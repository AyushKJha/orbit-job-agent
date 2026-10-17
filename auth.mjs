import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DATA} from './config.mjs';
import {promisify} from 'node:util';
const scrypt=promisify(crypto.scrypt),file=path.join(DATA,'accounts.json'),attempts=new Map(),otpPending=new Map(),otpEmailRates=new Map(),otpIpRates=new Map();
const read=()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file)): {users:[],sessions:[]};
const save=db=>{fs.writeFileSync(file+'.tmp',JSON.stringify(db),{mode:0o600});fs.renameSync(file+'.tmp',file);};
export const users=()=>read().users.map(({id,handle})=>({id,handle}));
export const otpConfigured=()=>Boolean(process.env.OTP_EMAIL_API_KEY&&process.env.OTP_EMAIL_FROM&&process.env.VAULT_KEY);
const otpDigest=(email,code)=>crypto.createHmac('sha256',process.env.VAULT_KEY||process.env.OTP_HMAC_KEY||'otp-disabled').update(email+'\0'+code).digest();
function rate(map,key,limit,windowMs){const now=Date.now(),entry=map.get(key);if(!entry||entry.until<=now){map.set(key,{count:1,until:now+windowMs});return true;}if(entry.count>=limit)return false;entry.count++;return true;}
function newSession(user){const raw=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(32).toString('hex'),latest=read();latest.sessions=latest.sessions.filter(x=>x.expires>Date.now());latest.sessions.push({hash:crypto.createHash('sha256').update(raw).digest('hex'),userId:user.id,csrf,expires:Date.now()+7*86400000});save(latest);return {raw,user:{id:user.id,handle:user.handle},csrf};}
export async function requestOtp(input,ip,deliver){
 if(!otpConfigured())throw Error('Email sign-in is not configured yet. Ask the Orbit operator to finish email setup.');
 const email=String(input.email||'').trim().toLowerCase();if(email.length>254||!/^[-a-z0-9.!#$%&'*+/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email))throw Error('Enter a valid email address.');
 if(!rate(otpIpRates,ip,10,60*60*1000)||!rate(otpEmailRates,email,4,15*60*1000))throw Error('Too many code requests. Wait a little and try again.');
 const current=otpPending.get(email);if(current&&current.resendAt>Date.now())throw Error('A code was just sent. Check your inbox, or wait a minute before requesting another.');
 const code=String(crypto.randomInt(0,1_000_000)).padStart(6,'0');
 await deliver({email,code});
 otpPending.set(email,{digest:otpDigest(email,code),expires:Date.now()+10*60*1000,resendAt:Date.now()+60*1000,attempts:0});
 return {sent:true,expiresIn:600};
}
export function verifyOtp(input){
 const email=String(input.email||'').trim().toLowerCase(),code=String(input.code||''),entry=otpPending.get(email);
 if(!entry||entry.expires<=Date.now()||!/^[0-9]{6}$/.test(code)){if(entry&&entry.expires<=Date.now())otpPending.delete(email);throw Error('That code is invalid or expired. Request a fresh one.');}
 const digest=otpDigest(email,code);if(!crypto.timingSafeEqual(entry.digest,digest)){entry.attempts++;if(entry.attempts>=5)otpPending.delete(email);throw Error('That code is invalid or expired. Request a fresh one.');}
 otpPending.delete(email);const db=read();let user=db.users.find(x=>x.handle===email);if(!user){user={id:crypto.randomUUID(),handle:email,email,createdAt:new Date().toISOString()};db.users.push(user);save(db);}else if(!user.email){user.email=email;save(db);}
 return newSession(user);
}
function validate(input){const handle=String(input.handle||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9@._+-]{2,63}$/.test(handle)||typeof input.password!=='string'||input.password.length<12||input.password.length>128)throw Error('Use a 3–64 character username and a password of 12–128 characters.');return handle;}
export async function authenticate(input,signup,ip){if(signup&&process.env.NODE_ENV!=='test')throw Error('Create your Orbit account with an email sign-in code.');const handle=validate(input),key=ip+'|'+handle,entry=attempts.get(key);if(entry&&entry.until>Date.now()&&entry.count>=5)throw Error('Too many attempts. Try again in 15 minutes.');const db=read();let user=db.users.find(x=>x.handle===handle);if(signup){if(user)throw Error('This username is already registered.');const salt=crypto.randomBytes(16).toString('hex'),digest=await scrypt(input.password,salt,64);user={id:crypto.randomUUID(),handle,salt,passwordHash:digest.toString('hex'),createdAt:new Date().toISOString()};const latest=read();if(latest.users.some(x=>x.handle===handle))throw Error('This username is already registered.');latest.users.push(user);save(latest);}else{const salt=user?.salt||'dummy-salt',digest=await scrypt(input.password,salt,64);if(!user||!user.passwordHash||!crypto.timingSafeEqual(digest,Buffer.from(user.passwordHash,'hex'))){attempts.set(key,{count:(entry?.until>Date.now()?entry.count:0)+1,until:Date.now()+900000});throw Error('Username or password is incorrect.');}}attempts.delete(key);return newSession(user);}
export function session(req){const raw=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('orbit_session='))?.slice(14);if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;const db=read(),match=db.sessions.find(x=>x.hash===crypto.createHash('sha256').update(raw).digest('hex')&&x.expires>Date.now());if(!match)return null;const user=db.users.find(x=>x.id===match.userId);return user?{...match,user:{id:user.id,handle:user.handle}}:null;}
export function logout(req){const current=session(req);if(current){const db=read();db.sessions=db.sessions.filter(x=>x.hash!==current.hash);save(db);}}
export const cookie=(raw,secure)=>'orbit_session='+raw+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+ (raw?'604800':'0')+(secure?'; Secure':'');

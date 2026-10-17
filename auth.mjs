import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DATA} from './config.mjs';
import {promisify} from 'node:util';
const scrypt=promisify(crypto.scrypt),file=path.join(DATA,'accounts.json'),attempts=new Map(),createRates=new Map();
const read=()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file)): {users:[],sessions:[]};
const save=db=>{fs.writeFileSync(file+'.tmp',JSON.stringify(db),{mode:0o600});fs.renameSync(file+'.tmp',file);};
export const users=()=>read().users.map(({id,handle})=>({id,handle}));
function rate(map,key,limit,windowMs){const now=Date.now(),entry=map.get(key);if(!entry||entry.until<=now){map.set(key,{count:1,until:now+windowMs});return true;}if(entry.count>=limit)return false;entry.count++;return true;}
function newSession(user){const raw=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(32).toString('hex'),latest=read();latest.sessions=latest.sessions.filter(x=>x.expires>Date.now());latest.sessions.push({hash:crypto.createHash('sha256').update(raw).digest('hex'),userId:user.id,csrf,expires:Date.now()+7*86400000});save(latest);return {raw,user:{id:user.id,handle:user.handle},csrf};}
const validEmail=value=>value.length<=254&&/^[-a-z0-9.!#$%&'*+/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value);
export async function createAccessKeyAccount(input,ip){
 const email=String(input.email||'').trim().toLowerCase(),accessKey=String(input.accessKey||'');
 if(!validEmail(email))throw Error('Enter a valid email address.');
 if(!/^orb-[a-f0-9]{64}$/i.test(accessKey))throw Error('Generate a new Orbit access key and try again.');
 if(!rate(createRates,ip,5,60*60*1000))throw Error('Too many account attempts. Wait a little and try again.');
 const handle=email,db=read();if(db.users.some(x=>x.handle===handle))throw Error('An account already uses this email. Sign in with its saved key or choose existing username/password sign-in.');
 const salt=crypto.randomBytes(16).toString('hex'),digest=await scrypt(accessKey,salt,64),latest=read();
 if(latest.users.some(x=>x.handle===handle))throw Error('An account already uses this email.');
 const user={id:crypto.randomUUID(),handle,email,salt,passwordHash:digest.toString('hex'),createdAt:new Date().toISOString()};latest.users.push(user);save(latest);return newSession(user);
}
function validate(input){const handle=String(input.handle||'').trim().toLowerCase(),isEmail=validEmail(handle);if(!(isEmail||/^[a-z0-9][a-z0-9@._+-]{2,63}$/.test(handle))||typeof input.password!=='string'||input.password.length<12||input.password.length>128)throw Error('Enter your email or username and a valid password/access key.');return handle;}
export async function authenticate(input,signup,ip){if(signup&&process.env.NODE_ENV!=='test')throw Error('Create an account using the Orbit access-key setup.');const handle=validate(input),key=ip+'|'+handle,entry=attempts.get(key);if(entry&&entry.until>Date.now()&&entry.count>=5)throw Error('Too many attempts. Try again in 15 minutes.');const db=read();let user=db.users.find(x=>x.handle===handle);if(signup){if(user)throw Error('This username is already registered.');const salt=crypto.randomBytes(16).toString('hex'),digest=await scrypt(input.password,salt,64);user={id:crypto.randomUUID(),handle,salt,passwordHash:digest.toString('hex'),createdAt:new Date().toISOString()};const latest=read();if(latest.users.some(x=>x.handle===handle))throw Error('This username is already registered.');latest.users.push(user);save(latest);}else{const salt=user?.salt||'dummy-salt',digest=await scrypt(input.password,salt,64);if(!user||!user.passwordHash||!crypto.timingSafeEqual(digest,Buffer.from(user.passwordHash,'hex'))){attempts.set(key,{count:(entry?.until>Date.now()?entry.count:0)+1,until:Date.now()+900000});throw Error('Email/username or access key is incorrect.');}}attempts.delete(key);return newSession(user);}
export function session(req){const raw=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('orbit_session='))?.slice(14);if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;const db=read(),match=db.sessions.find(x=>x.hash===crypto.createHash('sha256').update(raw).digest('hex')&&x.expires>Date.now());if(!match)return null;const user=db.users.find(x=>x.id===match.userId);return user?{...match,user:{id:user.id,handle:user.handle}}:null;}
export function logout(req){const current=session(req);if(current){const db=read();db.sessions=db.sessions.filter(x=>x.hash!==current.hash);save(db);}}
export const cookie=(raw,secure)=>'orbit_session='+raw+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+ (raw?'604800':'0')+(secure?'; Secure':'');

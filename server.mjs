import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {ROOT,DATA} from './config.mjs';
import {read,write,exclusive,audit} from './store.mjs';
import {stats,hash,required,safeURL,id} from './core.mjs';
import * as service from './service.mjs';
import * as mail from './gmail.mjs';
import * as auth from './auth.mjs';
import {inWorkspace,apiKey,modelName,saveSecrets,seal} from './workspace.mjs';
import {runDailySearch,searchReadiness} from './scheduler.mjs';
import {converse} from './chat.mjs';
import {restoreCloud,flushCloud} from './cloud.mjs';
import {aiReady} from './agent.mjs';
import {localMode,localModel,broker,workerAuthorized} from './local-ai.mjs';
await restoreCloud();
const port=Number(process.env.PORT||8765),hosted=Boolean(process.env.APP_URL),origin=process.env.APP_URL?.replace(/\/$/,'')||'http://127.0.0.1:'+port,localToken=crypto.randomBytes(32).toString('hex');
if(process.env.NODE_ENV==='production'&&(!hosted||!origin.startsWith('https://')||!process.env.VAULT_KEY))throw Error('Production needs an HTTPS APP_URL and a 64-character hexadecimal VAULT_KEY.');
if(process.env.EPHEMERAL_HOSTING==='true'&&!process.env.SUPABASE_URL&&!process.env.STORAGE_GATEWAY_URL)throw Error('Free ephemeral hosting requires durable cloud storage before accepting accounts.');
if(process.env.NODE_ENV==='production')seal({startupCheck:true});
const publicState=csrf=>{const s=read();return {...s,hosted,searchBlocker:searchReadiness(s,aiReady()),outreach:s.outreach.map(({raw,...x})=>({...x,previewHash:hash(raw||'')})),audit:s.audit.slice(-100),stats:stats(s),connection:{googleConfigured:mail.configured(),gmailConnected:mail.connected(),apiConfigured:aiReady(),model:localMode()?localModel():modelName(),provider:localMode()?'local':'openai',localStatus:localMode()?broker.status():null},csrfToken:csrf};};
const dailySearch=force=>runDailySearch({readState:read,saveState:write,search:service.searchJobs,hasKey:aiReady(),force});
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req,max=16000000){let length=0,chunks=[];for await(const chunk of req){length+=chunk.length;if(length>max)throw Error('Request too large.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
function saveProfile(input){const s=read();s.profile={name:required(input.name,'Name',200),roles:required(input.roles,'Roles',1000),locations:String(input.locations||'').slice(0,1000),preferences:String(input.preferences||'').slice(0,3000),portfolio:input.portfolio?safeURL(input.portfolio):''};if(input.portfolio&&!s.profile.portfolio)throw Error('Use a public HTTPS portfolio URL.');audit(s,'profile_saved');return {saved:true};}
function saveSettings(input){const s=read(),limit=Number(input.dailyLimit),minutes=Number(input.pollMinutes),searchLimit=Number(input.searchLimit??s.settings.searchLimit),time=input.dailySearchTime??s.settings.dailySearchTime;if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(minutes)||minutes<5||minutes>1440)throw Error('Daily limit must be 1–100; sync interval must be 5–1440 minutes.');if(!Number.isInteger(searchLimit)||searchLimit<1||searchLimit>30||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Choose 1–30 jobs per search and a valid daily time.');new Intl.DateTimeFormat('en',{timeZone:input.timezone});for(const field of ['dailySearchEnabled','pollEnabled'])if(input[field]!==undefined&&typeof input[field]!=='boolean')throw Error('Automation settings must be on or off.');s.settings={...s.settings,dailyLimit:limit,pollMinutes:minutes,timezone:input.timezone,pollEnabled:input.pollEnabled===true,searchLimit,dailySearchTime:time,dailySearchEnabled:input.dailySearchEnabled??s.settings.dailySearchEnabled};audit(s,'settings_saved');return s.settings;}
async function chatAction(action){
 if(action.type==='search_jobs')return dailySearch(true);
 if(action.type==='rank_jobs'){await service.rankJobs();return {ranked:read().jobs.length};}
 if(action.type==='review_materials')return service.suggestions();
 if(action.type==='sync_replies')return service.syncReplies(port);
 if(action.type==='show_results')return {jobs:read().jobs.slice(0,10).map(({id,company,title,score,url})=>({id,company,title,score,url}))};
 if(action.type==='show_stats')return stats(read());
 if(action.type==='update_profile'){const patch=action.profile||{},allowed=['name','roles','locations','preferences','portfolio'];if(Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('Unsupported profile field.');return saveProfile({...read().profile,...patch});}
 if(action.type==='update_schedule'){const patch=action.schedule||{},allowed=['dailySearchEnabled','dailySearchTime','searchLimit','timezone','pollEnabled','pollMinutes'];if(Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('Unsupported schedule field.');return saveSettings({...read().settings,...patch});}
 if(action.type==='create_draft'){const results=[];for(const jobId of action.jobIds){const o=await service.createDraft(jobId,[],port);results.push({id:o.id,subject:o.subject,to:o.to,status:o.status,attachments:[]});}return results;}
 throw Error('Unsupported conversational action.');
}
function startChat(input){const s=read(),message=required(input.message,'Message',8000),requestId=required(input.requestId,'Request ID',80);s.tasks=s.tasks||[];const existing=s.tasks.find(t=>t.requestId===requestId);if(existing)return {taskId:existing.id};if(s.tasks.some(t=>['queued','running'].includes(t.status)))throw Error('A task is already running. Wait for it to finish before starting another.');const task={id:id(),requestId,message,status:'queued',createdAt:new Date().toISOString()};s.tasks.push(task);s.tasks=s.tasks.slice(-100);write(s);
 exclusive(async()=>{let latest=read(),current=latest.tasks.find(t=>t.id===task.id);current.status='running';current.startedAt=new Date().toISOString();write(latest);try{const response=await converse(message,{execute:async action=>{const currentState=read(),t=currentState.tasks.find(x=>x.id===task.id);t.step=action.type;write(currentState);return chatAction(action);}});latest=read();current=latest.tasks.find(t=>t.id===task.id);current.status=response.failed||response.actions.some(x=>x.status==='failed')?'failed':'completed';current.responseId=response.id;}catch(e){latest=read();current=latest.tasks.find(t=>t.id===task.id);current.status='failed';current.error=String(e.message).replace(/sk-[\w-]+/g,'[redacted]');}current.completedAt=new Date().toISOString();write(latest);}).catch(()=>{});return {taskId:task.id};
}
async function routeAction(route,input,req){
 if(route==='/api/profile')return saveProfile(input);
 if(route==='/api/settings')return saveSettings(input);
 if(route==='/api/chat')return startChat(input);
 if(route==='/api/automation'){const s=read();if(typeof input.enabled!=='boolean')throw Error('Choose on or off.');s.settings.dailySearchEnabled=input.enabled;audit(s,'daily_search_toggled',{enabled:input.enabled});return {};}
 if(route==='/api/api-key'){if(typeof input.key!=='string'||!/^sk-[A-Za-z0-9_-]+$/.test(input.key))throw Error('Invalid API key format.');if(!['gpt-6-astra','gpt-6-luna'].includes(input.model))throw Error('Choose an available model.');saveSecrets({apiKey:input.key,model:input.model});return {saved:true};}
 if(route==='/api/google-client'){if(mail.connected())throw Error('Disconnect Gmail before replacing the OAuth client.');mail.saveClient(input);return {};}
 if(route==='/api/gmail/connect')return {url:mail.authURL(port)};
 if(route==='/api/gmail/disconnect'){await mail.disconnect(port);return {};}
 if(route==='/api/documents'){if(read().documents.length>=20)throw Error('Maximum 20 documents per workspace.');return service.uploadDocument(input);}
 if(route==='/api/jobs/add')return service.addJob(input);
 if(route==='/api/jobs/search')return dailySearch(true);
 if(route==='/api/jobs/rank')return service.rankJobs();
 if(route==='/api/jobs/contact')return service.confirmContact(input.jobId,input);
 if(route==='/api/drafts/create')return service.createDraft(input.jobId,input.attachmentIds,port);
 if(route==='/api/drafts/edit')return service.editDraft(input.id,input,port);
 if(route==='/api/drafts/approve')return service.approveDraft(input.id,input.previewHash,port);
 if(route==='/api/drafts/send')return service.sendApproved(input.ids,port);
 if(route==='/api/replies/sync')return service.syncReplies(port);
 if(route==='/api/replies/correct'){const s=read(),o=s.outreach.find(x=>x.id===input.outreachId),r=o?.replies.find(x=>x.id===input.replyId);if(!r||!['positive','negative','neutral','uncertain','automatic','bounce'].includes(input.category))throw Error('Invalid reply correction.');r.originalCategory=r.originalCategory||r.category;r.category=input.category;r.correctedAt=new Date().toISOString();audit(s,'reply_corrected',{replyId:r.id});return {};}
 if(route==='/api/suppress'){const s=read(),o=s.outreach.find(x=>x.id===input.id);if(!o)throw Error('Outreach not found.');if(!s.suppressed.includes(o.to))s.suppressed.push(o.to);audit(s,'recipient_suppressed',{outreachId:o.id});return {};}
 if(route==='/api/suggestions')return service.suggestions();
 if(route==='/api/auth/logout'){auth.logout(req);return {loggedOut:true};}
 throw Error('Unknown action.');
}
const loginRates=new Map();
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!==new URL(origin).host)throw Error('Invalid host.');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');if(origin.startsWith('https://'))res.setHeader('Strict-Transport-Security','max-age=31536000');
  const url=new URL(req.url,origin),current=hosted?auth.session(req):null;
  if(req.method==='GET'&&url.pathname==='/health'){json(res,{status:'ok',project:'Orbit'});return;}
  if(req.method==='GET'&&['/','/app.js','/style.css','/auth.js','/privacy'].includes(url.pathname)){const name=url.pathname==='/'?'index.html':url.pathname==='/privacy'?'privacy.html':url.pathname.slice(1);res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});res.end(fs.readFileSync(path.join(ROOT,'public',name)));return;}
  if(req.method==='GET'&&url.pathname==='/api/auth/me'){json(res,{hosted,user:current?.user||null,csrfToken:current?.csrf||null});return;}
  if(req.method==='POST'&&['/api/auth/login','/api/auth/register'].includes(url.pathname)){if(!hosted)throw Error('Local mode does not require a login.');if(req.headers.origin!==origin)throw Error('Invalid origin.');const ip=req.socket.remoteAddress,rate=loginRates.get(ip);if(rate?.until>Date.now()&&rate.count>=40)throw Error('Too many authentication requests. Try again later.');loginRates.set(ip,{count:(rate?.until>Date.now()?rate.count:0)+1,until:Date.now()+900000});const result=await auth.authenticate(await body(req,4096),url.pathname.endsWith('/register'),ip);await flushCloud();res.setHeader('Set-Cookie',auth.cookie(result.raw,origin.startsWith('https://')));json(res,{user:result.user});return;}
  if(req.method==='POST'&&url.pathname==='/internal/schedule'){const expected=process.env.CRON_SECRET||'',provided=req.headers.authorization||'';if(!expected||!crypto.timingSafeEqual(crypto.createHash('sha256').update(provided).digest(),crypto.createHash('sha256').update('Bearer '+expected).digest())){json(res,{error:'Unauthorized'},401);return;}await tick();await flushCloud();json(res,{ok:true});return;}
  if(req.method==='POST'&&url.pathname.startsWith('/internal/worker/')){
   if(process.env.AI_PROVIDER!=='local-worker'||!workerAuthorized(req.headers.authorization)){json(res,{error:'Unauthorized'},401);return;}
   const input=await body(req,200000);
   if(url.pathname==='/internal/worker/heartbeat'){broker.heartbeat(input.model);json(res,{ok:true});return;}
   if(url.pathname==='/internal/worker/poll'){json(res,{job:broker.claim()});return;}
   if(url.pathname==='/internal/worker/result'){json(res,{accepted:broker.finish(input.id,input.result,input.error)});return;}
   json(res,{error:'Not found'},404);return;
  }
  if(hosted&&!current){json(res,{error:'Sign in to your Orbit workspace.'},401);return;}
  const context=fn=>current?inWorkspace(current.user.id,fn):fn();
  await context(async()=>{
   if(url.pathname==='/oauth/callback'&&req.method==='GET'){await exclusive(async()=>{const s=read(),account=await mail.callback(url.searchParams.get('code'),url.searchParams.get('state'),s.gmailAccount||s.outreach[0]?.from);s.gmailAccount=account;audit(s,'gmail_connected',{account});});res.writeHead(200,{'Content-Type':'text/html'});res.end('<p>Gmail connected to your Orbit workspace.</p><a href="/">Return to Orbit</a>');return;}
   const csrf=current?.csrf||localToken;
   if(req.method==='GET'&&url.pathname==='/api/state'){if(req.headers['sec-fetch-site']==='cross-site')throw Error('Invalid request origin.');json(res,publicState(csrf));return;}
   if(req.method==='GET'&&url.pathname==='/api/export'){if(req.headers['x-app-token']!==csrf)throw Error('Invalid session.');res.setHeader('Content-Disposition','attachment; filename="orbit-workspace.json"');const s=read();json(res,{profile:s.profile,settings:s.settings,jobs:s.jobs,outreach:s.outreach.map(({raw,...o})=>o),chat:s.chat||[],suggestions:s.suggestions});return;}
   if(req.method!=='POST'||!url.pathname.startsWith('/api/')){json(res,{error:'Not found'},404);return;}
   if(req.headers.origin!==origin||req.headers['x-app-token']!==csrf)throw Error('Invalid request origin or session. Refresh the app.');
   const input=await body(req);const result=await exclusive(()=>routeAction(url.pathname,input,req));
   if(url.pathname==='/api/auth/logout')res.setHeader('Set-Cookie',auth.cookie('',origin.startsWith('https://')));
   json(res,{ok:true,result:result??null});
  });
 }catch(e){json(res,{error:String(e.message||'Action failed').replace(/sk-[\w-]+/g,'[redacted]')},400);}
});
function recoverWorkspace(){const s=read();let changed=false;if(s.searchRuntime?.status==='running'){s.searchRuntime.status='failed';s.searchRuntime.error='The app stopped during the last search. Run a search manually to try again.';changed=true;}for(const t of s.tasks||[]){if(['queued','running'].includes(t.status)){t.status='failed';t.error='Server restarted during this task. Review its receipts before trying again.';changed=true;}}if(changed)write(s);}
if(hosted){for(const user of auth.users())inWorkspace(user.id,recoverWorkspace);}else recoverWorkspace();
server.listen(port,hosted?'0.0.0.0':'127.0.0.1',()=>console.log('Job Outreach Agent: '+origin));
let ticking=false;
async function workspaceTick(){try{await dailySearch(false);}catch(e){console.error('Daily discovery failed: '+String(e.message).replace(/sk-[\w-]+/g,'[redacted]'));}const s=read();if(s.settings.pollEnabled&&mail.connected()&&(!s.lastSyncAt||Date.now()-new Date(s.lastSyncAt).getTime()>=s.settings.pollMinutes*60000))await service.syncReplies(port);}
async function tick(){if(ticking)return;ticking=true;try{if(hosted){for(const user of auth.users()){try{await inWorkspace(user.id,()=>exclusive(workspaceTick));}catch(e){console.error('Workspace automation failed: '+String(e.message).replace(/sk-[\w-]+/g,'[redacted]'));}}}else await exclusive(workspaceTick);}catch(e){console.error('Automation failed: '+String(e.message).replace(/sk-[\w-]+/g,'[redacted]'));}finally{ticking=false;}}
tick();const timer=setInterval(tick,60000);timer.unref();
process.on('SIGTERM',()=>{clearInterval(timer);server.close();setTimeout(()=>process.exit(0),10000).unref();});


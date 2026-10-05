// Outbound-only worker: never exposes Ollama, accepts shell commands, or sends email.
import fs from 'node:fs';
import {ollamaInfer} from './local-ai.mjs';
const file=process.argv[2];if(!file)throw Error('Usage: node local-worker.mjs /path/to/private-worker.json');
const config=JSON.parse(fs.readFileSync(file,'utf8')),url=new URL(config.url);
if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Use your public HTTPS Orbit origin.');
if(!/^[a-f0-9]{64}$/.test(config.token||''))throw Error('Missing worker credential.');
const model=config.model||'qwen3:4b',pause=ms=>new Promise(r=>setTimeout(r,ms));
async function request(route,input){const r=await fetch(url.origin+'/internal/worker/'+route,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(input),redirect:'error',signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('Orbit worker endpoint returned '+r.status);return r.json();}
async function heartbeat(){const r=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(5000)}),v=await r.json();if(!v.models?.some(x=>x.name===model))throw Error('Install '+model+' in Ollama first.');await request('heartbeat',{model});}
setInterval(()=>heartbeat().catch(()=>{}),15000).unref();
console.log('Orbit Local AI worker started. Keep this computer awake.');
while(true){try{await heartbeat();const {job}=await request('poll',{});if(!job){await pause(5000);continue;}let result,error;try{result=await ollamaInfer(job,{model});}catch(e){error=e.message;}await request('result',{id:job.id,result,error});console.log(new Date().toISOString(),error?'Inference failed':'Inference completed');}catch(e){console.error('Worker unavailable: '+e.message);await pause(15000);}}

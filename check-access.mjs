import './config.mjs';
import {MODEL, DATA} from './config.mjs';
import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
const client = new OpenAI({maxRetries:0,timeout:120000});
let id;
try {
  const events=await client.beta.agents.sessions.create({agent:{model:MODEL,instructions:'Perform only the requested access check.'},environment:{type:'openai_hosted'},input:'Run a command that prints JOB_AGENT_ACCESS_OK. Return that exact output.',stream:true});
  events.withResultCollection();
  for await(const e of events) {id=e.session_id || e.session?.id || id; if(id) fs.writeFileSync(path.join(DATA,'access-session.json'),JSON.stringify({id}));}
  const result=await events.finalResult(); id=result.session_id || id;
  console.log(JSON.stringify({session_id:id,turn_id:result.turn_id,output:result.output_text}));
} catch(e) {console.error(JSON.stringify({status:e.status || null,code:e.code || null,message:e.message?.replace(/sk-[\w-]+/g,'[redacted]')}));process.exitCode=1;}
finally {if(id) {try{await client.beta.agents.sessions.delete(id);console.log('Access-check session deleted.');}catch{console.log('Session cleanup pending: '+id);}}}

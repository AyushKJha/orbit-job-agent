import fs from 'node:fs';
import path from 'node:path';
import {dataDir,workspaceId} from './workspace.mjs';
const stateFile=()=>path.join(dataDir(),'state.json');
export const defaultSettings={dailyLimit:20,timezone:'Asia/Kolkata',pollMinutes:15,pollEnabled:false,dailySearchEnabled:true,dailySearchTime:'09:00',searchLimit:20};
export function read(){const file=stateFile();if(fs.existsSync(file)){const state=JSON.parse(fs.readFileSync(file,'utf8'));state.settings={...defaultSettings,...state.settings};return state;}return {profile:{name:'',roles:'',locations:'',preferences:'',portfolio:''},documents:[],jobs:[],outreach:[],suppressed:[],suggestions:null,audit:[],chat:[],settings:{...defaultSettings}};}
export function write(state){const file=stateFile();if(fs.existsSync(file)){const existing=JSON.parse(fs.readFileSync(file));if(existing.aiUsage&&(!state.aiUsage||(existing.aiUsage.day===state.aiUsage.day&&existing.aiUsage.calls>state.aiUsage.calls)))state.aiUsage=existing.aiUsage;}fs.writeFileSync(file+'.tmp',JSON.stringify(state,null,2));fs.renameSync(file+'.tmp',file);}
export function audit(state,action,detail={}){state.audit.push({at:new Date().toISOString(),action,...detail});write(state);}
const queues=new Map();
export function exclusive(fn){const key=workspaceId(),next=(queues.get(key)||Promise.resolve()).then(fn);queues.set(key,next.catch(()=>{}));return next;}

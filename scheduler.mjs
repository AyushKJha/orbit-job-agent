import {dayKey} from './core.mjs';
export function searchReadiness(state,hasKey){if(!hasKey)return 'Add your OpenAI API key';if(!state.profile.roles?.trim())return 'Save your target roles';if(!state.documents.length)return 'Upload your CV or resume';return null;}
export function searchDue(state,now=new Date()){
 if(!state.settings.dailySearchEnabled)return false;
 const zone=state.settings.timezone,day=dayKey(now,zone);
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const time=parts.find(x=>x.type==='hour').value+':'+parts.find(x=>x.type==='minute').value;
 return time>=state.settings.dailySearchTime&&state.searchRuntime?.lastAttemptDay!==day;
}
export async function runDailySearch({readState,saveState,search,hasKey,now=new Date(),force=false}){
 const state=readState();const reason=searchReadiness(state,hasKey);
 if(reason){if(force)throw Error(reason+' before starting a job search.');return {skipped:reason};}
 if(!force&&!searchDue(state,now))return {skipped:'Not due'};
 const runtime={lastAttemptDay:dayKey(now,state.settings.timezone),startedAt:now.toISOString(),status:'running',mode:force?'manual':'daily'};
 state.searchRuntime=runtime;saveState(state);
 try{const result=await search();const latest=readState();latest.searchRuntime={...runtime,status:'completed',completedAt:new Date().toISOString(),added:result.added};saveState(latest);return result;}
 catch(e){const latest=readState();latest.searchRuntime={...runtime,status:'failed',completedAt:new Date().toISOString(),error:String(e.message).replace(/sk-[\w-]+/g,'[redacted]')};saveState(latest);throw e;}
}

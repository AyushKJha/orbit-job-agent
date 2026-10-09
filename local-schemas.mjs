const str={type:'string'},text={type:'string',minLength:1},num={type:'number'},bool={type:'boolean'},strings={type:'array',items:str};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const list=items=>({type:'array',items});
export function responseSchema(task){
 if(task.includes('"actions"')&&task.includes('"reply"'))return object({reply:str,actions:{type:'array',maxItems:5,items:object({type:{type:'string',enum:['search_jobs','rank_jobs','review_materials','sync_replies','create_draft','update_profile','update_schedule','show_results','show_stats']},jobIds:strings,profile:object({name:str,roles:str,locations:str,preferences:str,portfolio:str},[]),schedule:object({dailySearchEnabled:bool,dailySearchTime:str,searchLimit:num,timezone:str,pollEnabled:bool,pollMinutes:num},[])},['type'])}});
 if(task.includes('"category"')&&task.includes('"optOut"'))return object({category:{type:'string',enum:['positive','negative','neutral','automatic','bounce','uncertain']},confidence:num,reason:str,evidence:str,optOut:bool});
 if(task.includes('"recommendations"'))return object({summary:text,recommendations:{...list(object({area:{type:'string',enum:['cv','resume','portfolio','skills','outreach']},priority:{type:'string',enum:['high','medium','low']},change:text,evidence:text,basis:{type:'string',enum:['direct_feedback','job_requirement','hypothesis']},example:text})),minItems:1,maxItems:4},experiments:{...list(object({action:text,measure:text,reviewAfter:text})),maxItems:2}});
 if(task.includes('"subject"')&&task.includes('"claims"'))return object({subject:text,body:text,claims:list(object({claim:text,evidence:text}))});
 if(task.includes('"jobs"')&&task.includes('"id"'))return object({jobs:list(object({id:str,score:num,reasons:strings,gaps:strings}))});
 return 'json';
}

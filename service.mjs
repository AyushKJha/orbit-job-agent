import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import {PDFParse} from 'pdf-parse';
import {simpleParser} from 'mailparser';
import {dataDir} from './workspace.mjs';
import {read,write,audit} from './store.mjs';
import {id,hash,email,required,safeURL,mime,assertSend,header,bodyText,autoCategory} from './core.mjs';
import {runAgent,profileData,jobTask,draftTask,replyTask,feedbackTask} from './agent.mjs';
import * as mail from './gmail.mjs';
import {flushCloud} from './cloud.mjs';
const now=()=>new Date().toISOString();
const attachmentDir=()=>{const dir=path.join(dataDir(),'documents');fs.mkdirSync(dir,{recursive:true});return dir;};
export async function verifyPreview(item,raw,documents){
 const parsed=await simpleParser(Buffer.from(raw,'base64url'),{skipHtmlToText:true,skipTextToHtml:true});
 const normalize=v=>String(v||'').replace(/\r\n/g,'\n').trim();
 const expected=item.attachmentIds.map(docId=>{const d=documents.find(x=>x.id===docId);return {name:d.name.replace(/[^a-zA-Z0-9._-]/g,'_'),hash:hash(fs.readFileSync(path.join(attachmentDir(),docId)))};});
 if(parsed.to?.value?.length!==1||parsed.to.value[0].address?.toLowerCase()!==item.to.toLowerCase()||parsed.from?.value?.length!==1||parsed.from.value[0].address?.toLowerCase()!==item.from.toLowerCase()||parsed.cc?.value?.length||parsed.bcc?.value?.length||parsed.subject!==item.subject||normalize(parsed.text)!==normalize(item.body)||parsed.messageId!=='<'+item.messageId+'>'||parsed.attachments.length!==expected.length||parsed.attachments.some((a,i)=>a.filename!==expected[i].name||hash(a.content)!==expected[i].hash))throw Error('Gmail draft contents differ from the preview. Review the draft before proceeding.');
 return raw;
}
export async function uploadDocument(input){
 const name=required(input.name,'File name',200), ext=path.extname(name).toLowerCase();
 if(!['.pdf','.docx','.txt','.md'].includes(ext))throw Error('Use PDF, DOCX, TXT or Markdown.');
 const bytes=Buffer.from(required(input.base64,'File',15000000),'base64');if(bytes.length>10*1024*1024)throw Error('Maximum file size is 10 MB.');
 const used=read().documents.reduce((total,d)=>total+(fs.existsSync(path.join(attachmentDir(),d.id))?fs.statSync(path.join(attachmentDir(),d.id)).size:0),0);if(used+bytes.length>50*1024*1024)throw Error('This workspace has reached its 50 MB document limit.');
 let text;
 if(ext==='.pdf'){const parser=new PDFParse({data:bytes});try{text=(await parser.getText()).text;}finally{await parser.destroy();}}
 else if(ext==='.docx')text=(await mammoth.extractRawText({buffer:bytes})).value;
 else text=bytes.toString('utf8');
 if(!text?.trim())throw Error('No readable text found. Use a text-based PDF or paste your content.');
 const state=read(),doc={id:id(),name,text:text.slice(0,80000),uploadedAt:now()};
 fs.writeFileSync(path.join(attachmentDir(),doc.id),bytes);state.documents.push(doc);audit(state,'document_uploaded',{documentId:doc.id});return doc;
}
function jobRecord(j){const url=safeURL(j.url);if(!url)throw Error('Job needs an HTTPS source URL.');return {id:id(),company:required(j.company,'Company',200),title:required(j.title,'Job title',200),location:String(j.location||''),url,score:Math.max(0,Math.min(100,Number(j.score)||0)),reasons:Array.isArray(j.reasons)?j.reasons.map(String):[],gaps:Array.isArray(j.gaps)?j.gaps.map(String):[],description:required(j.description||j.evidence,'Job description',20000),contactEmail:email(j.contactEmail)?j.contactEmail.toLowerCase():'',contactSource:safeURL(j.contactSource),evidence:String(j.evidence||''),checkedAt:now(),contactConfirmed:false};}
export function addJob(input){const s=read(),j=jobRecord(input);if(s.jobs.some(x=>x.url===j.url))throw Error('Job already exists.');s.jobs.push(j);audit(s,'job_added',{jobId:j.id});return j;}
export function mergeJobs(state,candidates,limit){let added=0;for(const candidate of candidates.slice(0,limit)){const j=jobRecord(candidate);const canonical=v=>{const u=new URL(v);u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_|^(ref|source)$/i.test(key))u.searchParams.delete(key);return u.href.replace(/\/$/,'');};if(!state.jobs.some(x=>canonical(x.url)===canonical(j.url))){state.jobs.push(j);added++;}}state.jobs.sort((a,b)=>b.score-a.score);return added;}
export async function searchJobs(){const s=read();required(s.profile.roles,'Target roles');if(!s.documents.length)throw Error('Upload your resume or CV first.');const limit=s.settings.searchLimit;const task=jobTask.replace('up to 10','up to '+limit)+' Find NEW opportunities; exclude the knownJobURLs. Search multiple relevant companies and role synonyms. Return fewer matches if verified results are insufficient.';const result=await runAgent(task,{...profileData(s),requestedCount:limit,knownJobURLs:s.jobs.map(x=>x.url)},{search:true});if(!Array.isArray(result.jobs))throw Error('AI returned invalid job results.');const added=mergeJobs(s,result.jobs,limit);audit(s,'jobs_searched',{added});return {added};}
export async function rankJobs(){const s=read();const result=await runAgent('Rank these supplied jobs against the applicant. Return {"jobs":[{"id":"original ID","score":0,"reasons":["supported fit"],"gaps":["missing requirements"]}]}. Use scores 0..100, no invented qualifications.',{...profileData(s),jobs:s.jobs});if(!Array.isArray(result.jobs))throw Error('Invalid ranking result.');for(const r of result.jobs){const j=s.jobs.find(x=>x.id===r.id);if(j){j.score=Math.max(0,Math.min(100,Number(r.score)||0));j.reasons=Array.isArray(r.reasons)?r.reasons.map(String):[];j.gaps=Array.isArray(r.gaps)?r.gaps.map(String):[];}}s.jobs.sort((a,b)=>b.score-a.score);audit(s,'jobs_ranked');}
export function confirmContact(jobId,input){const s=read(),j=s.jobs.find(x=>x.id===jobId);if(!j)throw Error('Job not found.');if(!email(input.email)||!safeURL(input.source)||input.confirmed!==true)throw Error('Confirm a valid recipient and public recruiting contact source.');j.contactEmail=input.email.toLowerCase();j.contactSource=safeURL(input.source);j.contactConfirmed=true;audit(s,'contact_confirmed',{jobId});}
export async function createDraft(jobId,attachmentIds,port){
 const s=read(),j=s.jobs.find(x=>x.id===jobId);if(!j)throw Error('Job not found.');
 if(!j.contactConfirmed)throw Error('Review and confirm the recruiting contact first.');
 if(s.suppressed.includes(j.contactEmail))throw Error('Recipient is suppressed.');
 if(s.outreach.some(x=>x.to===j.contactEmail))throw Error('An outreach record already exists for this recipient.');
 const attachments=(attachmentIds||[]).map(docId=>{const doc=s.documents.find(x=>x.id===docId);if(!doc)throw Error('Attachment not found.');return {id:doc.id,name:doc.name,bytes:fs.readFileSync(path.join(attachmentDir(),doc.id))};});
 const result=await runAgent(draftTask,{...profileData(s),job:j});
 const g=mail.gmail(port),profile=await g.users.getProfile({userId:'me'}),from=profile.data.emailAddress;
 const item={id:id(),jobId,to:j.contactEmail,subject:required(result.subject,'Subject',500),body:required(result.body,'Body',20000),claims:Array.isArray(result.claims)?result.claims:[],attachmentIds:attachments.map(a=>a.id),status:'creating',replies:[],createdAt:now(),from,messageId:id()+'@job-outreach.local'};
 item.raw=mime(item,from,attachments);s.outreach.push(item);audit(s,'draft_creation_started',{outreachId:item.id});await flushCloud();
 try{const draft=await g.users.drafts.create({userId:'me',requestBody:{message:{raw:item.raw}}});item.gmailDraftId=draft.data.id;write(s);const canonical=await g.users.drafts.get({userId:'me',id:item.gmailDraftId,format:'raw'});item.raw=await verifyPreview(item,canonical.data.message.raw,s.documents);item.status='draft';audit(s,'draft_created',{outreachId:item.id});return item;}
 catch(e){item.status='draft_unknown';audit(s,'draft_creation_unknown',{outreachId:item.id});throw Error('Gmail draft creation did not confirm. Check Gmail before creating another draft.');}
}
export async function editDraft(outreachId,input,port){const s=read(),item=s.outreach.find(x=>x.id===outreachId);if(!item||!['draft','approved'].includes(item.status))throw Error('Draft cannot be edited in its current state.');item.subject=required(input.subject,'Subject',500);item.body=required(input.body,'Body',20000);item.status='draft';item.approval=null;
 const attachments=item.attachmentIds.map(docId=>{const d=s.documents.find(x=>x.id===docId);return {name:d.name,bytes:fs.readFileSync(path.join(attachmentDir(),docId))};});item.raw=mime(item,item.from,attachments);audit(s,'draft_edited',{outreachId});
 await mail.gmail(port).users.drafts.update({userId:'me',id:item.gmailDraftId,requestBody:{message:{raw:item.raw}}});const canonical=await mail.gmail(port).users.drafts.get({userId:'me',id:item.gmailDraftId,format:'raw'});item.raw=await verifyPreview(item,canonical.data.message.raw,s.documents);write(s);return item;
}
export async function approveDraft(outreachId,expectedHash,port){const s=read(),item=s.outreach.find(x=>x.id===outreachId);if(!item||!['draft','approved'].includes(item.status))throw Error('Not an approvable draft.');if(hash(item.raw)!==expectedHash)throw Error('Your preview is stale. Refresh and review again.');const draft=await mail.gmail(port).users.drafts.get({userId:'me',id:item.gmailDraftId,format:'raw'});if(hash(draft.data.message.raw)!==hash(item.raw))throw Error('The draft was edited in Gmail. Save the desired contents in this app, then review again.');item.approval={at:now(),rawHash:hash(item.raw)};item.status='approved';audit(s,'draft_approved',{outreachId,hash:item.approval.rawHash});}
export async function sendApproved(ids,port){
 if(!Array.isArray(ids)||!ids.length||ids.length>100)throw Error('Select 1–100 approved drafts.');
 const results=[],g=mail.gmail(port);
 for(const outreachId of [...new Set(ids)]){
  const s=read(),item=s.outreach.find(x=>x.id===outreachId);
  try{
   if(!item)throw Error('Outreach not found.');const profile=await g.users.getProfile({userId:'me'});if(profile.data.emailAddress!==item.from)throw Error('Gmail account differs from the draft owner.');
   const draft=await g.users.drafts.get({userId:'me',id:item.gmailDraftId,format:'raw'});assertSend(item,draft.data.message.raw,s);
   item.status='sending';item.sendAttemptAt=now();audit(s,'send_started',{outreachId});await flushCloud();
   try{const sent=await g.users.drafts.send({userId:'me',requestBody:{id:item.gmailDraftId,message:{raw:item.raw}}});item.status='sent';item.sentAt=now();item.gmailMessageId=sent.data.id;item.gmailThreadId=sent.data.threadId;audit(s,'sent',{outreachId});results.push({id:outreachId,status:'sent'});}
   catch{item.status='send_unknown';audit(s,'send_unknown',{outreachId});results.push({id:outreachId,status:'send_unknown',error:'Delivery result is unknown. Sync to reconcile; do not retry.'});break;}
   await new Promise(resolve=>setTimeout(resolve,2000));
  }catch(e){results.push({id:outreachId,status:'blocked',error:e.message});}
 }
 return results;
}
export async function syncReplies(port){
 const s=read(),g=mail.gmail(port);let newReplies=0;const errors=[];
 for(const item of s.outreach){
  try{
   if(['sending','send_unknown','creating','draft_unknown'].includes(item.status)){
    const search=await g.users.messages.list({userId:'me',q:'in:sent rfc822msgid:'+item.messageId,maxResults:2});
    if(search.data.messages?.length===1){const message=await g.users.messages.get({userId:'me',id:search.data.messages[0].id,format:'metadata'});item.gmailMessageId=message.data.id;item.gmailThreadId=message.data.threadId;item.sentAt=new Date(Number(message.data.internalDate)).toISOString();item.status='sent';}
    else if(['creating','draft_unknown'].includes(item.status)){
     let pageToken,found,foundRaw;do{const drafts=await g.users.drafts.list({userId:'me',maxResults:100,pageToken});for(const d of drafts.data.drafts||[]){const full=await g.users.drafts.get({userId:'me',id:d.id,format:'raw'});const parsed=await simpleParser(Buffer.from(full.data.message.raw,'base64url'),{skipHtmlToText:true,skipTextToHtml:true});if(parsed.messageId==='<'+item.messageId+'>'){foundRaw=await verifyPreview(item,full.data.message.raw,s.documents);found=d.id;break;}}pageToken=drafts.data.nextPageToken;}while(pageToken&&!found);if(found){item.gmailDraftId=found;item.raw=foundRaw;item.status='draft';}
    }
    write(s);
   }
   if(!item.sentAt||!item.gmailThreadId)continue;
   const thread=await g.users.threads.get({userId:'me',id:item.gmailThreadId,format:'full'});
   for(const message of (thread.data.messages||[]).sort((a,b)=>Number(a.internalDate)-Number(b.internalDate))){
    if(message.id===item.gmailMessageId||message.labelIds?.some(x=>['SENT','DRAFT'].includes(x))||Number(message.internalDate)<new Date(item.sentAt).getTime()-5000||item.replies.some(r=>r.id===message.id))continue;
    const from=header(message,'From');if(from.toLowerCase().includes(item.from.toLowerCase()))continue;
    const text=bodyText(message.payload).slice(0,20000)||message.snippet||'';const automatic=autoCategory(message);
    let classification=automatic?{category:automatic,confidence:1,reason:'Automatic message headers or delivery report.',evidence:header(message,'Subject'),optOut:false}:await runAgent(replyTask,{latest:{from,subject:header(message,'Subject'),text},outreach:{subject:item.subject,body:item.body},previous:item.replies});
    if(!['positive','negative','neutral','automatic','bounce','uncertain'].includes(classification.category))throw Error('Invalid AI reply category.');
    if((!Number.isFinite(Number(classification.confidence))||Number(classification.confidence)<0.7||Number(classification.confidence)>1)&&!automatic)classification.category='uncertain';
    item.replies.push({id:message.id,at:new Date(Number(message.internalDate)).toISOString(),from,subject:header(message,'Subject'),text,...classification});
    if(classification.optOut===true||classification.category==='bounce'){if(!s.suppressed.includes(item.to))s.suppressed.push(item.to);}
    newReplies++;write(s);
   }
  }catch(e){errors.push({id:item.id,error:e.message});}
 }
 s.lastSyncAt=now();audit(s,'replies_synced',{newReplies,errors});return {newReplies,errors};
}
export async function suggestions(){const s=read();const result=await runAgent(feedbackTask,{...profileData(s),jobs:s.jobs,outreach:s.outreach.map(x=>({id:x.id,jobId:x.jobId,subject:x.subject,body:x.body,sentAt:x.sentAt,replies:x.replies}))});if(!Array.isArray(result.recommendations)||typeof result.summary!=='string'||!result.summary.trim())throw Error('Invalid improvement report.');s.suggestions={...result,at:now()};audit(s,'suggestions_generated');return s.suggestions;}

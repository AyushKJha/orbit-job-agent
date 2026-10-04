import crypto from 'node:crypto';
export const id = () => crypto.randomUUID();
export const hash = v => crypto.createHash('sha256').update(v).digest('hex');
export const email = v => typeof v==='string' && /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(v) && !/[\r\n]/.test(v);
export function required(v,label,max=100000) {if(typeof v!=='string'||!v.trim()||v.length>max) throw Error(label+' is missing or too long.');return v.trim();}
export function safeURL(v) {try {const u=new URL(v);if(u.protocol==='https:')return u.href;}catch{}return '';}
export function dayKey(date,timezone='Asia/Kolkata') {return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function stats(state) {
 const sent=state.outreach.filter(x=>x.sentAt), responded=sent.filter(x=>x.replies.some(r=>['positive','negative','neutral','uncertain'].includes(r.category)));
 const latest=x=>x.replies.filter(r=>['positive','negative','neutral','uncertain'].includes(r.category)).at(-1)?.category;
 return {drafts:state.outreach.filter(x=>['draft','approved'].includes(x.status)).length,sent:sent.length,replied:responded.length,awaiting:sent.filter(x=>!responded.includes(x)&&!x.replies.some(r=>r.category==='bounce')).length,positive:responded.filter(x=>latest(x)==='positive').length,negative:responded.filter(x=>latest(x)==='negative').length,neutral:responded.filter(x=>latest(x)==='neutral').length,uncertain:responded.filter(x=>latest(x)==='uncertain').length,bounced:sent.filter(x=>x.replies.some(r=>r.category==='bounce')).length,automatic:sent.filter(x=>x.replies.some(r=>r.category==='automatic')).length,replyMessages:sent.reduce((a,x)=>a+x.replies.length,0)};
}
export function assertSend(item,raw,state,now=new Date()) {
 if(item.status!=='approved'||!item.approval||hash(raw)!==item.approval.rawHash) throw Error('Draft changed or has no current approval. Review and approve it again.');
 if(state.suppressed.includes(item.to.toLowerCase())) throw Error('Recipient is suppressed.');
 if(state.outreach.some(x=>x.id!==item.id&&x.to.toLowerCase()===item.to.toLowerCase()&&['sent','sending','send_unknown'].includes(x.status))) throw Error('This recipient has already been contacted or has an unresolved send.');
 const daily=state.outreach.filter(x=>x.sendAttemptAt&&dayKey(new Date(x.sendAttemptAt),state.settings.timezone)===dayKey(now,state.settings.timezone)).length;
 if(daily>=state.settings.dailyLimit) throw Error('Daily send limit reached.');
}
export function mime(item,from,attachments=[]) {
 if(!email(item.to)||!email(from)||/[\r\n]/.test(item.subject)) throw Error('Invalid email address or subject.');
 const header=['From: '+from,'To: '+item.to,'Subject: =?UTF-8?B?'+Buffer.from(item.subject).toString('base64')+'?=','Message-ID: <'+item.messageId+'>','MIME-Version: 1.0'];
 const b64=v=>Buffer.from(v).toString('base64').match(/.{1,76}/g)?.join('\r\n')||'';
 if(!attachments.length) return Buffer.from([...header,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',b64(item.body)].join('\r\n')).toString('base64url');
 const boundary='outreach_'+item.id.replaceAll('-','');
 const parts=[...header,'Content-Type: multipart/mixed; boundary="'+boundary+'"','','--'+boundary,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',b64(item.body)];
 for(const a of attachments){const name=a.name.replace(/[^a-zA-Z0-9._-]/g,'_');parts.push('--'+boundary,'Content-Type: application/octet-stream; name="'+name+'"','Content-Disposition: attachment; filename="'+name+'"','Content-Transfer-Encoding: base64','',b64(a.bytes));}
 parts.push('--'+boundary+'--','');return Buffer.from(parts.join('\r\n')).toString('base64url');
}
export const header=(msg,name)=>msg.payload?.headers?.find(h=>h.name.toLowerCase()===name.toLowerCase())?.value||'';
export function bodyText(payload) {
 if(!payload)return '';
 if(payload.mimeType==='text/plain'&&payload.body?.data)return Buffer.from(payload.body.data,'base64url').toString('utf8');
 const text=(payload.parts||[]).map(bodyText).filter(Boolean).join('\n');
 if(text)return text;
 if(payload.mimeType==='text/html'&&payload.body?.data)return Buffer.from(payload.body.data,'base64url').toString('utf8').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ');
 return '';
}
export function autoCategory(msg) {
 const from=header(msg,'From');const subject=header(msg,'Subject');
 if(/mailer-daemon|postmaster/i.test(from)||/delivery (status notification|failure)|undeliverable|returned mail/i.test(subject)||msg.payload?.mimeType==='multipart/report')return 'bounce';
 if((header(msg,'Auto-Submitted')&&header(msg,'Auto-Submitted').toLowerCase()!=='no')||header(msg,'X-Autoreply')||header(msg,'X-Autorespond')||/out of office|automatic reply|auto.?reply/i.test(subject))return 'automatic';
 return null;
}

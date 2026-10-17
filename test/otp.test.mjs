import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const data=fs.mkdtempSync(path.join(process.cwd(),'.otp-test-'));
process.env.JOB_AGENT_DATA=data;process.env.NODE_ENV='test';process.env.VAULT_KEY='c'.repeat(64);process.env.OTP_EMAIL_API_KEY='test-only-key';process.env.OTP_EMAIL_FROM='Orbit <login@example.test>';
const auth=await import('../auth.mjs');
test('email codes create workspaces, authenticate by email, and cannot be reused',async()=>{
 const sent=[];const deliver=async message=>sent.push(message);
 assert.deepEqual(await auth.requestOtp({email:'New.User@example.test'},'ip-one',deliver),{sent:true,expiresIn:600});
 assert.equal(sent.length,1);assert.equal(sent[0].email,'new.user@example.test');assert.match(sent[0].code,/^[0-9]{6}$/);
 await assert.rejects(auth.requestOtp({email:'new.user@example.test'},'ip-one',deliver),/just sent/);
 await assert.rejects(Promise.resolve().then(()=>auth.verifyOtp({email:'new.user@example.test',code:'000000'})),/invalid or expired/);
 const login=auth.verifyOtp({email:'new.user@example.test',code:sent[0].code});
 assert.equal(login.user.handle,'new.user@example.test');assert.ok(login.raw);assert.ok(login.csrf);
 assert.deepEqual(auth.users(),[{id:login.user.id,handle:'new.user@example.test'}]);
 assert.throws(()=>auth.verifyOtp({email:'new.user@example.test',code:sent[0].code}),/invalid or expired/);
});
test('invalid OTP attempts are limited and email addresses are validated',async()=>{
 const sent=[];await auth.requestOtp({email:'bounded@example.test'},'ip-two',async message=>sent.push(message));
 const wrong=sent[0].code==='000000'?'000001':'000000';for(let i=0;i<5;i++)assert.throws(()=>auth.verifyOtp({email:'bounded@example.test',code:wrong}),/invalid or expired/);
 assert.throws(()=>auth.verifyOtp({email:'bounded@example.test',code:sent[0].code}),/invalid or expired/);
 await assert.rejects(auth.requestOtp({email:'not-an-email'},'ip-three',async()=>{}),/valid email/);
});
test('existing email-keyed accounts keep their workspace when signing in with OTP',async()=>{
 const legacy=await auth.authenticate({handle:'legacy@example.test',password:'A long test password 123'},true,'ip-four');
 const sent=[];await auth.requestOtp({email:'legacy@example.test'},'ip-four',async message=>sent.push(message));
 const login=auth.verifyOtp({email:'legacy@example.test',code:sent[0].code});
 assert.equal(login.user.id,legacy.user.id);
});
test.after(()=>fs.rmSync(data,{recursive:true,force:true}));

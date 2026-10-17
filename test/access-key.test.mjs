import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const data=fs.mkdtempSync(path.join(process.cwd(),'.access-key-test-'));
process.env.JOB_AGENT_DATA=data;process.env.NODE_ENV='test';
const auth=await import('../auth.mjs');
const key='orb-'+'a'.repeat(64);
test('new accounts use a browser-generated access key as their persistent password',async()=>{
 const created=await auth.createAccessKeyAccount({email:'New.User@example.test',accessKey:key},'ip-one');
 assert.equal(created.user.handle,'new.user@example.test');assert.ok(created.raw);assert.ok(created.csrf);
 const stored=JSON.parse(fs.readFileSync(path.join(data,'accounts.json'),'utf8')).users[0];
 assert.equal(stored.email,'new.user@example.test');assert.notEqual(stored.passwordHash,key);assert.ok(stored.salt);
 const login=await auth.authenticate({handle:'new.user@example.test',password:key},false,'ip-two');
 assert.equal(login.user.id,created.user.id);
 await assert.rejects(auth.createAccessKeyAccount({email:'new.user@example.test',accessKey:key},'ip-three'),/already uses this email/);
});
test('access-key account creation validates the email and generated key',async()=>{
 await assert.rejects(auth.createAccessKeyAccount({email:'not-an-email',accessKey:key},'ip-four'),/valid email/);
 await assert.rejects(auth.createAccessKeyAccount({email:'valid@example.test',accessKey:'short'},'ip-five'),/Generate a new Orbit access key/);
});
test('existing username and password accounts retain their workspace',async()=>{
 const legacy=await auth.authenticate({handle:'legacy.user',password:'A long test password 123'},true,'ip-six');
 const login=await auth.authenticate({handle:'legacy.user',password:'A long test password 123'},false,'ip-seven');
 assert.equal(login.user.id,legacy.user.id);
});
test.after(()=>fs.rmSync(data,{recursive:true,force:true}));

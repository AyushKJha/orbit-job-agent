import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.JOB_AGENT_DATA=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-gateway-client-'));
process.env.STORAGE_GATEWAY_URL='https://orbit-test.supabase.co/functions/v1/orbit-storage';
process.env.STORAGE_GATEWAY_TOKEN='c'.repeat(64);
process.env.VAULT_KEY='d'.repeat(64);
delete process.env.SUPABASE_SECRET_KEY;
const {DATA}=await import('../config.mjs');
const {restoreCloud,flushCloud}=await import('../cloud.mjs');
const objects=new Map();
globalThis.fetch=async(url,options)=>{
 assert.equal(url.origin,'https://orbit-test.supabase.co');
 assert.equal(options.headers['x-orbit-token'],'c'.repeat(64));
 assert.equal(options.headers.apikey,undefined);
 assert.equal(options.headers.Authorization,undefined);
 assert.equal(options.redirect,'error');
 const name=url.searchParams.get('object');
 if(options.method==='POST'){objects.set(name,Buffer.from(options.body));return new Response('{}');}
 if(options.method==='DELETE'){objects.delete(name);return new Response('{}');}
 return objects.has(name)?new Response(objects.get(name)):new Response('{}',{status:404});
};
test('gateway mode commits and restores encrypted state without a Supabase server key',async()=>{
 await restoreCloud();
 const file=path.join(DATA,'accounts.json');fs.writeFileSync(file,'private account');await flushCloud();
 fs.writeFileSync(file,'changed');await restoreCloud();assert.equal(fs.readFileSync(file,'utf8'),'private account');
 assert.ok(!objects.get('manifest').includes('accounts.json'));
});

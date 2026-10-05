import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHandler} from '../deploy/storage-gateway.mjs';
const token='a'.repeat(64),tokenHash=createHash('sha256').update(token).digest('hex');
const object='versions/12345678-1234-1234-1234-123456789abc';
let calls=[];
const handler=createHandler({tokenHash,env:name=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'internal-only'})[name],fetcher:async(url,options)=>{calls.push({url,options});return new Response('encrypted');}});
const request=(name='manifest',method='GET',body,auth=token)=>new Request('https://test.supabase.co/functions/v1/orbit-storage?object='+encodeURIComponent(name),{method,headers:{'x-orbit-token':auth},body});
test('gateway denies unauthenticated and cross-bucket access without upstream requests',async()=>{
 calls=[];
 assert.equal((await handler(request('manifest','GET',undefined,'b'.repeat(64)))).status,401);
 for(const name of ['../meal-photos','versions/../../meal-photos','meal-photos/file','versions/abc','manifest/other','https://example.com'])assert.equal((await handler(request(name))).status,400);
 assert.equal((await handler(request('manifest','DELETE'))).status,403);
 assert.equal((await handler(request('manifest','PUT'))).status,405);
 assert.equal(calls.length,0);
});
test('gateway only proxies the fixed private bucket and never returns upstream credentials or errors',async()=>{
 calls=[];let r=await handler(request(object));assert.equal(r.status,200);assert.equal(await r.text(),'encrypted');
 assert.equal(calls[0].url,'https://test.supabase.co/storage/v1/object/orbit-private/'+object);
 assert.equal(r.headers.get('authorization'),null);
 await handler(request(object,'DELETE'));assert.deepEqual(JSON.parse(calls[1].options.body),{prefixes:[object]});
 const fail=createHandler({tokenHash,env:name=>name==='SUPABASE_URL'?'https://test.supabase.co':'internal-only',fetcher:async()=>new Response('{"secret":"internal-only"}',{status:500})});
 r=await fail(request());assert.equal(r.status,502);assert.ok(!(await r.text()).includes('internal-only'));
});
test('gateway rejects plaintext and excessive bodies before writing',async()=>{
 calls=[];assert.equal((await handler(request(object,'POST','resume plaintext'))).status,400);
 assert.equal((await handler(request(object,'POST',new Uint8Array(12*1024*1024+1)))).status,413);
 assert.equal(calls.length,0);
 const body=new Uint8Array(40);body.set(new TextEncoder().encode('ORB1'));
 assert.equal((await handler(request(object,'POST',body))).status,200);
 assert.equal(calls.length,1);
});

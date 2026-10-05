import test from 'node:test';
import assert from 'node:assert/strict';
import {candidates,searchFeed} from '../job-feeds.mjs';
test('free discovery uses fixed public feed, excludes unsafe and stale listings, and cannot invent contact details',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{assert.equal(url,'https://www.arbeitnow.com/api/job-board-api');return Response.json({data:[{company_name:'Example',title:'Software Engineer',location:'Berlin',url:'https://www.arbeitnow.com/jobs/companies/example/software-engineer',description:'<p>Build JavaScript applications</p>',created_at:Date.now()/1000},{title:'Software Engineer',url:'https://evil.test/job',created_at:Date.now()/1000},{title:'Software Engineer',url:'https://www.arbeitnow.com/jobs/old',created_at:1}]});};
 try{const data={profile:{roles:'Software Engineer'},documents:[],requestedCount:10};const list=await candidates(data);assert.equal(list.length,1);const result=await searchFeed(data,async()=>({jobs:[{id:'invented',url:'https://evil.test',contactEmail:'fake@example.com'},{id:list[0].id,score:99,contactEmail:'fake@example.com',reasons:['JavaScript']},{id:list[0].id,score:88}]}));assert.equal(result.jobs.length,1);assert.equal(result.jobs[0].contactEmail,'');assert.equal(result.jobs[0].url,list[0].url);assert.match(result.jobs[0].evidence,/Arbeitnow/);assert.equal((await candidates({...data,knownJobURLs:[list[0].url]})).length,0);}finally{globalThis.fetch=original;}
});

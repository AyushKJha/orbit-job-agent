import test from 'node:test';
import assert from 'node:assert/strict';
import {responseSchema} from '../local-schemas.mjs';
import {ollamaInfer} from '../local-ai.mjs';
import {feedbackTask,draftTask} from '../agent.mjs';
test('local reviews require substantive structured fields and future-work instructions',async()=>{const schema=responseSchema(feedbackTask);assert.equal(schema.properties.summary.minLength,1);assert.equal(schema.properties.recommendations.minItems,1);await ollamaInfer({task:feedbackTask,instructions:'Evidence only',data:{documents:[]}},{fetcher:async(url,opts)=>{const body=JSON.parse(opts.body);assert.match(body.messages[1].content,/FUTURE WORK/);assert.match(body.messages[1].content,/UNTRUSTED INPUT DATA/);assert.deepEqual(body.format,schema);return Response.json({done:true,message:{content:'{"summary":"No documents supplied","recommendations":[]}'}});}});assert.equal(responseSchema(draftTask).properties.body.minLength,1);});

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT = path.dirname(fileURLToPath(import.meta.url));
for (const file of [path.join(ROOT,'.env.local'),path.resolve(ROOT,'../../.env.local')]) {
  if(fs.existsSync(file)) process.loadEnvFile(file);
}
export const DATA = process.env.JOB_AGENT_DATA || path.join(ROOT,'data');
fs.mkdirSync(DATA,{recursive:true});
export const MODEL = process.env.OPENAI_MODEL || 'gpt-6-astra';

import {AsyncLocalStorage} from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DATA,MODEL} from './config.mjs';
const scope=new AsyncLocalStorage();
export const workspaceId=()=>scope.getStore()?.id||'local';
export const dataDir=()=>scope.getStore()?.directory||DATA;
export function inWorkspace(userId,fn){if(!/^[a-f0-9-]{36}$/.test(userId))throw Error('Invalid workspace.');const directory=path.join(DATA,'users',userId);fs.mkdirSync(directory,{recursive:true});return scope.run({id:userId,directory},fn);}
function vaultKey(){if(process.env.VAULT_KEY){if(!/^[a-f0-9]{64}$/i.test(process.env.VAULT_KEY))throw Error('VAULT_KEY must contain 64 hexadecimal characters.');return Buffer.from(process.env.VAULT_KEY,'hex');}if(process.env.NODE_ENV==='production')throw Error('Production requires VAULT_KEY.');const file=path.join(DATA,'.vault-key');if(!fs.existsSync(file))fs.writeFileSync(file,crypto.randomBytes(32),{mode:0o600});return fs.readFileSync(file);}
export function seal(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',vaultKey(),iv);const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return {version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:bytes.toString('base64')};}
export function unseal(value){const cipher=crypto.createDecipheriv('aes-256-gcm',vaultKey(),Buffer.from(value.iv,'base64'));cipher.setAuthTag(Buffer.from(value.tag,'base64'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.ciphertext,'base64')),cipher.final()]).toString('utf8'));}
export function secrets(){const file=path.join(dataDir(),'vault.json');return fs.existsSync(file)?unseal(JSON.parse(fs.readFileSync(file))):{};}
export function saveSecrets(changes){const file=path.join(dataDir(),'vault.json');fs.writeFileSync(file+'.tmp',JSON.stringify(seal({...secrets(),...changes})),{mode:0o600});fs.renameSync(file+'.tmp',file);}
export const apiKey=()=>secrets().apiKey||(!scope.getStore()?process.env.OPENAI_API_KEY:undefined);
export const modelName=()=>secrets().model||MODEL;

import {google} from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {dataDir,workspaceId,secrets,saveSecrets} from './workspace.mjs';
const pending=new Map();
const hosted=()=>Boolean(process.env.APP_URL);
const legacy=name=>path.join(dataDir(),name);
const clientConfig=()=>secrets().googleClient||(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET?{client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET}:!hosted()&&fs.existsSync(legacy('google-client.json'))?JSON.parse(fs.readFileSync(legacy('google-client.json'))).installed:null);
const storedToken=()=>secrets().gmailToken||(!hosted()&&fs.existsSync(legacy('gmail-token.json'))?JSON.parse(fs.readFileSync(legacy('gmail-token.json'))):null);
export const configured=()=>Boolean(clientConfig());
export const connected=()=>Boolean(storedToken());
export function saveClient(value){const c=hosted()?value.web:value.installed;if(!c?.client_id||!c?.client_secret)throw Error('Upload a Google '+(hosted()?'Web application':'Desktop app')+' OAuth client JSON.');saveSecrets({googleClient:c});}
function client(port){const c=clientConfig();if(!c)throw Error('Add your Google OAuth client first.');return new google.auth.OAuth2(c.client_id,c.client_secret,(process.env.APP_URL||'http://127.0.0.1:'+port)+'/oauth/callback');}
export function authURL(port){const oauth=client(port),state=crypto.randomBytes(32).toString('hex'),verifier=crypto.randomBytes(48).toString('base64url');pending.set(workspaceId(),{oauth,state,verifier,expires:Date.now()+600000});return oauth.generateAuthUrl({access_type:'offline',prompt:'consent',state,scope:['https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.compose'],code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});}
export async function callback(code,state,expectedAccount){const entry=pending.get(workspaceId());if(!entry||entry.expires<Date.now()||state!==entry.state)throw Error('Expired or invalid Gmail authorization. Connect Gmail again.');pending.delete(workspaceId());const {tokens}=await entry.oauth.getToken({code,codeVerifier:entry.verifier});entry.oauth.setCredentials(tokens);const g=google.gmail({version:'v1',auth:entry.oauth}),profile=await g.users.getProfile({userId:'me'});if(expectedAccount&&profile.data.emailAddress!==expectedAccount)throw Error('This workspace belongs to '+expectedAccount+'. Use a separate account for another Gmail address.');saveSecrets({gmailToken:tokens});return profile.data.emailAddress;}
export function gmail(port){const tokens=storedToken();if(!tokens)throw Error('Connect Gmail first.');const oauth=client(port);oauth.setCredentials(tokens);oauth.on('tokens',t=>saveSecrets({gmailToken:{...storedToken(),...t}}));return google.gmail({version:'v1',auth:oauth});}
export async function disconnect(port){if(connected()){const oauth=client(port);oauth.setCredentials(storedToken());try{await oauth.revokeCredentials();}catch{}saveSecrets({gmailToken:null});if(!hosted()&&fs.existsSync(legacy('gmail-token.json')))fs.unlinkSync(legacy('gmail-token.json'));}pending.delete(workspaceId());}

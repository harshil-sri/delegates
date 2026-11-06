import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadConfig, runtime, root, waitUntil } from '../src/runtime.mjs';
import { SwitchClient } from '../src/switch-client.mjs';
import { loadCourtConfig } from '../src/court-runtime.mjs';
const config=await loadConfig();
const court=await loadCourtConfig();
const evidence=court?null:JSON.parse(await readFile(resolve(runtime,'last-spike.json'),'utf8'));
const client=new SwitchClient(config,config.actors.clerk);
const requestId=await client.post(court?`@${config.actors.clerk.name} status ${court.caseId}`:`@${config.actors.clerk.name} status — clerk listener verification.`);
const reply=await waitUntil(async()=>{
  const messages=await client.context();
  const matches=messages.filter(message=>court?message.body.startsWith(`[CVC_EVENT ${court.caseId}:`)&&message.body.includes(` status source=${requestId}]`):message.body.startsWith(`[CLERK_STATUS source=${requestId}]`));
  if(matches.length!==1) throw new Error('Waiting for exactly one deterministic clerk status reply.');
  if(matches[0].sender!==(court?.principals.clerk.sender ?? evidence.sourceSenderIds[0])) throw new Error('Clerk source identity changed.');
  return matches[0];
},'clerk response',15000);
await writeFile(resolve(root,'docs',court?'court-clerk-listener-result.json':'clerk-listener-result.json'),JSON.stringify({completedAt:new Date().toISOString(),requestId,replyId:reply.id,sender:reply.sender,body:reply.body},null,2)+'\n');
console.log(`PASS: live clerk status reply ${reply.id}, under its own Switch identity.`);

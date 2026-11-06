import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadConfig, runtime, root, waitUntil } from '../src/runtime.mjs';
import { SwitchClient } from '../src/switch-client.mjs';
import { loadCourtConfig } from '../src/court-runtime.mjs';
const config=await loadConfig();
const court=await loadCourtConfig();
const prior=court?null:JSON.parse(await readFile(resolve(runtime,'last-spike.json'),'utf8'));
const pid=Number(await readFile(resolve(runtime,'listener.pid'),'utf8'));
process.kill(pid,0);
const clerk=new SwitchClient(config,config.actors.clerk);
const marker=`listener-check-${randomUUID()}`;
const results=[];
for(const role of ['lead','creator']) {
  const previous=results.at(-1);
  const requestId=await clerk.post(`@${config.actors[role].name} [${marker}] ${role==='lead' ? "Explain the lead's portrait requirement and why only the creator could authorize portrait use. Suggest an object-only alternative for a human decision." : `Read the actual lead reply ${previous.replyId}; state your portrait boundary, preserve your final line and credit, and propose the next human decision.`}`);
  console.log(`Waiting for the background ${role} worker; this script does not invoke Codex itself.`);
  const reply=await waitUntil(async()=>{
    const matches=(await clerk.context()).filter(message=>message.body.includes(`source=${requestId}]`));
    if(!matches.length) throw new Error('Waiting for automatic reply.');
    if(matches.length!==1) throw new Error('Duplicate automatic reply.');
    if(matches[0].sender!==(court?.principals.agents[role].sender ?? prior[role].sourceSender)) throw new Error('Reply sender does not match the actual advocate identity.');
    return matches[0];
  },`${role} live reply`,210000);
  results.push({role,requestId,replyId:reply.id,sender:reply.sender,body:reply.body});
  console.log(`Verified automatic ${role} reply ${reply.id}.`);
}
const state=court?await (await fetch(`${court.webUrl}/api/cases/${court.caseId}`)).json():null;
const result={runId:marker,completedAt:new Date().toISOString(),mode:'background-polling-workers',roomId:config.room.id,turns:results,humanApprovals:state?.approvals.length ?? 0,...(court?{caseId:court.caseId,stage:state.stage,persistedMandatesSupplied:true}:{})};
await writeFile(resolve(root,'docs',court?'court-advocate-listener-result.json':'live-listener-result.json'),JSON.stringify(result,null,2)+'\n');
console.log('PASS: both background advocates automatically answered their own new Switch mentions.');

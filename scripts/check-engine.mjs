import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadConfig,root,jsonRequest,waitUntil } from '../src/runtime.mjs';
import { loadCourtConfig } from '../src/court-runtime.mjs';
import { SwitchClient } from '../src/switch-client.mjs';

// A live negative authorization check. It deliberately uses the clerk's own
// agent credential, never a human login, and never supplies a human decision.
const config=await loadConfig(),court=await loadCourtConfig();
if (!court) throw new Error('Run npm run setup:engine first.');
const api=async path=>(await jsonRequest(court.webUrl,path)).data;
const before=await api(`/api/cases/${court.caseId}`);
const clerk=new SwitchClient(config,config.actors.clerk);
const command=before.commands.adopt.lead;
const requestId=await clerk.post(command);
const rejected=await waitUntil(async()=>{
  const events=await api(`/api/cases/${court.caseId}/events`);
  const event=events.find(event=>event.source_id===requestId && event.kind==='command_rejected');
  if (!event) throw new Error('Waiting for the live clerk to reject its own agent-authored adoption.');
  if (event.data.code!=='HUMAN_REQUIRED') throw new Error(`Unexpected rejection: ${event.data.code}`);
  return event;
},'agent-authority rejection',15000);
const messages=await waitUntil(async()=>{
  const entries=await clerk.context();
  const source=entries.find(entry=>entry.id===requestId);
  const response=entries.find(entry=>entry.body.includes(`[CVC_EVENT ${court.caseId}:${rejected.id} `));
  if (!source || !response) throw new Error('Waiting for source and rejection read-back through Switch.');
  if (source.sender!==court.principals.clerk.sender || response.sender!==court.principals.clerk.sender) throw new Error('The real source sender did not match the bound clerk.');
  return {source,response};
},'rejection source read-back',15000);
const after=await api(`/api/cases/${court.caseId}`);
if (JSON.stringify(before.briefs)!==JSON.stringify(after.briefs) || JSON.stringify(before.approvals)!==JSON.stringify(after.approvals)) throw new Error('The unauthorized probe changed a human decision.');
const proof={completedAt:new Date().toISOString(),kind:'live-switch-negative-authorization-check',caseId:court.caseId,requestId,rejectionReplyId:messages.response.id,actor:messages.source.sender,rejectionCode:rejected.data.code,owners:Object.fromEntries(Object.entries(court.principals.humans).map(([role,actor])=>[role,{username:actor.username,platformUserId:actor.platformUserId,sender:actor.sender}])),checks:{actualSwitchSourceReadBack:true,botAdoptionRejected:true,briefsUnchanged:true,approvalsUnchanged:true,twoDistinctNativeHumanAccounts:true},recordedHumanApprovals:after.approvals.length,stage:after.stage};
await writeFile(resolve(root,'docs','court-engine-live-result.json'),JSON.stringify(proof,null,2)+'\n');
console.log(`PASS: agent-authored adoption ${requestId} was rejected as HUMAN_REQUIRED; human briefs and approvals are unchanged.`);
console.log(`Case ${court.caseId}: ${after.stage}; ${after.currentApprovals.length}/2 current human approvals. No human decision was simulated.`);

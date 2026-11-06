import { randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runtime,sleep } from './runtime.mjs';
import { isAddressed } from './switch-client.mjs';
import { respond } from './advocate.mjs';
import { ProviderSchemaError } from './codex-provider.mjs';
import { runNegotiationTurn } from './negotiation-worker.mjs';
import { negotiationMarker } from './negotiation.mjs';
import { verifyHumanAccounts,flushCourtOutbox } from './court-runtime.mjs';

export function isAgentCommand(body,clerkName) {
  return body.startsWith(`@${clerkName} `) && /^(TURN|REQUEST|PROPOSE|ADOPT|AMEND|ACCEPT|DECLINE|APPROVE|REVOKE|NEGOTIATE|status|help)(?:\s|$)/.test(body.slice(clerkName.length+2));
}
export function isAdvisoryRequest(message,config,clerkSender) {
  if(message.body.includes(negotiationMarker))return false;
  // Passive Switch can speak under the clerk's identity to announce manual
  // polling. Those notices are conversation, never an invitation for another
  // model turn. Only the explicitly labelled legacy verification harness is
  // allowed to issue an advisory prompt through the clerk credential.
  if(message.sender===clerkSender && !Object.values(config.actors).some(actor=>message.body.startsWith(`@${actor.name} [listener-check-`)))return false;
  return true;
}

// Shared, read-only status for /health and the court view. A failed poll
// pauses ingestion visibly; it never crashes the court or skips a message.
export function createIngestionStatus() {
  return {state:'starting',since:Date.now(),lastPollAt:null,reason:null,failures:0};
}
export const retryDelay = failures => Math.min(2000*2**Math.max(0,failures-1),30000);

export async function runRoomWorker({config,engine,court,clerk,mm,agentSenders,seen,state,save,isStopping,onWorkStarted=()=>{},status=createIngestionStatus(),wait=sleep,pollMs=2000,transcriptPath=resolve(runtime,'live-transcript.jsonl')}) {
  let job=null,recovered=false;
  const advisory=[];
  const start=(metadata,work)=>{
    const current={...metadata,controller:new AbortController(),promise:null};
    job=current;
    onWorkStarted(metadata);
    current.promise=work(current.controller.signal).catch(async error=>{
      console.error(`Advocate turn stopped: ${error.message}`);
      try {
        if(current.turn) engine.failNegotiationTurn(court.caseId,current.turn.id,{code:error instanceof ProviderSchemaError?'INVALID_PROVIDER_REPLY':'PROVIDER_FAILED',message:error.message,repairable:error instanceof ProviderSchemaError});
        else {state.failures.push({messageId:current.message.id,role:current.role,error:error.message,at:new Date().toISOString()});await save();}
      } catch(recordError) {console.error(`Could not record the stopped turn: ${recordError.message}`);}
    }).finally(()=>{if(job===current)job=null;});
  };
  const poll=async()=>{
      const messages=await clerk.context();
      for(const message of messages) {
        if(seen.has(message.id))continue;
        if(engine && (message.body.startsWith('CVC_TURN ') || message.body.startsWith(`@${config.actors.clerk.name} `) && (!agentSenders.has(message.sender) || isAgentCommand(message.body,config.actors.clerk.name)))) {
          await verifyHumanAccounts(mm,config,court.principals,message.sender);
          let outcome;
          try {outcome=engine.handleMessage({...message,roomId:config.room.id});}
          catch(error) {
            // An edited post under an already consumed ID cannot replay a
            // decision. Record that and move on rather than stalling the court.
            if(error?.code!=='SOURCE_CHANGED')throw error;
            outcome={code:error.code};
          }
          if(!outcome.ignored) console.log(`Court ${message.id}: ${outcome.kind ?? outcome.code}${outcome.duplicate?' (already consumed)':''}`);
        }
        seen.add(message.id);
        await appendFile(transcriptPath,JSON.stringify(message)+'\n',{mode:0o600});await save();
        if(agentSenders.has(message.sender) || message.sender_kind==='platform')continue;
        if(!isAdvisoryRequest(message,config,court?.principals.clerk.sender))continue;
        if(isAddressed(message.body,config.actors.clerk.name)) {
          if(!engine && /\b(status|ping)\b/i.test(message.body)) await clerk.post(`[CLERK_STATUS source=${message.id}] The two local Codex advocate workers are listening. No mandate engine is configured.`);
          continue;
        }
        for(const role of ['lead','creator']) if(isAddressed(message.body,config.actors[role].name))advisory.push({role,message});
      }
      if(engine) {
        // Process any stored source replies first. Never restart a previously
        // running provider blindly after a process crash.
        if(!recovered) {engine.recoverNegotiation(court.caseId);recovered=true;}
        await flushCourtOutbox(engine,clerk,messages);
        const snapshot=engine.snapshot(court.caseId);
        const turn=snapshot.negotiation?.turns.find(item=>item.id===snapshot.negotiation.currentTurnId);
        if(turn && ['running','awaiting_reply'].includes(turn.status) && engine.now()-turn.claimedAt>240000)engine.failNegotiationTurn(court.caseId,turn.id,{code:'TURN_TIMEOUT',message:'The scheduled advocate did not deliver an accepted Switch reply before its deadline.'});
        if(turn?.status==='queued' && engine.now()-turn.createdAt>90000)engine.expireQueuedNegotiationTurn(court.caseId,turn.id);
      }
      if(job?.turn && !engine.isNegotiationTurnCurrent(court.caseId,job.turn.id))job.controller.abort();
      if(!job && !isStopping()) {
        const turn=engine?.claimNegotiationTurn(court.caseId);
        if(turn) start({turn},async signal=>{
          const result=await runNegotiationTurn(config,engine,court.caseId,turn,{signal});
          await appendFile(resolve(runtime,'negotiation-turns.jsonl'),JSON.stringify({caseId:court.caseId,at:new Date().toISOString(),...result})+'\n',{mode:0o600});
        });
        else if(advisory.length) {
          const next=advisory.shift(),stage=engine?.snapshot(court.caseId).stage;
          if(['NEEDS_HUMAN','NEGOTIATING','NEGOTIATION_BLOCKED'].includes(stage))console.log(`Advisory source ${next.message.id} was not scheduled during ${stage}.`);
          else start(next,async signal=>{
            const result=await respond(config,next.role,next.message.id,`live-${randomUUID()}`,{recentContext:true,courtState:engine?.snapshot(court.caseId),signal});
            await appendFile(resolve(runtime,'live-turns.jsonl'),JSON.stringify({role:next.role,...result})+'\n',{mode:0o600});
          });
        }
      }
  };
  try {
    while(!isStopping()) {
      try {
        await poll();
        if(status.state!=='live') {
          if(status.state==='paused')console.log(`Room ingestion resumed after ${status.failures} failed poll(s).`);
          Object.assign(status,{state:'live',since:Date.now(),reason:null,failures:0});
        }
        status.lastPollAt=Date.now();
      } catch(error) {
        if(isStopping())break;
        const reason=String(error?.message ?? error).slice(0,400);
        if(status.state!=='paused' || status.reason!==reason)console.error(`Room ingestion paused: ${reason}`);
        Object.assign(status,{state:'paused',since:status.state==='paused'?status.since:Date.now(),reason,failures:status.failures+1});
        await wait(retryDelay(status.failures));
        continue;
      }
      await wait(pollMs);
    }
  } finally {
    if(job) {job.controller.abort();await job.promise;}
  }
}

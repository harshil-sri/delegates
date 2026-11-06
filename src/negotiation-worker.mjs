import { SwitchClient } from './switch-client.mjs';
import { runCodex,ProviderSchemaError } from './codex-provider.mjs';
import { waitUntil } from './runtime.mjs';

export async function runNegotiationTurn(config,engine,caseId,turn,{provider=runCodex,signal,clientFactory=actor=>new SwitchClient(config,actor)}={}) {
  const actor=config.actors[turn.role],client=clientFactory(actor);
  if(!engine.isNegotiationTurnCurrent(caseId,turn.id)) return {cancelled:true};
  const state=engine.snapshot(caseId);
  const candidate=turn.boardRevision?state.boards.find(board=>board.revision===turn.boardRevision):null;
  const required=new Set([turn.requestId,...(candidate?[candidate.sourceId]:[])]);
  const context=await waitUntil(async()=>{
    const messages=await client.context();
    const request=messages.find(message=>message.id===turn.requestId);
    if(!request || request.sender!==state.principals.clerk.sender) throw new Error('The actual clerk turn request is not visible under its bound identity.');
    for(const id of required) if(!messages.some(message=>message.id===id)) throw new Error(`Scheduled source ${id} is not visible to the advocate.`);
    // Keep required older sources even if newer conversation pushes them out of
    // the last 25 messages. The exact lead proposal must reach the reviewer.
    const recent=new Set(messages.slice(-20).map(message=>message.id));
    return messages.filter(message=>required.has(message.id)||recent.has(message.id));
  },`${turn.role} scheduled Switch context`,20000);
  if(!engine.isNegotiationTurnCurrent(caseId,turn.id)) return {cancelled:true};
  console.log(`${actor.name}: structured ${turn.kind}, ${turn.id}; ${provider===runCodex?'Codex':'injected test provider'} running.`);
  const generated=await provider(turn.role,context,turn.requestId,turn.invocationId,{courtState:state,negotiationTurn:turn,signal});
  if(!engine.isNegotiationTurnCurrent(caseId,turn.id)) return {cancelled:true};
  const body=`CVC_TURN ${caseId} ${turn.id} ${JSON.stringify(generated.result)}`;
  if(body.length>24000) throw new ProviderSchemaError('The structured reply exceeded the room command size limit.');
  // Only a source read back from Switch may commit the board/review. A local
  // model result or a successful send is not itself an accepted agent turn.
  const replyId=await client.post(body);
  engine.markNegotiationReply(caseId,turn.id,replyId);
  const observed=await waitUntil(async()=>{
    const reply=(await client.context()).find(message=>message.id===replyId);
    if(!reply) throw new Error('Waiting for the actual structured reply in Switch.');
    if(reply.sender!==state.principals.agents[turn.role].sender || reply.body!==body) throw new Error('Structured reply identity or content failed read-back.');
    return reply;
  },`${turn.role} structured reply read-back`,20000);
  return {turnId:turn.id,role:turn.role,requestId:turn.requestId,replyId,sourceSender:observed.sender,contextMessageIds:context.map(message=>message.id),elapsedMs:generated.elapsedMs,usage:generated.usage};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { CourtEngine,objectBrief,sampleBoard } from '../src/court-engine.mjs';
import { digest } from '../src/court-schema.mjs';
import { fixture,principals } from './court-fixture.mjs';
import { runNegotiationTurn } from '../src/negotiation-worker.mjs';
import { isAgentCommand,isAdvisoryRequest } from '../src/room-worker.mjs';

function negotiated(t,path) {
  const f=fixture(path);if(t)t.after(()=>f.engine.close());
  f.engine.enableNegotiation('C01');
  const claim=()=>{for(const entry of f.engine.outbox())if(entry.state==='pending')f.engine.markSent(entry.event_id,`fixture-clerk-prompt-${entry.event_id}`);return f.engine.claimNegotiationTurn('C01');};
  const reply=(turn,value,role=turn.role)=>f.agent(role,`TURN C01 ${turn.id} ${JSON.stringify(value)}`);
  const proposal=(ref='H1')=>{const board=sampleBoard(ref);if(ref==='H1')board.panels[0].assetId='portrait-daksh';return {summary:'A complete candidate for review, without human approval.',board};};
  const review=(turn,decision='recommend',extra={})=>({summary:'Review of the exact scheduled board.',boardRevision:turn.boardRevision,boardHash:turn.boardHash,decision,revisionNotes:[],amendment:null,...extra});
  const reachAmendment=()=>{
    f.adopt();const lead=claim();reply(lead,proposal());const creator=claim();
    reply(creator,review(creator,'amend',{amendment:{briefRef:'H1',replacement:objectBrief,reason:'May the lead replace the portrait requirement with objects, while preserving the creator boundary?'}}));
    return f.snapshot().commands.amendments[0];
  };
  return {...f,claim,reply,proposal,review,reachAmendment};
}

test('automatic negotiation waits for both genuine owner mandates and schedules just one lead',t=>{
  const f=negotiated(t);
  assert.equal(f.claim(),null);
  f.human('lead',f.snapshot().commands.adopt.lead);
  assert.equal(f.claim(),null);
  f.human('creator',f.snapshot().commands.adopt.creator);
  assert.equal(f.snapshot().stage,'NEGOTIATING');
  const turn=f.claim();assert.equal(turn.role,'lead');assert.equal(turn.kind,'proposal');
  assert.equal(f.claim(),null);
  assert.equal(f.snapshot().negotiation.turns.length,1);
});

test('lead candidate is checked and reviewed before any preview or approval target exists',t=>{
  const f=negotiated(t);f.adopt();f.amend();
  const lead=f.claim();f.reply(lead,f.proposal('H2'));
  const state=f.snapshot();
  assert.ok(state.boards[0].checks.every(check=>check.passed));
  assert.equal(state.currentBundle,null);assert.equal(state.commands.approve,null);
  assert.throws(()=>f.engine.bundle('C01',1),error=>error.code==='PREVIEW_NOT_READY');
  const creator=f.claim();assert.equal(creator.role,'creator');
  assert.equal(creator.boardHash,digest(state.boards[0].body));
  assert.equal(creator.boardRevision,1);
});

test('full negotiation pauses for owner amendment, revises, reviews, and still requires two humans',t=>{
  const f=negotiated(t),action=f.reachAmendment();
  assert.equal(f.snapshot().stage,'NEEDS_HUMAN');assert.equal(f.claim(),null);
  assert.equal(f.snapshot().negotiation.proposalCount,1);
  assert.equal(f.snapshot().briefs.lead.length,1);
  assert.equal(f.human('creator',action.accept).code,'NOT_OWNER');
  assert.equal(f.claim(),null);
  f.human('lead',action.accept);
  const second=f.claim();assert.equal(second.briefs.lead.ref,'H2');
  f.reply(second,f.proposal('H2'));
  assert.equal(f.snapshot().currentBundle,null);
  const review=f.claim();f.reply(review,f.review(review));
  const final=f.snapshot();
  assert.equal(final.boards.at(-1).revision,2);
  assert.equal(final.negotiation.status,'awaiting_humans');
  assert.equal(final.stage,'AWAITING_APPROVALS');assert.equal(final.currentApprovals.length,0);
  assert.deepEqual(final.briefs.creator.at(-1).content.forbiddenAssets,['portrait-daksh']);
  assert.equal(f.claim(),null);
  const manifest=f.engine.bundle('C01',2).manifest;
  assert.equal(manifest.creatorReview.boardHash,digest(final.boards[1].body));
  assert.equal(manifest.creatorReview.sender,principals.agents.creator.sender);
  f.human('lead',final.commands.approve);
  assert.equal(f.snapshot().stage,'AWAITING_APPROVALS');
  f.human('creator',final.commands.approve);
  assert.equal(f.snapshot().stage,'APPROVED');
  assert.equal(f.engine.receipt('C01',2).creatorReview.turnId,review.id);
});

test('an owner decline stops rather than inferring a compromise or repeatedly asking',t=>{
  const f=negotiated(t),action=f.reachAmendment();
  f.human('lead',action.decline);
  assert.equal(f.snapshot().stage,'NEGOTIATION_BLOCKED');
  assert.equal(f.snapshot().negotiation.block.code,'OWNER_DECLINED');
  assert.deepEqual(f.snapshot().briefs.lead[0].content.requiredAssets,['portrait-daksh']);
  assert.equal(f.claim(),null);
  assert.equal(f.agent('lead','NEGOTIATE C01').code,'HUMAN_REQUIRED');
  assert.equal(f.human('lead','NEGOTIATE C01').kind,'negotiation_restarted');
  assert.equal(f.snapshot().negotiation.run,2);assert.equal(f.claim().role,'lead');
});

test('only the scheduled advocate can answer and a duplicate source cannot allocate a second board',t=>{
  const f=negotiated(t);f.adopt();const turn=f.claim();
  assert.equal(f.reply(turn,f.proposal(),'creator').code,'WRONG_TURN_ACTOR');
  assert.equal(f.human('lead',`TURN C01 ${turn.id} ${JSON.stringify(f.proposal())}`).code,'WRONG_TURN_ACTOR');
  const source=f.source(principals.agents.lead.sender,`TURN C01 ${turn.id} ${JSON.stringify(f.proposal())}`);
  assert.equal(f.engine.handleMessage(source).kind,'negotiation_proposal_received');
  assert.equal(f.engine.handleMessage(source).duplicate,true);
  assert.equal(f.snapshot().boards.length,1);
  assert.equal(f.reply(turn,f.proposal()).code,'STALE_TURN');
});

test('new owner terms cancel an in-flight turn and reject its later old-brief reply',t=>{
  const f=negotiated(t);f.adopt();const old=f.claim();
  f.amend();
  assert.equal(f.engine.isNegotiationTurnCurrent('C01',old.id),false);
  assert.equal(f.reply(old,f.proposal()).code,'STALE_TURN');
  assert.equal(f.snapshot().boards.length,0);
  const fresh=f.claim();assert.notEqual(fresh.id,old.id);assert.equal(fresh.briefs.lead.ref,'H2');
});

test('a cancelled unsent turn request is removed from delivery rather than prompting an obsolete model',t=>{
  const f=negotiated(t);f.adopt();
  const obsolete=f.snapshot().negotiation.turns[0];f.amend();
  assert.equal(f.snapshot().negotiation.turns[0].status,'cancelled');
  assert.ok(!f.engine.outbox().some(item=>item.event_id===obsolete.requestEventId));
  const fresh=f.claim();assert.notEqual(fresh.id,obsolete.id);assert.equal(fresh.briefs.lead.ref,'H2');
});

test('manual proposals and agent endorsements cannot bypass the automatic review gate',t=>{
  const f=negotiated(t);f.adopt();f.amend();
  assert.equal(f.propose().code,'NEGOTIATION_ACTIVE');
  const lead=f.claim();f.reply(lead,f.proposal('H2'));
  assert.equal(f.snapshot().currentBundle,null);
  assert.equal(f.agent('creator',`APPROVE C01 BOARD1 ${'a'.repeat(64)}`).code,'HUMAN_REQUIRED');
});

test('enabling automation does not reuse an old manual preview that lacks creator review',t=>{
  const f=fixture();t.after(()=>f.engine.close());f.ready();
  const old=f.snapshot().commands.approve;f.human('lead',old);
  f.engine.enableNegotiation('C01');
  assert.equal(f.snapshot().currentBundle,null);assert.equal(f.snapshot().currentApprovals.length,0);
  assert.equal(f.snapshot().approvals.length,1);
  assert.equal(f.human('creator',old).code,'STALE_BUNDLE');
  assert.equal(f.snapshot().stage,'NEGOTIATING');
});

test('a creator cannot recommend a failing candidate; invalid replies get one repair then stop',t=>{
  const f=negotiated(t);f.adopt();f.reply(f.claim(),f.proposal());
  const creator=f.claim();
  assert.equal(f.reply(creator,f.review(creator)).code,'CHECKS_FAILED');
  assert.equal(f.snapshot().currentBundle,null);
  const repair=f.claim();assert.equal(repair.attempt,1);assert.equal(repair.repairOf,creator.id);
  assert.equal(f.reply(repair,f.review(repair)).repairQueued,false);
  assert.equal(f.snapshot().stage,'NEGOTIATION_BLOCKED');assert.equal(f.claim(),null);
});

test('creator must bind the exact candidate hash; stale or embellished review data does not finalize',t=>{
  const f=negotiated(t);f.adopt();f.amend();f.reply(f.claim(),f.proposal('H2'));
  const creator=f.claim();
  assert.equal(f.reply(creator,f.review(creator,'recommend',{boardHash:'f'.repeat(64)})).code,'WRONG_REVIEW_TARGET');
  const repair=f.claim();
  assert.equal(f.reply(repair,{...f.review(repair),humanApproved:true}).code,'INVALID_SCHEMA');
  assert.equal(f.snapshot().currentApprovals.length,0);assert.equal(f.snapshot().currentBundle,null);
});

test('malformed lead payload is repaired once without mutating briefs or allocating a board',t=>{
  const f=negotiated(t);f.adopt();const lead=f.claim();
  assert.equal(f.reply(lead,{summary:'invented consent',board:{approved:true}}).repairQueued,true);
  assert.equal(f.snapshot().boards.length,0);
  const repair=f.claim();assert.equal(repair.attempt,1);
  assert.equal(f.reply(repair,f.proposal()).kind,'negotiation_proposal_received');
  assert.equal(f.snapshot().negotiation.proposalCount,1);
});

test('a creator revision request cannot cause more than two lead proposals or an endless loop',t=>{
  const f=negotiated(t);f.adopt();f.amend();
  for(let round=0;round<2;round++) {
    f.reply(f.claim(),f.proposal('H2'));const creator=f.claim();
    f.reply(creator,f.review(creator,'revise',{revisionNotes:['Give the opening more energy without changing the briefs.']}));
  }
  assert.equal(f.snapshot().negotiation.proposalCount,2);
  assert.equal(f.snapshot().negotiation.block.code,'ROUND_LIMIT');assert.equal(f.claim(),null);
  assert.equal(f.snapshot().currentBundle,null);
});

test('provider failure blocks the run; it does not silently reuse a canned board or retry calls',t=>{
  const f=negotiated(t);f.adopt();const turn=f.claim();
  f.engine.failNegotiationTurn('C01',turn.id,{code:'PROVIDER_FAILED',message:'Provider unavailable.'});
  assert.equal(f.claim(),null);assert.equal(f.snapshot().negotiation.turns.length,1);
  assert.equal(f.snapshot().boards.length,0);assert.equal(f.snapshot().stage,'NEGOTIATION_BLOCKED');
});

test('a queued turn waits for its actual clerk source rather than starting on an unsent intent',t=>{
  const f=negotiated(t);f.adopt();
  assert.equal(f.engine.claimNegotiationTurn('C01'),null);
  const request=f.engine.outbox().find(entry=>entry.body.includes('[CVC_NEGOTIATION '));
  f.engine.markUncertain(request.event_id,'send outcome unknown');
  assert.equal(f.engine.claimNegotiationTurn('C01'),null);
  f.engine.markSent(request.event_id,'actual-clerk-source');
  assert.equal(f.engine.claimNegotiationTurn('C01').requestId,'actual-clerk-source');
});

test('restart preserves an amendment pause and does not repeat an interrupted provider',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'cvc-negotiation-test-')),path=join(directory,'case.sqlite');
  let engine;
  try {
    const f=negotiated(null,path);f.reachAmendment();f.engine.close();
    engine=new CourtEngine(path,{now:()=>f.now()+1});engine.recoverNegotiation('C01');
    assert.equal(engine.snapshot('C01').stage,'NEEDS_HUMAN');assert.equal(engine.claimNegotiationTurn('C01'),null);
    const accept=engine.snapshot('C01').commands.amendments[0].accept;
    engine.handleMessage(f.source(principals.humans.lead.sender,accept));
    for(const entry of engine.outbox())if(entry.state==='pending')engine.markSent(entry.event_id,`saved-prompt-${entry.event_id}`);
    assert.ok(engine.claimNegotiationTurn('C01'));engine.close();
    engine=new CourtEngine(path,{now:()=>f.now()+2});engine.recoverNegotiation('C01');
    assert.equal(engine.snapshot('C01').negotiation.block.code,'INTERRUPTED_TURN');assert.equal(engine.claimNegotiationTurn('C01'),null);
  } finally {engine?.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir(),'cvc-negotiation-test-')));await rm(directory,{recursive:true,force:true});}
});

test('worker posts real structured output but cannot commit a local model result without Switch ingestion',async t=>{
  const f=negotiated(t);f.adopt();const turn=f.claim();
  const config={actors:{lead:{id:'lead',name:'lead'},creator:{id:'creator',name:'creator'},clerk:{name:'cvc-clerk'}}};
  const messages=[{id:turn.requestId,sender:principals.clerk.sender,body:'scheduled proposal'}];
  const client={context:async()=>messages,post:async body=>{messages.push({id:'actual-advocate-reply',sender:principals.agents.lead.sender,body,timestamp:f.tick()});return 'actual-advocate-reply';}};
  const result=await runNegotiationTurn(config,f.engine,'C01',turn,{clientFactory:()=>client,provider:async()=>({result:f.proposal(),elapsedMs:1,usage:null})});
  assert.equal(result.replyId,'actual-advocate-reply');assert.equal(f.snapshot().boards.length,0);
  f.engine.handleMessage({...messages.at(-1),roomId:'test-room'});
  assert.equal(f.snapshot().boards.length,1);
});

test('worker discards an old generated board if an owner amends during the provider call',async t=>{
  const f=negotiated(t);f.adopt();const turn=f.claim();let posts=0;
  const config={actors:{lead:{name:'lead'},clerk:{name:'cvc-clerk'}}};
  const client={context:async()=>[{id:turn.requestId,sender:principals.clerk.sender,body:'request'}],post:async()=>{posts++;return 'should-not-exist';}};
  const result=await runNegotiationTurn(config,f.engine,'C01',turn,{clientFactory:()=>client,provider:async()=>{f.amend();return {result:f.proposal(),elapsedMs:1};}});
  assert.equal(result.cancelled,true);assert.equal(posts,0);assert.equal(f.snapshot().boards.length,0);
});

test('creator worker retains the actual lead proposal even outside the most recent context slice',async t=>{
  const f=negotiated(t);f.adopt();f.amend();f.reply(f.claim(),f.proposal('H2'));
  const turn=f.claim(),candidate=f.snapshot().boards[0];
  const messages=[{id:candidate.sourceId,sender:principals.agents.lead.sender,body:'the actual complete lead proposal'},...Array.from({length:30},(_,index)=>({id:`noise-${index}`,sender:'other-participant',body:'discussion'})),{id:turn.requestId,sender:principals.clerk.sender,body:'exact review request'}];
  const config={actors:{creator:{name:'creator'},clerk:{name:'cvc-clerk'}}};
  const client={context:async()=>messages,post:async body=>{messages.push({id:'creator-review-source',sender:principals.agents.creator.sender,body,timestamp:f.tick()});return 'creator-review-source';}};
  await runNegotiationTurn(config,f.engine,'C01',turn,{clientFactory:()=>client,provider:async(role,context)=>{
    assert.equal(role,'creator');assert.ok(context.some(message=>message.id===candidate.sourceId));
    return {result:f.review(turn),elapsedMs:1};
  }});
  assert.equal(f.snapshot().currentBundle,null);
  f.engine.handleMessage({...messages.at(-1),roomId:'test-room'});assert.ok(f.snapshot().currentBundle);
});

test('Switch passive notices cannot schedule extra advisory models or masquerade as structured replies',()=>{
  const config={actors:{lead:{name:'cvc-lead-advocate'},creator:{name:'cvc-creator-advocate'},clerk:{name:'cvc-clerk'}}};
  const notice={sender:principals.clerk.sender,body:'@cvc-lead-advocate I read room messages asynchronously, not in real time.'};
  assert.equal(isAdvisoryRequest(notice,config,principals.clerk.sender),false);
  assert.equal(isAdvisoryRequest({...notice,sender:principals.humans.lead.sender},config,principals.clerk.sender),true);
  assert.equal(isAdvisoryRequest({...notice,body:'@cvc-lead-advocate [listener-check-abc] Explain the brief.'},config,principals.clerk.sender),true);
  assert.equal(isAgentCommand("@cvc-clerk You're not permitted to direct messages to me in this room.",'cvc-clerk'),false);
  assert.equal(isAgentCommand('@cvc-clerk TURN C01 T123 {}','cvc-clerk'),true);
});

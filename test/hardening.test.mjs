import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { objectBrief, sampleBoard } from '../src/court-engine.mjs';
import { fixture, principals } from './court-fixture.mjs';
import { SwitchClient, historyPageLimit, historyMaxPages } from '../src/switch-client.mjs';
import { runRoomWorker, createIngestionStatus, retryDelay } from '../src/room-worker.mjs';
import { createCourtServer, parseOrigins } from '../src/court-http.mjs';
import { courtView } from '../src/court-view.mjs';
import { verifyReceipt } from '../src/receipt-verify.mjs';

// Same synthetic negotiation driver as negotiation.test.mjs; never touches Switch.
function negotiated(t) {
  const f=fixture();t.after(()=>f.engine.close());
  f.engine.enableNegotiation('C01');
  const deliver=()=>{for(const entry of f.engine.outbox())if(entry.state==='pending')f.engine.markSent(entry.event_id,`fixture-clerk-prompt-${entry.event_id}`);};
  const claim=()=>{deliver();return f.engine.claimNegotiationTurn('C01');};
  const reply=(turn,value,role=turn.role)=>f.agent(role,`TURN C01 ${turn.id} ${JSON.stringify(value)}`);
  const proposal=(ref='H1')=>{const board=sampleBoard(ref);if(ref==='H1')board.panels[0].assetId='portrait-daksh';return {summary:'Candidate for review.',board};};
  const review=(turn,decision='recommend',extra={})=>({summary:'Review of the exact board.',boardRevision:turn.boardRevision,boardHash:turn.boardHash,decision,revisionNotes:[],amendment:null,...extra});
  const toPreview=()=>{
    f.adopt();reply(claim(),proposal());const creator=claim();
    reply(creator,review(creator,'amend',{amendment:{briefRef:'H1',replacement:objectBrief,reason:'May objects replace the portrait?'}}));
    f.human('lead',f.snapshot().commands.amendments[0].accept);
    reply(claim(),proposal('H2'));const final=claim();reply(final,review(final));
  };
  return {...f,deliver,claim,reply,proposal,review,toPreview};
}
const entry=(id,timestamp,body=`message ${id}`)=>({id,kind:'message',sender:'opaque-A',sender_name:'a',body,timestamp,attachments:[]});

test('room history pages backwards past one read limit and merges overlapping boundaries exactly',async()=>{
  const calls=[];
  const pages=[
    {threads:[{root:entry('m3',300),replies:[]},{root:entry('m4',400),replies:[]}],truncated:true,oldest_timestamp:300},
    {threads:[{root:entry('m1',100),replies:[entry('m2',200)]},{root:entry('m3',300),replies:[]}],truncated:false,oldest_timestamp:100}
  ];
  const client=new SwitchClient({bridgeUrl:'http://switch.test',room:{id:'room'}},{id:'clerk',apiKey:'k'},{request:async(base,path,options)=>{calls.push(options.body);return {data:{result:pages[calls.length-1]}};}});
  const messages=await client.context();
  assert.deepEqual(messages.map(message=>message.id),['m1','m2','m3','m4']);
  assert.equal(calls[0].limit,historyPageLimit);assert.equal(calls[0].before,undefined);
  assert.equal(calls[1].before,new Date(301).toISOString());
});

test('history paging fails explicitly when it cannot advance or exceeds its bound',async()=>{
  const stuck=new SwitchClient({bridgeUrl:'http://switch.test',room:{id:'room'}},{id:'clerk',apiKey:'k'},{request:async()=>({data:{result:{threads:[{root:entry('x',5),replies:[]}],truncated:true,oldest_timestamp:5}}})});
  await assert.rejects(()=>stuck.context(),/did not advance/);
  let oldest=10_000;
  const endless=new SwitchClient({bridgeUrl:'http://switch.test',room:{id:'room'}},{id:'clerk',apiKey:'k'},{request:async()=>({data:{result:{threads:[],truncated:true,oldest_timestamp:oldest--}}})});
  await assert.rejects(()=>endless.context(),new RegExp(`exceeds ${historyPageLimit*historyMaxPages}`));
});

test('a failed room poll pauses ingestion visibly and resumes instead of crashing the court',async()=>{
  let polls=0;const delays=[];
  const status=createIngestionStatus();
  const clerk={context:async()=>{polls++;if(polls<=2)throw new Error('connect ECONNREFUSED 127.0.0.1:18800');return [];},post:async()=>'x'};
  const config={actors:{clerk:{name:'cvc-clerk'},lead:{name:'cvc-lead-advocate'},creator:{name:'cvc-creator-advocate'}},room:{id:'room'}};
  const observed=[];
  await runRoomWorker({config,engine:null,court:null,clerk,mm:null,agentSenders:new Set(),seen:new Set(),state:{failures:[]},save:async()=>{},
    isStopping:()=>polls>=3,status,pollMs:1,wait:async ms=>{delays.push(ms);observed.push(status.state);}});
  assert.deepEqual(observed.slice(0,2),['paused','paused']);
  assert.equal(status.state,'live');assert.equal(status.failures,0);assert.equal(status.reason,null);
  assert.deepEqual(delays.slice(0,2),[retryDelay(1),retryDelay(2)]);
  assert.equal(retryDelay(50),30000);
});

test('an edited post under a consumed decision ID is skipped rather than replayed or stalling ingestion',async t=>{
  const f=fixture();t.after(()=>f.engine.close());
  const dir=await mkdtemp(join(tmpdir(),'cvc-worker-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const original=f.source(principals.humans.lead.sender,f.snapshot().commands.adopt.lead);
  assert.equal(f.engine.handleMessage(original).kind,'brief_adopted');
  const edited={...original,body:`${original.body} (edited)`};
  let polls=0;const seen=new Set();
  const config={actors:{clerk:{name:'cvc-clerk'},lead:{name:principals.agents.lead.name},creator:{name:principals.agents.creator.name}},room:{id:'test-room',external_channel_id:'channel'}};
  const mm=async path=>path.includes('/members/')?{user_id:path.split('/').pop()}:{id:path.split('/').pop(),is_bot:false,delete_at:0};
  const status=createIngestionStatus();
  await runRoomWorker({config,engine:f.engine,court:{caseId:'C01',principals},clerk:{context:async()=>{polls++;return [edited];},post:async()=>`posted-${polls}`},mm,
    agentSenders:new Set([principals.agents.lead.sender,principals.agents.creator.sender]),seen,state:{failures:[]},save:async()=>{},isStopping:()=>polls>=2,status,pollMs:1,wait:async()=>{},transcriptPath:join(dir,'t.jsonl')});
  assert.ok(seen.has(original.id));assert.equal(status.state,'live');
  assert.equal(f.snapshot().briefs.lead.length,1);
  assert.equal((await readFile(join(dir,'t.jsonl'),'utf8')).trim().split('\n').length,1);
});

test('an undelivered turn request stops the run visibly instead of waiting forever',t=>{
  const f=negotiated(t);f.adopt();
  const turn=f.snapshot().negotiation.turns[0];
  f.engine.markUncertain(turn.requestEventId,'socket hang up');
  assert.equal(f.engine.expireQueuedNegotiationTurn('C01',turn.id),true);
  const state=f.snapshot();
  assert.equal(state.stage,'NEGOTIATION_BLOCKED');assert.equal(state.negotiation.block.code,'TURN_REQUEST_UNDELIVERED');
  assert.ok(!f.engine.outbox().some(item=>item.event_id===turn.requestEventId));
  assert.equal(f.claim(),null);
  assert.equal(f.human('creator','NEGOTIATE C01').kind,'negotiation_restarted');
  const fresh=f.snapshot().negotiation.turns.at(-1);
  f.deliver();
  assert.equal(f.engine.expireQueuedNegotiationTurn('C01',fresh.id),false,'a delivered request is never expired');
});

test('court view narrates the real case as courtroom beats, including an advocate trying to sign',t=>{
  const f=negotiated(t);
  let view=courtView(f.snapshot(),f.engine.timeline('C01'));
  assert.equal(view.phase.code,'FILING');assert.deepEqual(view.phase.waitingOn,['owner:lead','owner:creator']);
  assert.ok(view.adopt.lead && view.adopt.creator);
  f.adopt();f.reply(f.claim(),f.proposal());const creator=f.claim();
  f.reply(creator,f.review(creator,'amend',{amendment:{briefRef:'H1',replacement:objectBrief,reason:'May objects replace the portrait?'}}));
  view=courtView(f.snapshot(),f.engine.timeline('C01'));
  assert.equal(view.phase.code,'RECESS');assert.equal(view.question.owner,'owner:lead');assert.equal(view.question.reason,'May objects replace the portrait?');
  assert.ok(view.question.accept.includes('ACCEPT C01 A1'));
  f.human('lead',view.question.accept);
  f.reply(f.claim(),f.proposal('H2'));const final=f.claim();f.reply(final,f.review(final));
  const command=f.snapshot().commands.approve;
  assert.equal(f.agent('lead',command).code,'HUMAN_REQUIRED');
  f.human('lead',command);f.human('creator',command);
  view=courtView(f.snapshot(),f.engine.timeline('C01'));
  assert.equal(view.phase.code,'VERDICT');assert.equal(view.approvals.count,2);assert.ok(view.exports.receipt.endsWith('/boards/2/receipt'));
  const types=view.beats.map(beat=>beat.type);
  for (const type of ['filing','mandate','summons','proposal','objection','appeal','decision','endorsement','draft_verdict','signature','verdict']) assert.ok(types.includes(type),`missing ${type}`);
  const overreach=view.beats.find(beat=>beat.agentOverreach);
  assert.equal(overreach.speaker,'lead');assert.equal(overreach.code,'HUMAN_REQUIRED');
  assert.equal(view.beats.find(beat=>beat.type==='decision').speaker,'owner:lead');
  assert.ok(view.beats.find(beat=>beat.type==='proposal').quote);
  assert.ok(view.beats.every(beat=>!beat.text?.startsWith('[CVC_EVENT')));
});

async function serve(t,engine,options={}) {
  const server=createCourtServer(engine,{roomUrl:'http://localhost:18865/test-room',port:0,streamPollMs:20,...options});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(done=>server.close(done)));
  return `http://127.0.0.1:${server.address().port}`;
}
function openStream(url,headers={}) {
  return new Promise((done,failed)=>{
    const call=request(url,{headers},response=>{
      let buffer='';const events=[];const waiters=[];
      response.setEncoding('utf8');
      response.on('data',chunk=>{
        buffer+=chunk;let index;
        while((index=buffer.indexOf('\n\n'))>=0) {
          const block=buffer.slice(0,index);buffer=buffer.slice(index+2);
          const event=Object.fromEntries(block.split('\n').filter(line=>line&&!line.startsWith(':')).map(line=>[line.slice(0,line.indexOf(':')),line.slice(line.indexOf(':')+2)]));
          if(event.event){events.push({...event,data:JSON.parse(event.data)});waiters.splice(0).forEach(fn=>fn());}
        }
      });
      const next=async predicate=>{while(true){const found=events.find(predicate);if(found)return found;await new Promise(fn=>waiters.push(fn));}};
      done({response,events,next,close:()=>call.destroy()});
    });
    call.on('error',failed);call.end();
  });
}

test('frontend API: CORS only for configured origins, court view, and a resumable live stream',async t=>{
  const f=negotiated(t);
  const base=await serve(t,f.engine,{allowedOrigins:['http://localhost:5173'],status:()=>({state:'live'})});
  const allowed=await fetch(`${base}/api/cases/C01/court`,{headers:{origin:'http://localhost:5173'}});
  assert.equal(allowed.status,200);assert.equal(allowed.headers.get('access-control-allow-origin'),'http://localhost:5173');
  const body=await allowed.json();assert.equal(body.phase.code,'FILING');assert.equal(body.ingestion.state,'live');
  const foreign=await fetch(`${base}/api/cases/C01/court`,{headers:{origin:'https://evil.example'}});
  assert.equal(foreign.headers.get('access-control-allow-origin'),null);
  assert.equal((await fetch(`${base}/api/cases/C01/court`,{method:'OPTIONS',headers:{origin:'http://localhost:5173'}})).status,204);
  assert.equal((await fetch(`${base}/api/cases/C01/court`,{method:'OPTIONS',headers:{origin:'https://evil.example'}})).status,405);
  assert.equal((await fetch(`${base}/api/cases/C99/court`)).status,404);
  assert.equal((await fetch(`${base}/health`)).headers.get('content-type'),'application/json; charset=utf-8');
  assert.equal((await (await fetch(`${base}/health`)).json()).ingestion.state,'live');

  const live=await openStream(`${base}/api/cases/C01/stream`);t.after(()=>live.close());
  assert.equal(live.response.headers['content-type'],'text/event-stream; charset=utf-8');
  const first=await live.next(event=>event.event==='court');
  assert.equal(first.data.stage,'AWAITING_MANDATES');
  f.human('lead',f.snapshot().commands.adopt.lead);
  const mandate=await live.next(event=>event.event==='beat'&&event.data.type==='mandate');
  assert.equal(mandate.data.speaker,'owner:lead');assert.equal(Number(mandate.id),mandate.data.id);
  await live.next(event=>event.event==='court'&&event.data.cast.owners.lead.adopted);

  f.human('creator',f.snapshot().commands.adopt.creator);
  const resumed=await openStream(`${base}/api/cases/C01/stream`,{'last-event-id':String(mandate.data.id)});t.after(()=>resumed.close());
  const after=await resumed.next(event=>event.event==='beat');
  assert.ok(after.data.id>mandate.data.id);assert.equal(after.data.type,'mandate');assert.equal(after.data.speaker,'owner:creator');
  assert.equal((await fetch(`${base}/api/cases/C01/stream?after=oops`)).status,400);
  assert.equal((await fetch(`${base}/api/cases/C01/stream`,{method:'POST'})).status,405);
});

test('stream connections are bounded',async t=>{
  const f=fixture();t.after(()=>f.engine.close());
  const base=await serve(t,f.engine,{maxStreams:1});
  const one=await openStream(`${base}/api/cases/C01/stream`);t.after(()=>one.close());
  await one.next(event=>event.event==='court');
  assert.equal((await fetch(`${base}/api/cases/C01/stream`)).status,503);
});

test('frontend origin configuration rejects malformed origins',()=>{
  assert.deepEqual(parseOrigins('http://localhost:5174, https://court.example'),['http://localhost:5174','https://court.example']);
  assert.ok(parseOrigins(undefined).includes('http://localhost:5173'));
  assert.throws(()=>parseOrigins('http://localhost:5173/path'),/Invalid/);
  assert.throws(()=>parseOrigins('*'),/Invalid/);
});

test('the consent receipt verifies offline and detects tampering with bytes, approvals or terms',t=>{
  const f=negotiated(t);f.toPreview();
  const command=f.snapshot().commands.approve;f.human('lead',command);
  const {html,script}=f.engine.bundle('C01',2);
  assert.throws(()=>f.engine.receipt('C01',2),error=>error.code==='EXPORT_NOT_APPROVED');
  f.human('creator',command);
  const receipt=JSON.parse(JSON.stringify(f.engine.receipt('C01',2)));
  const verified=verifyReceipt(receipt,{html,script});
  assert.equal(verified.ok,true,JSON.stringify(verified.results.filter(item=>!item.passed)));
  assert.ok(verified.results.some(item=>item.name==='creator-review'&&item.passed));
  assert.equal(verifyReceipt(receipt,{html:html.toString().replace('SIGNAL','S1GNAL')}).ok,false);
  const oneSigner=structuredClone(receipt);oneSigner.approvals=oneSigner.approvals.slice(0,1);
  assert.equal(verifyReceipt(oneSigner).results.find(item=>item.name==='two-human-approvals').passed,false);
  const sameSender=structuredClone(receipt);sameSender.approvals[1].sender=sameSender.approvals[0].sender;
  assert.equal(verifyReceipt(sameSender).ok,false);
  const revoked=structuredClone(receipt);revoked.approvals[0].revokedBy={sourceId:'x'};
  assert.equal(verifyReceipt(revoked).ok,false);
  const rewritten=structuredClone(receipt);rewritten.briefs.creator.content.forbiddenAssets=[];
  assert.equal(verifyReceipt(rewritten).results.find(item=>item.name==='brief-creator').passed,false);
  const sneaky=structuredClone(receipt);sneaky.manifest.board.panels[0].assetId='portrait-daksh';
  assert.equal(verifyReceipt(sneaky).ok,false);
});

test('demo twist: an amendment after both signatures voids them; a human restart and fresh signatures restore export',t=>{
  const f=negotiated(t);f.toPreview();
  const first=f.snapshot().commands.approve;f.human('lead',first);f.human('creator',first);
  assert.equal(f.snapshot().stage,'APPROVED');
  const changed={...f.snapshot().briefs.creator.at(-1).content,finalCopy:['Made together. On our terms.','Visuals: Daksh','SIGNAL 2026']};
  assert.equal(f.human('creator',`AMEND C01 D1 ${JSON.stringify(changed)}`).kind,'brief_amended');
  const voided=f.snapshot();
  assert.equal(voided.currentApprovals.length,0);assert.equal(voided.currentBundle,null);
  assert.throws(()=>f.engine.receipt('C01',2),error=>error.code==='EXPORT_NOT_APPROVED');
  assert.equal(voided.stage,'NEGOTIATION_BLOCKED');assert.equal(voided.negotiation.block.code,'ROUND_LIMIT');
  assert.equal(f.human('lead',first).code,'STALE_BUNDLE');
  assert.equal(f.human('lead','NEGOTIATE C01').kind,'negotiation_restarted');
  const lead=f.claim();assert.equal(lead.briefs.creator.ref,'D2');
  const board=sampleBoard('H2','D2');board.panels[3].onScreen+='\nSIGNAL 2026';
  f.reply(lead,{summary:'Adds the new closing line.',board});
  const review=f.claim();f.reply(review,f.review(review));
  const second=f.snapshot().commands.approve;assert.notEqual(second,first);
  f.human('lead',second);f.human('creator',second);
  assert.equal(f.snapshot().stage,'APPROVED');assert.equal(f.engine.receipt('C01',3).revision,3);
});

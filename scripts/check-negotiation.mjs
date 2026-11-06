import { randomUUID } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { loadConfig,readSettings,root,runtime,jsonRequest,sleep } from '../src/runtime.mjs';
import { loadCourtConfig,courtDatabasePath,switchClock,flushCourtOutbox } from '../src/court-runtime.mjs';
import { CourtEngine } from '../src/court-engine.mjs';
import { digest,demand } from '../src/court-schema.mjs';
import { loadCatalog } from '../src/storyboard.mjs';
import { createCourtServer } from '../src/court-http.mjs';
import { SwitchClient } from '../src/switch-client.mjs';
import { runRoomWorker } from '../src/room-worker.mjs';

// Real Switch + real Codex, isolated from C01. Human mandate/amendment inputs
// are explicitly synthetic fixtures in a separate database. No human login is
// used to post, and no final human approval is generated or recorded.
const config=await loadConfig(),court=await loadCourtConfig(),env=await readSettings();
if(!court)throw new Error('Run npm run setup:engine first.');
function liveCaseHash() {const db=new CourtEngine(courtDatabasePath);try{return digest(db.snapshot(court.caseId));}finally{db.close();}}
const before=liveCaseHash();
const runId=`negotiation-verify-${randomUUID().replaceAll('-','').slice(0,12)}`;
const caseId='CV'+runId.slice(-12).toUpperCase();
const {response:login}=await jsonRequest(config.bridgeUrl,'/gateway/auth/login',{method:'POST',body:{email:env.GATEWAY_ADMIN_EMAIL,password:env.GATEWAY_ADMIN_PASSWORD},secrets:[env.GATEWAY_ADMIN_PASSWORD]});
const cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
if(!cookie.includes('switch_auth='))throw new Error('Gateway did not return an authenticated session.');
const gateway=async(path,options={})=>(await jsonRequest(config.bridgeUrl,`/gateway${path}`,{...options,cookie})).data;
const roomPath=resolve(runtime,'negotiation-verification-room.json');
let room;
try{room=JSON.parse(await readFile(roomPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(!room) {
  const created=(await jsonRequest(config.bridgeUrl,'/gateway/rooms',{method:'POST',cookie,body:{name:'cvc-negotiation-verification',description:'Automated negotiation verification. Real agent turns; synthetic owner fixtures in a separate database. No real human approvals.',instructions:'This room is a labelled integration rehearsal. All owner mandate/amendment inputs are synthetic test fixtures. Agents must not call them real human consent. Structured turns are scheduled by a dedicated test clerk.',agent_ids:Object.values(config.actors).map(actor=>actor.id),user_names:[env.MATTERMOST_ADMIN_USER],bridge_id:court.bridgeId,channel_type:'channel_private',read_visibility:'public',write_visibility:'public'}})).data;
  room={id:created.id,name:created.name,external_channel_id:created.external_channel_id,url:new URL(new URL(created.external_channel_url).pathname,config.mattermostUrl).href};
  await writeFile(roomPath,JSON.stringify(room,null,2)+'\n',{mode:0o600});
}
for(const role of ['lead','creator']) {
  const actor=await gateway(`/agents/${config.actors[role].id}`),policy=actor.addressing_policy;
  if(policy && !policy.rules.some(rule=>rule.rooms?.includes(room.id) && rule.agents?.includes(config.actors.clerk.id))) {
    await gateway(`/agents/${config.actors[role].id}/addressing-policy`,{method:'PUT',body:{policy:{...policy,rules:[...policy.rules,{rooms:[room.id],users:[],agents:[config.actors.clerk.id],owner:true,owner_agents:false,platform:false}]}}});
  }
}
const testConfig={...config,room};
const clerk=new SwitchClient(testConfig,config.actors.clerk);
const opening=await clerk.post(`[CVC_VERIFICATION ${runId}] Isolated integration rehearsal. The advocates run real Codex turns through Switch. Brief adoption and owner amendment are SYNTHETIC FIXTURES in a separate test database, not messages from real people. C01 is untouched. No human approvals will be generated.`);
const directory=resolve(runtime,'negotiation-verification');await mkdir(directory,{recursive:true});
const engine=new CourtEngine(resolve(directory,`${runId}.sqlite`),{now:await switchClock(config),clerkName:config.actors.clerk.name});
const server=createCourtServer(engine,{roomUrl:room.url,port:0});server.listen(0,'127.0.0.1');await once(server,'listening');
engine.webUrl=`http://localhost:${server.address().port}`;
const principals=structuredClone(court.principals);
for(const role of ['lead','creator'])principals.humans[role]={platform:'mattermost',platformUserId:`fixture-only-native-${role}`,username:`synthetic-fixture-${role}`,sender:`fixture-only-sender-${role}`};
let serial=0,amendmentPause=false,stopping=false,worker,workerError;
const workStarted=[];
const fixture=(role,body)=>engine.handleMessage({id:`fixture-only-source-${++serial}`,roomId:room.id,sender:principals.humans[role].sender,body,timestamp:engine.now()});
try {
  engine.createCase({id:caseId,roomId:room.id,principals,catalog:await loadCatalog(root)});engine.enableNegotiation(caseId);
  for(const role of ['lead','creator'])fixture(role,engine.snapshot(caseId).commands.adopt[role]);
  const seen=new Set((await clerk.context()).map(message=>message.id));
  worker=runRoomWorker({config:testConfig,engine,court:{...court,caseId,roomId:room.id,principals},clerk,mm:async()=>{throw new Error('No real human account verification or login may be requested by this fixture rehearsal.');},agentSenders:new Set(Object.values(principals.agents).map(actor=>actor.sender)),seen,state:{failures:[]},save:async()=>{},isStopping:()=>stopping,onWorkStarted:job=>workStarted.push({turnId:job.turn?.id ?? null,kind:job.turn?.kind ?? 'advisory'})}).catch(error=>{workerError=error;stopping=true;});
  const deadline=Date.now()+12*60*1000;
  let lastPhase;
  while(Date.now()<deadline) {
    if(workerError)throw workerError;
    let state=engine.snapshot(caseId);
    if(state.negotiation.status!==lastPhase){lastPhase=state.negotiation.status;console.log(`Background room listener: ${lastPhase}.`);}
    if(state.stage==='NEEDS_HUMAN') {
      demand(!amendmentPause,'VERIFICATION_FAILED','The advocates asked for more than the expected one owner amendment.');
      demand(engine.claimNegotiationTurn(caseId)===null,'VERIFICATION_FAILED','The scheduler did not pause for its owner.');
      const calls=workStarted.length;await sleep(3000);
      demand(workStarted.length===calls,'VERIFICATION_FAILED','A model was scheduled while awaiting its owner.');
      const action=state.commands.amendments[0],request=state.amendments.find(item=>item.id===action.id);
      demand(action.role==='lead' && request.baseRef==='H1','VERIFICATION_FAILED','The conflict must be referred to the lead owner; the creator boundary cannot be waived.');
      const creatorBefore=digest(state.briefs.creator);
      await flushCourtOutbox(engine,clerk,await clerk.context());
      console.log('PASS: scheduler paused at the owner amendment. Applying an explicitly synthetic lead-owner fixture in the isolated test database.');
      fixture('lead',action.accept);amendmentPause=true;
      state=engine.snapshot(caseId);
      demand(digest(state.briefs.creator)===creatorBefore,'VERIFICATION_FAILED','The creator brief changed.');
    }
    if(state.stage==='AWAITING_APPROVALS')break;
    demand(state.stage!=='NEGOTIATION_BLOCKED','VERIFICATION_FAILED',`Negotiation blocked: ${state.negotiation.block?.message}`);
    await sleep(500);
  }
  // Let several more normal polls run after preparation. Passive notices must
  // not provoke an extra advisory provider call after the final review.
  const callsAtFinal=workStarted.length;await sleep(5000);
  demand(workStarted.length===callsAtFinal && workStarted.every(job=>job.kind!=='advisory'),'VERIFICATION_FAILED','A Switch notice scheduled an unwanted extra model call.');
  stopping=true;await worker;if(workerError)throw workerError;
  const state=engine.snapshot(caseId),board=state.boards.at(-1);
  demand(amendmentPause && state.stage==='AWAITING_APPROVALS' && board.revision===2 && state.approvals.length===0,'VERIFICATION_FAILED','The expected amended, reviewed, unapproved final revision was not reached.');
  const bundle=engine.bundle(caseId,board.revision);
  const preview=await fetch(`${engine.webUrl}/api/cases/${caseId}/boards/${board.revision}/preview`);
  demand(digest(Buffer.from(await preview.arrayBuffer()))===bundle.manifest.files['storyboard.html'],'VERIFICATION_FAILED','Served preview differs from the prepared bytes.');
  demand((await fetch(`${engine.webUrl}/api/cases/${caseId}/boards/${board.revision}/export`)).status===409,'VERIFICATION_FAILED','Export was not blocked without human approvals.');
  await flushCourtOutbox(engine,clerk,await clerk.context());
  demand(liveCaseHash()===before,'VERIFICATION_FAILED','The live case changed during isolated verification.');
  const metadata=(await readFile(resolve(runtime,'negotiation-turns.jsonl'),'utf8')).trim().split(/\r?\n/).map(line=>JSON.parse(line)).filter(turn=>turn.caseId===caseId);
  const turns=state.negotiation.turns.filter(turn=>turn.replyId).map(turn=>{
    const observed=metadata.find(result=>result.turnId===turn.id);
    demand(observed,'VERIFICATION_FAILED','A structured worker result was not recorded.');
    const inbox=engine.db.prepare('SELECT outcome FROM court_inbox WHERE room_id=? AND message_id=?').get(room.id,turn.replyId);
    demand(inbox,'VERIFICATION_FAILED','The background listener did not consume the actual reply.');
    return {...observed,kind:turn.kind,outcome:JSON.parse(inbox.outcome)};
  });
  const proof={runId,completedAt:new Date().toISOString(),mode:'background-room-listener-with-real-switch-and-codex-and-isolated-owner-fixtures',room:{id:room.id,url:room.url},caseId,openingSourceId:opening,turns,workStarted,syntheticOwnerInputs:{adoptions:2,amendmentAcceptances:1,finalApprovals:0},realHumanApprovals:0,productionCaseUnchanged:true,final:{revision:board.revision,briefs:board.body.briefs,digest:bundle.digest,checks:board.checks,creatorReview:board.review},checks:{automaticBackgroundScheduling:true,onlyScheduledModelsStarted:true,leadProposalReadFromSwitch:true,creatorReadExactLeadSource:true,ownerPauseObserved:true,creatorBoundaryPreserved:true,secondProposalReviewed:true,preparedBytesServedUnchanged:true,exportBlockedWithoutHumans:true}};
  await writeFile(resolve(root,'docs','negotiation-live-result.json'),JSON.stringify(proof,null,2)+'\n');
  await writeFile(resolve(directory,'last-unapproved-storyboard.html'),bundle.html);
  console.log('PASS: real lead → creator → owner-fixture pause → revised lead → creator → frozen preview. Zero real human approvals; live C01 unchanged.');
} finally {stopping=true;if(worker)await worker;await new Promise(done=>server.close(done));engine.close();}

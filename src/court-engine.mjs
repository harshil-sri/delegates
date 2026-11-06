import { DatabaseSync } from 'node:sqlite';
import { CourtError, demand, canonical, digest, roles, briefPrefix, roleOfRef, validateBrief, validateBoard, parseCommand } from './court-schema.mjs';
import { boardChecks, prepareBundle } from './storyboard.mjs';
import { initializeNegotiation,advanceNegotiation,restartNegotiation,claimTurn,turnIsCurrent,failTurn,completeTurn,expireQueuedTurn } from './negotiation.mjs';

export const initialBriefs = {
  lead: {goal:'A personal, energetic 30-second SIGNAL promo.',requiredAssets:['portrait-daksh'],forbiddenAssets:[],requiredCopy:['SIGNAL'],finalCopy:[],negotiable:['Opening shot, palette and scene order. Only the lead may replace the portrait requirement.']},
  creator: {goal:'Contribute a recognizable creative voice while keeping the portrait-use boundary.',requiredAssets:[],forbiddenAssets:['portrait-daksh'],requiredCopy:[],finalCopy:['Made together. On our terms.','Visuals: Daksh'],negotiable:['Object illustrations, text treatments, scene order and palette.']}
};
export const objectBrief = {...initialBriefs.lead,requiredAssets:[],negotiable:['Object-based artwork, opening shot, palette and scene order.']};
export const sampleBoard = (lead = 'H2', creator = 'D1') => ({
  briefs:{lead,creator},title:'SIGNAL — ideas take shape',panels:[
    {seconds:6,assetId:'notebook',scene:'A notebook opens onto the first spark of an idea.',onScreen:'Every idea starts somewhere.',voiceover:'A line. A thought. A beginning.'},
    {seconds:8,assetId:'hands-sketch',scene:'Hands turn separate sketches into one shared composition.',onScreen:'Built by many hands.',voiceover:'Our different voices make something new.'},
    {seconds:9,assetId:'light-trails',scene:'Lines become trails of light and converge.',onScreen:'Let your ideas meet.',voiceover:'Bring your work. Find your people.'},
    {seconds:7,assetId:'signal-mark',scene:'The event identity holds with the agreed closing line and credit.',onScreen:'SIGNAL\nMade together. On our terms.\nVisuals: Daksh',voiceover:'SIGNAL. Made together. On our terms.'}
  ]
});

const activeBriefs = state => Object.fromEntries(roles.map(role => [role,state.briefs[role].at(-1)]));
const currentGrants = state => state.approvals.filter(approval => approval.digest === state.currentBundle && !approval.revokedBy);
export function stage(state) {
  if (state.amendments.some(request => request.status === 'pending')) return 'NEEDS_HUMAN';
  if (roles.some(role => !state.briefs[role].at(-1).adoption)) return 'AWAITING_MANDATES';
  if (!state.currentBundle && state.negotiation?.enabled && state.negotiation.status==='blocked') return 'NEGOTIATION_BLOCKED';
  if (!state.currentBundle && state.negotiation?.enabled && state.negotiation.currentTurnId) return 'NEGOTIATING';
  if (!state.currentBundle) return state.boards.at(-1)?.stale ? 'NEEDS_NEW_BOARD' : state.boards.at(-1)?.checks.some(check=>!check.passed) ? 'CHECK_FAILED' : 'AWAITING_BOARD';
  return new Set(currentGrants(state).map(approval=>approval.role)).size === 2 ? 'APPROVED' : 'AWAITING_APPROVALS';
}

// This database is the only mutation path. Source consumption, state changes,
// immutable artifacts, audit events and reply intents commit in one transaction.
export class CourtEngine {
  constructor(path, {now = Date.now, clerkName = 'cvc-clerk', webUrl = 'http://localhost:18802'} = {}) {
    this.db = new DatabaseSync(path);
    this.now = now; this.clerkName = clerkName; this.webUrl = webUrl;
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS court_cases (id TEXT PRIMARY KEY, room_id TEXT NOT NULL UNIQUE, state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS court_inbox (room_id TEXT NOT NULL, message_id TEXT NOT NULL, source_hash TEXT NOT NULL, source TEXT NOT NULL, outcome TEXT NOT NULL, PRIMARY KEY(room_id,message_id));
      CREATE TABLE IF NOT EXISTS court_events (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT NOT NULL REFERENCES court_cases(id), kind TEXT NOT NULL, at INTEGER NOT NULL, source_id TEXT, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS court_bundles (digest TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES court_cases(id), revision INTEGER NOT NULL, manifest TEXT NOT NULL, html BLOB NOT NULL, script BLOB NOT NULL, UNIQUE(case_id,revision));
      CREATE TABLE IF NOT EXISTS court_outbox (event_id INTEGER PRIMARY KEY REFERENCES court_events(id), room_id TEXT NOT NULL, body TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', message_id TEXT, error TEXT);
      PRAGMA user_version=1;`);
  }
  close() { this.db.close(); }
  transaction(action) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = action(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  load(caseId) {
    const row = this.db.prepare('SELECT state FROM court_cases WHERE id=?').get(caseId);
    demand(row, 'CASE_NOT_FOUND', 'Case not found.');
    return JSON.parse(row.state);
  }
  save(state) { this.db.prepare('UPDATE court_cases SET state=? WHERE id=?').run(canonical(state),state.id); }
  event(state, kind, source, data, reply) {
    const at = this.now();
    const row = this.db.prepare('INSERT INTO court_events(case_id,kind,at,source_id,data) VALUES(?,?,?,?,?) RETURNING id').get(state.id,kind,at,source?.id ?? null,canonical({actor:source?.sender ?? null,...data}));
    if (reply) this.db.prepare('INSERT INTO court_outbox(event_id,room_id,body) VALUES(?,?,?)').run(row.id,state.roomId,`[CVC_EVENT ${state.id}:${row.id} ${kind}${source ? ` source=${source.id}` : ''}]\n${reply}`);
    return row.id;
  }
  command(text) { return `@${this.clerkName} ${text}`; }
  briefCommand(state, brief) { return this.command(`ADOPT ${state.id} ${brief.ref} ${brief.hash}`); }
  approvalCommand(state, board) { return this.command(`APPROVE ${state.id} BOARD${board.revision} ${board.bundleDigest}`); }
  createCase({id = 'C01',roomId,principals,catalog}) {
    return this.transaction(() => {
      demand(/^C[A-Z0-9_-]{1,31}$/.test(id) && typeof roomId === 'string' && roomId.length, 'INVALID_CASE', 'A case needs a safe ID and a bound Switch room.');
      const existing = this.db.prepare('SELECT state FROM court_cases WHERE id=? OR room_id=?').get(id,roomId);
      if (existing) {
        const state = JSON.parse(existing.state);
        demand(state.id === id && state.roomId === roomId && canonical(state.principals) === canonical(principals), 'BINDING_CONFLICT', 'Case already exists with different frozen identity bindings.');
        demand(digest(state.catalog) === digest(catalog), 'CATALOG_CONFLICT', 'The existing case has a different immutable asset catalog.');
        return this.snapshot(id);
      }
      const all = [...roles.map(role=>principals.humans[role]),...roles.map(role=>principals.agents[role]),principals.clerk];
      demand(all.every(actor=>actor && typeof actor.sender === 'string' && actor.sender.length) && new Set(all.map(actor=>actor.sender)).size === 5, 'BINDING_CONFLICT', 'Two humans, two advocates and the clerk must have five distinct verified source identities.');
      demand(roles.every(role=>principals.humans[role].platform === 'mattermost' && principals.humans[role].platformUserId) && new Set(roles.map(role=>principals.humans[role].platformUserId)).size === 2, 'BINDING_CONFLICT', 'Both owners must be different native human accounts.');
      const createdAt = this.now();
      const state = {schema:1,id,roomId,createdAt,principals:structuredClone(principals),catalog:structuredClone(catalog),briefs:{},amendments:[],boards:[],approvals:[],currentBundle:null};
      for (const role of roles) {
        const content = validateBrief(initialBriefs[role],catalog);
        state.briefs[role] = [{ref:`${briefPrefix(role)}1`,hash:digest(content),content,createdAt,sourceId:null,adoption:null}];
      }
      this.db.prepare('INSERT INTO court_cases(id,room_id,state) VALUES(?,?,?)').run(id,roomId,canonical(state));
      this.event(state,'case_created',null,{principals,briefs:activeBriefs(state)},`Case ${id} is ready. Each owner must review and adopt their own brief. No human decisions have been recorded.\nReview briefs and commands: ${this.webUrl}/\n${roles.map(role=>`${principals.humans[role].username} (${role}):\n${JSON.stringify(state.briefs[role][0].content,null,2)}\n${this.briefCommand(state,state.briefs[role][0])}`).join('\n\n')}`);
      return this.snapshot(id);
    });
  }
  actor(state, source, humanOnly = false) {
    demand((source.on_behalf_of === undefined || source.on_behalf_of === null) && source.sender_kind !== 'platform', 'DIRECT_IDENTITY_REQUIRED', 'Platform messages and statements on someone’s behalf cannot make decisions.');
    for (const role of roles) {
      if (source.sender === state.principals.humans[role].sender) {
        demand(!source.sender_kind || source.sender_kind === 'user', 'DIRECT_IDENTITY_REQUIRED', 'This must be a direct human message.');
        return {kind:'human',role,...state.principals.humans[role]};
      }
    }
    demand(!humanOnly, 'HUMAN_REQUIRED', 'Only a bound human owner can adopt, amend, accept, decline, approve or revoke.');
    for (const role of roles) if (source.sender === state.principals.agents[role].sender) return {kind:'agent',role,...state.principals.agents[role]};
    throw new CourtError('UNKNOWN_ACTOR', 'This sender is not a participant authorized to propose changes.');
  }
  fresh(source, after) { demand(Number.isSafeInteger(source.timestamp) && source.timestamp >= after && source.timestamp <= this.now()+5000, 'STALE_SOURCE', 'The source message predates its review target or has an invalid timestamp. Send a new command.'); }
  owner(actor, role) { demand(actor.kind === 'human' && actor.role === role, 'NOT_OWNER', 'Only this brief’s bound owner can change or adopt it.'); }
  amend(state, role, content, source) {
    const previous = state.briefs[role].at(-1);
    demand(digest(content) !== previous.hash, 'NO_CHANGE', 'The replacement brief is identical to the current brief.');
    const next = {ref:`${briefPrefix(role)}${state.briefs[role].length+1}`,hash:digest(content),content,createdAt:this.now(),sourceId:source.id,adoption:{sourceId:source.id,sender:source.sender,at:this.now()}};
    state.briefs[role].push(next);
    for (const request of state.amendments) if (request.role === role && request.status === 'pending') request.status = 'superseded';
    for (const board of state.boards) board.stale = true;
    state.currentBundle = null;
    return {previous:previous.ref,next};
  }
  handleMessage(source) {
    const row = this.db.prepare('SELECT id FROM court_cases WHERE room_id=?').get(source.roomId ?? '');
    if (!row) return {ignored:true};
    let parsed, parseError;
    try { parsed = parseCommand(source.body,this.clerkName); }
    catch (error) { if (!(error instanceof CourtError)) throw error; parseError=error; }
    if (!parsed && !parseError) return {ignored:true};
    demand(typeof source.id === 'string' && source.id.length && typeof source.sender === 'string' && source.sender.length, 'INVALID_SOURCE', 'Switch source ID and opaque sender are required.');
    const sourceHash = digest(source);
    return this.transaction(() => {
      const consumed = this.db.prepare('SELECT source_hash,outcome FROM court_inbox WHERE room_id=? AND message_id=?').get(source.roomId,source.id);
      if (consumed) {
        demand(consumed.source_hash === sourceHash, 'SOURCE_CHANGED', 'A consumed message changed; edits cannot replay a decision. Send a new command.');
        return {...JSON.parse(consumed.outcome),duplicate:true};
      }
      const state = this.load(row.id);
      let outcome;
      // A rejected command must leave no partial mutations or artifacts behind.
      this.db.exec('SAVEPOINT court_action');
      try {
        if (parseError) throw parseError;
        demand(!parsed.caseId || parsed.caseId === state.id, 'WRONG_CASE', 'The command names a different case.');
        this.fresh(source,state.createdAt);
        demand(!(source.attachments?.length), 'INVALID_COMMAND', 'Decision messages must contain only their exact text command.');
        outcome = this.apply(state,parsed,source);
        advanceNegotiation(this,state);
        this.save(state);
        this.db.exec('RELEASE court_action');
      } catch (error) {
        this.db.exec('ROLLBACK TO court_action; RELEASE court_action');
        if (!(error instanceof CourtError)) throw error;
        outcome = {accepted:false,code:error.code,message:error.message};
        this.event(state,'command_rejected',source,{command:parsed?.type ?? null,...outcome},`Rejected: ${error.message}`);
      }
      this.db.prepare('INSERT INTO court_inbox(room_id,message_id,source_hash,source,outcome) VALUES(?,?,?,?,?)').run(source.roomId,source.id,sourceHash,canonical(source),canonical(outcome));
      return outcome;
    });
  }
  apply(state, command, source) {
    if (command.type === 'STATUS' || command.type === 'HELP') {
      const snapshot = this.snapshot(state.id);
      this.event(state,'status',source,{},`${state.id}: ${snapshot.stage}. Both humans must approve the same current bundle. Review: ${this.webUrl}/`);
      return {accepted:true,kind:'status'};
    }
    const humanOnly = ['ADOPT','AMEND','ACCEPT','DECLINE','APPROVE','REVOKE','NEGOTIATE'].includes(command.type);
    const actor = this.actor(state,source,humanOnly);
    const briefs = activeBriefs(state);
    const complete = () => demand(roles.every(role=>briefs[role].adoption), 'MANDATES_REQUIRED', 'Both owners must adopt their current briefs first.');
    const noQuestions = () => demand(!state.amendments.some(request=>request.status==='pending'), 'HUMAN_DECISION_PENDING', 'Resolve the pending amendment before a new board or approval.');
    if(command.type==='NEGOTIATE') {restartNegotiation(this,state,source);return {accepted:true,kind:'negotiation_restarted'};}
    if(command.type==='TURN') return completeTurn(this,state,command,source,actor);
    if (['ADOPT','AMEND','REQUEST'].includes(command.type)) {
      const role = roleOfRef(command.ref), brief = briefs[role];
      if (command.type !== 'REQUEST') this.owner(actor,role);
      demand(command.ref === brief.ref, 'STALE_BRIEF', 'This brief revision is no longer current.');
      this.fresh(source,brief.createdAt);
      if (command.type === 'ADOPT') {
        demand(command.hash === brief.hash, 'DIGEST_MISMATCH', 'The brief digest does not match the displayed revision.');
        if (brief.adoption) return {accepted:true,kind:'already_adopted',ref:brief.ref};
        brief.adoption = {sourceId:source.id,sender:source.sender,at:this.now()};
        this.event(state,'brief_adopted',source,{role,ref:brief.ref,hash:brief.hash},`${actor.username} adopted ${brief.ref}. Stage: ${stage(state)}.`);
        return {accepted:true,kind:'brief_adopted',ref:brief.ref};
      }
      const content = validateBrief(command.value,state.catalog);
      demand(digest(content) !== brief.hash, 'NO_CHANGE', 'The replacement brief is identical to the current brief.');
      if (command.type === 'AMEND') {
        const {previous,next} = this.amend(state,role,content,source);
        this.event(state,'brief_amended',source,{role,previous,next},`${actor.username} adopted ${next.ref}, replacing ${previous}. All earlier storyboard approvals are historical. A fresh board is required.\n${JSON.stringify(content,null,2)}`);
        return {accepted:true,kind:'brief_amended',ref:next.ref};
      }
      demand(!state.amendments.some(request=>request.role===role && request.status==='pending'), 'AMENDMENT_PENDING', 'This owner already has a pending amendment to resolve.');
      const request = {id:`A${state.amendments.length+1}`,role,baseRef:brief.ref,content,hash:digest({caseId:state.id,baseRef:brief.ref,content}),createdAt:this.now(),sourceId:source.id,proposedBy:source.sender,status:'pending'};
      state.amendments.push(request);
      this.event(state,'amendment_requested',source,{request},`Only ${state.principals.humans[role].username} may decide ${request.id}, replacing ${brief.ref} with this exact brief:\n${JSON.stringify(content,null,2)}\n${this.command(`ACCEPT ${state.id} ${request.id} ${request.hash}`)}\nOr decline: ${this.command(`DECLINE ${state.id} ${request.id} ${request.hash}`)}`);
      return {accepted:true,kind:'amendment_requested',requestId:request.id};
    }
    if (command.type === 'ACCEPT' || command.type === 'DECLINE') {
      const request = state.amendments.find(item=>item.id===command.requestId);
      demand(request, 'UNKNOWN_AMENDMENT', 'Amendment not found.');
      this.owner(actor,request.role);
      demand(request.status === 'pending' && briefs[request.role].ref === request.baseRef, 'STALE_AMENDMENT', 'This amendment is no longer pending against the current brief.');
      demand(command.hash === request.hash, 'DIGEST_MISMATCH', 'The amendment digest does not match.');
      this.fresh(source,request.createdAt);
      let next = null;
      if (command.type === 'ACCEPT') next = this.amend(state,request.role,request.content,source).next;
      request.status = command.type === 'ACCEPT' ? 'accepted' : 'declined';
      request.decision = {sourceId:source.id,sender:source.sender,at:this.now(),ref:next?.ref ?? null};
      this.event(state,`amendment_${request.status}`,source,{request},`${actor.username} ${request.status} ${request.id}.${next ? ` ${request.baseRef} → ${next.ref}. Earlier board approvals cannot be reused; submit a fresh board.` : ' The brief is unchanged.'}`);
      return {accepted:true,kind:`amendment_${request.status}`,ref:next?.ref ?? request.baseRef};
    }
    if (command.type === 'PROPOSE') {
      complete(); noQuestions();
      demand(!state.negotiation?.enabled,'NEGOTIATION_ACTIVE','The automatic workflow accepts boards only from its scheduled lead turn, then requires the creator review.');
      const board = validateBoard(command.value);
      demand(roles.every(role=>board.briefs[role]===briefs[role].ref), 'STALE_BRIEF', 'The storyboard must name both current adopted brief revisions.');
      for (const role of roles) this.fresh(source,briefs[role].createdAt);
      const record=this.recordBoard(state,board,source);
      const revision=record.revision;
      return {accepted:true,kind:record.bundleDigest?'preview_ready':'check_failed',revision,digest:record.bundleDigest};
    }
    if (command.type === 'APPROVE' || command.type === 'REVOKE') {
      complete();
      if (command.type === 'APPROVE') noQuestions();
      const board = state.boards.at(-1);
      demand(board && board.revision === command.revision && state.currentBundle && state.currentBundle === command.hash && board.bundleDigest === command.hash && !board.stale, 'STALE_BUNDLE', 'Approval must target the exact current prepared storyboard and digest.');
      demand(board.checks.every(check=>check.passed) && roles.every(role=>board.body.briefs[role]===briefs[role].ref), 'STALE_BUNDLE', 'The board checks or brief bindings are no longer current.');
      this.fresh(source,board.readyAt);
      const bundle=this.bundle(state.id,board.revision); // Verify stored bytes before every decision.
      demand(bundle.digest===command.hash && roles.every(role=>bundle.manifest.briefs[role].sha256===briefs[role].hash) && bundle.manifest.catalogSha256===digest(state.catalog), 'STALE_BUNDLE', 'The stored bundle no longer matches its active brief and asset bindings.');
      if(state.negotiation?.enabled)demand(board.review?.decision==='recommend' && bundle.manifest.creatorReview?.boardHash===digest(board.body) && bundle.manifest.creatorReview?.sourceId===board.review.sourceId,'CREATOR_REVIEW_REQUIRED','The final bundle requires a recommendation of this exact board from the scheduled creator.');
      const grant = currentGrants(state).find(approval=>approval.role===actor.role);
      if (command.type === 'REVOKE') {
        demand(grant, 'NO_APPROVAL', 'You have no active approval on this revision to revoke.');
        grant.revokedBy = {sourceId:source.id,sender:source.sender,at:this.now()};
        this.event(state,'approval_revoked',source,{role:actor.role,revision:board.revision,digest:command.hash},`${actor.username} revoked their approval of BOARD${board.revision}. Official export is blocked.`);
        return {accepted:true,kind:'approval_revoked'};
      }
      if (grant) return {accepted:true,kind:'already_approved'};
      const approval = {role:actor.role,platformUserId:actor.platformUserId,sender:source.sender,sourceId:source.id,sourceTimestamp:source.timestamp,recordedAt:this.now(),revision:board.revision,digest:command.hash,revokedBy:null};
      state.approvals.push(approval);
      this.event(state,'approval_recorded',source,{approval},`${actor.username} approved BOARD${board.revision}, bundle ${command.hash}. ${currentGrants(state).length}/2 human approvals of this exact revision.`);
      if (stage(state) === 'APPROVED') this.event(state,'artifact_approved',source,{revision:board.revision,digest:command.hash,approvals:currentGrants(state)},`Both distinct human owners approved BOARD${board.revision}, bundle ${command.hash}. Approved export: ${this.webUrl}/api/cases/${state.id}/boards/${board.revision}/export`);
      return {accepted:true,kind:stage(state)==='APPROVED'?'artifact_approved':'approval_recorded'};
    }
    throw new CourtError('INVALID_COMMAND', 'Unknown court command.');
  }
  recordBoard(state,board,source,{deferPreparation=false,turnId=null}={}) {
    const briefs=activeBriefs(state),revision=state.boards.length+1;
    const checks=boardChecks(board,briefs,state.catalog);
    const record={revision,body:board,checks,sourceId:source.id,proposedBy:source.sender,createdAt:this.now(),bundleDigest:null,stale:false,turnId};
    state.currentBundle=null;state.boards.push(record);
    if(checks.every(check=>check.passed)) {
      if(!deferPreparation) this.prepareBoard(state,record,source);
      else this.event(state,'board_checks_passed',source,{revision,checks},`BOARD${revision} passes the encoded checks. It still needs the creator's exact-board review before a preview can be prepared.`);
    } else this.event(state,'check_failed',source,{revision,checks},`BOARD${revision} cannot be approved:\n${checks.filter(check=>!check.passed).map(check=>`- ${check.detail}`).join('\n')}`);
    return record;
  }
  prepareBoard(state,record,source,review=null) {
    const briefs=activeBriefs(state),revision=record.revision;
    demand(state.boards.at(-1)===record && !record.stale && !state.amendments.some(item=>item.status==='pending') && record.checks.every(check=>check.passed) && roles.every(role=>briefs[role].adoption && record.body.briefs[role]===briefs[role].ref),'STALE_BUNDLE','Only a current valid board against both adopted briefs can be prepared.');
    if(state.negotiation?.enabled) demand(review && review.decision==='recommend' && review.boardRevision===revision && review.boardHash===digest(record.body) && review.sender===state.principals.agents.creator.sender && review.sourceId===source.id,'CREATOR_REVIEW_REQUIRED','The scheduled creator must recommend this exact board before preparation.');
    const bundle=prepareBundle({caseId:state.id,revision,board:record.body,briefs,catalog:state.catalog,readyAt:this.now(),review});
    this.db.prepare('INSERT INTO court_bundles(digest,case_id,revision,manifest,html,script) VALUES(?,?,?,?,?,?)').run(bundle.digest,state.id,revision,bundle.manifest,Buffer.from(bundle.html),Buffer.from(bundle.script));
    record.bundleDigest=bundle.digest;record.readyAt=bundle.readyAt;record.review=review;state.currentBundle=bundle.digest;
    this.event(state,'preview_ready',source,{revision,digest:bundle.digest,checks:record.checks,review},`BOARD${revision} is prepared against ${briefs.lead.ref}/${briefs.creator.ref}.${review?' The creator advocate recommends this exact revision; that is not human approval.':''} Each owner must inspect the frozen preview, then approve from their own account.\n${this.webUrl}/api/cases/${state.id}/boards/${revision}/preview\n${this.approvalCommand(state,record)}\nBoth humans must use that same command. No approval has been inferred.`);
    return record;
  }
  enableNegotiation(caseId) {
    return this.transaction(()=>{const state=this.load(caseId);initializeNegotiation(this,state);this.save(state);return this.snapshot(caseId);});
  }
  claimNegotiationTurn(caseId) {
    return this.transaction(()=>{const state=this.load(caseId);const turn=claimTurn(this,state);this.save(state);return turn;});
  }
  isNegotiationTurnCurrent(caseId,turnId) {return turnIsCurrent(this.load(caseId),turnId);}
  markNegotiationReply(caseId,turnId,replyId) {
    return this.transaction(()=>{const state=this.load(caseId);if(!turnIsCurrent(state,turnId))return false;const turn=state.negotiation.turns.find(item=>item.id===turnId);turn.status='awaiting_reply';turn.replyId=replyId;this.save(state);return true;});
  }
  failNegotiationTurn(caseId,turnId,options) {
    return this.transaction(()=>{const state=this.load(caseId);const result=failTurn(this,state,turnId,options);this.save(state);return result;});
  }
  expireQueuedNegotiationTurn(caseId,turnId,options) {
    return this.transaction(()=>{const state=this.load(caseId);const result=expireQueuedTurn(this,state,turnId,options);if(result)this.save(state);return result;});
  }
  // Events joined with the clerk's actual room delivery, for read-only views.
  timeline(caseId, after = 0, limit = 500) {
    this.load(caseId);
    return this.db.prepare(`SELECT e.*,o.body AS reply,o.state AS delivery,o.message_id AS reply_message_id FROM court_events e LEFT JOIN court_outbox o ON o.event_id=e.id
      WHERE e.case_id=? AND e.id>? ORDER BY e.id LIMIT ?`).all(caseId,after,Math.max(1,Math.min(limit,500))).map(row=>({...row,data:JSON.parse(row.data)}));
  }
  lastEventId(caseId) { return this.db.prepare('SELECT coalesce(max(id),0) AS id FROM court_events WHERE case_id=?').get(caseId).id; }
  recoverNegotiation(caseId) {
    return this.transaction(()=>{
      const state=this.load(caseId),turn=state.negotiation?.turns.find(item=>item.id===state.negotiation.currentTurnId);
      if(turn && ['running','awaiting_reply'].includes(turn.status)) failTurn(this,state,turn.id,{code:'INTERRUPTED_TURN',message:'The worker restarted during an unconfirmed turn. Its model call was not repeated. A human can explicitly restart the bounded negotiation.'});
      this.save(state);
    });
  }
  snapshot(caseId) {
    const state = this.load(caseId);
    const board = state.boards.at(-1);
    return {...state,catalog:{version:state.catalog.version,sha256:digest(state.catalog),assets:state.catalog.assets.map(({bytes,...asset})=>asset)},stage:stage(state),currentApprovals:currentGrants(state),commands:{
      adopt:Object.fromEntries(roles.map(role=>[role,this.briefCommand(state,state.briefs[role].at(-1))])),
      approve:state.currentBundle && board ? this.approvalCommand(state,board) : null,
      negotiate:state.negotiation?.status==='blocked'?this.command(`NEGOTIATE ${state.id}`):null,
      amendments:state.amendments.filter(item=>item.status==='pending').map(item=>({id:item.id,role:item.role,accept:this.command(`ACCEPT ${state.id} ${item.id} ${item.hash}`),decline:this.command(`DECLINE ${state.id} ${item.id} ${item.hash}`)}))
    }};
  }
  listCases() { return this.db.prepare('SELECT id FROM court_cases ORDER BY id').all().map(({id})=>this.snapshot(id)); }
  events(caseId, after = 0) {
    this.load(caseId);
    return this.db.prepare('SELECT * FROM court_events WHERE case_id=? AND id>? ORDER BY id LIMIT 500').all(caseId,after).map(row=>({...row,data:JSON.parse(row.data)}));
  }
  bundle(caseId,revision,{official=false}={}) {
    const state = this.load(caseId);
    const row = this.db.prepare('SELECT * FROM court_bundles WHERE case_id=? AND revision=?').get(caseId,revision);
    demand(row, 'PREVIEW_NOT_READY', 'This revision has no prepared preview.');
    const manifest = JSON.parse(row.manifest);
    demand(digest(manifest)===row.digest && digest(Buffer.from(row.html))===manifest.files['storyboard.html'] && digest(Buffer.from(row.script))===manifest.files['script.txt'], 'ARTIFACT_CORRUPT', 'Stored bundle integrity check failed. Export is blocked.');
    if (official) demand(stage(state)==='APPROVED' && state.currentBundle===row.digest && state.boards.at(-1).revision===revision && roles.every(role=>manifest.briefs[role].sha256===state.briefs[role].at(-1).hash) && manifest.catalogSha256===digest(state.catalog), 'EXPORT_NOT_APPROVED', 'Two current human approvals on this exact bundle are required for official export.');
    return {digest:row.digest,manifest,html:Buffer.from(row.html),script:Buffer.from(row.script)};
  }
  receipt(caseId,revision) {
    const bundle = this.bundle(caseId,revision,{official:true});
    const state = this.load(caseId);
    const board=state.boards.at(-1);
    return {caseId,revision,digest:bundle.digest,manifest:bundle.manifest,briefs:activeBriefs(state),amendments:state.amendments.filter(item=>item.status==='accepted'),proposal:{sourceId:board.sourceId,sender:board.proposedBy},creatorReview:board.review ?? null,approvals:currentGrants(state),checks:board.checks};
  }
  outbox() { return this.db.prepare("SELECT o.*,e.case_id FROM court_outbox o JOIN court_events e ON e.id=o.event_id WHERE o.state NOT IN ('sent','cancelled') ORDER BY event_id").all(); }
  markSending(id) { this.db.prepare("UPDATE court_outbox SET state='sending' WHERE event_id=? AND state='pending'").run(id); }
  markSent(id,messageId) { this.db.prepare("UPDATE court_outbox SET state='sent',message_id=?,error=NULL WHERE event_id=?").run(messageId,id); }
  markUncertain(id,error) { this.db.prepare("UPDATE court_outbox SET state='uncertain',error=? WHERE event_id=?").run(String(error).slice(0,400),id); }
}

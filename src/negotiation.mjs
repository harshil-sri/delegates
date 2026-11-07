import { randomUUID } from 'node:crypto';
import { CourtError,demand,digest,fields,text,strings,validateBoard,validateBrief,roles } from './court-schema.mjs';

const bindings = state => Object.fromEntries(roles.map(role=>{const brief=state.briefs[role].at(-1);return [role,{ref:brief.ref,hash:brief.hash}];}));
const fingerprint = state => digest({briefs:bindings(state),catalog:digest(state.catalog)});
const activeTurn = state => state.negotiation?.turns.find(turn=>turn.id===state.negotiation.currentTurnId);
export const negotiationMarker = '[CVC_NEGOTIATION ';

export function initializeNegotiation(engine,state) {
  if (state.negotiation?.enabled) return;
  if(state.currentBundle && !state.boards.at(-1)?.review) {
    // Keep legacy previews/decisions in history, but never reuse an unreviewed
    // manual target as the automatic workflow's final revision.
    state.currentBundle=null;for(const board of state.boards)board.stale=true;
  }
  state.negotiation={enabled:true,run:1,status:state.currentBundle?'awaiting_humans':'waiting_mandates',fingerprint:fingerprint(state),proposalCount:0,maxProposals:2,currentTurnId:null,waitingAmendmentId:null,turns:[],reviews:[],block:null};
  engine.event(state,'negotiation_enabled',null,{},'The AI advocates will negotiate for you. Once you both accept your briefs, the lead\'s advocate drafts a storyboard and the creator\'s advocate reviews it. You two still make every final decision.');
  advanceNegotiation(engine,state);
}
function cancelTurn(engine,state,reason) {
  const turn=activeTurn(state);
  if (turn && ['queued','running','awaiting_reply'].includes(turn.status)) {
    turn.status='cancelled';turn.error=reason;
    engine.db.prepare("UPDATE court_outbox SET state='cancelled',error=? WHERE event_id=? AND state='pending'").run(reason,turn.requestEventId);
  }
  state.negotiation.currentTurnId=null;
}
function block(engine,state,code,message,source=null) {
  const n=state.negotiation;
  n.status='blocked';n.block={code,message,at:engine.now()};n.currentTurnId=null;
  engine.event(state,'negotiation_blocked',source,{code,message},`The negotiation is paused. ${message}\nYou can each change your own brief. When you're ready to try again, send:\n${engine.command(`NEGOTIATE ${state.id}`)}`);
}
function queue(engine,state,kind,{board=null,notes=[],attempt=0,repairOf=null}={}) {
  const n=state.negotiation,role=kind==='proposal'?'lead':'creator';
  const turn={id:'T'+randomUUID().replaceAll('-',''),run:n.run,kind,role,status:'queued',createdAt:engine.now(),fingerprint:fingerprint(state),briefs:bindings(state),boardRevision:board?.revision ?? null,boardHash:board?digest(board.body):null,notes,attempt,repairOf,requestEventId:null,requestId:null,replyId:null,invocationId:null,error:null};
  n.turns.push(turn);n.currentTurnId=turn.id;n.status=kind==='proposal'?'lead_queued':'creator_queued';n.block=null;
  const target=board?`Please review storyboard v${board.revision}.`:'Please draft a four-panel storyboard that fits both accepted briefs.';
  turn.requestEventId=engine.event(state,'negotiation_turn_requested',null,{turnId:turn.id,run:n.run,kind,role,briefs:turn.briefs,boardRevision:turn.boardRevision,boardHash:turn.boardHash,attempt},`@${state.principals.agents[role].name} your turn. ${target}${notes.length?`\nFeedback to address: ${notes.join(' ')}`:''}\nYou can't sign for the owners. If you need one of them to change their brief, ask and I'll pause for them.\n\n${negotiationMarker}${state.id} ${turn.id}]`);
  return turn;
}
function nextProposal(engine,state,notes=[]) {
  const n=state.negotiation;
  if (n.proposalCount>=n.maxProposals) {block(engine,state,'ROUND_LIMIT','The two-proposal limit was reached. No approvable final revision was prepared.');return;}
  queue(engine,state,'proposal',{notes});
}
export function advanceNegotiation(engine,state) {
  const n=state.negotiation;
  if (!n?.enabled) return;
  const pending=state.amendments.filter(item=>item.status==='pending');
  if (pending.length) {
    cancelTurn(engine,state,'An owner amendment is pending.');n.status='needs_human';return;
  }
  if (roles.some(role=>!state.briefs[role].at(-1).adoption)) {cancelTurn(engine,state,'Current mandates are not adopted.');n.status='waiting_mandates';return;}
  const current=fingerprint(state);
  if (n.fingerprint!==current) {
    cancelTurn(engine,state,'The adopted brief bindings changed.');
    n.fingerprint=current;n.waitingAmendmentId=null;
    nextProposal(engine,state,['The owners changed their terms. Use only the current adopted brief revisions; earlier proposals and reviews are stale.']);return;
  }
  if (n.status==='needs_human') {
    if(state.currentBundle) {n.status='awaiting_humans';return;}
    const request=state.amendments.find(item=>item.id===n.waitingAmendmentId);
    block(engine,state,request?.status==='declined'?'OWNER_DECLINED':'OWNER_DECISION_RESOLVED',request?.status==='declined'?'The owner declined the proposed amendment. Their unchanged terms remain binding; no compromise or consent was inferred.':'The human question is resolved. Review the unchanged terms before explicitly restarting negotiation.');return;
  }
  if (['waiting_mandates','idle'].includes(n.status)) nextProposal(engine,state);
}
export function restartNegotiation(engine,state,source) {
  demand(state.negotiation?.enabled,'NEGOTIATION_DISABLED','Automatic negotiation is not enabled for this case.');
  demand(state.negotiation.status==='blocked','NEGOTIATION_ACTIVE','A fresh run can be requested only after negotiation has stopped.');
  demand(!state.amendments.some(item=>item.status==='pending'),'HUMAN_DECISION_PENDING','The affected owner must resolve the pending amendment first.');
  demand(roles.every(role=>state.briefs[role].at(-1).adoption),'MANDATES_REQUIRED','Both current briefs must be adopted.');
  const n=state.negotiation;n.run++;n.proposalCount=0;n.status='idle';n.waitingAmendmentId=null;n.block=null;n.fingerprint=fingerprint(state);state.currentBundle=null;
  engine.event(state,'negotiation_restarted',source,{run:n.run},'Starting a fresh negotiation. The lead\'s advocate gets up to two tries.');
  advanceNegotiation(engine,state);
}
export function claimTurn(engine,state) {
  advanceNegotiation(engine,state);
  const turn=activeTurn(state);
  if(!turn || turn.status!=='queued') return null;
  const sent=engine.db.prepare('SELECT state,message_id FROM court_outbox WHERE event_id=?').get(turn.requestEventId);
  if(sent?.state!=='sent' || !sent.message_id) return null;
  turn.status='running';turn.requestId=sent.message_id;turn.claimedAt=engine.now();turn.invocationId=`negotiation-${turn.id}`;
  state.negotiation.status=turn.kind==='proposal'?'lead_working':'creator_working';
  engine.event(state,'negotiation_turn_started',null,{turnId:turn.id,role:turn.role,requestId:turn.requestId},null);
  return structuredClone(turn);
}
export function turnIsCurrent(state,turnId) {
  const turn=activeTurn(state);
  return !!turn && turn.id===turnId && ['running','awaiting_reply'].includes(turn.status) && turn.fingerprint===fingerprint(state) && !state.amendments.some(item=>item.status==='pending');
}
export function failTurn(engine,state,turnId,{code='PROVIDER_FAILED',message='The advocate turn failed.',repairable=false,source=null}={}) {
  if(!turnIsCurrent(state,turnId)) return false;
  const turn=activeTurn(state);turn.status='failed';turn.error=message;turn.replyId=source?.id ?? turn.replyId;
  engine.event(state,'negotiation_turn_failed',source,{turnId,code,message,attempt:turn.attempt},null);
  if(repairable && turn.attempt<1) {
    queue(engine,state,turn.kind,{board:turn.boardRevision?state.boards.find(item=>item.revision===turn.boardRevision):null,notes:[...turn.notes,`Repair the invalid structured reply: ${message}`],attempt:turn.attempt+1,repairOf:turn.id});
  } else block(engine,state,code,repairable?'The advocate reply remained invalid after one repair. No final preview was prepared.':message,source);
  return true;
}
// A queued turn waits for a confirmed clerk request. If that post failed and
// never appeared in the room, stop visibly instead of waiting forever.
export function expireQueuedTurn(engine,state,turnId,{code='TURN_REQUEST_UNDELIVERED',message='The clerk could not confirm delivery of the scheduled advocate request. No model was started.'}={}) {
  const turn=activeTurn(state);
  if(!turn || turn.id!==turnId || turn.status!=='queued') return false;
  const sent=engine.db.prepare('SELECT state FROM court_outbox WHERE event_id=?').get(turn.requestEventId);
  if(sent?.state==='sent') return false;
  turn.status='failed';turn.error=message;
  engine.db.prepare("UPDATE court_outbox SET state='cancelled',error=? WHERE event_id=? AND state IN ('pending','sending','uncertain')").run(message,turn.requestEventId);
  engine.event(state,'negotiation_turn_failed',null,{turnId,code,message,attempt:turn.attempt},null);
  block(engine,state,code,message);
  return true;
}
function validateReply(state,turn,value) {
  if(turn.kind==='proposal') {
    fields(value,['summary','board'],'Lead reply');text(value.summary,'summary',1200);
    const board=validateBoard(value.board);
    demand(roles.every(role=>board.briefs[role]===turn.briefs[role].ref),'STALE_BRIEF','Lead output must name the exact current brief references.');
    return {summary:value.summary,board};
  }
  fields(value,['summary','boardRevision','boardHash','decision','revisionNotes','amendment'],'Creator review');
  text(value.summary,'summary',1200);strings(value.revisionNotes,'revisionNotes');
  demand(value.boardRevision===turn.boardRevision && value.boardHash===turn.boardHash,'WRONG_REVIEW_TARGET','Creator review must bind the exact scheduled board revision and hash.');
  demand(['recommend','revise','amend','blocked'].includes(value.decision),'INVALID_SCHEMA','Unknown creator review decision.');
  if(value.decision==='amend') {
    fields(value.amendment,['briefRef','replacement','reason'],'Amendment');text(value.amendment.reason,'amendment reason');
    const brief=roles.map(role=>state.briefs[role].at(-1)).find(item=>item.ref===value.amendment.briefRef);
    demand(brief,'STALE_BRIEF','The amendment must name a current brief.');
    validateBrief(value.amendment.replacement,state.catalog);
    demand(digest(value.amendment.replacement)!==brief.hash,'NO_CHANGE','An amendment must propose an actual brief change.');
  } else demand(value.amendment===null,'INVALID_SCHEMA','Only an amend decision may contain a brief replacement.');
  if(value.decision==='recommend') demand(value.revisionNotes.length===0,'INVALID_SCHEMA','A recommendation with unresolved revision notes is not final.');
  if(['revise','blocked'].includes(value.decision)) demand(value.revisionNotes.length>0,'INVALID_SCHEMA','Explain the revision or blocking issue in revisionNotes.');
  return structuredClone(value);
}
export function completeTurn(engine,state,command,source,actor) {
  const turn=activeTurn(state);
  demand(turnIsCurrent(state,command.turnId),'STALE_TURN','This negotiation turn is no longer active. Late or duplicate replies cannot advance it.');
  demand(actor.kind==='agent' && actor.role===turn.role,'WRONG_TURN_ACTOR','Only the scheduled advocate can answer this turn.');
  engine.fresh(source,turn.createdAt);
  let value;
  try {
    value=validateReply(state,turn,command.value);
    if(turn.kind==='review' && value.decision==='recommend') {
      const board=state.boards.at(-1);
      demand(board?.revision===turn.boardRevision && !board.stale && board.checks.every(check=>check.passed),'CHECKS_FAILED','A creator recommendation cannot override failed board checks. Request a revision or an owner amendment.');
    }
  } catch(error) {
    if(!(error instanceof CourtError)) throw error;
    failTurn(engine,state,turn.id,{code:error.code,message:error.message,repairable:true,source});
    return {accepted:false,code:error.code,repairQueued:state.negotiation.status!=='blocked'};
  }
  const n=state.negotiation;
  if(turn.kind==='proposal') {
    const board=engine.recordBoard(state,value.board,source,{deferPreparation:true,turnId:turn.id});
    turn.status='completed';turn.replyId=source.id;turn.summary=value.summary;n.proposalCount++;
    engine.event(state,'negotiation_proposal_received',source,{turnId:turn.id,revision:board.revision,summary:value.summary},`The lead's advocate drafted storyboard v${board.revision}. The creator's advocate will review it next. Nothing needs your attention yet.`);
    queue(engine,state,'review',{board});
    return {accepted:true,kind:'negotiation_proposal_received',revision:board.revision};
  }
  let requested;
  if(value.decision==='amend') requested=engine.apply(state,{type:'REQUEST',ref:value.amendment.briefRef,value:value.amendment.replacement},source);
  const review={...value,turnId:turn.id,sourceId:source.id,sender:source.sender,at:engine.now()};
  n.reviews.push(review);turn.status='completed';turn.replyId=source.id;turn.summary=value.summary;n.currentTurnId=null;
  engine.event(state,'negotiation_review_received',source,{review},`The creator's advocate reviewed storyboard v${turn.boardRevision}: ${value.summary}\n${({recommend:'It recommends this version.',revise:'It asked for changes.',amend:'It wants an owner to change their brief.',block:'It refused this version.'})[value.decision] ?? `Decision: ${value.decision}.`} This is the AI's opinion, not a signature.${value.amendment?`\nWhy: ${value.amendment.reason}`:''}`);
  if(value.decision==='recommend') {
    engine.prepareBoard(state,state.boards.at(-1),source,review);n.status='awaiting_humans';
  } else if(value.decision==='amend') {n.waitingAmendmentId=requested.requestId;n.status='needs_human';}
  else if(value.decision==='revise') nextProposal(engine,state,value.revisionNotes);
  else block(engine,state,'CREATOR_BLOCKED',value.revisionNotes.join(' '),source);
  return {accepted:true,kind:'negotiation_review_received',decision:value.decision,revision:turn.boardRevision};
}

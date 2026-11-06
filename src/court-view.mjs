import { roles } from './court-schema.mjs';

// A stable, read-only presentation contract for the courtroom frontend. It is a
// projection of persisted engine state and the clerk's actual room messages;
// it never decides anything and adds no authority.
export const courtViewVersion = 'cvc-court-view-v1';

const speakerOf = (state, sender) => {
  if (!sender) return 'clerk';
  if (sender === state.principals.clerk.sender) return 'clerk';
  for (const role of roles) {
    if (sender === state.principals.humans[role].sender) return `owner:${role}`;
    if (sender === state.principals.agents[role].sender) return role;
  }
  return 'unknown';
};
const roomText = reply => reply ? reply.replace(/^\[CVC_EVENT [^\]]*\]\n?/, '') : null;

function beat(state, row) {
  const data = row.data, actor = speakerOf(state, data.actor);
  const base = {id:row.id, at:row.at, kind:row.kind, sourceId:row.source_id, text:roomText(row.reply), roomMessageId:row.reply_message_id ?? null, delivery:row.delivery ?? null};
  switch (row.kind) {
    case 'case_created': return {...base, type:'filing', speaker:'clerk'};
    case 'negotiation_enabled': case 'negotiation_restarted': return {...base, type:'procedure', speaker:row.kind==='negotiation_restarted'?actor:'clerk', run:data.run ?? 1};
    case 'brief_adopted': return {...base, type:'mandate', speaker:actor, role:data.role, ref:data.ref};
    case 'brief_amended': return {...base, type:'mandate', speaker:actor, role:data.role, ref:data.next.ref, replaces:data.previous};
    case 'negotiation_turn_requested': return {...base, type:'summons', speaker:'clerk', target:data.role, turnId:data.turnId, phase:data.kind, boardRevision:data.boardRevision};
    case 'negotiation_turn_started': return {...base, type:'deliberating', speaker:data.role, turnId:data.turnId};
    case 'negotiation_proposal_received': return {...base, type:'proposal', speaker:'lead', quote:data.summary, boardRevision:data.revision, turnId:data.turnId};
    case 'board_checks_passed': return {...base, type:'ruling', speaker:'clerk', passed:true, boardRevision:data.revision, checks:data.checks};
    case 'check_failed': return {...base, type:'objection', speaker:'clerk', basis:'rules', boardRevision:data.revision, failed:data.checks.filter(check=>!check.passed)};
    case 'negotiation_review_received': {
      const review = data.review;
      return {...base, type:review.decision==='recommend'?'endorsement':'objection', basis:'review', speaker:'creator', quote:review.summary, decision:review.decision, boardRevision:review.boardRevision, notes:review.revisionNotes, ownerQuestion:review.amendment?.reason ?? null};
    }
    case 'amendment_requested': return {...base, type:'appeal', speaker:'clerk', requestedBy:actor, awaiting:`owner:${data.request.role}`, requestId:data.request.id, baseRef:data.request.baseRef};
    case 'amendment_accepted': case 'amendment_declined': return {...base, type:'decision', speaker:actor, requestId:data.request.id, accepted:row.kind==='amendment_accepted', ref:data.request.decision?.ref ?? null};
    case 'preview_ready': return {...base, type:'draft_verdict', speaker:'clerk', boardRevision:data.revision, digest:data.digest};
    case 'approval_recorded': return {...base, type:'signature', speaker:actor, role:data.approval.role, boardRevision:data.approval.revision, digest:data.approval.digest};
    case 'approval_revoked': return {...base, type:'withdrawal', speaker:actor, role:data.role, boardRevision:data.revision};
    case 'artifact_approved': return {...base, type:'verdict', speaker:'clerk', boardRevision:data.revision, digest:data.digest};
    case 'negotiation_blocked': return {...base, type:'recess', speaker:'clerk', code:data.code, reason:data.message};
    case 'negotiation_turn_failed': return {...base, type:'turn_failed', speaker:'clerk', code:data.code, reason:data.message, turnId:data.turnId};
    // An advocate trying to decide for a human is the court's signature moment.
    case 'command_rejected': return {...base, type:'overruled', speaker:actor, code:data.code, command:data.command, reason:data.message, agentOverreach:data.code==='HUMAN_REQUIRED' && roles.includes(actor)};
    default: return {...base, type:'note', speaker:actor};
  }
}
export const hiddenBeat = row => row.kind === 'status';
export const toBeat = (state, row) => beat(state, row);

function phase(snapshot) {
  const n = snapshot.negotiation, owner = role => snapshot.principals.humans[role].username;
  switch (snapshot.stage) {
    case 'AWAITING_MANDATES': {
      const missing = roles.filter(role => !snapshot.briefs[role].at(-1).adoption);
      return {code:'FILING', label:'Awaiting mandates', detail:`${missing.map(owner).join(' and ')} must adopt their brief.`, speaker:null, waitingOn:missing.map(role=>`owner:${role}`)};
    }
    case 'NEEDS_HUMAN': {
      const request = snapshot.amendments.find(item => item.status === 'pending');
      return {code:'RECESS', label:'Court in recess', detail:`Only ${owner(request.role)} can decide ${request.id}. No advocate turns run until then.`, speaker:`owner:${request.role}`, waitingOn:[`owner:${request.role}`]};
    }
    case 'NEGOTIATING': {
      const lead = /^lead_/.test(n.status);
      return {code:'ARGUMENT', label:lead?'Lead advocate is proposing':'Creator advocate is reviewing', detail:n.status.endsWith('_working')?'The advocate is preparing its structured turn.':'The clerk has summoned the advocate.', speaker:lead?'lead':'creator', waitingOn:[lead?'lead':'creator']};
    }
    case 'NEGOTIATION_BLOCKED': return {code:'DEADLOCK', label:'Negotiation paused', detail:n.block?.message ?? 'The bounded run stopped.', speaker:'clerk', waitingOn:roles.map(role=>`owner:${role}`)};
    case 'AWAITING_APPROVALS': {
      const signed = new Set(snapshot.currentApprovals.map(approval => approval.role));
      const missing = roles.filter(role => !signed.has(role));
      return {code:'SIGNATURES', label:'Awaiting signatures', detail:`${missing.map(owner).join(' and ')} must approve the exact bundle.`, speaker:null, waitingOn:missing.map(role=>`owner:${role}`)};
    }
    case 'APPROVED': return {code:'VERDICT', label:'Approved by both owners', detail:'The exact reviewed bundle is approved and exportable.', speaker:'clerk', waitingOn:[]};
    default: return {code:snapshot.stage, label:snapshot.stage.replaceAll('_',' ').toLowerCase(), detail:null, speaker:null, waitingOn:[]};
  }
}

export function courtView(snapshot, rows, {base = ''} = {}) {
  const board = snapshot.boards.at(-1) ?? null, signed = new Set(snapshot.currentApprovals.map(approval => approval.role));
  const path = board ? `${base}/api/cases/${snapshot.id}/boards/${board.revision}` : null;
  const pending = snapshot.amendments.find(item => item.status === 'pending');
  const action = snapshot.commands.amendments.find(item => item.id === pending?.id);
  return {
    version:courtViewVersion, caseId:snapshot.id, stage:snapshot.stage, phase:phase(snapshot),
    cast:{
      clerk:{name:snapshot.principals.clerk.name, kind:'deterministic', authority:'Enforces rules and records decisions. Cannot decide for a human.'},
      advocates:Object.fromEntries(roles.map(role => [role, {name:snapshot.principals.agents[role].name, represents:snapshot.principals.humans[role].username, authority:'Proposes and reviews. Cannot adopt, accept or approve.'}])),
      owners:Object.fromEntries(roles.map(role => {const brief = snapshot.briefs[role].at(-1); return [role, {username:snapshot.principals.humans[role].username, briefRef:brief.ref, adopted:!!brief.adoption, signed:signed.has(role), brief:brief.content}];}))
    },
    question:pending ? {requestId:pending.id, owner:`owner:${pending.role}`, replaces:pending.baseRef, replacement:pending.content, reason:snapshot.negotiation?.reviews.find(review => review.sourceId === pending.sourceId)?.amendment?.reason ?? null, accept:action.accept, decline:action.decline} : null,
    negotiation:snapshot.negotiation ? {status:snapshot.negotiation.status, run:snapshot.negotiation.run, proposals:snapshot.negotiation.proposalCount, maxProposals:snapshot.negotiation.maxProposals, block:snapshot.negotiation.block, restart:snapshot.commands.negotiate} : null,
    board:board ? {
      revision:board.revision, title:board.body.title, stale:board.stale, panels:board.body.panels, checks:board.checks, passed:board.checks.every(check => check.passed),
      review:board.review ? {decision:board.review.decision, summary:board.review.summary} : null, bundleDigest:board.bundleDigest,
      preview:board.bundleDigest ? `${path}/preview` : null, manifest:board.bundleDigest ? `${path}/manifest` : null
    } : null,
    approvals:{lead:signed.has('lead'), creator:signed.has('creator'), count:signed.size, command:snapshot.commands.approve},
    adopt:Object.fromEntries(roles.filter(role => !snapshot.briefs[role].at(-1).adoption).map(role => [role, snapshot.commands.adopt[role]])),
    exports:snapshot.stage === 'APPROVED' && board ? {html:`${path}/export`, script:`${path}/script`, receipt:`${path}/receipt`} : null,
    beats:rows.filter(row => !hiddenBeat(row)).map(row => beat(snapshot, row))
  };
}

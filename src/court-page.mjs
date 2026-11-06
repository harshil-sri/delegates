import { escapeHtml as e } from './storyboard.mjs';
import { objectBrief,sampleBoard } from './court-engine.mjs';

const command=value=>`<pre>${e(value)}</pre>`;
function negotiationView(state) {
  const n=state.negotiation;
  if(!n?.enabled)return '';
  return `<article><h3>Automatic storyboard negotiation</h3>
    <p>Lead proposes → creator reviews → owner decides any amendment → lead revises → creator reviews → both humans approve.</p>
    <p>${e(n.status.replaceAll('_',' '))} · ${n.proposalCount}/${n.maxProposals} proposals in this run.</p>
    ${state.stage==='AWAITING_MANDATES'?'<p>Both owners must adopt their briefs before the agents begin. No separate start command is needed.</p>':''}
    ${n.block?`<p>${e(n.block.message)}</p>${state.commands.negotiate?`<p>After resolving the issue, either owner can start a fresh bounded run:</p>${command(state.commands.negotiate)}`:''}`:''}
    ${n.turns.length?`<ol>${n.turns.slice(-8).map(turn=>`<li>${e(turn.role)} ${e(turn.kind)}: ${e(turn.status)}${turn.boardRevision?` · BOARD${turn.boardRevision}`:''}${turn.attempt?' · schema repair':''}</li>`).join('')}</ol>`:''}
    ${n.reviews.slice(-2).map(review=>`<p><strong>Creator review, BOARD${review.boardRevision}:</strong> ${e(review.summary)}${review.amendment?`<br>Owner question: ${e(review.amendment.reason)}`:''}</p>`).join('')}
    <small>An advocate recommendation is advisory. Both people still make their own final approval.</small>
  </article>`;
}
function boardView(state,board) {
  if(!board)return '';
  const path=`/api/cases/${state.id}/boards/${board.revision}`;
  return `<article><h3>BOARD${board.revision}${board.stale?' · stale':''}</h3>
    <p>${e(board.body.title)}</p>
    <ol>${board.body.panels.map(panel=>`<li><strong>${panel.seconds}s · ${e(panel.assetId)}</strong> — ${e(panel.scene)}<pre>${e(panel.onScreen)}</pre></li>`).join('')}</ol>
    <ul>${board.checks.map(check=>`<li>${check.passed?'PASS':'FAIL'}: ${e(check.detail)}</li>`).join('')}</ul>
    ${board.bundleDigest?`<p><a href="${path}/preview">Storyboard preview</a> · <a href="${path}/script-preview">Script preview</a> · <a href="${path}/manifest">Exact review bundle</a></p>`:'<p>This candidate has no prepared approval bundle yet.</p>'}
    ${state.commands.approve?`<p>After inspecting the preview, each owner sends the same command from their own account:</p>${command(state.commands.approve)}<p>Approved by: ${state.currentApprovals.map(approval=>e(state.principals.humans[approval.role].username)).join(', ')||'neither owner'}</p><p>To withdraw your own current approval, replace APPROVE with REVOKE in that command.</p>`:''}
    ${state.stage==='APPROVED'?`<p><a href="${path}/export">Approved HTML</a> · <a href="${path}/script">Approved script</a> · <a href="${path}/receipt">Approval receipt</a></p>`:''}
  </article>`;
}
export function renderCasePage(cases,roomUrl,ingestion=null) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="10"><title>Creative Veto Court</title>
  <style>body{font:16px system-ui;line-height:1.5;background:#f4f1e9;color:#182d26;margin:32px auto;max-width:1000px;padding:0 20px}article,section{background:white;padding:24px;margin:20px 0;border:1px solid #cad3c6;border-radius:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf2ea;padding:14px;font-size:13px}a{color:#125846}.briefs{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}small{color:#486552}</style>
  <h1>Creative Veto Court</h1><p>Review terms and storyboards here. Send decisions from your own account in the <a href="${e(roomUrl)}">Switch / Mattermost room</a>. This page refreshes every 10 seconds.</p>${ingestion?.state==='paused'?`<section role="alert"><strong>Room ingestion is paused.</strong> New decisions are not being recorded until it resumes. ${e(ingestion.reason)}</section>`:''}
  ${cases.map(state=>{
    const briefs=Object.fromEntries(['lead','creator'].map(role=>[role,state.briefs[role].at(-1)]));
    return `<section><h2>${e(state.id)} · ${e(state.stage)}</h2><p>${state.currentApprovals.length}/2 approvals on the current bundle.</p>
    <div class="briefs">${['lead','creator'].map(role=>`<article><h3>${e(role)} · ${e(briefs[role].ref)}</h3><p>Owner: ${e(state.principals.humans[role].username)} · ${briefs[role].adoption?'adopted':'awaiting adoption'}</p>${command(JSON.stringify(briefs[role].content,null,2))}${!briefs[role].adoption?`<p>After review, this owner sends:</p>${command(state.commands.adopt[role])}`:''}</article>`).join('')}</div>
    ${negotiationView(state)}
    ${state.commands.amendments.map(action=>{
      const amendment=state.amendments.find(item=>item.id===action.id);
      return `<article><h3>${e(action.id)} · Only ${e(state.principals.humans[action.role].username)} may decide</h3><p>Replace ${e(amendment.baseRef)} with this complete brief:</p>${command(JSON.stringify(amendment.content,null,2))}<p>Accept this exact replacement:</p>${command(action.accept)}<p>Or preserve the current terms:</p>${command(action.decline)}</article>`;
    }).join('')}
    ${boardView(state,state.boards.at(-1))}
    <details><summary>Owner edits and manual commands</summary><p>Only a brief's owner may directly replace it:</p><pre>@cvc-clerk AMEND ${e(state.id)} &lt;current H/D revision&gt; &lt;complete replacement brief JSON&gt;</pre>
    ${!state.negotiation?.enabled?`<p>Sample object-based amendment request:</p>${command(`@cvc-clerk REQUEST ${state.id} ${briefs.lead.ref} ${JSON.stringify(objectBrief)}`)}<p>Sample board against the current revisions:</p>${command(`@cvc-clerk PROPOSE ${state.id} ${JSON.stringify(sampleBoard(briefs.lead.ref,briefs.creator.ref))}`)}`:'<p>The automatic workflow schedules structured agent turns. Manual PROPOSE commands cannot bypass the creator review.</p>'}</details>
    <p><a href="/api/cases/${state.id}">Case JSON</a> · <a href="/api/cases/${state.id}/events">Decision log</a></p></section>`;
  }).join('')}
  <small>Approvals attest to the chat accounts that sent decisions. The system cannot verify that a person actually read the preview.</small></html>\n`;
}

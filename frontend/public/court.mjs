import { benchMarkup } from './judges.mjs';
import { avatarMarkup, setAvatarState } from './avatars.mjs';

// The live court reads the clerk's read-only stream through this server's
// /api proxy. Without a running clerk it replays a real recorded rehearsal,
// clearly labelled. It never sends anything: decisions happen in Switch.
const CASE = new URLSearchParams(location.search).get('case') || 'C01';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const gsapReady = () => window.gsap && !reduced;
const perspectives = {arata: 'The letter', vale: 'Feasibility', thorne: 'Consent'};
const ROLE_JUDGES = {thorne: /REQUIRES|FORBIDS|ASSET:/, vale: /FOUR_PANELS|THIRTY_SECONDS/, arata: /COPY|FINAL|ASSET:/};

const state = {mode: 'connecting', view: null, boards: new Map(), briefs: null, seenBeats: new Set()};

// ── Text helpers ────────────────────────────────────────────────────────────
function clean(text) {
  return String(text ?? '')
    .replace(/@cvc-[a-z-]+\s*/g, '')
    .replace(/\[CVC_[A-Z_]+[^\]]*\]\s*/g, '')
    .replace(/\{[\s\S]*\}/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/,? ?hash [a-f0-9]{64}/g, '')
    .replace(/\b[a-f0-9]{64}\b/g, '…')
    .replace(/\s+/g, ' ').trim();
}
function speakerName(speaker, view = state.view) {
  if (!view) return speaker;
  if (speaker === 'clerk') return 'The clerk';
  if (speaker === 'lead' || speaker === 'creator') return speaker === 'lead' ? 'Lead advocate' : 'Creator advocate';
  if (speaker?.startsWith('owner:')) return view.cast.owners[speaker.slice(6)]?.username ?? 'Owner';
  return 'Unknown';
}
const kindLabel = {filing: 'Filing', procedure: 'Procedure', mandate: 'Mandate adopted', summons: 'Summons', deliberating: 'Deliberating', proposal: 'Motion', ruling: 'Ruling of the checks', objection: 'Objection', endorsement: 'Recommendation', appeal: 'Recess · human decision', decision: 'Owner decision', draft_verdict: 'Frozen for signature', signature: 'Signature', withdrawal: 'Withdrawal', verdict: 'Verdict', recess: 'Negotiation paused', turn_failed: 'Turn failed', overruled: 'Overruled'};
function beatLine(beat) {
  switch (beat.type) {
    case 'proposal': return beat.quote;
    case 'endorsement': return beat.quote;
    case 'objection': return beat.basis === 'review' ? beat.quote : `BOARD${beat.boardRevision} fails: ${beat.failed.map(check => check.detail).join(' ')}`;
    case 'appeal': return beat.question || clean(beat.text).split(' replacing ')[0] + '.';
    case 'overruled': return beat.agentOverreach ? 'An advocate tried to make a human decision. The advocate is not the client.' : beat.reason;
    case 'deliberating': return `${speakerName(beat.speaker)} is preparing a structured turn.`;
    case 'recess': case 'turn_failed': return beat.reason;
    default: return clean(beat.text) || kindLabel[beat.type] || beat.kind;
  }
}

// ── Stage setup ─────────────────────────────────────────────────────────────
$('#bench-host').innerHTML = benchMarkup({perspectives});
$('#avatar-lead').innerHTML = avatarMarkup('codex', 'left');
$('#avatar-creator').innerHTML = avatarMarkup('codex-alt', 'right');
const stage = $('#stage'), scene = $('#court-scene');
const judgeEl = id => scene.querySelector(`[data-judge="${id}"]`);
const setJudges = cls => ['arata', 'vale', 'thorne'].forEach(id => judgeEl(id)?.setAttribute('class', `judge ${cls[id] ?? cls.all ?? 'is-listening'}`));
const avatars = {lead: () => $('#avatar-lead .advocate-avatar'), creator: () => $('#avatar-creator .advocate-avatar')};
function setAdvocates(active, mood) {
  for (const role of ['lead', 'creator']) {
    setAvatarState(avatars[role](), role === active ? mood : 'idle');
    $(`#podium-${role}`).classList.toggle('is-active', role === active);
  }
}
function replayEvent(event) { stage.dataset.event = ''; void stage.offsetWidth; stage.dataset.event = event; }

// ── Phase title, caption and stamp choreography ─────────────────────────────
function setPhase(phase) {
  if (!phase) return;
  $('#phase-code').textContent = phase.code;
  const h1 = $('#phase-label');
  if (h1.dataset.text === phase.label) { $('#phase-detail').textContent = phase.detail ?? ''; return; }
  h1.dataset.text = phase.label;
  h1.innerHTML = phase.label.split(' ').map(word => `<span class="w"><span>${esc(word)}</span></span>`).join(' ');
  $('#phase-detail').textContent = phase.detail ?? '';
  if (gsapReady()) gsap.fromTo(h1.querySelectorAll('.w>span'), {yPercent: 110}, {yPercent: 0, duration: .9, ease: 'expo.out', stagger: .05});
}
function setCaption(beat) {
  $('#caption-speaker').textContent = speakerName(beat.speaker);
  $('#caption-kind').textContent = kindLabel[beat.type] ?? beat.kind;
  const quote = $('#caption-text'), line = beatLine(beat) ?? '';
  quote.textContent = line;
  if (gsapReady() && line.length < 420) {
    quote.innerHTML = [...line].map(c => `<span class="ch">${esc(c)}</span>`).join('');
    gsap.to(quote.querySelectorAll('.ch'), {opacity: 1, duration: .01, stagger: Math.min(.018, 1.6 / line.length), ease: 'none'});
  }
}
function stamp(text, tone = 'bad') {
  const el = $('#stamp');
  el.dataset.tone = tone; $('#stamp-text').textContent = text;
  if (!gsapReady()) { el.style.opacity = 1; setTimeout(() => { el.style.opacity = 0; }, 1600); return; }
  gsap.timeline()
    .fromTo(el, {opacity: 0, scale: 2.6, rotate: -18}, {opacity: 1, scale: 1, rotate: -8, duration: .38, ease: 'power4.in'})
    .fromTo(stage, {x: -8, y: 4}, {x: 0, y: 0, duration: .5, ease: 'elastic.out(1,.3)'}, '>-0.02')
    .to(el, {opacity: 0, scale: 1.08, duration: .6, delay: 1.1, ease: 'power2.out'});
}

// ── Case file rendering ─────────────────────────────────────────────────────
function renderBriefs(owners, briefs) {
  $('#briefs').innerHTML = ['lead', 'creator'].map(role => {
    const owner = owners[role], brief = briefs?.[role] ?? owner.brief, content = brief.content ?? brief;
    const adopted = brief.adopted ?? owner.adopted;
    return `<div class="brief" data-role="${role}"><span class="seal ${adopted ? '' : 'pending'}">${adopted ? 'ADOPTED' : 'DRAFT'}</span>
      <span class="eyebrow">${role === 'lead' ? 'Lead' : 'Creator'} · ${esc(brief.ref ?? owner.briefRef)}</span><h3>${esc(owner.username)}</h3><span class="who">${esc(content.goal)}</span>
      <dl><div><dt>Must include</dt><dd>${[...content.requiredAssets, ...content.requiredCopy].map(item => `<span class="tag">${esc(item)}</span>`).join('') || '—'}</dd></div>
      <div><dt>Will not allow</dt><dd>${content.forbiddenAssets.map(item => `<span class="tag forbid">${esc(item)}</span>`).join('') || '—'}</dd></div>
      <div><dt>Closing line</dt><dd>${content.finalCopy.map(item => `<span class="tag">${esc(item)}</span>`).join('') || '—'}</dd></div></dl></div>`;
  }).join('');
}
function renderBoard(board, {animate = false} = {}) {
  const grid = $('#board');
  if (!board) { grid.innerHTML = '<div class="board-empty">The advocates have not proposed a storyboard yet.</div>'; $('#checks').innerHTML = ''; return; }
  $('#board-title').textContent = board.title;
  const total = board.panels.reduce((sum, panel) => sum + panel.seconds, 0);
  $('#board-meta').textContent = `BOARD${board.revision} · ${board.panels.length} panels · ${total}s${board.stale ? ' · superseded' : ''}`;
  grid.innerHTML = board.panels.map((panel, index) => {
    const known = ['notebook', 'hands-sketch', 'light-trails', 'signal-mark'].includes(panel.assetId);
    return `<div class="card" data-asset="${esc(panel.assetId)}"><span class="sec">${index + 1} · ${panel.seconds}s</span>
      ${known ? `<img src="/storyboard/${panel.assetId}.svg" alt="${esc(panel.assetId)}">` : `<div class="missing">${esc(panel.assetId)}<br>not permitted</div>`}
      <div class="on">${esc(panel.onScreen)}</div><p>${esc(panel.scene)}</p><span class="veto">Vetoed</span></div>`;
  }).join('');
  $('#checks').innerHTML = (board.checks ?? []).map(check => `<li data-pass="${check.passed}">${check.passed ? '✓' : '✕'} ${esc(check.detail)}</li>`).join('');
  if (animate && gsapReady()) gsap.from(grid.querySelectorAll('.card'), {y: 60, rotate: (i) => (i - 1.5) * 4, opacity: 0, duration: .8, ease: 'expo.out', stagger: .08});
}
function vetoCards(failed) {
  const codes = failed.map(check => check.code).join(' ');
  document.querySelectorAll('#board .card').forEach(card => {
    if (codes.includes(card.dataset.asset)) {
      card.classList.add('is-vetoed');
      if (gsapReady()) gsap.fromTo(card.querySelector('.veto'), {scale: 2.2, opacity: 0}, {scale: 1, opacity: 1, duration: .35, ease: 'power4.in'});
    }
  });
}
function renderSeals(view, signed = view.approvals) {
  $('#seals').innerHTML = ['lead', 'creator'].map(role => `<div class="seal-slot ${signed[role] ? 'is-signed' : ''}" data-role="${role}"><div class="wax">${signed[role] ? '§' : ''}</div><strong>${esc(view.cast.owners[role].username)}</strong><span>${signed[role] ? 'Signed this exact bundle' : 'Not signed'}</span></div>`).join('');
  $('#exports').innerHTML = view.exports ? `<a href="${view.exports.html}">Approved storyboard</a><a href="${view.exports.script}">Script</a><a href="${view.exports.receipt}">Consent receipt</a>` : '';
  if (view.approvals?.command && state.mode === 'live' && view.approvals.count < 2) $('#sign-note').innerHTML = `Each owner sends this from their own account in Switch:<code>${esc(view.approvals.command)}</code>`;
}
function renderQuestion(question, view) {
  const section = $('#question');
  if (!question) { section.hidden = true; return; }
  section.hidden = false;
  $('#question-title').textContent = question.reason || `Should ${question.replaces} be replaced?`;
  $('#question-detail').textContent = `Only ${view.cast.owners[question.owner.slice(6)].username} can decide ${question.requestId}. No advocate turn runs until they do.`;
  $('#question-owner').textContent = view.cast.owners[question.owner.slice(6)].username;
  $('#question-accept').textContent = question.accept; $('#question-decline').textContent = question.decline;
}
function addBeat(beat) {
  if (state.seenBeats.has(beat.id) || beat.type === 'deliberating') return;
  state.seenBeats.add(beat.id);
  const li = document.createElement('li');
  li.className = 'beat'; li.dataset.type = beat.type;
  const time = new Date(beat.at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
  li.innerHTML = `<span class="n">${String(beat.id).padStart(3, '0')}</span><span class="who">${esc(speakerName(beat.speaker))}</span><span class="what"><b>${esc(kindLabel[beat.type] ?? beat.type)}</b><span>${esc((beatLine(beat) ?? '').slice(0, 320))}</span><small>${time}${beat.roomMessageId ? ` · Switch ${esc(beat.roomMessageId)}` : beat.sourceId ? ` · source ${esc(beat.sourceId)}` : ''}</small></span>`;
  const list = $('#beats');
  list.prepend(li);
  if (gsapReady()) gsap.from(li, {height: 0, opacity: 0, duration: .5, ease: 'power3.out'});
}

// ── Choreography: what the room does for each kind of beat ──────────────────
function perform(beat) {
  const speaker = beat.speaker === 'lead' || beat.speaker === 'creator' ? beat.speaker : beat.target ?? 'clerk';
  scene.dataset.speaker = speaker;
  setCaption(beat);
  addBeat(beat);
  switch (beat.type) {
    case 'summons': setAdvocates(beat.target, 'thinking'); setJudges({all: 'is-listening'}); replayEvent('statement'); break;
    case 'deliberating': setAdvocates(beat.speaker, 'thinking'); break;
    case 'proposal': setAdvocates('lead', 'speaking'); setJudges({all: 'is-assessing'}); if (state.boards.has(beat.boardRevision)) renderBoard(state.boards.get(beat.boardRevision), {animate: true}); replayEvent('statement'); break;
    case 'objection':
      if (beat.basis === 'rules') {
        const failed = beat.failed.map(check => check.code).join(' ');
        setJudges(Object.fromEntries(Object.entries(ROLE_JUDGES).map(([id, rule]) => [id, rule.test(failed) ? 'is-rejecting' : 'is-accepting'])));
        setAdvocates('lead', 'idle'); vetoCards(beat.failed); stamp('Objection'); replayEvent('objection');
      } else { setAdvocates('creator', 'objecting'); setJudges({all: 'is-listening'}); stamp('Objection'); replayEvent('objection'); }
      break;
    case 'ruling': setJudges({all: 'is-accepting'}); stamp('The checks pass', 'good'); replayEvent('ruling'); break;
    case 'endorsement': setAdvocates('creator', 'pleased'); setJudges({all: 'is-accepting'}); replayEvent('statement'); break;
    case 'appeal': setAdvocates(null); setJudges({all: 'is-listening'}); stamp('Recess', 'amber'); replayEvent('appeal'); break;
    case 'decision': setJudges({all: beat.accepted ? 'is-accepting' : 'is-rejecting'}); stamp(beat.accepted ? 'Amendment accepted' : 'Declined', beat.accepted ? 'good' : 'bad'); replayEvent('statement'); break;
    case 'draft_verdict': setJudges({vale: 'is-speaking', all: 'is-accepting'}); setAdvocates(null); stamp('Frozen for signature', 'gold'); replayEvent('ruling'); break;
    case 'signature': setJudges({thorne: 'is-accepting', all: 'is-listening'}); stamp('Signed', 'gold'); break;
    case 'withdrawal': setJudges({all: 'is-narrowing'}); stamp('Withdrawn', 'amber'); break;
    case 'verdict': setJudges({all: 'is-accepting'}); setAdvocates('lead', 'pleased'); setAdvocates('creator', 'pleased'); stamp('Approved', 'good'); replayEvent('verdict'); break;
    case 'overruled': if (beat.agentOverreach) { setJudges({thorne: 'is-rejecting', all: 'is-assessing'}); setAdvocates(beat.speaker, 'idle'); stamp('Overruled'); replayEvent('objection'); } break;
    case 'recess': case 'turn_failed': setJudges({all: 'is-rejecting'}); setAdvocates(null); stamp('Paused', 'amber'); replayEvent('deadlock'); break;
    case 'mandate': setJudges({all: 'is-accepting'}); replayEvent('statement'); break;
    default: setJudges({all: 'is-listening'}); replayEvent('statement');
  }
}

// ── Replay: rebuild each moment of a real recorded session ──────────────────
function orderBeats(beats) {
  const list = beats.filter(beat => beat.type !== 'status');
  for (let i = 0; i < list.length - 1; i++) {
    const [a, b] = [list[i], list[i + 1]];
    // The clerk records its rule check a moment before it announces the motion.
    if (((a.type === 'objection' && a.basis === 'rules') || a.type === 'ruling') && b.type === 'proposal' && a.boardRevision === b.boardRevision) [list[i], list[i + 1]] = [b, a];
    // Show the creator's objection before the owner question it raised.
    if (a.type === 'appeal' && b.type === 'objection' && b.basis === 'review') { b.question = b.ownerQuestion; a.question = b.ownerQuestion; [list[i], list[i + 1]] = [b, a]; }
  }
  return list;
}
function replayPhase(beat, view, briefs) {
  const owner = role => view.cast.owners[role].username;
  switch (beat.type) {
    case 'filing': case 'procedure': return {code: 'Filing', label: 'A case is filed.', detail: 'Two people, two advocates, one storyboard. Each owner must adopt their own brief.'};
    case 'mandate': return {code: 'Mandates', label: `${owner(beat.role)} adopts ${beat.ref}.`, detail: 'Only the owner of a brief can adopt or change it.'};
    case 'summons': case 'deliberating': return {code: 'Argument', label: beat.target === 'creator' || beat.speaker === 'creator' ? 'The creator advocate reviews.' : 'The lead advocate proposes.', detail: 'A real model turn, posted into the Switch room under its own identity.'};
    case 'proposal': return {code: 'Motion', label: `BOARD${beat.boardRevision} is before the court.`, detail: 'The clerk checks it against both adopted briefs.'};
    case 'objection': return beat.basis === 'rules' ? {code: 'Objection', label: 'The portrait is vetoed.', detail: 'Consent fails: one brief requires the portrait, the other forbids it.'} : {code: 'Objection', label: 'The creator objects.', detail: 'It proposes an object-based treatment and asks the lead owner to amend.'};
    case 'appeal': return {code: 'Recess', label: 'Only a human can decide this.', detail: `The court is silent until ${owner('lead')} answers in Switch. No model runs meanwhile.`};
    case 'decision': return {code: 'Decision', label: `${speakerName(beat.speaker)} ${beat.accepted ? 'accepts' : 'declines'}.`, detail: beat.accepted ? `${beat.ref} replaces the portrait requirement. Every earlier board is now stale.` : 'The original terms stand.'};
    case 'ruling': return {code: 'Ruling', label: `BOARD${beat.boardRevision} passes every check.`, detail: 'Four panels, thirty seconds, permitted assets, exact copy.'};
    case 'endorsement': return {code: 'Recommendation', label: 'The creator advocate recommends it.', detail: 'A recommendation is advisory. It is not consent.'};
    case 'draft_verdict': return {code: 'Signatures', label: 'Frozen. Awaiting two signatures.', detail: 'The exact bundle is hashed. Each owner must approve it from their own account.'};
    default: return null;
  }
}
async function startReplay(note) {
  const replay = await (await fetch('/data/replay-signal.json')).json();
  state.mode = 'replay'; state.view = replay.view; state.briefs = replay.briefs; setCast(replay.view);
  for (const board of replay.boards) state.boards.set(board.revision, board);
  setMode('replay', 'Replay · recorded rehearsal');
  $('#foot-source').textContent = `${note} ${replay.label}`;
  $('#case-id').textContent = replay.caseId;
  const beats = orderBeats(replay.view.beats);
  const bar = $('#replay-bar'); bar.hidden = false;
  let index = 0, playing = true, timer;
  const briefsAt = upto => {
    const out = {};
    for (const role of ['lead', 'creator']) {
      const decided = beats.slice(0, upto + 1).filter(beat => beat.type === 'decision' && beat.accepted && beat.ref?.startsWith(role === 'lead' ? 'H' : 'D')).length;
      const brief = replay.briefs[role][Math.min(decided, replay.briefs[role].length - 1)];
      const adopted = beats.slice(0, upto + 1).some(beat => beat.type === 'mandate' && beat.role === role);
      out[role] = {...brief, adopted};
    }
    return out;
  };
  const show = i => {
    const beat = beats[i];
    renderBriefs(replay.view.cast.owners, briefsAt(i));
    if (i === 0) { renderBoard(null); $('#beats').innerHTML = ''; state.seenBeats.clear(); renderSeals(replay.view, {}); }
    perform(beat);
    setPhase(replayPhase(beat, replay.view) ?? undefined);
    renderQuestion(beat.type === 'appeal' ? {...replay.view.question, reason: beat.question, requestId: beat.requestId, owner: beat.awaiting, replaces: beat.baseRef, accept: `@cvc-clerk ACCEPT ${replay.caseId} ${beat.requestId} …`, decline: `@cvc-clerk DECLINE ${replay.caseId} ${beat.requestId} …`} : null, replay.view);
    $('#replay-progress').style.width = `${((i + 1) / beats.length) * 100}%`;
    $('#replay-count').textContent = `${i + 1} / ${beats.length}`;
  };
  const dwell = beat => ({appeal: 6200, objection: 5200, decision: 4200, draft_verdict: 6000, proposal: 5200, endorsement: 4800, ruling: 4200, deliberating: 1600, summons: 2400})[beat.type] ?? 3200;
  const tick = () => { clearTimeout(timer); show(index); if (index < beats.length - 1) { index++; if (playing) timer = setTimeout(tick, dwell(beats[index - 1])); } else { playing = false; $('#replay-toggle').textContent = 'Play'; } };
  $('#replay-toggle').addEventListener('click', () => { playing = !playing; $('#replay-toggle').textContent = playing ? 'Pause' : 'Play'; if (playing) tick(); else clearTimeout(timer); });
  $('#replay-step').addEventListener('click', () => { playing = false; clearTimeout(timer); $('#replay-toggle').textContent = 'Play'; show(index); if (index < beats.length - 1) index++; });
  $('#replay-restart').addEventListener('click', () => { index = 0; playing = true; $('#replay-toggle').textContent = 'Pause'; tick(); });
  setTimeout(tick, 1400);
}

// ── Live: the clerk's own view model and event stream ───────────────────────
function applyView(view) {
  state.view = view; setCast(view);
  if (view.board) state.boards.set(view.board.revision, view.board);
  setPhase(view.phase);
  renderBriefs(view.cast.owners);
  if (view.board) { const current = $('#board-meta').textContent.startsWith(`BOARD${view.board.revision} `); if (!current) renderBoard(view.board, {animate: true}); }
  else renderBoard(null);
  renderSeals(view);
  renderQuestion(view.question, view);
  $('#case-id').textContent = view.caseId;
  if (view.ingestion?.state === 'paused') setMode('offline', 'Room ingestion paused');
  else if (state.mode === 'live') setMode('live', 'Live · Switch room');
}
async function startLive() {
  const response = await fetch(`/api/cases/${CASE}/court`, {headers: {accept: 'application/json'}});
  if (!response.ok) throw new Error(`court ${response.status}`);
  const view = await response.json();
  state.mode = 'live'; setMode('live', 'Live · Switch room');
  $('#foot-source').textContent = 'Live: read-only view of the clerk. Decisions are made only by the bound humans in the Switch room.';
  applyView(view);
  for (const beat of view.beats.slice(-40)) addBeat(beat);
  const last = view.beats.at(-1); if (last) perform(last);
  const stream = new EventSource(`/api/cases/${CASE}/stream`);
  stream.addEventListener('beat', event => perform(JSON.parse(event.data)));
  stream.addEventListener('court', event => applyView(JSON.parse(event.data)));
  stream.addEventListener('ingestion', event => { const ingestion = JSON.parse(event.data); setMode(ingestion.state === 'paused' ? 'offline' : 'live', ingestion.state === 'paused' ? 'Room ingestion paused' : 'Live · Switch room'); });
  stream.onerror = () => setMode('offline', 'Reconnecting to the clerk');
  stream.onopen = () => setMode('live', 'Live · Switch room');
}
function setCast(view) {
  for (const role of ["lead", "creator"]) {
    $(`#${role}-model`).textContent = "Codex advocate";
    $(`#${role}-name`).textContent = role === "lead" ? "For the lead" : "For the creator";
    $(`#${role}-for`).textContent = `acting for ${view.cast.owners[role].username}`;
  }
}
function setMode(mode, label) { $('#mode').dataset.mode = mode; $('#mode-label').textContent = label; }

// ── Motion: entrance, parallax and scroll reveals ───────────────────────────
function motion() {
  if (!gsapReady()) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.timeline({defaults: {ease: 'expo.out'}})
    .from('.scene-background', {scale: 1.18, filter: 'blur(10px) brightness(.4)', duration: 2.4})
    .from('.layer-bench', {yPercent: 14, opacity: 0, duration: 1.8}, '<0.3')
    .from('.podium', {y: 80, opacity: 0, duration: 1.4, stagger: .12}, '<0.4')
    .from('.top > *', {y: -20, opacity: 0, duration: 1, stagger: .08}, '<')
    .from('.caption', {y: 40, opacity: 0, duration: 1}, '<0.3');
  const layers = [['.scene-background', 14], ['.layer-bench', 7], ['.podium-left', 22], ['.podium-right', 22], ['.phase', -10]];
  const movers = layers.map(([selector, depth]) => ({depth, x: gsap.quickTo(selector, 'x', {duration: 1.2, ease: 'power3'}), y: gsap.quickTo(selector, 'y', {duration: 1.2, ease: 'power3'})}));
  stage.addEventListener('pointermove', event => {
    const rect = stage.getBoundingClientRect(), nx = (event.clientX - rect.left) / rect.width - .5, ny = (event.clientY - rect.top) / rect.height - .5;
    for (const mover of movers) { mover.x(-nx * mover.depth); mover.y(-ny * mover.depth * .6); }
  });
  gsap.to('.scene-background', {yPercent: 8, ease: 'none', scrollTrigger: {trigger: stage, start: 'top top', end: 'bottom top', scrub: true}});
  gsap.to('.layer-bench', {yPercent: -6, ease: 'none', scrollTrigger: {trigger: stage, start: 'top top', end: 'bottom top', scrub: true}});
  gsap.utils.toArray('.reveal').forEach(panel => gsap.from(panel, {y: 70, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: {trigger: panel, start: 'top 88%'}}));
}

motion();
setJudges({all: 'is-listening'});
setAdvocates(null);
startLive().catch(error => startReplay(`The clerk is not reachable here (${error.message}), so this is a replay.`).catch(() => setMode('offline', 'Court unavailable')));

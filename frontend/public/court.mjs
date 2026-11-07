import { pixelateBackgrounds, benchMarkup } from './pixel-judges.mjs';
import { typewrite, emote, soundToggle } from './retro.mjs';
import { avatarMarkup, setAvatarState } from './avatars.mjs';

// The live court reads the clerk's read-only stream through this server's
// /api proxy. Without a running clerk it replays a real recorded rehearsal,
// clearly labelled. It never sends anything: decisions happen in Switch.
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
let reduced = Boolean(motionQuery?.matches);
function handleReducedMotionChange(matches) {
  reduced = Boolean(matches);
  if (reduced && window.gsap) {
    const courtSelectors = [
      '#phase-label',
      '#phase-label span',
      '#caption-text',
      '#caption-text span',
      '#beats .beat',
      '.reveal',
      '.scene-background',
      '.layer-bench',
      '.podium',
      '#stamp',
      '.card',
      '.card .veto'
    ];
    courtSelectors.forEach(sel => {
      try {
        gsap.killTweensOf(sel);
        document.querySelectorAll(sel).forEach(el => {
          el.style.opacity = '1';
          el.style.transform = 'none';
          el.style.visibility = 'visible';
        });
      } catch (_) {}
    });
  }
}
motionQuery?.addEventListener?.('change', event => {
  handleReducedMotionChange(event.matches);
});
const isReducedMotion = () => Boolean(motionQuery?.matches || reduced);
const gsapReady = () => Boolean(window.gsap && !isReducedMotion());

const perspectives = {arata: 'The letter', vale: 'Feasibility', thorne: 'Consent'};
const ROLE_JUDGES = {thorne: /REQUIRES|FORBIDS|ASSET:/, vale: /FOUR_PANELS|THIRTY_SECONDS/, arata: /COPY|FINAL|ASSET:/};

let currentSessionId = 0;

const state = {
  mode: 'connecting',
  view: null,
  boards: new Map(),
  briefs: null,
  seenBeats: new Set(),
  performedBeats: new Set(),
  cursor: 0,
  latestEventId: 0,
  activeStream: null,
  replayTimer: null,
  reconnecting: false,
  sessionId: 0,
  signed: {},
  verdict: false,
};

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
  return speaker || 'Unknown';
}
const kindLabel = {filing: 'Filing', procedure: 'Procedure', mandate: 'Mandate adopted', summons: 'Summons', deliberating: 'Deliberating', proposal: 'Motion', ruling: 'Ruling of the checks', objection: 'Objection', endorsement: 'Recommendation', appeal: 'Recess · human decision', decision: 'Owner decision', draft_verdict: 'Frozen for signature', signature: 'Signature', withdrawal: 'Withdrawal', verdict: 'Verdict', recess: 'Negotiation paused', turn_failed: 'Turn failed', overruled: 'Overruled'};
function beatLine(beat) {
  switch (beat.type) {
    case 'proposal': return beat.quote;
    case 'endorsement': return beat.quote;
    case 'objection': return beat.basis === 'review' ? beat.quote : `BOARD${beat.boardRevision} fails: ${(beat.failed || []).map(check => check.detail).join(' ')}`;
    case 'appeal': return beat.question || clean(beat.text).split(' replacing ')[0] + '.';
    case 'overruled': return beat.agentOverreach ? 'An advocate tried to make a human decision. The advocate is not the client.' : beat.reason;
    case 'deliberating': return `${speakerName(beat.speaker)} is preparing a structured turn.`;
    case 'recess': case 'turn_failed': return beat.reason;
    default: return clean(beat.text) || kindLabel[beat.type] || beat.kind;
  }
}

// ── Stage setup ─────────────────────────────────────────────────────────────
$('#bench-host').innerHTML = benchMarkup({perspectives});
pixelateBackgrounds();
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

// ── Voices: speech bubbles over every head, and judges' gestures ────────────
const host = $('#bench-host');
host.insertAdjacentHTML('beforeend', ['arata', 'vale', 'thorne'].map(id => `<div class="bubble judge-bubble" data-judge="${id}" aria-hidden="true"><b></b><span></span></div>`).join(''));
for (const role of ['lead', 'creator']) $(`#podium-${role}`).insertAdjacentHTML('afterbegin', `<div class="bubble" data-who="${role}" aria-hidden="true"><b></b><span></span></div>`);
host.insertAdjacentHTML('beforeend', ['arata', 'vale', 'thorne'].map(id => `<div class="emote-anchor" data-judge="${id}"></div>`).join(''));
soundToggle($('#sound-toggle'));
const emoteAt = (who, kind) => emote(who in judgeNames ? host.querySelector(`.emote-anchor[data-judge="${who}"]`) : $(`#podium-${who} .podium-avatar`), kind);
// Camera: cut towards whoever addresses the court, then return to the wide shot.
let cameraTimer;
function focus(target, hold = 3600) {
  if (!gsapReady()) return;
  const origin = {lead: '12% 78%', creator: '88% 78%', vale: '50% 40%', thorne: '74% 40%', arata: '26% 40%'}[target];
  if (!origin) return;
  clearTimeout(cameraTimer);
  gsap.to(scene, {scale: target in judgeNames ? 1.22 : 1.3, transformOrigin: origin, duration: 1.1, ease: 'power3.inOut', overwrite: true});
  cameraTimer = setTimeout(() => gsap.to(scene, {scale: 1, duration: 1.2, ease: 'power3.inOut', overwrite: true}), hold);
}
const judgeNames = {arata: 'Justice Arata · the letter', vale: 'Justice Vale · presiding', thorne: 'Lord Justice Thorne · consent'};
const bubbleTimers = new Map(), actTimers = new Map(), pending = new Set();
let lastBeatAt = 0;
function later(fn, ms) { const timer = setTimeout(() => { pending.delete(timer); fn(); }, ms); pending.add(timer); }
function hush() { for (const timer of pending) clearTimeout(timer); pending.clear(); }
function say(who, text, {tone = '', ms = 3800, delay = 0} = {}) {
  if (!text) return;
  const isJudge = who in judgeNames;
  const el = isJudge ? host.querySelector(`.judge-bubble[data-judge="${who}"]`) : $(`#podium-${who} .bubble`);
  if (!el) return;
  const run = () => {
    el.dataset.tone = tone;
    el.querySelector('b').textContent = isJudge ? judgeNames[who] : who === 'lead' ? 'Counsel for the lead' : 'Counsel for the creator';
    const line = clean(text);
    typewrite(el.querySelector('span'), line.length > 170 ? `${line.slice(0, 167).trimEnd()}…` : line, {voice: isJudge ? who : who, cps: 70});
    clearTimeout(bubbleTimers.get(who));
    if (isJudge) judgeEl(who)?.setAttribute('data-talk', '');
    if (gsapReady()) gsap.fromTo(el, {opacity: 0, y: 16, scale: .82}, {opacity: 1, y: 0, scale: 1, duration: .5, ease: 'back.out(2.2)', overwrite: true});
    else el.style.opacity = 1;
    bubbleTimers.set(who, setTimeout(() => {
      if (isJudge) judgeEl(who)?.removeAttribute('data-talk');
      if (gsapReady()) gsap.to(el, {opacity: 0, y: -8, duration: .35, ease: 'power2.in', overwrite: true}); else el.style.opacity = 0;
    }, ms));
  };
  delay ? later(run, delay) : run();
}
function act(id, name, ms = 1700, delay = 0) {
  const run = () => {
    const el = judgeEl(id); if (!el) return;
    el.removeAttribute('data-act'); void el.getBoundingClientRect(); el.setAttribute('data-act', name);
    clearTimeout(actTimers.get(id)); actTimers.set(id, setTimeout(() => el.removeAttribute('data-act'), ms));
  };
  delay ? later(run, delay) : run();
}
// Between beats the bench is never still: instruments, glances, quiet conferences.
const idleMoves = {arata: ['soroban', 'specs', 'nod', 'soroban', 'sigh'], vale: ['watch', 'tap', 'lean', 'watch', 'nod'], thorne: ['scales', 'chuckle', 'finger', 'scales', 'nod']};
setInterval(() => {
  if (isReducedMotion() || document.hidden || Date.now() - lastBeatAt < 2400) return;
  const roll = Math.random();
  if (roll < .16) { act('arata', 'confer-right'); act('vale', 'confer-left'); return; }
  if (roll < .3) { act('vale', 'confer-right'); act('thorne', 'confer-left'); return; }
  const id = ['arata', 'vale', 'thorne'][Math.floor(Math.random() * 3)];
  if (judgeEl(id)?.hasAttribute('data-act')) return;
  act(id, idleMoves[id][Math.floor(Math.random() * idleMoves[id].length)]);
}, 2300);
const ownerName = role => state.view?.cast?.owners?.[role]?.username ?? role;
function chorus(beat) {
  lastBeatAt = Date.now();
  hush();
  const kinds = {proposal: ['lead', '♪'], endorsement: ['creator', 'idea'], deliberating: [beat.speaker, '...'], summons: [beat.target, 'sweat'], appeal: ['vale', '?'], decision: ['thorne', beat.accepted ? 'idea' : 'anger'], ruling: ['arata', '♪'], verdict: ['vale', '♪'], signature: ['thorne', 'idea'], recess: ['vale', 'sweat'], turn_failed: ['vale', 'sweat']};
  if (beat.type === 'objection') { emoteAt(beat.basis === 'review' ? 'creator' : 'thorne', '!'); focus(beat.basis === 'review' ? 'creator' : 'thorne'); }
  else if (beat.type === 'overruled' && beat.agentOverreach) { emoteAt('thorne', 'anger'); focus('thorne'); }
  else if (kinds[beat.type]?.[0]) emoteAt(...kinds[beat.type]);
  if (beat.type === 'proposal') focus('lead', 4200);
  if (beat.type === 'endorsement') focus('creator', 4200);
  if (['appeal', 'verdict', 'draft_verdict'].includes(beat.type)) focus('vale', 3400);
  switch (beat.type) {
    case 'filing': say('vale', 'The court is in session. Two briefs, one storyboard, and only people may decide.'); act('vale', 'tap'); act('thorne', 'nod', 900, 900); break;
    case 'procedure': say('thorne', 'Advocates may argue. Only the owners may consent.', {delay: 300}); act('thorne', 'finger'); break;
    case 'mandate': say('thorne', `${ownerName(beat.role)} adopts ${beat.ref}. Recorded, by the only person who could.`, {tone: 'good'}); act('thorne', 'nod'); act('arata', 'specs', 1500, 500); break;
    case 'summons': say('vale', beat.target === 'creator' ? 'Counsel for the creator: review it exactly as filed.' : 'Counsel for the lead, you have the floor.'); act('vale', 'lean'); break;
    case 'deliberating': act('arata', 'soroban'); act('vale', 'watch', 1800, 500); act('thorne', 'confer-left', 1600, 900); break;
    case 'proposal':
      say('lead', beat.quote, {ms: 5600});
      act('arata', 'soroban', 1700, 900); act('thorne', 'scales', 1800, 1500);
      say('arata', 'Four panels. Let me count the seconds.', {delay: 1800, ms: 3000}); break;
    case 'objection':
      if (beat.basis === 'rules') {
        const failed = (beat.failed || []).map(check => check.code).join(' ');
        act('vale', 'gavel', 1100, 200);
        if (ROLE_JUDGES.thorne.test(failed)) { say('thorne', 'Sustained. One brief forbids that portrait. Consent is not ours to give.', {tone: 'bad', ms: 5000}); act('thorne', 'finger', 1500, 300); }
        if (ROLE_JUDGES.vale.test(failed)) say('vale', 'It does not fit the panels or the thirty seconds.', {tone: 'bad', delay: 900});
        else say('vale', 'Four panels, thirty seconds. That part holds.', {tone: 'good', delay: 1100, ms: 3200});
        if (ROLE_JUDGES.arata.test(failed)) { say('arata', 'And the letter is broken: an unregistered asset.', {tone: 'bad', delay: 1900}); act('arata', 'specs', 1500, 1900); }
      } else {
        say('creator', beat.quote, {tone: 'bad', ms: 5600});
        act('thorne', 'startle'); act('arata', 'confer-right', 1600, 900); act('vale', 'confer-left', 1600, 900);
        say('vale', 'Noted. Only the owner of H1 can change H1.', {delay: 2400, ms: 3400});
      }
      break;
    case 'appeal':
      say('vale', `Recess. Only ${ownerName(beat.awaiting?.slice(6) ?? 'lead')} can answer this.`, {ms: 5200}); act('vale', 'gavel');
      say('thorne', 'No advocate speaks until a person decides.', {delay: 1500, ms: 4200}); act('thorne', 'finger', 1500, 1500); act('arata', 'sigh', 1600, 900); break;
    case 'decision':
      say('thorne', beat.accepted ? `Consent given, by the right person. ${beat.ref ?? ''} now binds.` : 'Declined. The original terms stand.', {tone: beat.accepted ? 'good' : 'bad', ms: 4400});
      act('thorne', beat.accepted ? 'chuckle' : 'sigh'); act('arata', 'soroban', 1500, 700); act('vale', 'nod', 900, 1200); break;
    case 'ruling':
      say('arata', 'To the letter. Every rule holds.', {tone: 'good'}); act('arata', 'nod');
      say('vale', `BOARD${beat.boardRevision} passes.`, {tone: 'good', delay: 1000}); act('vale', 'gavel', 1100, 1000); act('thorne', 'scales', 1600, 500); break;
    case 'endorsement':
      say('creator', beat.quote, {tone: 'good', ms: 5400});
      say('thorne', 'A recommendation. Not a signature.', {delay: 2000, ms: 3600}); act('thorne', 'finger', 1400, 2000); break;
    case 'draft_verdict': say('vale', 'Frozen and hashed. Two signatures, or nothing.', {ms: 5000}); act('vale', 'gavel'); act('arata', 'specs', 1500, 700); act('thorne', 'nod', 900, 1300); break;
    case 'signature': say('thorne', `${ownerName(beat.role)} signs this exact bundle.`, {tone: 'good'}); act('thorne', 'nod'); act('arata', 'soroban', 1500, 500); break;
    case 'withdrawal': say('vale', 'A signature withdrawn. The export is locked again.', {tone: 'bad'}); act('vale', 'sigh'); break;
    case 'verdict':
      say('vale', 'So ordered. Approved by both owners.', {tone: 'good', ms: 5600}); act('vale', 'gavel');
      act('thorne', 'chuckle', 900, 700); act('arata', 'nod', 900, 500);
      say('thorne', 'Fair to both of them.', {delay: 1300, tone: 'good'}); say('arata', 'And not one second over.', {delay: 2300, tone: 'good'}); break;
    case 'overruled':
      if (beat.agentOverreach) { say('thorne', 'Overruled. The advocate is not the client.', {tone: 'bad', ms: 5000}); act('thorne', 'finger'); act('vale', 'startle'); act('arata', 'startle'); }
      else if (beat.reason) say('vale', beat.reason, {tone: 'bad'});
      break;
    case 'recess': case 'turn_failed': say('vale', 'We pause. A person must restart this.', {tone: 'bad'}); act('vale', 'sigh'); break;
  }
}

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
  const voice = beat.speaker?.startsWith('owner:') ? 'owner' : ['lead', 'creator'].includes(beat.speaker) ? beat.speaker : 'clerk';
  const box = $('#caption');
  box.classList.remove('is-done');
  box.dataset.voice = voice;
  typewrite(quote, line.length > 360 ? `${line.slice(0, 357).trimEnd()}…` : line, {voice, onDone: () => box.classList.add('is-done')});
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
function renderBriefs(owners, briefs = null, adoptCommands = state.view?.adopt) {
  if (!owners) return;
  $('#briefs').innerHTML = ['lead', 'creator'].map(role => {
    const owner = owners[role];
    if (!owner) return '';
    const brief = briefs?.[role] ?? owner.brief, content = brief.content ?? brief;
    const adopted = brief.adopted ?? owner.adopted;
    const adoptCmd = (!adopted && state.mode === 'live') ? adoptCommands?.[role] : null;
    return `<div class="brief" data-role="${role}"><span class="seal ${adopted ? '' : 'pending'}">${adopted ? 'ADOPTED' : 'DRAFT'}</span>
      <span class="eyebrow">${role === 'lead' ? 'Lead' : 'Creator'} · ${esc(brief.ref ?? owner.briefRef)}</span><h3>${esc(owner.username)}</h3><span class="who">${esc(content?.goal ?? '')}</span>
      <dl><div><dt>Must include</dt><dd>${[...(content?.requiredAssets ?? []), ...(content?.requiredCopy ?? [])].map(item => `<span class="tag">${esc(item)}</span>`).join('') || '—'}</dd></div>
      <div><dt>Will not allow</dt><dd>${(content?.forbiddenAssets ?? []).map(item => `<span class="tag forbid">${esc(item)}</span>`).join('') || '—'}</dd></div>
      <div><dt>Closing line</dt><dd>${(content?.finalCopy ?? []).map(item => `<span class="tag">${esc(item)}</span>`).join('') || '—'}</dd></div></dl>
      ${adoptCmd ? `<div class="brief-adopt" style="margin-top:14px;"><dt style="font:500 9.5px var(--mono);letter-spacing:.16em;text-transform:uppercase;color:#7a654b;margin-bottom:4px;">Adopt in Switch</dt><code style="font-size:11px;padding:6px 8px;">${esc(adoptCmd)}</code></div>` : ''}</div>`;
  }).join('');
}

function renderBoard(board, {animate = false} = {}) {
  const grid = $('#board');
  if (!board) {
    grid.innerHTML = '<div class="board-empty">The advocates have not proposed a storyboard yet.</div>';
    $('#checks').innerHTML = '';
    $('#board-title').textContent = 'No storyboard yet';
    $('#board-meta').textContent = '';
    return;
  }
  $('#board-title').textContent = board.title || 'Storyboard';
  const total = (board.panels || []).reduce((sum, panel) => sum + (panel.seconds || 0), 0);
  $('#board-meta').textContent = `BOARD${board.revision} · ${(board.panels || []).length} panels · ${total}s${board.stale ? ' · superseded' : ''}`;
  grid.innerHTML = (board.panels || []).map((panel, index) => {
    const known = ['notebook', 'hands-sketch', 'light-trails', 'signal-mark'].includes(panel.assetId);
    return `<div class="card" data-asset="${esc(panel.assetId)}"><span class="sec">${index + 1} · ${panel.seconds}s</span>
      ${known ? `<img src="/storyboard/${panel.assetId}.svg" alt="${esc(panel.assetId)}">` : `<div class="missing">${esc(panel.assetId)}<br>not permitted</div>`}
      <div class="on">${esc(panel.onScreen)}</div><p>${esc(panel.scene)}</p><span class="veto">Vetoed</span></div>`;
  }).join('');
  $('#checks').innerHTML = (board.checks ?? []).map(check => `<li data-pass="${check.passed}">${check.passed ? '✓' : '✕'} ${esc(check.detail)}</li>`).join('');
  const failed = (board.checks ?? []).filter(check => !check.passed);
  if (failed.length) vetoCards(failed);
  if (animate && gsapReady()) gsap.from(grid.querySelectorAll('.card'), {y: 60, rotate: (i) => (i - 1.5) * 4, opacity: 0, duration: .8, ease: 'expo.out', stagger: .08});
}

function vetoCards(failed) {
  const codes = (failed || []).map(check => check.code).join(' ');
  document.querySelectorAll('#board .card').forEach(card => {
    if (codes.includes(card.dataset.asset)) {
      card.classList.add('is-vetoed');
      if (gsapReady()) gsap.fromTo(card.querySelector('.veto'), {scale: 2.2, opacity: 0}, {scale: 1, opacity: 1, duration: .35, ease: 'power4.in'});
    }
  });
}

function renderSeals(view, signed = view.approvals) {
  if (!view?.cast?.owners) return;
  $('#seals').innerHTML = ['lead', 'creator'].map(role => {
    const isSigned = Boolean(signed?.[role]);
    return `<div class="seal-slot ${isSigned ? 'is-signed' : ''}" data-role="${role}"><div class="wax">${isSigned ? '§' : ''}</div><strong>${esc(view.cast.owners[role]?.username ?? role)}</strong><span>${isSigned ? 'Signed this exact bundle' : 'Not signed'}</span></div>`;
  }).join('');
  if (view.exports && (state.mode === 'live' || (state.mode === 'replay' && state.verdict))) {
    $('#exports').innerHTML = `<a href="${view.exports.html}" download>Approved storyboard</a><a href="${view.exports.script}" download>Script</a><a href="${view.exports.receipt}" target="_blank" rel="noopener">Consent receipt</a>`;
  } else {
    $('#exports').innerHTML = '';
  }
  const signNote = $('#sign-note');
  if (state.mode === 'live' && view.stage === 'AWAITING_APPROVALS' && view.approvals?.command && (view.approvals.count ?? 0) < 2) {
    signNote.innerHTML = `Each owner sends this from their own account in Switch:<code>${esc(view.approvals.command)}</code>`;
  } else {
    signNote.textContent = 'An advocate can argue for its owner. It can never consent for them.';
  }
}

function renderQuestion(question, view) {
  const section = $('#question');
  if (!question) { section.hidden = true; return; }
  section.hidden = false;
  $('#question-title').textContent = question.reason || `Should ${question.replaces} be replaced?`;
  const ownerUsername = view.cast.owners[question.owner.slice(6)]?.username ?? 'Owner';
  $('#question-detail').textContent = `Only ${ownerUsername} can decide ${question.requestId}. No advocate turn runs until they do.`;
  $('#question-owner').textContent = ownerUsername;
  $('#question-accept').textContent = question.accept; $('#question-decline').textContent = question.decline;
}

function renderBeatListItem(beat) {
  if (!beat || beat.type === 'deliberating') return;
  const li = document.createElement('li');
  li.className = 'beat'; li.dataset.type = beat.type;
  const time = new Date(beat.at || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
  li.innerHTML = `<span class="n">${String(beat.id ?? '').padStart(3, '0')}</span><span class="who">${esc(speakerName(beat.speaker))}</span><span class="what"><b>${esc(kindLabel[beat.type] ?? beat.type)}</b><span>${esc((beatLine(beat) ?? '').slice(0, 320))}</span><small>${time}${beat.roomMessageId ? ` · Switch ${esc(beat.roomMessageId)}` : beat.sourceId ? ` · source ${esc(beat.sourceId)}` : ''}</small></span>`;
  const list = $('#beats');
  list.prepend(li);
}

function addBeat(beat) {
  if (!beat || state.seenBeats.has(beat.id) || beat.type === 'deliberating') return;
  state.seenBeats.add(beat.id);
  if (Number.isFinite(beat.id) && beat.id > state.cursor) {
    state.cursor = beat.id;
  }
  renderBeatListItem(beat);
  const list = $('#beats');
  const firstChild = list.firstElementChild;
  if (firstChild && gsapReady()) gsap.from(firstChild, {height: 0, opacity: 0, duration: .5, ease: 'power3.out'});
}

// ── Choreography: what the room does for each kind of beat ──────────────────
function perform(beat) {
  if (!beat) return;
  if (beat.id != null) {
    if (state.performedBeats.has(beat.id)) return;
    state.performedBeats.add(beat.id);
    if (Number.isFinite(beat.id) && beat.id > state.cursor) {
      state.cursor = beat.id;
    }
  }
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
        const failed = (beat.failed || []).map(check => check.code).join(' ');
        setJudges(Object.fromEntries(Object.entries(ROLE_JUDGES).map(([id, rule]) => [id, rule.test(failed) ? 'is-rejecting' : 'is-accepting'])));
        setAdvocates('lead', 'idle'); if (beat.failed) vetoCards(beat.failed); stamp('Objection'); replayEvent('objection');
      } else { setAdvocates('creator', 'objecting'); setJudges({all: 'is-listening'}); stamp('Objection'); replayEvent('objection'); }
      break;
    case 'ruling': setJudges({all: 'is-accepting'}); stamp('The checks pass', 'good'); replayEvent('ruling'); break;
    case 'endorsement': setAdvocates('creator', 'pleased'); setJudges({all: 'is-accepting'}); replayEvent('statement'); break;
    case 'appeal': setAdvocates(null); setJudges({all: 'is-listening'}); stamp('Recess', 'amber'); replayEvent('appeal'); break;
    case 'decision': setJudges({all: beat.accepted ? 'is-accepting' : 'is-rejecting'}); stamp(beat.accepted ? 'Amendment accepted' : 'Declined', beat.accepted ? 'good' : 'bad'); replayEvent('statement'); break;
    case 'draft_verdict': setJudges({vale: 'is-speaking', all: 'is-accepting'}); setAdvocates(null); stamp('Frozen for signature', 'gold'); replayEvent('ruling'); break;
    case 'signature': setJudges({thorne: 'is-accepting', all: 'is-listening'}); stamp('Signed', 'gold'); if (beat.role) { state.signed[beat.role] = true; renderSeals(state.view, state.signed); sealStamp(beat.role); } break;
    case 'withdrawal': setJudges({all: 'is-narrowing'}); stamp('Withdrawn', 'amber'); break;
    case 'verdict': setJudges({all: 'is-accepting'}); setAvatarState(avatars.lead(), 'pleased'); setAvatarState(avatars.creator(), 'pleased'); stamp('Approved', 'good'); replayEvent('verdict'); state.verdict = true; renderSeals(state.view, state.signed); break;
    case 'overruled': if (beat.agentOverreach) { setJudges({thorne: 'is-rejecting', all: 'is-assessing'}); setAdvocates(beat.speaker, 'idle'); stamp('Overruled'); replayEvent('objection'); } break;
    case 'recess': case 'turn_failed': setJudges({all: 'is-rejecting'}); setAdvocates(null); stamp('Paused', 'amber'); replayEvent('deadlock'); break;
    case 'mandate': setJudges({all: 'is-accepting'}); replayEvent('statement'); break;
    default: setJudges({all: 'is-listening'}); replayEvent('statement');
  }
  chorus(beat);
}
function sealStamp(role) {
  const wax = document.querySelector(`.seal-slot[data-role="${role}"] .wax`);
  if (wax && gsapReady()) gsap.fromTo(wax, {scale: 2.6, rotate: -35, opacity: 0}, {scale: 1, rotate: 0, opacity: 1, duration: .55, ease: 'power4.in'});
}

// ── Replay: rebuild each moment of a real recorded session ──────────────────
function orderBeats(beats) {
  const list = beats.filter(beat => beat.type !== 'status');
  for (let i = 0; i < list.length - 1; i++) {
    const [a, b] = [list[i], list[i + 1]];
    if (((a.type === 'objection' && a.basis === 'rules') || a.type === 'ruling') && b.type === 'proposal' && a.boardRevision === b.boardRevision) [list[i], list[i + 1]] = [b, a];
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
    case 'signature': return {code: 'Signatures', label: `${owner(beat.role)} signs.`, detail: 'One signature is not consent. The export stays locked until both owners approve the same digest.'};
    case 'verdict': return {code: 'Verdict', label: 'Approved, by both owners.', detail: 'The consent receipt binds the exact bytes, both briefs and both signatures. Anyone can verify it offline.'};
    default: return null;
  }
}

const replayState = {
  view: null,
  briefs: null,
  beats: [],
  index: 0,
  playing: false,
  timer: null,
  dwell: beat => ({filing: 4600, procedure: 3600, mandate: 3800, summons: 3000, deliberating: 2600, proposal: 7400, objection: 7200, appeal: 7400, decision: 5400, ruling: 5600, endorsement: 6800, draft_verdict: 6200, signature: 4400, verdict: 10000})[beat.type] ?? 3600,
};

function showReplayStep(i) {
  const beat = replayState.beats[i];
  if (!beat) return;
  const beats = replayState.beats;
  const replayView = replayState.view;
  const replayBriefs = replayState.briefs;
  const briefsAt = upto => {
    const out = {};
    for (const role of ['lead', 'creator']) {
      const decided = beats.slice(0, upto + 1).filter(b => b.type === 'decision' && b.accepted && b.ref?.startsWith(role === 'lead' ? 'H' : 'D')).length;
      const brief = replayBriefs[role][Math.min(decided, replayBriefs[role].length - 1)];
      const adopted = beats.slice(0, upto + 1).some(b => b.type === 'mandate' && b.role === role);
      out[role] = {...brief, adopted};
    }
    return out;
  };

  renderBriefs(replayView.cast.owners, briefsAt(i));
  if (i === 0) {
    renderBoard(null);
    $('#beats').innerHTML = '';
    state.seenBeats.clear();
    state.performedBeats.clear();
    state.signed = {}; state.verdict = false;
    renderSeals(replayView, {});
  }
  perform(beat);
  setPhase(replayPhase(beat, replayView) ?? undefined);
  renderQuestion(beat.type === 'appeal' ? {
    ...replayView.question,
    reason: beat.question,
    requestId: beat.requestId,
    owner: beat.awaiting,
    replaces: beat.baseRef,
    accept: `@cvc-clerk ACCEPT ${replayView.caseId} ${beat.requestId} …`,
    decline: `@cvc-clerk DECLINE ${replayView.caseId} ${beat.requestId} …`
  } : null, replayView);
  $('#replay-progress').style.width = `${((i + 1) / beats.length) * 100}%`;
  $('#replay-count').textContent = `${i + 1} / ${beats.length}`;
}

function replayTick() {
  clearTimeout(replayState.timer);
  clearTimeout(state.replayTimer);
  replayState.timer = null;
  state.replayTimer = null;
  if (replayState.index < replayState.beats.length - 1) {
    replayState.index++;
    showReplayStep(replayState.index);
    if (replayState.playing) {
      const wait = replayState.dwell(replayState.beats[replayState.index]);
      replayState.timer = setTimeout(replayTick, wait);
      state.replayTimer = replayState.timer;
    }
  } else {
    replayState.playing = false;
    $('#replay-toggle').textContent = 'Play';
  }
}

let replayControlsBound = false;
function setupReplayControls() {
  if (replayControlsBound) return;
  replayControlsBound = true;

  $('#replay-toggle')?.addEventListener('click', () => {
    replayState.playing = !replayState.playing;
    $('#replay-toggle').textContent = replayState.playing ? 'Pause' : 'Play';
    if (replayState.playing) {
      if (replayState.index >= replayState.beats.length - 1) {
        replayState.index = 0;
        showReplayStep(0);
        replayState.timer = setTimeout(replayTick, 1400);
        state.replayTimer = replayState.timer;
      } else {
        replayTick();
      }
    } else {
      clearTimeout(replayState.timer);
      clearTimeout(state.replayTimer);
      replayState.timer = null;
      state.replayTimer = null;
    }
  });

  $('#replay-step')?.addEventListener('click', () => {
    replayState.playing = false;
    clearTimeout(replayState.timer);
    clearTimeout(state.replayTimer);
    replayState.timer = null;
    state.replayTimer = null;
    $('#replay-toggle').textContent = 'Play';
    if (replayState.index < replayState.beats.length - 1) {
      replayState.index++;
    }
    showReplayStep(replayState.index);
  });

  $('#replay-restart')?.addEventListener('click', () => {
    replayState.index = 0;
    replayState.playing = true;
    $('#replay-toggle').textContent = 'Pause';
    showReplayStep(0);
    replayState.timer = setTimeout(replayTick, 1400);
    state.replayTimer = replayState.timer;
  });
}

function resetSession() {
  const sessionId = ++currentSessionId;
  state.sessionId = sessionId;

  if (state.replayTimer) {
    clearTimeout(state.replayTimer);
    state.replayTimer = null;
  }
  if (replayState.timer) {
    clearTimeout(replayState.timer);
    replayState.timer = null;
  }
  replayState.playing = false;
  if (state.activeStream) {
    state.activeStream.close();
    state.activeStream = null;
  }
  state.seenBeats.clear();
  state.performedBeats.clear();
  state.boards.clear();
  state.cursor = 0;
  state.latestEventId = 0;
  state.view = null;
  state.reconnecting = false;
  state.signed = {};
  state.verdict = false;
  hush();

  const bar = $('#replay-bar');
  if (bar) bar.hidden = true;
  $('#replay-progress').style.width = '0%';
  $('#replay-count').textContent = '0 / 0';
  $('#beats').innerHTML = '';
  $('#checks').innerHTML = '';
  $('#board').innerHTML = '';
  $('#board-title').textContent = 'No storyboard yet';
  $('#board-meta').textContent = '';
  $('#exports').innerHTML = '';
  $('#sign-note').textContent = 'An advocate can argue for its owner. It can never consent for them.';
  $('#caption-speaker').textContent = 'The clerk';
  $('#caption-kind').textContent = '';
  $('#caption-text').textContent = 'Waiting for the room.';

  return sessionId;
}

async function startReplay(note) {
  const sessionId = resetSession();
  const replayResponse = await fetch('/data/replay-signal.json');
  if (!replayResponse.ok) throw new Error(`replay fetch ${replayResponse.status}`);
  const replay = await replayResponse.json();
  if (sessionId !== state.sessionId) return;

  state.mode = 'replay';
  state.view = replay.view;
  state.briefs = replay.briefs;
  // Replay exports must NEVER link to live approvals
  if (replay.view && !String(replay.view.exports?.html ?? '').startsWith('/data/')) replay.view.exports = null;
  setCast(replay.view);
  for (const board of replay.boards) state.boards.set(board.revision, board);
  setMode('replay', 'Recorded session');
  $('#foot-source').textContent = `${note} ${replay.label}`;
  $('#case-id').textContent = replay.caseId;

  replayState.view = replay.view;
  replayState.briefs = replay.briefs;
  replayState.beats = orderBeats(replay.view.beats);
  replayState.index = 0;
  replayState.playing = true;

  const bar = $('#replay-bar');
  if (bar) bar.hidden = false;
  $('#replay-toggle').textContent = 'Pause';

  showReplayStep(0);
  replayState.timer = setTimeout(replayTick, 1400);
  state.replayTimer = replayState.timer;
}

// ── Live: the clerk's own view model and event stream ───────────────────────
function updateConnectionStatus(ingestion = state.view?.ingestion) {
  if (state.mode !== 'live') return;
  if (ingestion?.state === 'live') {
    setMode('live', 'Live in Switch');
  } else if (ingestion?.state === 'paused') {
    setMode('offline', 'Room ingestion paused');
  } else if (ingestion?.state === 'starting' || !ingestion) {
    setMode('starting', 'Connected clerk · starting room');
  } else {
    setMode('connecting', 'Connecting to the clerk');
  }
}

function applyView(view) {
  if (!view) return;
  state.view = view;
  setCast(view);
  if (view.board) {
    state.boards.set(view.board.revision, view.board);
    const isNewRevision = !$('#board-meta').textContent.startsWith(`BOARD${view.board.revision} `);
    renderBoard(view.board, { animate: isNewRevision });
  } else {
    renderBoard(null);
  }
  setPhase(view.phase);
  renderBriefs(view.cast.owners, null, view.adopt);
  renderSeals(view);
  renderQuestion(view.question, view);
  $('#case-id').textContent = view.caseId;
  updateConnectionStatus(view.ingestion);
}

function connectStream(caseId, sessionId) {
  if (state.activeStream) {
    state.activeStream.close();
    state.activeStream = null;
  }
  const streamUrl = `/api/cases/${caseId}/stream?after=${state.cursor}`;
  const stream = new EventSource(streamUrl);
  state.activeStream = stream;

  stream.addEventListener('beat', event => {
    if (sessionId !== state.sessionId) return;
    try {
      const beat = JSON.parse(event.data);
      const eventId = Number(event.lastEventId || beat.id);
      if (Number.isFinite(eventId) && eventId > state.latestEventId) {
        state.latestEventId = eventId;
      }
      perform(beat);
    } catch (e) {
      console.error('Failed to parse beat event:', e);
    }
  });

  stream.addEventListener('court', event => {
    if (sessionId !== state.sessionId) return;
    try {
      const freshView = JSON.parse(event.data);
      const eventId = Number(event.lastEventId || 0);
      const maxBeatId = Array.isArray(freshView.beats) && freshView.beats.length > 0
        ? Math.max(...freshView.beats.map(b => b.id || 0))
        : 0;
      const currentCursor = Math.max(eventId, maxBeatId);
      if (currentCursor >= state.latestEventId) {
        state.latestEventId = currentCursor;
      }
      applyView(freshView);
      if (Array.isArray(freshView.beats)) {
        for (const beat of freshView.beats) {
          if (!state.performedBeats.has(beat.id)) {
            perform(beat);
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse court event:', e);
    }
  });

  stream.addEventListener('ingestion', event => {
    if (sessionId !== state.sessionId) return;
    try {
      const ingestion = JSON.parse(event.data);
      if (state.view) state.view.ingestion = ingestion;
      updateConnectionStatus(ingestion);
    } catch (e) {
      console.error('Failed to parse ingestion event:', e);
    }
  });

  stream.onerror = () => {
    if (sessionId !== state.sessionId) return;
    state.reconnecting = true;
    setMode('offline', 'Reconnecting to the clerk');
  };

  stream.onopen = () => {
    if (sessionId !== state.sessionId) return;
    state.reconnecting = false;
    updateConnectionStatus(state.view?.ingestion);
  };
}

function validateCourtView(view, expectedCaseId) {
  if (!view || typeof view !== 'object') return false;
  if (view.version !== 'cvc-court-view-v1') return false;
  if (view.caseId !== expectedCaseId) return false;
  if (!view.stage || typeof view.stage !== 'string') return false;
  if (!view.phase || typeof view.phase !== 'object') return false;
  if (!view.cast || !view.cast.owners || typeof view.cast.owners !== 'object') return false;
  if (!Array.isArray(view.beats)) return false;
  return true;
}

async function startLive(caseId) {
  const sessionId = resetSession();
  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(new Error('timeout')), 6000);
  let response, view;
  try {
    response = await fetch(`/api/cases/${caseId}/court`, {
      headers: { accept: 'application/json' },
      signal: controller.signal
    });
    if (response.status === 404) {
      const err = new Error('Case not found');
      err.kind = 'not_found';
      err.status = 404;
      throw err;
    }
    if (response.status === 502) {
      const err = new Error('Court unreachable (502 Bad Gateway)');
      err.kind = 'unreachable';
      err.status = 502;
      throw err;
    }
    if (!response.ok) {
      const err = new Error(`Court server error (${response.status})`);
      err.kind = 'unavailable';
      err.status = response.status;
      throw err;
    }
    try {
      view = await response.json();
    } catch (parseErr) {
      const err = new Error('Malformed JSON payload from court');
      err.kind = 'unavailable';
      throw err;
    }
  } catch (netErr) {
    if (netErr.kind) throw netErr;
    const isTimeout = netErr.name === 'AbortError' || netErr.message?.includes('timeout');
    const err = new Error(isTimeout ? 'Connection timed out' : (netErr.message || 'Network unreachable'));
    err.kind = 'unreachable';
    err.status = 502;
    throw err;
  } finally {
    clearTimeout(fetchTimeout);
  }

  // Abandoned session check: ignore response if a newer session was started
  if (sessionId !== state.sessionId) return;

  if (!validateCourtView(view, caseId)) {
    const err = new Error('Invalid court view schema or version mismatch');
    err.kind = 'unavailable';
    throw err;
  }

  if (view.ingestion && view.ingestion.state !== 'live') {
    const err = new Error('The Switch room is not being read right now');
    err.kind = 'unreachable';
    throw err;
  }
  state.mode = 'live';
  hideRetryButton();
  $('#foot-source').textContent = 'Connected to the read-only clerk. Decisions are made only by the bound humans in the Switch room.';
  applyView(view);

  // Mark all historical beats as seen and performed so old history is never rechoreographed
  for (const beat of (view.beats || [])) {
    state.seenBeats.add(beat.id);
    state.performedBeats.add(beat.id);
    if (Number.isFinite(beat.id) && beat.id > state.cursor) {
      state.cursor = beat.id;
    }
  }
  state.latestEventId = state.cursor;

  // Render recent historical beats in the record list
  for (const beat of (view.beats || []).slice(-40)) {
    renderBeatListItem(beat);
  }

  // Establish stage caption and speaker based on current/latest beat
  const last = (view.beats || []).at(-1);
  if (last) {
    setCaption(last);
    const speaker = last.speaker === 'lead' || last.speaker === 'creator' ? last.speaker : last.target ?? 'clerk';
    scene.dataset.speaker = speaker;
  }

  connectStream(caseId, sessionId);
}

function setCast(view) {
  for (const role of ["lead", "creator"]) {
    $(`#${role}-model`).textContent = "Codex advocate";
    $(`#${role}-name`).textContent = role === "lead" ? "For the lead" : "For the creator";
    $(`#${role}-for`).textContent = `acting for ${view.cast.owners[role]?.username ?? '—'}`;
  }
}
function setMode(mode, label) {
  const el = $('#mode');
  if (el) el.dataset.mode = mode;
  const lbl = $('#mode-label');
  if (lbl) lbl.textContent = label;
}

function showRetryButton() {
  const btn = $('#retry-live');
  if (btn) btn.hidden = false;
}
function hideRetryButton() {
  const btn = $('#retry-live');
  if (btn) btn.hidden = true;
}

$('#retry-live')?.addEventListener('click', () => {
  hideRetryButton();
  setMode('connecting', 'Connecting to the clerk');
  init();
});

// ── Motion: entrance, parallax and scroll reveals ───────────────────────────
function motion() {
  if (!gsapReady()) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.timeline({defaults: {ease: 'expo.out'}})
    .from('.scene-background', {scale: 1.12, opacity: 0, duration: 2})
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

// ── Main startup ────────────────────────────────────────────────────────────
const CASE_REGEX = /^C[A-Z0-9_-]{1,31}$/;

async function init() {
  const params = new URLSearchParams(location.search);
  const rawCase = params.get('case');
  const isExplicitReplay = params.get('replay') === '1' || params.get('replay') === 'true';

  if (rawCase !== null && !CASE_REGEX.test(rawCase)) {
    resetSession();
    setMode('offline', 'Court unavailable');
    $('#case-id').textContent = rawCase;
    $('#foot-source').textContent = 'Invalid case identifier.';
    $('#phase-code').textContent = 'Error';
    $('#phase-label').textContent = 'Invalid case format';
    $('#phase-detail').textContent = 'Case identifier must match /^C[A-Z0-9_-]{1,31}$/.';
    renderBoard(null);
    showRetryButton();
    return;
  }

  const caseId = rawCase || 'C01';
  $('#case-id').textContent = caseId;

  if (isExplicitReplay) {
    await startReplay('Replay mode requested (?replay=1). Replaying recorded rehearsal.').catch(() => {
      setMode('offline', 'Court unavailable');
      showRetryButton();
    });
    return;
  }

  try {
    await startLive(caseId);
  } catch (error) {
    if (error.kind === 'unreachable' || error.status === 502) {
      showRetryButton();
      await startReplay('Recorded session (the live room is not running here).').catch(() => {
        setMode('offline', 'Court unavailable');
      });
    } else if (error.kind === 'not_found' || error.status === 404) {
      setMode('offline', 'Court unavailable');
      $('#foot-source').textContent = `Case ${caseId} was not found on the clerk.`;
      $('#phase-code').textContent = '404';
      $('#phase-label').textContent = 'Case not found';
      $('#phase-detail').textContent = `The clerk has no active record for case ${caseId}.`;
      renderBoard(null);
      showRetryButton();
    } else {
      // HTTP 500, malformed JSON, schema mismatch, 400, 403: show unavailable + retry, NEVER fall back to replay
      setMode('offline', 'Court unavailable');
      $('#foot-source').textContent = `Court unavailable (${error.message}).`;
      $('#phase-code').textContent = 'Error';
      $('#phase-label').textContent = 'Court unavailable';
      $('#phase-detail').textContent = error.message;
      renderBoard(null);
      showRetryButton();
    }
  }
}

setupReplayControls();
motion();
setJudges({all: 'is-listening'});
setAdvocates(null);
init();

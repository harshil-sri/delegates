import { setAvatarState } from './avatars.mjs';
import { act } from './demo-voices.mjs';
import { typewrite, emote, soundToggle } from './retro.mjs';

const $ = selector => document.querySelector(selector);
const people = {
  lead: { name: 'GPT', role: 'Delegate for Harshil', kind: 'harshil', img: '/brands/openai.svg', initials: 'G', side: 'left', voice: 'lead' },
  creator: { name: 'Claude', role: 'Delegate for Daksh', kind: 'daksh', img: '/brands/claude.svg', initials: 'C', side: 'right', voice: 'creator' },
  clerk: { name: 'The Clerk', role: 'Checks both calendars and budgets', kind: 'clerk', initials: '§', side: 'bench', voice: 'vale' },
  'human-lead': { name: 'Harshil', role: 'Person', kind: 'humans', initials: 'H', side: 'floor', voice: 'owner' },
  'human-creator': { name: 'Daksh', role: 'Person', kind: 'humans', initials: 'D', side: 'floor', voice: 'owner' },
  other: { name: 'Room', role: 'Switch', kind: 'clerk', initials: '·', side: 'floor', voice: 'clerk' },
};
const speakerKey = { lead: 'harshil', creator: 'daksh', clerk: 'clerk', 'human-lead': 'humans', 'human-creator': 'humans', other: 'clerk' };
const judgeIds = ['arata', 'vale', 'thorne'];
const markerFor = { arata: 'Cost', vale: 'Feasibility', thorne: 'Fairness' };
const moments = {
  objection: ['THE CLERK OBJECTS', 'Objection'],
  ruling: ['THE DELEGATES AGREE', 'Agreement'],
  verdict: ['BOTH PEOPLE APPROVED', 'Trip locked'],
};
let timers = [];

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const format = body => escape(body).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
const plain = body => String(body).replace(/\*\*|`/g, '').replace(/@cvc-[a-z-]+\s*/g, '').trim();
const clock = ts => { const d = new Date(typeof ts === 'number' ? ts : Date.parse(ts)); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
const later = (fn, ms) => timers.push(setTimeout(fn, ms));

function toneOf(text) {
  if (/Trip locked|🤝|Delegates agree|✅|passes|approved|accept/i.test(text)) return 'good';
  if (/❌|reject|refus|only takes instructions|can't plan|couldn't|conflict|clash|breaks|over budget|exceeds/i.test(text)) return 'bad';
  return '';
}

function eventOf(message) {
  const text = message.body;
  if (message.role === 'clerk') {
    if (/Trip locked/i.test(text)) return 'verdict';
    if (/Delegates agree/i.test(text)) return 'ruling';
    if (toneOf(text) === 'bad') return 'objection';
    return 'statement';
  }
  if (message.role === 'lead' || message.role === 'creator') return /counter/i.test(text) ? 'objection' : 'proposal';
  return 'statement';
}

function culprits(text) {
  const hit = [];
  if (/budget|₹|cost|afford|price|expensive|cheap|\dk\b/i.test(text)) hit.push('arata');
  if (/calendar|block|deadline|busy|window|time|evening|morning|work|leave|overnight|hours|free/i.test(text)) hit.push('vale');
  if (/instructions|fair|only|consent|approve/i.test(text)) hit.push('thorne');
  return hit.length ? hit : judgeIds;
}

function bench(states, marker) {
  for (const id of judgeIds) {
    document.querySelectorAll(`#court-scene .judge[data-judge="${id}"]`).forEach(j => j.setAttribute('class', `judge ${states[id] ?? states.all ?? 'is-listening'}`));
    const m = $(`#court-scene .judge-marker[data-perspective="${markerFor[id]}"]`);
    if (!m) continue;
    const label = typeof marker === 'function' ? marker(id) : marker;
    if (label) { m.querySelector('small').textContent = label[0]; m.dataset.decision = label[1] ?? ''; }
  }
}

function avatars(states) {
  for (const role of ['lead', 'creator']) document.querySelectorAll(`.advocate-mark.${people[role].side} .advocate-avatar`).forEach(el => setAvatarState(el, states[role] ?? 'idle'));
}

function retrigger(event) {
  const stage = $('.court-stage');
  stage.dataset.event = '';
  void stage.offsetWidth;
  stage.dataset.event = event;
}

function bubble(who, text, tone) {
  const stage = $('.court-stage');
  stage.querySelectorAll('.live-bubble').forEach(b => b.remove());
  const box = document.createElement('div');
  box.className = 'live-bubble';
  box.dataset.side = who.side;
  box.dataset.tone = tone;
  box.setAttribute('aria-hidden', 'true');
  box.innerHTML = `<strong>${escape(who.name)}${who.side === 'bench' ? ' · through Justice Vale' : ''}</strong><p></p>`;
  stage.append(box);
  const line = text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text;
  return new Promise(done => typewrite(box.querySelector('p'), line, { voice: who.voice, cps: 60, onDone: done }));
}

function thinking(side, name) {
  $('.court-stage').querySelectorAll('.live-thinking').forEach(t => t.remove());
  if (!side) return;
  const tag = document.createElement('div');
  tag.className = 'live-thinking';
  tag.dataset.side = side;
  tag.setAttribute('aria-hidden', 'true');
  tag.innerHTML = `${escape(name)} is thinking <span>.</span><span>.</span><span>.</span>`;
  $('.court-stage').append(tag);
}

function nextUp(message) {
  const body = message.body;
  if (message.role === 'human-lead' && /@cvc-lead-advocate/.test(body)) return 'lead';
  if (message.role === 'human-creator' && /@cvc-creator-advocate/.test(body)) return 'creator';
  if (message.role === 'clerk' && /@cvc-creator-advocate/.test(body) && !/only takes instructions/.test(body)) return 'creator';
  if (message.role === 'clerk' && (/@cvc-lead-advocate/.test(body) || /^Planning:|^Re-planning/i.test(body)) && !/only takes instructions/.test(body)) return 'lead';
  return null;
}

async function showOnStage(message) {
  timers.forEach(clearTimeout);
  timers = [];
  const who = people[message.role] ?? people.other;
  const event = eventOf(message);
  const tone = toneOf(message.body);
  const speaker = speakerKey[message.role] ?? 'clerk';
  const text = plain(message.body);
  thinking(null);
  $('#court-scene').dataset.speaker = speaker;
  $('.court-stage').dataset.speaker = speaker;
  retrigger(event);
  $('#dialogue-name').textContent = who.name;
  $('#dialogue-type').textContent = who.role;
  $('#dialogue-text').textContent = text;
  $('#dialogue-avatar').textContent = who.initials;
  $('#phase').textContent = { verdict: 'Trip locked', ruling: 'Plan agreed', objection: message.role === 'clerk' ? 'Clerk objects' : 'Counter-offer', proposal: 'Negotiating' }[event] ?? 'In session';
  $('#harshil-state').textContent = message.role === 'lead' ? 'Has the floor' : 'Listening';
  $('#daksh-state').textContent = message.role === 'creator' ? 'Has the floor' : 'Listening';
  $('#session-label').textContent = event === 'verdict' ? 'THE TRIP IS LOCKED' : 'THE ROOM IS IN SESSION';
  $('#announcer').textContent = `${who.name}: ${text.slice(0, 160)}`;
  const moment = $('#stage-moment');
  moment.hidden = !moments[event];
  moment.dataset.type = event;
  if (moments[event]) { $('#moment-label').textContent = moments[event][0]; $('#moment-title').textContent = moments[event][1]; }

  if (message.role === 'lead' || message.role === 'creator') {
    avatars({ [message.role]: event === 'objection' ? 'objecting' : 'speaking' });
    bench({ all: 'is-listening' }, ['Listening']);
    emote($(`.advocate-mark.${who.side}`), event === 'objection' ? '!' : 'idea');
    later(() => { bench({ all: 'is-assessing' }, ['Weighing']); act('arata', 'soroban'); act('thorne', 'scales'); act('vale', 'watch'); }, 1600);
    await bubble(who, text, tone);
    avatars({ [message.role]: 'idle' });
  } else if (message.role === 'clerk') {
    avatars({});
    bench({ vale: 'is-speaking', all: 'is-assessing' }, ['Checking']);
    if (event === 'ruling' || event === 'verdict') act('vale', 'gavel', 1100);
    await bubble(who, text, tone);
    if (tone === 'bad') {
      const blamed = culprits(message.body);
      bench(Object.fromEntries(judgeIds.map(id => [id, blamed.includes(id) ? 'is-rejecting' : 'is-narrowing'])), id => blamed.includes(id) ? ['Objection', 'Reject'] : ['Concerned', 'Narrow']);
      act('thorne', 'startle'); act('arata', 'confer-right'); act('vale', 'confer-left');
      emote($('.advocate-mark.left'), 'sweat');
    } else if (tone === 'good') {
      bench({ all: 'is-accepting' }, ['Passes', 'Accept']);
      avatars({ lead: 'pleased', creator: 'pleased' });
      if (event === 'verdict' || event === 'ruling') { emote($('.advocate-mark.left'), '♪'); emote($('.advocate-mark.right'), '♪'); retrigger(event); }
    } else {
      bench({ all: 'is-listening' }, ['Listening']);
    }
  } else {
    avatars({});
    bench({ all: 'is-listening' }, ['Listening']);
    act('vale', 'lean');
    await bubble(who, text, tone);
  }
  const up = nextUp(message);
  if (up) {
    thinking(people[up].side, people[up].name);
    avatars({ [up]: 'thinking' });
    emote($(`.advocate-mark.${people[up].side}`), '...');
  }
}

function chatItem(message) {
  const who = people[message.role] ?? people.other;
  const article = document.createElement('article');
  article.className = 'chat-message';
  article.dataset.event = message.id;
  const avatar = who.img ? `<img src="${who.img}" alt="" width="16" height="16">` : escape(who.initials);
  article.innerHTML = `<header class="chat-message-header"><span class="chat-avatar ${who.kind}" aria-hidden="true">${avatar}</span><span><strong class="chat-name">${escape(who.name)}</strong><span class="chat-role">${escape(who.role)}</span></span><span class="chat-time">${escape(clock(message.timestamp))}</span></header><p>${format(message.body)}</p>`;
  return article;
}

function addSoundButton() {
  const nav = $('.header-actions');
  if (!nav || $('#live-sound')) return;
  const button = document.createElement('button');
  button.id = 'live-sound';
  button.className = 'quiet-button';
  button.type = 'button';
  nav.prepend(button);
  soundToggle(button);
}

export function startLive({ interval = 1500 } = {}) {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/live-room.css';
  document.head.append(css);
  addSoundButton();
  const shown = new Set();
  const queue = [];
  let playing = false;
  const log = $('#chat-log');
  log.replaceChildren();
  log.setAttribute('aria-label', 'Live Switch room');
  for (const selector of ['.playback', '#docket', '#about-button', '.round-total', '.header-actions .live-link', '[data-tab="docket"]']) document.querySelectorAll(selector).forEach(el => { el.hidden = true; });
  const topline = $('.stage-topline span:last-child');
  if (topline) topline.textContent = 'Two delegates · one clerk';
  const roomTitle = $('#room-title');
  if (roomTitle) roomTitle.innerHTML = '<span>#</span>weekend-trip';
  const footer = $('.room-footer p');
  if (footer) footer.textContent = 'Read-only view of the live Switch room. Only Harshil and Daksh can approve a plan.';
  document.querySelectorAll('.demo-tag').forEach(el => { el.textContent = 'Live · Switch room'; });
  $('#case-title').textContent = 'The weekend trip';
  $('#round').textContent = '01';
  $('#phase').textContent = 'In session';
  const intro = $('.chat-intro p');
  const dot = $('.room-header > p');
  let lastStatus;
  const setStatus = (live, text) => {
    if (lastStatus === text) return;
    lastStatus = text;
    if (intro) intro.textContent = text;
    if (!dot) return;
    const mark = document.createElement('span');
    mark.className = 'offline-dot';
    if (live) { mark.style.background = '#3f8f4e'; mark.style.borderColor = '#3f8f4e'; }
    dot.replaceChildren(mark, ` ${live ? 'Live room' : 'Waiting for the room'}`);
  };
  setStatus(false, 'Connecting to the Switch room…');
  $('#dialogue-name').textContent = 'The Clerk';
  $('#dialogue-type').textContent = 'Waiting';
  $('#dialogue-text').textContent = 'Waiting for the first message in the room.';
  bench({ all: 'is-listening' }, ['Listening']);

  async function play() {
    if (playing) return;
    playing = true;
    while (queue.length) {
      const message = queue.shift();
      await showOnStage(message);
      if (queue.length) await new Promise(r => setTimeout(r, 900));
    }
    playing = false;
  }

  let first = true;
  async function poll() {
    try {
      const response = await fetch('/api/room', { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const { messages = [] } = await response.json();
      setStatus(true, 'Live from the Switch room. Every message here was posted in Mattermost.');
      // After a clerk reset the feed starts over, so drop what it no longer has.
      const current = new Set(messages.map(m => m.id));
      for (const id of [...shown]) if (!current.has(id)) { shown.delete(id); log.querySelector(`[data-event="${CSS.escape(id)}"]`)?.remove(); }
      $('#mobile-count').textContent = shown.size;
      const fresh = messages.filter(m => !shown.has(m.id));
      if (fresh.length) {
        const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
        for (const m of fresh) { shown.add(m.id); log.append(chatItem(m)); }
        $('#mobile-count').textContent = shown.size;
        queue.push(...(first ? fresh.slice(-1) : fresh));
        play();
        if (nearBottom || first) requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
      }
      first = false;
    } catch {
      setStatus(false, 'Trip mode is not running. Start it with scripts\\start-trip.ps1, and this panel will fill in.');
    }
    setTimeout(poll, interval);
  }
  poll();
}

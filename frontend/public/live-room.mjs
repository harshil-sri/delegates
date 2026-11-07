import { setAvatarState } from './avatars.mjs';

const $ = selector => document.querySelector(selector);
const people = {
  lead: { name: 'GPT', role: 'Delegate for Harshil', kind: 'harshil', img: '/brands/openai.svg', initials: 'G', side: 'left' },
  creator: { name: 'Claude', role: 'Delegate for Daksh', kind: 'daksh', img: '/brands/claude.svg', initials: 'C', side: 'right' },
  clerk: { name: 'The Clerk', role: 'Checks both calendars and budgets', kind: 'clerk', initials: '§' },
  'human-lead': { name: 'Harshil', role: 'Person', kind: 'humans', initials: 'H' },
  'human-creator': { name: 'Daksh', role: 'Person', kind: 'humans', initials: 'D' },
  other: { name: 'Room', role: 'Switch', kind: 'clerk', initials: '·' },
};
const speakerKey = { lead: 'harshil', creator: 'daksh', clerk: 'clerk', 'human-lead': 'humans', 'human-creator': 'humans', other: 'clerk' };
const moments = {
  objection: ['THE CLERK OBJECTS', 'Objection'],
  ruling: ['THE DELEGATES AGREE', 'Agreement'],
  verdict: ['BOTH PEOPLE APPROVED', 'Trip locked'],
};

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const format = body => escape(body).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
const plain = body => String(body).replace(/\*\*|`/g, '');
const clock = ts => { const d = new Date(typeof ts === 'number' ? ts : Date.parse(ts)); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };

function eventOf(message) {
  const text = message.body;
  if (message.role === 'clerk') {
    if (/Trip locked/i.test(text)) return 'verdict';
    if (/Delegates agree/i.test(text)) return 'ruling';
    if (/❌|reject|refus|only takes instructions/i.test(text)) return 'objection';
    return 'statement';
  }
  if (message.role === 'lead' || message.role === 'creator') return /counter/i.test(text) ? 'objection' : 'proposal';
  return 'statement';
}

function showOnStage(message) {
  const who = people[message.role] ?? people.other;
  const event = eventOf(message);
  const speaker = speakerKey[message.role] ?? 'clerk';
  $('#court-scene').dataset.speaker = speaker;
  $('.court-stage').dataset.speaker = speaker;
  $('.court-stage').dataset.event = event;
  $('#dialogue-name').textContent = who.name;
  $('#dialogue-type').textContent = who.role;
  $('#dialogue-text').textContent = plain(message.body);
  $('#dialogue-avatar').textContent = who.initials;
  $('#phase').textContent = { verdict: 'Trip locked', ruling: 'Plan agreed', objection: 'Clerk check', proposal: 'Negotiating' }[event] ?? 'In session';
  $('#harshil-state').textContent = message.role === 'lead' ? 'Has the floor' : 'Listening';
  $('#daksh-state').textContent = message.role === 'creator' ? 'Has the floor' : 'Listening';
  for (const role of ['lead', 'creator']) {
    const state = event === 'verdict' || event === 'ruling' ? 'pleased' : message.role === role ? (event === 'objection' ? 'objecting' : 'speaking') : 'idle';
    document.querySelectorAll(`.advocate-mark.${people[role].side} .advocate-avatar`).forEach(el => setAvatarState(el, state));
  }
  const moment = $('#stage-moment');
  moment.hidden = !moments[event];
  moment.dataset.type = event;
  if (moments[event]) { $('#moment-label').textContent = moments[event][0]; $('#moment-title').textContent = moments[event][1]; }
  $('#session-label').textContent = event === 'verdict' ? 'THE TRIP IS LOCKED' : 'THE ROOM IS IN SESSION';
  $('#announcer').textContent = `${who.name}: ${plain(message.body).slice(0, 160)}`;
}

function bubble(message) {
  const who = people[message.role] ?? people.other;
  const article = document.createElement('article');
  article.className = 'chat-message';
  article.dataset.event = message.id;
  const avatar = who.img ? `<img src="${who.img}" alt="" width="16" height="16">` : escape(who.initials);
  article.innerHTML = `<header class="chat-message-header"><span class="chat-avatar ${who.kind}" aria-hidden="true">${avatar}</span><span><strong class="chat-name">${escape(who.name)}</strong><span class="chat-role">${escape(who.role)}</span></span><span class="chat-time">${escape(clock(message.timestamp))}</span></header><p>${format(message.body)}</p>`;
  return article;
}

export function startLive({ interval = 1500 } = {}) {
  const shown = new Set();
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

  async function poll() {
    try {
      const response = await fetch('/api/room', { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const { messages = [] } = await response.json();
      setStatus(true, 'Live from the Switch room. Every message here was posted in Mattermost.');
      const fresh = messages.filter(m => !shown.has(m.id));
      if (fresh.length) {
        const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
        for (const m of fresh) { shown.add(m.id); log.append(bubble(m)); }
        $('#mobile-count').textContent = shown.size;
        showOnStage(fresh.at(-1));
        if (nearBottom || shown.size === fresh.length) requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
      }
    } catch {
      setStatus(false, 'Trip mode is not running. Start it with scripts\\start-trip.ps1, and this panel will fill in.');
    }
    setTimeout(poll, interval);
  }
  poll();
}

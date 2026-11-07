import { characters, perspectives, judgeRoleMapping, speakers, createState, advance, resolveAppeal, exportPlan, script } from './hearing.mjs';

const $ = selector => document.querySelector(selector);
let state = createState();
let playing = false;
let playbackTimer;
let choreography = [];
let lastMessageCount = 0;
let unread = 0;
let expanded = false;
let entered = false;
let introTimers = [];
let lastRulingId;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function escape(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function sceneMarkup() {
  return `<img class="scene-background" src="/art/chamber.svg" alt="" width="1440" height="1000">
    ${characters.map((character, index) => `<div class="judge" data-character="${character.id}" role="img" aria-label="Panel member ${index + 1}, ${character.id === 'woman' ? 'adapted costume and original portrait' : 'supplied Capcom reference artwork'}. Perspective not assigned."><img class="judge-figure" src="${character.asset}" alt="" width="360" height="650"></div>`).join('')}
    <div class="bench-front" aria-hidden="true"></div>
    <div class="judge-markers" aria-label="The panel’s perspectives, not yet assigned to individual characters"><span class="panel-legend">Panel perspectives · artwork unassigned</span>${perspectives.map(perspective => `<div class="judge-marker" role="group" data-perspective="${perspective}" aria-label="${perspective}: listening"><strong>${perspective}</strong><small>Listening</small></div>`).join('')}</div>
    <img class="room-foreground" src="/art/chamber-foreground.svg" alt="" width="1440" height="1000">
    <div class="advocate-spotlight left" aria-hidden="true"></div><div class="advocate-spotlight right" aria-hidden="true"></div>
    <div class="advocate-mark left"><img src="/brands/openai.svg" alt="OpenAI, sample GPT advocate" width="64" height="64"></div>
    <div class="advocate-mark right"><img src="/brands/claude.svg" alt="Claude, sample advocate" width="64" height="64"></div>`;
}

$('#court-scene').innerHTML = sceneMarkup();
$('#intro-scene').innerHTML = sceneMarkup();

Promise.all(characters.map(async character => {
  const response = await fetch(character.asset);
  if (!response.ok) return;
  const source = await response.text();
  for (const scene of ['court-scene', 'intro-scene']) {
    const prefix = `${scene}-${character.id}-`;
    const markup = source.replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`).replace(/href="#([^"]+)"/g, (_, id) => `href="#${prefix}${id}"`);
    const host = $(`#${scene} [data-character="${character.id}"]`);
    host.innerHTML = markup;
    host.querySelector('svg').setAttribute('aria-hidden', 'true');
  }
})).catch(() => { $('#announcer').textContent = 'Character motion is unavailable. The hearing transcript remains available.'; });

function startIntro() {
  introTimers.forEach(clearTimeout);
  introTimers = [];
  const intro = $('#intro');
  intro.classList.remove('is-running');
  intro.dataset.beat = reducedMotion.matches ? '3' : '0';
  $('#enter-court').hidden = !reducedMotion.matches;
  $('#intro-beat').textContent = reducedMotion.matches ? '04 / The whole court' : '01 / The threshold';
  if (reducedMotion.matches) return;
  void intro.offsetWidth;
  intro.classList.add('is-running');
  [[1600, '1', '02 / The bench'], [3400, '2', '03 / The advocates'], [5100, '3', '04 / The whole court']].forEach(([delay, beat, label]) => {
    introTimers.push(setTimeout(() => { intro.dataset.beat = beat; $('#intro-beat').textContent = label; }, delay));
  });
  introTimers.push(setTimeout(() => { $('#enter-court').hidden = false; }, 7000));
}

function setEntered(value) {
  entered = value;
  $('#intro').hidden = value;
  $('#intro').inert = value;
  $('#workspace').hidden = !value;
  $('#workspace').inert = !value;
  if (value) {
    introTimers.forEach(clearTimeout);
    introTimers = [];
    if (!reducedMotion.matches) {
      $('#court-scene').animate([{ transform: 'translateX(3%) scale(1.08)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' });
      $('.switch-panel').animate([{ transform: 'translateX(24px)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
    $('#main').focus({ preventScroll: true });
    window.scrollTo(0, 0);
    requestAnimationFrame(checkDialogueOverflow);
  } else {
    setPlaying(false);
    startIntro();
    $('#skip-intro').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function clearChoreography() {
  choreography.forEach(clearTimeout);
  choreography = [];
  document.querySelectorAll('#court-scene .judge').forEach(judge => { judge.className = 'judge'; });
}

function showRuling(current) {
  if (lastRulingId === current.id) return;
  lastRulingId = current.id;
  clearChoreography();
  document.querySelectorAll('#court-scene .judge-marker').forEach(marker => {
    marker.removeAttribute('data-decision');
    marker.querySelector('small').textContent = current.assessments ? 'CONSIDERING' : 'LISTENING';
    marker.setAttribute('aria-label', `${marker.dataset.perspective}: ${current.assessments ? 'considering' : 'listening'}`);
  });
  document.querySelectorAll('#court-scene .judge').forEach(figure => {
    figure.classList.add(current.assessments ? 'is-assessing' : current.speaker === 'panel' ? 'is-speaking' : 'is-listening');
  });
  if (!current.assessments) return;
  perspectives.forEach((perspective, index) => {
    const characterId = judgeRoleMapping[perspective];
    const figure = characterId ? $(`#court-scene [data-character="${characterId}"]`) : null;
    const marker = $(`#court-scene [data-perspective="${perspective}"]`);
    const assessment = current.assessments[perspective];
    if (!assessment) return;
    const finish = () => {
      if (figure) {
        figure.classList.remove('is-assessing');
        figure.classList.add({ Accept: 'is-accepting', Narrow: 'is-narrowing', Reject: 'is-rejecting' }[assessment[0]] || 'is-listening');
      }
      marker.dataset.decision = assessment[0];
      marker.querySelector('small').textContent = assessment[0].toUpperCase();
      marker.setAttribute('aria-label', `${perspective}: ${assessment[0]}. ${assessment[1]}`);
      if (index === perspectives.length - 1) document.querySelectorAll('#court-scene .judge.is-assessing').forEach(judge => { judge.classList.replace('is-assessing', 'is-listening'); });
    };
    if (reducedMotion.matches) finish();
    else {
      choreography.push(setTimeout(finish, 500 + index * 400));
    }
  });
}

function renderDocket() {
  const container = $('#docket-items');
  for (const [index, item] of state.items.entries()) {
    let details = $(`#item-${item.id}`);
    if (!details) {
      details = document.createElement('details');
      details.className = 'docket-item';
      details.id = `item-${item.id}`;
      details.innerHTML = `<summary><span class="item-number">0${index + 1}</span><span><strong class="item-title"></strong><span class="item-wording"></span><span class="item-owner"></span></span><span class="item-status"></span><span class="item-chevron" aria-hidden="true">+</span></summary><div class="item-detail"></div>`;
      container.append(details);
    }
    details.querySelector('.item-title').textContent = item.title;
    const latest = item.history.at(-1);
    details.querySelector('.item-owner').textContent = `${item.owner}${latest ? ` · Round ${latest.round} · ${latest.type.replaceAll('_', ' ')}` : ''}`;
    details.querySelector('.item-wording').textContent = item.text;
    const status = details.querySelector('.item-status');
    status.textContent = item.status;
    status.dataset.status = item.status;
    details.dataset.current = state.current.item === item.id;
    details.querySelector('.item-detail').innerHTML = `<p>${escape(item.text)}</p><h3>Decision history</h3>${item.history.length ? `<ol>${item.history.map(change => `<li><span>Round ${change.round} · ${escape(change.type.replaceAll('_', ' '))} · ${escape(change.status)}</span>${escape(change.text)}</li>`).join('')}</ol>` : '<p>No proposal has been heard yet.</p>'}`;
  }
  $('#agreed-count').textContent = `${state.items.filter(item => item.status === 'Agreed').length} of 4 agreed`;
  $('#locate-item').hidden = !state.current.item;
}

function renderChat() {
  const log = $('#chat-log');
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 55;
  const additions = state.events.slice(lastMessageCount);
  for (const event of additions) {
    const speaker = speakers[event.speaker];
    const article = document.createElement('article');
    article.className = `chat-message${event.assessments ? ' assessment-message' : ''}`;
    article.dataset.event = event.id;
    const avatar = ['harshil', 'daksh'].includes(event.speaker) ? `<img src="/brands/${event.speaker === 'harshil' ? 'openai' : 'claude'}.svg" alt="" width="16" height="16">` : escape(speaker.initials);
    const position = state.events.indexOf(event);
    const minute = String(Math.floor(position * 11 / 60)).padStart(2, '0');
    const second = String(position * 11 % 60).padStart(2, '0');
    article.innerHTML = `<header class="chat-message-header"><span class="chat-avatar ${speaker.kind}" aria-hidden="true">${avatar}</span><span><strong class="chat-name">${speaker.name}</strong><span class="chat-role">${speaker.role}</span></span><span class="chat-time" aria-label="Sample timeline ${minute} minutes ${second} seconds">${minute}:${second}</span></header><span class="chat-event-type">${escape(event.type.replaceAll('_', ' '))} · ROUND ${event.round}</span><p>${escape(event.text)}</p>${event.assessments ? `<div class="chat-assessments">${Object.entries(event.assessments).map(([perspective, [decision, text]]) => `<div class="chat-assessment"><strong>${perspective}<span>${decision.toUpperCase()}</span></strong><p>${escape(text)}</p></div>`).join('')}</div>` : ''}`;
    log.append(article);
  }
  lastMessageCount = state.events.length;
  $('#mobile-count').textContent = state.events.length;
  if (nearBottom) {
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
  } else if (additions.length) {
    unread += additions.length;
    $('#new-messages').hidden = false;
    $('#new-messages').textContent = `${unread} new ${unread === 1 ? 'message' : 'messages'} ↓`;
  }
}

const typeLabels = { statement: 'Opening statement', proposal: 'Motion before the court', objection: 'Objection', ruling: 'Ruling of the bench', plan_update: 'Entered into the record', deadlock: 'Human decision required', appeal: 'Appeal to the owners', verdict: 'Final verdict' };
const phases = { statement: 'Opening statements', proposal: 'Motion & counter-motion', objection: 'Hearing an objection', ruling: 'The bench has ruled', plan_update: 'Updating the plan', deadlock: 'Deadlock', appeal: 'Appeal to the owners', verdict: 'Case closed' };

function checkDialogueOverflow() {
  const paragraph = $('#dialogue-text');
  const button = $('#expand-dialogue');
  if (!entered) return;
  if (expanded) button.hidden = false;
  else button.hidden = paragraph.scrollHeight <= paragraph.clientHeight + 1;
}

function render() {
  const playbackHadFocus = $('.playback').contains(document.activeElement);
  const event = state.current;
  const speaker = speakers[event.speaker];
  const awaiting = event.type === 'appeal' && !state.choice;
  $('#round').textContent = String(event.round).padStart(2, '0');
  $('#phase').textContent = phases[event.type];
  $('#dialogue-name').textContent = speaker.name;
  $('#dialogue-type').textContent = typeLabels[event.type];
  $('#dialogue-text').textContent = event.text;
  $('#dialogue-avatar').textContent = speaker.initials;
  expanded = false;
  $('.dialogue-body').classList.remove('expanded');
  $('#expand-dialogue').setAttribute('aria-expanded', 'false');
  $('#expand-dialogue').textContent = 'Read full statement';
  $('#court-scene').dataset.speaker = event.speaker;
  $('.court-stage').dataset.speaker = event.speaker;
  $('.court-stage').dataset.event = event.type;
  $('#harshil-state').textContent = event.speaker === 'harshil' ? (event.type === 'objection' ? 'Objecting' : 'Has the floor') : 'Listening';
  $('#daksh-state').textContent = event.speaker === 'daksh' ? (event.type === 'objection' ? 'Objecting' : 'Has the floor') : 'Listening';
  $('#session-label').textContent = state.complete ? 'THE CASE IS CLOSED' : awaiting ? 'AWAITING THE OWNERS’ DECISION' : 'THE COURT IS IN SESSION';
  const moment = $('#stage-moment');
  moment.hidden = !['objection', 'ruling', 'deadlock', 'appeal', 'verdict'].includes(event.type);
  moment.dataset.type = event.type;
  $('#moment-label').textContent = { objection: 'A POINT OF DISAGREEMENT', ruling: 'THE BENCH HAS SPOKEN', deadlock: 'FOUR ROUNDS. NO CONSENSUS.', appeal: 'OVER TO THE PEOPLE', verdict: 'LET THE RECORD SHOW' }[event.type] || '';
   $('#moment-title').textContent = { objection: 'Objection', ruling: 'Ruling', deadlock: 'DEADLOCK', appeal: 'APPEAL', verdict: 'Final verdict' }[event.type] || '';
  $('#appeal-panel').hidden = !awaiting;
  $('#verdict-panel').hidden = !state.complete;
  $('#verdict-summary').textContent = `Four items settled across four rounds. ${state.choice === 'local' ? 'The owners chose a guided local demo.' : 'The owners chose a recorded walkthrough.'}`;
  const progress = state.cursor + 1;
  $('.progress-track').setAttribute('aria-valuenow', progress);
  $('#progress-fill').style.width = `${progress / script.length * 100}%`;
  $('#progress-label').textContent = `${String(progress).padStart(2, '0')} / ${script.length}`;
  $('#play-button').disabled = awaiting || state.complete;
  $('#step-button').disabled = awaiting || state.complete;
  showRuling(event);
  renderDocket();
  renderChat();
  if (awaiting || state.complete) setPlaying(false);
  updatePlaybackUI();
  requestAnimationFrame(checkDialogueOverflow);
  $('#announcer').textContent = `${typeLabels[event.type]}, round ${event.round}. ${speaker.name}.${awaiting ? ' Choose a sample human decision in the court view to continue.' : ''}`;
  if (playbackHadFocus && awaiting) $('[data-choice="local"]').focus();
  else if (playbackHadFocus && state.complete) $('#download-plan').focus();
}

function updatePlaybackUI() {
  $('#play-button').setAttribute('aria-label', playing ? 'Pause hearing' : 'Play hearing');
  $('#play-icon').innerHTML = playing ? '<path d="M5 4h4v12H5ZM12 4h4v12h-4Z"/>' : '<path d="m7 4 9 6-9 6Z"/>';
  $('#playback-state').textContent = state.complete ? 'A plan, agreed.' : state.current?.type === 'appeal' && !state.choice ? 'The people decide' : playing ? 'Playing sample hearing' : 'Ready when you are';
}

function scheduleNext() {
  clearTimeout(playbackTimer);
  if (!playing) return;
  const delay = Math.min(14000, Math.max(7000, state.current.text.length * 35 + 2000)) / Number($('#speed-select').value);
  playbackTimer = setTimeout(() => {
    if (advance(state)) render();
    else setPlaying(false);
    if (playing) scheduleNext();
  }, delay);
}

function setPlaying(value) {
  playing = value;
  clearTimeout(playbackTimer);
  updatePlaybackUI();
  if (value) scheduleNext();
}

function download() {
  const blob = new Blob([exportPlan(state)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = state.complete ? 'delegates-agreed-plan.md' : 'delegates-hearing-record.md';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('#announcer').textContent = 'The sample hearing record has been exported.';
}

$('#enter-court').addEventListener('click', () => setEntered(true));
$('#skip-intro').addEventListener('click', () => setEntered(true));
$('.skip-link').addEventListener('click', () => { if (!entered) setEntered(true); });
$('#replay-intro').addEventListener('click', () => setEntered(false));
$('#about-button').addEventListener('click', () => {
  const panel = $('#about-panel');
  panel.hidden = !panel.hidden;
  $('#about-button').setAttribute('aria-expanded', !panel.hidden);
});
$('#participants-button').addEventListener('click', () => {
  const panel = $('#participants');
  panel.hidden = !panel.hidden;
  $('#participants-button').setAttribute('aria-expanded', !panel.hidden);
});
$('#play-button').addEventListener('click', () => setPlaying(!playing));
$('#step-button').addEventListener('click', () => {
  setPlaying(false);
  if (advance(state)) render();
});
$('#restart-button').addEventListener('click', () => {
  setPlaying(false);
  clearChoreography();
   state = createState();
   lastRulingId = undefined;
  lastMessageCount = 0;
  unread = 0;
  $('#chat-log').replaceChildren();
  $('#new-messages').hidden = true;
  advance(state);
  render();
  $('#announcer').textContent = 'Hearing restarted. Previous sample choices have been cleared.';
});
$('#speed-select').addEventListener('change', () => { if (playing) scheduleNext(); });
$('#expand-dialogue').addEventListener('click', () => {
  expanded = !expanded;
  $('.dialogue-body').classList.toggle('expanded', expanded);
  $('#expand-dialogue').setAttribute('aria-expanded', expanded);
  $('#expand-dialogue').textContent = expanded ? 'Collapse statement' : 'Read full statement';
});
document.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
  if (!resolveAppeal(state, button.dataset.choice)) return;
  render();
  $('#play-button').focus({ preventScroll: true });
  $('#announcer').textContent = 'Sample human decision recorded. Continue the hearing to receive the final plan.';
}));
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  $('.court-layout').dataset.view = button.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(tab => tab.setAttribute('aria-pressed', tab === button));
  if (button.dataset.tab === 'court') requestAnimationFrame(checkDialogueOverflow);
}));
$('#new-messages').addEventListener('click', () => {
  $('#chat-log').scrollTop = $('#chat-log').scrollHeight;
  unread = 0;
  $('#new-messages').hidden = true;
  $('#chat-log').focus({ preventScroll: true });
});
$('#chat-log').addEventListener('scroll', () => {
  const log = $('#chat-log');
  if (log.scrollHeight - log.scrollTop - log.clientHeight < 55) {
    unread = 0;
    $('#new-messages').hidden = true;
  }
});
$('#download-plan').addEventListener('click', download);
$('#download-record').addEventListener('click', download);
$('#locate-item').addEventListener('click', () => {
  const item = $(`#item-${state.current.item}`);
  if (item) {
    item.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    item.querySelector('summary').focus({ preventScroll: true });
  }
});
reducedMotion.addEventListener('change', () => {
  if (!entered) startIntro();
  if (state.current) { lastRulingId = undefined; showRuling(state.current); }
});
window.addEventListener('resize', checkDialogueOverflow);
document.fonts.ready.then(checkDialogueOverflow);
document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
advance(state);
render();
startIntro();

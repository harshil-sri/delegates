// Demo hearing: dialogue over the speakers' heads, and a bench that is never
// still. Imported by app.mjs; it only reads the scene and adds bubbles/gestures.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const timers = new Map();

function placeAbove(bubble, target) {
  const scene = document.querySelector('#court-scene'), box = target.getBoundingClientRect(), frame = scene.getBoundingClientRect();
  bubble.style.left = `${box.left - frame.left + box.width / 2}px`;
  bubble.style.top = `${box.top - frame.top - 8}px`;
}

function say(key, target, name, text, tone = '') {
  const scene = document.querySelector('#court-scene');
  if (!scene || !target || !text) return;
  let bubble = scene.querySelector(`.demo-bubble[data-key="${key}"]`);
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'demo-bubble';
    bubble.dataset.key = key;
    bubble.setAttribute('aria-hidden', 'true');
    bubble.innerHTML = '<b></b><span></span>';
    scene.append(bubble);
  }
  bubble.dataset.tone = tone;
  bubble.querySelector('b').textContent = name;
  bubble.querySelector('span').textContent = text.length > 150 ? `${text.slice(0, 147).trimEnd()}…` : text;
  placeAbove(bubble, target);
  bubble.classList.remove('is-on'); void bubble.offsetWidth; bubble.classList.add('is-on');
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => bubble.classList.remove('is-on'), 5200));
}

export function act(id, name, ms = 1700) {
  const judge = document.querySelector(`#court-scene [data-judge="${id}"]`);
  if (!judge) return;
  judge.removeAttribute('data-act'); void judge.getBoundingClientRect(); judge.setAttribute('data-act', name);
  setTimeout(() => judge.removeAttribute('data-act'), ms);
}

export function demoVoices(event) {
  const scene = document.querySelector('#court-scene');
  if (!scene || !event) return;
  const tone = event.type === 'objection' ? 'bad' : ['verdict', 'plan_update'].includes(event.type) ? 'good' : '';
  if (event.speaker === 'harshil' || event.speaker === 'daksh') {
    const mark = scene.querySelector(`.advocate-mark.${event.speaker === 'harshil' ? 'left' : 'right'}`);
    say(event.speaker, mark, event.speaker === 'harshil' ? 'GPT · for Harshil' : 'Claude · for Daksh', event.text, tone);
    if (event.type === 'objection') { act('thorne', 'startle'); act('arata', 'confer-right'); act('vale', 'confer-left'); }
    else { const i = (event.round ?? 0) % 3; act(['arata', 'vale', 'thorne'][i], ['soroban', 'watch', 'scales'][i]); }
  } else if (event.speaker === 'panel' || event.speaker === 'clerk') {
    const head = scene.querySelector('[data-judge="vale"] .j-head');
    say('bench', head, event.speaker === 'panel' ? 'Justice Vale · for the bench' : 'The clerk', event.text, tone);
    if (event.type === 'ruling' || event.type === 'verdict') act('vale', 'gavel', 1100);
    if (event.type === 'deadlock' || event.type === 'appeal') { act('thorne', 'sigh'); act('arata', 'sigh'); }
  }
}

const moves = {arata: ['soroban', 'specs', 'nod'], vale: ['watch', 'tap', 'lean'], thorne: ['scales', 'chuckle', 'finger']};
setInterval(() => {
  if (reduced.matches || document.hidden) return;
  if (Math.random() < .2) { act('arata', 'confer-right'); act('vale', 'confer-left'); return; }
  const id = ['arata', 'vale', 'thorne'][Math.floor(Math.random() * 3)];
  act(id, moves[id][Math.floor(Math.random() * 3)]);
}, 2600);

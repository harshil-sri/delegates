// Retro game layer: typewriter dialogue with per-speaker chiptune blips
// (synthesised, original — no sampled game audio), and small pixel emotes.

const voices = {
  lead: {f: 520, type: 'square'}, creator: {f: 640, type: 'square'},
  vale: {f: 300, type: 'triangle'}, thorne: {f: 200, type: 'triangle'}, arata: {f: 380, type: 'triangle'},
  clerk: {f: 260, type: 'sine'}, owner: {f: 460, type: 'sawtooth'}
};
let ctx = null, muted = false;
try { muted = localStorage.getItem('cvc-muted') === '1'; } catch {}
const unlock = () => { try { ctx ??= new AudioContext(); if (ctx.state === 'suspended') ctx.resume(); } catch {} };
addEventListener('pointerdown', unlock, {once: true});
addEventListener('keydown', unlock, {once: true});

export function blip(voice = 'clerk') {
  if (muted || !ctx || ctx.state !== 'running') return;
  const v = voices[voice] ?? voices.clerk, now = ctx.currentTime;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = v.type;
  osc.frequency.setValueAtTime(v.f * (0.94 + Math.random() * 0.12), now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.07);
}

export function soundToggle(button) {
  if (!button) return;
  const show = () => { button.textContent = muted ? 'Sound off' : 'Sound on'; button.setAttribute('aria-pressed', String(!muted)); };
  show();
  button.addEventListener('click', () => { muted = !muted; unlock(); try { localStorage.setItem('cvc-muted', muted ? '1' : '0'); } catch {} show(); });
}

// Reveal text a few characters per frame with a blip every few letters.
const typing = new WeakMap();
export function typewrite(el, text, {voice = 'clerk', cps = 55, onDone} = {}) {
  cancelAnimationFrame(typing.get(el));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { el.textContent = text; onDone?.(); return; }
  el.textContent = '';
  const start = performance.now();
  let shown = 0;
  const step = now => {
    const target = Math.min(text.length, Math.floor((now - start) / 1000 * cps));
    if (target > shown) {
      for (let i = shown; i < target; i++) if (i % 3 === 0 && /\S/.test(text[i])) { blip(voice); break; }
      shown = target; el.textContent = text.slice(0, shown);
    }
    if (shown < text.length) typing.set(el, requestAnimationFrame(step)); else onDone?.();
  };
  typing.set(el, requestAnimationFrame(step));
}

// 7x7 pixel emotes (one letter per pixel; r = red, k = ink, w = white, y = gold, b = blue).
const EMOTES = {
  '!': ['..rrr..', '..rrr..', '..rrr..', '..rrr..', '.......', '..rrr..', '..rrr..'],
  '?': ['.bbbbb.', 'bb...bb', '.....bb', '...bbb.', '...bb..', '.......', '...bb..'],
  '...': ['.......', '.......', '.......', '.......', '.......', 'kk.kk.kk', 'kk.kk.kk'],
  '♪': ['...yyyy', '...y..y', '...y..y', '...y..y', '.yyy.yy', 'yyyyyyy', '.yy....'],
  'anger': ['rr...rr', 'rr...rr', '..r.r..', '.......', '..r.r..', 'rr...rr', 'rr...rr'],
  'idea': ['..yyy..', '.yyyyy.', '.yyyyy.', '.yyyyy.', '..yyy..', '..kkk..', '..kkk..'],
  'sweat': ['...b...', '..bbb..', '.bbbbb.', '.bbbbb.', '..bbb..', '.......', '.......']
};
const colours = {r: '#e2412c', k: '#1b120d', w: '#ffffff', y: '#f2c14e', b: '#4fa3e0'};
export function emote(host, kind) {
  const map = EMOTES[kind];
  if (!host || !map) return;
  host.querySelector(':scope > .emote')?.remove();
  const rects = map.flatMap((row, y) => [...row].map((c, x) => colours[c] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${colours[c]}"/>` : '')).join('');
  const box = document.createElement('div');
  box.className = 'emote';
  box.setAttribute('aria-hidden', 'true');
  box.innerHTML = `<svg viewBox="-1 -1 10 9" shape-rendering="crispEdges"><rect x="-1" y="-1" width="10" height="9" fill="#fff"/><rect x="-.5" y="-.5" width="9" height="8" fill="none" stroke="#1b120d" stroke-width=".5"/>${rects}</svg>`;
  host.append(box);
  setTimeout(() => box.remove(), 2400);
}

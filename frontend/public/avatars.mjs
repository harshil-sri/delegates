// Pixel-mascot advocates. Each avatar is a crisp pixel grid (shape-rendering:
// crispEdges) with separately animatable eyes, limbs and speech marks.
// States are set as classes on .advocate-avatar: is-speaking, is-thinking,
// is-objecting, is-pleased, is-idle.

const px = (cells, fill, cls = '') => `<g class="${cls}" fill="${fill}">${cells.map(([x, y, w = 1, h = 1]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('')}</g>`;

// Claude: the orange pixel crab mascot (wide body, side claws, four legs).
function claude() {
  const body = '#d97757', shade = '#b85f42', light = '#e8916f';
  return `
    <g class="av-legs">${px([[3, 11, 1, 3], [5, 11, 1, 3], [10, 11, 1, 3], [12, 11, 1, 3]], body)}${px([[3, 13, 1, 1], [5, 13, 1, 1], [10, 13, 1, 1], [12, 13, 1, 1]], shade)}</g>
    <g class="av-arm av-arm-l">${px([[0, 5, 2, 3]], body)}${px([[0, 7, 2, 1]], shade)}</g>
    <g class="av-arm av-arm-r">${px([[14, 5, 2, 3]], body)}${px([[14, 7, 2, 1]], shade)}</g>
    ${px([[2, 2, 12, 9]], body, 'av-body')}
    ${px([[2, 2, 12, 1], [2, 2, 1, 9]], light)}${px([[2, 10, 12, 1], [13, 3, 1, 8]], shade)}
    <g class="av-eyes av-eyes-rest" fill="#141414"><path d="M4.6 4.6 6.4 5.6 4.6 6.6v-.7l1.1-.3-1.1-.3Z"/><path d="M11.4 4.6 9.6 5.6l1.8 1v-.7l-1.1-.3 1.1-.3Z"/></g>
    <g class="av-eyes av-eyes-open" fill="#141414"><rect x="4.6" y="4.6" width="1.4" height="1.8"/><rect x="10" y="4.6" width="1.4" height="1.8"/></g>
    <g class="av-eyes av-eyes-happy" fill="none" stroke="#141414" stroke-width=".55"><path d="M4.4 6.2 5.3 5 6.2 6.2M9.8 6.2l.9-1.2.9 1.2"/></g>
    <g class="av-mouth" fill="#141414"><rect x="7" y="7.6" width="2" height=".7"/></g>`;
}

// GPT: an original pixel mascot — rounded terminal head, antenna knot, legs.
function gpt(body = '#10a37f', shade = '#0b7a5f', light = '#3fc39f') {
  return `
    <g class="av-legs">${px([[4, 12, 2, 2], [10, 12, 2, 2]], shade)}</g>
    <g class="av-antenna">${px([[7.5, 0, 1, 2]], shade)}${px([[7, -1, 2, 1]], light)}</g>
    <g class="av-arm av-arm-l">${px([[1, 6, 1, 3]], body)}${px([[0, 8, 2, 1]], shade)}</g>
    <g class="av-arm av-arm-r">${px([[14, 6, 1, 3]], body)}${px([[14, 8, 2, 1]], shade)}</g>
    ${px([[3, 2, 10, 1], [2, 3, 12, 8], [3, 11, 10, 1]], body, 'av-body')}
    ${px([[3, 2, 10, 1], [2, 3, 1, 8]], light)}${px([[3, 11, 10, 1], [13, 3, 1, 8]], shade)}
    ${px([[4, 4, 8, 5]], '#0d1b17')}
    <g class="av-eyes av-eyes-rest" fill="#7dffd6"><rect x="5.4" y="5.2" width="1.4" height="2"/><rect x="9.2" y="5.2" width="1.4" height="2"/></g>
    <g class="av-eyes av-eyes-open" fill="#7dffd6"><rect x="5.2" y="5" width="1.8" height="2.4"/><rect x="9" y="5" width="1.8" height="2.4"/></g>
    <g class="av-eyes av-eyes-happy" fill="none" stroke="#7dffd6" stroke-width=".55"><path d="M5.2 7 6.1 5.8 7 7M9 7l.9-1.2.9 1.2"/></g>
    <g class="av-mouth" fill="#7dffd6"><rect x="7" y="7.9" width="2" height=".5"/></g>`;
}

export const advocateKinds = {
  claude: {draw: claude, label: 'Claude'},
  gpt: {draw: () => gpt(), label: 'GPT'},
  codex: {draw: () => gpt(), label: 'Codex'},
  'codex-alt': {draw: () => gpt('#6f7bf7', '#4e58c7', '#9aa3ff'), label: 'Codex'}
};

export function avatarMarkup(kind, side) {
  const avatar = advocateKinds[kind] ?? advocateKinds.gpt;
  return `<div class="advocate-avatar is-idle" data-kind="${kind}" data-side="${side}">
    <span class="av-shadow" aria-hidden="true"></span>
    <svg viewBox="-1 -2 18 17" shape-rendering="crispEdges" aria-hidden="true">${avatar.draw()}</svg>
    <span class="av-bubble av-bubble-think" aria-hidden="true">···</span>
    <span class="av-bubble av-bubble-object" aria-hidden="true">!</span>
  </div>`;
}

export function setAvatarState(element, state) {
  if (!element) return;
  element.classList.remove('is-idle', 'is-speaking', 'is-thinking', 'is-objecting', 'is-pleased');
  element.classList.add(`is-${state}`);
}

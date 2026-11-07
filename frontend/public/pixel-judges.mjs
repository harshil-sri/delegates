// The bench in retro pixel art. Three original judges drawn from character maps
// (one letter per pixel), seated behind a pixel bench. Animation hooks match
// judges.css: .judge[data-judge], .j-torso, .j-head, .j-brows, .j-pupil, .j-lid,
// .j-mouth (.m-rest/.m-open/.m-smile/.m-frown), .j-gavel-arm, .j-impact,
// .j-beam/.j-pan-l/.j-pan-r, .j-bead, .j-specs, .j-finger, .j-second, data-act.

export const judges = [
  {slot: 'japan-inspired', id: 'arata', name: 'Justice Sōjirō Arata', perspective: 'Cost', x: 250,
    blurb: 'Counts every hour twice. Keeps a brass soroban on the bench and smiles only when the numbers close.'},
  {slot: 'woman', id: 'vale', name: 'Justice Imani Vale', perspective: 'Feasibility', x: 600,
    blurb: 'Presides. Times every promise against her pocket watch and strikes the gavel when a plan is real.'},
  {slot: 'victorian-inspired', id: 'thorne', name: 'Lord Justice Barnaby Thorne', perspective: 'Fairness', x: 950,
    blurb: 'Weighs both owners on his brass scales. Patient, warm and impossible to rush.'}
];

const P = 11; // one art pixel in bench units
const K = '#1b120d';
// Merge horizontal runs of the same letter into single rects.
function paint(map, palette, {only = null, skip = '', ox = 0, oy = 0} = {}) {
  let out = '';
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let w = 1;
      while (row[x + w] === c) w++;
      if (c !== '.' && palette[c] && (!only || only.includes(c)) && !skip.includes(c)) out += `<rect x="${ox + x * P}" y="${oy + y * P}" width="${w * P}" height="${P}" fill="${palette[c]}"/>`;
      x += w;
    }
  });
  return out;
}
const cells = (map, letter) => map.flatMap((row, y) => [...row].map((c, x) => c === letter ? [x, y] : null).filter(Boolean));

// Rows 0–15 are the head; 16+ the robed torso (the bench hides the rest).
const maps = {
  arata: [
    '......KKKKKKKK......',
    '....KKHHHHHHHHKK..KK',
    '...KHHhHHHHHhHHHKKhK',
    '...KHhHHHHHHHHhHKHHK',
    '...KHSSSSSSSSSSHKKK.',
    '...KSSSSSSSSSSSSK...',
    '...KSBBBSSSSBBBSK...',
    '...KPPPPPSSPPPPPK...',
    '..KKPOEOPPPPOEOPKK..',
    '..KsPPPPPSSPPPPPsK..',
    '...KSSSSSsSSSSSSK...',
    '...KSSSMMMMMMSSSK...',
    '...KsSSSSSSSSSSsK...',
    '....KsSSSSSSSSsK....',
    '.....KKsSSSSsKK.....',
    '......KKSSSSKK......',
    '..KKRRRGWWWWGRRRKK..',
    '.KRRRRRGGWWGGRRRRRK.',
    'KRRrRRRRGWWGRRRRrRRK',
    'KRRrRRRRRGGRRRRRrRRK',
    'KRrrRCRRRGGRRRCRrrRK',
    'KRrrRRRRRGGRRRRRrrRK',
    'KRrrRRRRRGGRRRRRrrRK'
  ],
  vale: [
    '.....KKKKKKKKKK.....',
    '....KHhHHhHHhHHK....',
    '...KHHhHHhHXXhHHK...',
    '...KHhHHhHHXHhHhK...',
    '...KHHSSSSSSSSHHK...',
    '...KHSSSSSSSSSSHK...',
    '...KSSBBSSSSBBSSK...',
    '...KSSSSSSSSSSSSK...',
    '..KKSOEOSSSSOEOSKK..',
    '..GKSSSSSSSSSSSSKG..',
    '..GKSSSSSsSSSSSSKG..',
    '...KSSSSSSSSSSSSK...',
    '...KsSSSSSSSSSSsK...',
    '....KsSSSSSSSSsK....',
    '.....KKsSSSSsKK.....',
    '......KKSSSSKK......',
    '..KKRRRRWWWWRRRRKK..',
    '.KRRRRRWWWWWWRRRRRK.',
    'KRRrRRRRWWWWRRRRrRRK',
    'KRRrRGGRRWWRRGGRrRRK',
    'KRrrRRRRRWWRRRRRrrRK',
    'KRrrRRRRRRRRRRRRrrRK',
    'KRrrRRRRRRRRRRRRrrRK'
  ],
  thorne: [
    '.....KKKKKKKKKK.....',
    '...KKWWwWWWWwWWKK...',
    '..KWWwWWWWWWWWwWWK..',
    '.KWwWWwWWWWWWwWWwWK.',
    '.KWWwKSSSSSSSSKwWWK.',
    'KWwWKSSSSSSSSSSKWwWK',
    'KWWwKSBBBSSBBBSKwWWK',
    'KwWWKSSSSSSSSSSKWWwK',
    'KWwWKSOEOSSOEOSKWwWK',
    'KWWwKSPPPSSPPPSKwWWK',
    'KwWWKCCSSsSSSCCKWWwK',
    'KWwWKSSSSSSSSSSKWwWK',
    'KWWwKSSSSSSSSSSKwWWK',
    'KwWWKKSSSSSSSSKKWWwK',
    'KWwWWKKSSSSSSKKWWwWK',
    '.KWWwWKKSSSSKKWwWWK.',
    '.KwWWRRRKWWKRRRWWwK.',
    'KRRRRRRRKWWKRRRRRRRK',
    'KRRrRGRRKWWKRRGRrRRK',
    'KRRrRGRRRKKRRRGRrRRK',
    'KRrrRGRRRRRRRRGRrrRK',
    'KRrrRGRRRRRRRRGRrrRK',
    'KRrrRGRRRRRRRRGRrrRK'
  ]
};
const palettes = {
  arata: {K, H: '#8d8883', h: '#5f5b57', S: '#e8c29a', s: '#c49871', B: '#4d4946', P: '#d1a24a', O: '#f5efe2', E: '#1b120d', M: '#4a4542', R: '#2b3c60', r: '#1b2742', G: '#d1a24a', W: '#efe8da', C: '#efe8da'},
  vale: {K, H: '#2a1d17', h: '#4d362b', X: '#dcd8cf', S: '#946141', s: '#6f4329', B: '#1f1612', O: '#f5efe2', E: '#1b120d', G: '#e0b85c', R: '#24604f', r: '#163f33', W: '#f2ece0'},
  thorne: {K, W: '#f1ebdf', w: '#c9bfae', S: '#f2c8a7', s: '#d6a07f', B: '#4a3123', O: '#f5efe2', E: '#2e4f60', P: '#d1a24a', C: '#e8907f', R: '#26232c', r: '#16141b', G: '#d1a24a'}
};
const mouths = {arata: {x: 8, y: 12, w: 4}, vale: {x: 8, y: 12, w: 4}, thorne: {x: 8, y: 12, w: 4}};
const lips = {arata: '#8a4a3a', vale: '#6f2f26', thorne: '#a24f47'};

function mouth(id) {
  const {x, y, w} = mouths[id], X = x * P, Y = y * P, lip = lips[id];
  return `<g class="j-mouth">
    <g class="m-rest"><rect x="${X}" y="${Y}" width="${w * P}" height="${P / 2}" fill="${K}"/></g>
    <g class="m-open"><rect x="${X}" y="${Y - P / 2}" width="${w * P}" height="${P * 1.5}" fill="${K}"/><rect x="${X + P}" y="${Y + P / 2}" width="${(w - 2) * P}" height="${P / 2}" fill="${lip}"/></g>
    <g class="m-smile"><rect x="${X - P}" y="${Y - P / 2}" width="${P}" height="${P / 2}" fill="${K}"/><rect x="${X}" y="${Y}" width="${w * P}" height="${P / 2}" fill="${K}"/><rect x="${X + w * P}" y="${Y - P / 2}" width="${P}" height="${P / 2}" fill="${K}"/></g>
    <g class="m-frown"><rect x="${X - P}" y="${Y + P / 2}" width="${P}" height="${P / 2}" fill="${K}"/><rect x="${X}" y="${Y}" width="${w * P}" height="${P / 2}" fill="${K}"/><rect x="${X + w * P}" y="${Y + P / 2}" width="${P}" height="${P / 2}" fill="${K}"/></g>
  </g>`;
}
function eyes(id) {
  const map = maps[id], pal = palettes[id];
  const whites = paint(map, pal, {only: 'O'}), pupils = paint(map, pal, {only: 'E'});
  // One lid per eye, covering its whites and pupil, in skin colour.
  const rows = cells(map, 'E').map(([x, y]) => `<rect class="j-lid" x="${(x - 1) * P}" y="${y * P}" width="${3 * P}" height="${P}" fill="${pal.S}"/>`).join('');
  return `${whites}<g class="j-pupil">${pupils}</g>${rows}`;
}

function chair(fill) {
  // Stepped pixel arch with gold trim and velvet back.
  const steps = [[3, 14, 0], [2, 16, 1], [1, 18, 2], [0, 20, 3]];
  const top = steps.map(([x, w, y]) => `<rect x="${x * P}" y="${y * P}" width="${w * P}" height="${P}" fill="#4d311f"/>`).join('');
  return `<g class="j-chair" transform="translate(${-2 * P} ${-4 * P})">${top}
    <rect x="0" y="${4 * P}" width="${24 * P}" height="${26 * P}" fill="#4d311f"/>
    <rect x="${P}" y="${P}" width="${22 * P}" height="${P}" fill="#d1a24a"/>
    <rect x="${2 * P}" y="${3 * P}" width="${20 * P}" height="${27 * P}" fill="${fill}"/>
    <rect x="${2 * P}" y="${3 * P}" width="${3 * P}" height="${27 * P}" fill="#000" opacity=".22"/>
    ${[[7, 7], [12, 6], [17, 7], [9, 12], [15, 12]].map(([x, y]) => `<rect x="${x * P}" y="${y * P}" width="${P}" height="${P}" fill="#000" opacity=".3"/>`).join('')}
    <rect x="${10 * P}" y="${-P}" width="${4 * P}" height="${2 * P}" fill="#d1a24a"/><rect x="${11 * P}" y="${-2 * P}" width="${2 * P}" height="${P}" fill="#d1a24a"/>
  </g>`;
}

// Props sit on the bench top (y≈440); positions are in the judge's local frame.
const props = {
  arata: () => `<g class="j-soroban" transform="translate(${11 * P} ${23 * P})">
      <rect x="0" y="0" width="${9 * P}" height="${3 * P}" fill="#2a1a10"/><rect x="0" y="${P}" width="${9 * P}" height="${P / 3}" fill="#d1a24a"/>
      ${[1, 2, 3, 4, 5, 6, 7].map(i => `<g class="j-bead ${i % 3 === 0 ? 'j-bead-a' : i % 3 === 1 ? 'j-bead-b' : ''}"><rect x="${i * P}" y="${P * .2}" width="${P * .7}" height="${P * .7}" fill="#b0452c"/></g><rect x="${i * P}" y="${P * 1.7}" width="${P * .7}" height="${P * .7}" fill="#b0452c"/>`).join('')}
    </g>
    <g class="j-hand-r"><rect x="${9 * P}" y="${23 * P}" width="${2 * P}" height="${2 * P}" fill="#e8c29a"/><rect x="${9 * P}" y="${23 * P}" width="${2 * P}" height="${P / 3}" fill="${K}"/></g>
    <rect x="${3 * P}" y="${23 * P}" width="${2 * P}" height="${2 * P}" fill="#e8c29a"/>`,
  vale: () => `<g class="j-watch" transform="translate(${2 * P} ${23 * P})"><rect x="0" y="0" width="${3 * P}" height="${3 * P}" fill="#e0b85c"/><rect x="${P / 2}" y="${P / 2}" width="${2 * P}" height="${2 * P}" fill="#f5efe2"/><rect class="j-second" x="${1.4 * P}" y="${P * .6}" width="${P / 4}" height="${P}" fill="#a3392d"/></g>
    <g class="j-block"><rect x="${14 * P}" y="${24 * P}" width="${5 * P}" height="${P}" fill="#6b4329"/><rect class="j-impact" x="${13 * P}" y="${23 * P}" width="${7 * P}" height="${3 * P}" fill="none" stroke="#f3d79e" stroke-width="${P / 2}"/></g>
    <g class="j-gavel-arm"><rect x="${15 * P}" y="${17 * P}" width="${P}" height="${6 * P}" fill="#5a3520"/><rect x="${13 * P}" y="${15 * P}" width="${5 * P}" height="${2 * P}" fill="#6b4329"/><rect x="${13 * P}" y="${15 * P}" width="${P}" height="${2 * P}" fill="#e0b85c"/><rect x="${17 * P}" y="${15 * P}" width="${P}" height="${2 * P}" fill="#e0b85c"/><rect x="${14 * P}" y="${21 * P}" width="${3 * P}" height="${2 * P}" fill="#946141"/></g>
    <rect x="${6 * P}" y="${23 * P}" width="${2 * P}" height="${2 * P}" fill="#946141"/>`,
  thorne: () => `<g class="j-scales" transform="translate(${2 * P} ${15 * P})">
      <rect x="${3 * P}" y="${P}" width="${P}" height="${7 * P}" fill="#d1a24a"/><rect x="${2 * P}" y="${8 * P}" width="${3 * P}" height="${P}" fill="#8f6c2c"/>
      <g class="j-beam"><rect x="0" y="${P}" width="${7 * P}" height="${P / 2}" fill="#d1a24a"/>
        <g class="j-pan-l"><rect x="0" y="${P * 1.5}" width="${P / 4}" height="${3 * P}" fill="#8f6c2c"/><rect x="${-P}" y="${4.5 * P}" width="${2.5 * P}" height="${P / 2}" fill="#d1a24a"/></g>
        <g class="j-pan-r"><rect x="${6.8 * P}" y="${P * 1.5}" width="${P / 4}" height="${3 * P}" fill="#8f6c2c"/><rect x="${5.8 * P}" y="${4.5 * P}" width="${2.5 * P}" height="${P / 2}" fill="#d1a24a"/></g></g></g>
    <g class="j-hand-r"><rect class="j-finger" x="${14 * P}" y="${20 * P}" width="${P}" height="${3 * P}" fill="#f2c8a7"/><rect x="${13 * P}" y="${22 * P}" width="${3 * P}" height="${2 * P}" fill="#f2c8a7"/></g>`
};

function judgeSprite(id) {
  const map = maps[id], pal = palettes[id];
  const head = map.slice(0, 16), torso = map.map((row, y) => y < 16 ? '' : row);
  const specs = id === 'vale' ? '' : `<g class="j-specs">${paint(head, pal, {only: 'P'})}</g>`;
  const blush = id === 'thorne' ? `<g class="j-blush">${paint(head, pal, {only: 'C'})}</g>` : '';
  return `<g class="j-torso">${paint(torso, pal)}
      <g class="j-head">${paint(head, pal, {skip: 'OEPBC'})}${blush}<g class="j-brows">${paint(head, pal, {only: 'B'})}</g>${eyes(id)}${specs}${mouth(id)}</g>
    </g><g class="j-hands">${props[id]()}</g>`;
}

function bench(perspectives) {
  const plaques = judges.map(judge => `<g transform="translate(${judge.x} 522)">
      <rect x="-118" y="-36" width="236" height="82" fill="#3a2418"/><rect x="-110" y="-28" width="220" height="66" fill="#5b3a25"/>
      <rect x="-90" y="-14" width="180" height="40" fill="#d1a24a"/><rect x="-90" y="-14" width="180" height="6" fill="#f2d48f"/><rect x="-90" y="20" width="180" height="6" fill="#8f6c2c"/>
      <text y="4" text-anchor="middle" class="bench-name">${judge.name.replace('Lord Justice', 'Lord J.')}</text>
      <text y="19" text-anchor="middle" class="bench-role">${(perspectives[judge.id] ?? judge.perspective).toUpperCase()}</text>
    </g>`).join('');
  return `<g class="j-bench">
    <rect x="40" y="430" width="1120" height="22" fill="#9a6b42"/><rect x="40" y="430" width="1120" height="6" fill="#c9905a"/><rect x="40" y="448" width="1120" height="4" fill="#5b3a25"/>
    <rect x="60" y="452" width="1080" height="148" fill="#6b4529"/><rect x="60" y="452" width="1080" height="10" fill="#3a2418"/>
    ${Array.from({length: 49}, (_, i) => `<rect x="${70 + i * 22}" y="466" width="12" height="10" fill="#8a5d38"/>`).join('')}
    ${plaques}
    ${[425, 775].map(x => `<rect x="${x - 18}" y="504" width="36" height="36" fill="#d1a24a"/><rect x="${x - 6}" y="510" width="12" height="24" fill="#8f6c2c"/>`).join('')}
    <rect x="60" y="588" width="1080" height="12" fill="#2a1a10"/>
  </g>`;
}

export function benchMarkup({perspectives = {}} = {}) {
  const motes = Array.from({length: 12}, (_, i) => `<rect class="mote" x="${170 + (i * 79) % 860}" y="${110 + (i * 43) % 300}" width="5" height="5"/>`).join('');
  return `<svg class="bench-svg pixel-bench" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax meet" shape-rendering="crispEdges" aria-hidden="false">
    ${judges.map(judge => {
      const left = judge.x - 10 * P, top = 440 - 23 * P;
      return `<g transform="translate(${left} ${top})">${chair(judge.id === 'arata' ? '#3a2233' : '#5c1f2b')}</g>
        <g transform="translate(${left} ${top})"><g class="judge" data-character="${judge.slot}" data-judge="${judge.id}" role="img" aria-label="${judge.name}, ${perspectives[judge.id] ?? judge.perspective}">${judgeSprite(judge.id)}</g></g>`;
    }).join('')}
    ${bench(perspectives)}
    <g class="motes" fill="#f6dcaa">${motes}</g>
  </svg>`;
}

// Render each vector chamber background into a small canvas and scale it up
// with crisp pixels, so the room shares the sprites' pixel scale.
export function pixelateBackgrounds(root = document, width = 300) {
  for (const img of root.querySelectorAll('img.scene-background, img.room-foreground')) {
    const draw = () => {
      const height = Math.round(width * (img.naturalHeight || 1000) / (img.naturalWidth || 1440));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.className = `${img.className} pixel-room`;
      canvas.setAttribute('aria-hidden', 'true');
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, width, height);
      img.replaceWith(canvas);
    };
    if (img.complete && img.naturalWidth) draw(); else img.addEventListener('load', draw, {once: true});
  }
}

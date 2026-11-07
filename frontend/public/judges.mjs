// The bench: three original judges drawn as one inline SVG so every part (lids,
// pupils, brows, mouths, hands, props) can be animated by CSS state classes.
// Characters are original Delegates designs in a hand-drawn period-courtroom
// style. They are not based on any existing game's characters.

export const judges = [
  {slot:'japan-inspired', id:'arata', name:'Justice Sōjirō Arata', perspective:'Cost', x:250,
    blurb:'Counts every hour twice. Keeps a brass soroban on the bench and smiles only when the numbers close.'},
  {slot:'woman', id:'vale', name:'Justice Imani Vale', perspective:'Feasibility', x:600,
    blurb:'Presides. Times every promise against her open pocket watch and strikes the gavel when a plan is real.'},
  {slot:'victorian-inspired', id:'thorne', name:'Lord Justice Barnaby Thorne', perspective:'Fairness', x:950,
    blurb:'Weighs both owners on his brass scales. Patient, warm and impossible to rush.'}
];

const INK = '#241812';
const line = (w = 2.2) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

// Almond eye: white, clipped iris/pupil (moves), blink lid, lash line, crease.
function eye(id, side, x, y, {w = 12, h = 6, iris = '#3a281d', skin, shade, slant = 0, lash = 2.6} = {}) {
  const shape = `M${-w} 0Q${-w * 0.2} ${-h * 1.35} ${w} ${-h * 0.1}Q${w * 0.15} ${h * 1.05} ${-w} 0Z`;
  const clip = `${id}-eye-${side}`;
  return `<g transform="translate(${x} ${y}) rotate(${slant})">
    <clipPath id="${clip}"><path d="${shape}"/></clipPath>
    <path d="${shape}" fill="#f3ebde"/>
    <g clip-path="url(#${clip})"><g class="j-pupil"><circle r="${h * 0.95}" fill="${iris}"/><circle r="${h * 0.95}" fill="none" stroke="#120c09" stroke-width="1.2" opacity=".6"/><circle r="${h * 0.45}" fill="#0f0a08"/><circle cx="${h * 0.32}" cy="${-h * 0.36}" r="${h * 0.24}" fill="#fff"/></g>
      <path d="M${-w} ${-h * 1.4}H${w}V${-h * 0.25}Q0 ${-h * 0.9} ${-w} ${-h * 0.25}Z" fill="${shade}" opacity=".35"/></g>
    <path class="j-lid" d="M${-w - 1.5} 0Q${-w * 0.2} ${-h * 1.55} ${w + 1.5} ${-h * 0.1}Q${w * 0.15} ${h * 1.25} ${-w - 1.5} 0Z" fill="${skin}"/>
    <path d="M${-w - 1} 0.5Q${-w * 0.2} ${-h * 1.4} ${w + 1} ${-h * 0.1}" fill="none" ${line(lash)}/>
    <path d="M${-w * 0.7} ${-h * 1.55}Q${w * 0.1} ${-h * 2.25} ${w * 0.85} ${-h * 1.1}" fill="none" stroke="${shade}" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M${-w * 0.6} ${h * 0.75}Q${w * 0.1} ${h * 1.2} ${w * 0.7} ${h * 0.55}" fill="none" stroke="${shade}" stroke-width="1" stroke-linecap="round" opacity=".7"/>
  </g>`;
}

// Mouth states are stacked; CSS shows exactly one.
function mouth(x, y, {w = 13, lip = '#9b5a4c', dark = '#4a1f1c', curve = 3} = {}) {
  return `<g class="j-mouth" transform="translate(${x} ${y})">
    <g class="m-rest"><path d="M${-w} -0.5Q0 ${curve} ${w} -0.5" fill="none" ${line(2)}/><path d="M${-w * 0.6} 4.5Q0 7.5 ${w * 0.6} 4.5" fill="none" stroke="${lip}" stroke-width="2" stroke-linecap="round" opacity=".55"/></g>
    <g class="m-open"><path d="M${-w * 0.85} -1Q0 -3 ${w * 0.85} -1Q${w * 0.55} 11 0 11Q${-w * 0.55} 11 ${-w * 0.85} -1Z" fill="${dark}" ${line(1.8)}/><path d="M${-w * 0.45} 7Q0 3.5 ${w * 0.45} 7Q0 10.5 ${-w * 0.45} 7Z" fill="#b8584e"/><path d="M${-w * 0.6} 0.2H${w * 0.6}" stroke="#f1e7da" stroke-width="2.2"/></g>
    <g class="m-smile"><path d="M${-w - 2} -3Q0 7 ${w + 2} -3.5" fill="none" ${line(2.1)}/><path d="M${-w - 3} -5.5q1.5 1 1 3M${w + 3} -6q-1.5 1 -1 3" fill="none" ${line(1.4)}/></g>
    <g class="m-frown"><path d="M${-w} 3Q0 -4 ${w} 3" fill="none" ${line(2.1)}/><path d="M${-w * 0.5} 7Q0 5.5 ${w * 0.5} 7" fill="none" stroke="${lip}" stroke-width="1.8" stroke-linecap="round" opacity=".5"/></g>
  </g>`;
}

function chair(fill = '#5e1f2a') {
  return `<g class="j-chair">
    <path d="M28 470V150Q28 90 76 72Q112 44 150 38Q188 44 224 72Q272 90 272 150V470Z" fill="#4a2f20" ${line(3)}/>
    <path d="M150 18c-13 0-21 9-21 19 0 6 4 10 9 12-8 4-25 4-31 0 5 19 24 27 43 27s38-8 43-27c-6 4-23 4-31 0 5-2 9-6 9-12 0-10-8-19-21-19Z" fill="#8a6038" ${line(2.2)}/>
    <path d="M150 26v20" stroke="#d8b07a" stroke-width="2" opacity=".5"/>
    <path d="M46 470V156Q48 108 86 94Q118 68 150 64Q182 68 214 94Q252 108 254 156V470Z" fill="${fill}" ${line(2)}/>
    <path d="M46 470V156Q48 108 86 94Q118 68 150 64V470Z" fill="#000" opacity=".18"/>
    <path d="M150 64Q182 68 214 94Q244 106 250 146" fill="none" stroke="#f0bf94" stroke-width="2.2" opacity=".22"/>
    ${[[100,118],[150,100],[200,118],[76,178],[125,166],[175,166],[224,178]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="#000" opacity=".35"/>`).join('')}
    <path d="M100 118 125 166 150 100 175 166 200 118M76 178 100 118M224 178 200 118" fill="none" stroke="#000" stroke-opacity=".16" stroke-width="1.6"/>
    <path d="M32 150Q34 94 78 76" fill="none" stroke="#b08452" stroke-width="3" opacity=".6"/>
  </g>`;
}
const neck = (skin, shade) => `<path d="M135 226v44q15 12 30 0v-44Z" fill="${skin}" ${line(2)}/><path d="M135 236q15 26 30 0v14q-15 16-30 0Z" fill="${shade}" opacity=".85"/>`;
const scaled = body => `<g transform="translate(150 196) scale(1.1) translate(-150 -196)">${body}</g>`;
const rim = d => `<path d="${d}" fill="none" stroke="#ffd9a3" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>`;

// ── Justice Sōjirō Arata · Cost ─────────────────────────────────────────────
function arata() {
  const skin = '#e3bc94', shade = '#bb8a64', deep = '#9d6f4e', hair = '#77726e', hairDark = '#4a4644', robe = '#22304b', robeShade = '#141c30', robeHi = '#3a4f78', gold = '#c9a25a';
  return `${chair('#3a2233')}
  <g class="j-torso">
    <path d="M48 470C44 384 54 318 96 298Q124 284 138 266H162Q176 284 204 298C246 318 256 384 252 470Z" fill="${robe}" ${line(2.6)}/>
    <path d="M48 470C44 384 54 318 96 298Q112 290 124 280L112 470Z" fill="${robeShade}"/>
    <path d="M200 302Q236 318 244 370M216 330q12 40 10 140M76 340q-8 50-6 130M92 330q8 60 4 140" fill="none" stroke="${robeShade}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M206 304Q234 320 240 352" fill="none" stroke="${robeHi}" stroke-width="3" stroke-linecap="round"/>
    <path d="M128 270 150 352 172 270Z" fill="#555a66" ${line(1.8)}/>
    <path d="M136 268 150 318 164 268Z" fill="#f1eadc" ${line(1.6)}/>
    <path d="M124 272 146 470M176 272 154 470" fill="none" stroke="${gold}" stroke-width="11"/>
    <path d="M124 272 146 470M176 272 154 470" fill="none" stroke="#7a5a2c" stroke-width="5" stroke-dasharray="1 5"/>
    <path d="M118 271 140 470M182 271 160 470M130 273 152 470M170 273 148 470" fill="none" ${line(1.3)}/>
    ${[[98, 352], [202, 352]].map(([x, y]) => `<g transform="translate(${x} ${y})"><circle r="11" fill="#f1eadc" ${line(1.4)}/><circle r="7.5" fill="none" stroke="${robe}" stroke-width="1.6"/>${[-4, 0, 4].map(dx => `<rect x="${dx - 1.6}" y="-3" width="3.2" height="6" rx="1.6" fill="${robe}"/>`).join('')}</g>`).join('')}
    ${neck(skin, shade)}
    <g class="j-head">${scaled(`
      <path d="M113 178c-9-6-15 2-13 13 2 11 8 18 15 18" fill="${skin}" ${line(2)}/><path d="M108 186q-3 7 2 14" fill="none" stroke="${deep}" stroke-width="1.6"/>
      <path d="M187 178c9-6 15 2 13 13-2 11-8 18-15 18" fill="${skin}" ${line(2)}/>
      <path d="M150 114C127 114 112 131 111 158c-1 17 1 34 4 49 3 17 11 33 22 43 4 4 9 6 13 6s9-2 13-6c11-10 19-26 22-43 3-15 5-32 4-49-1-27-16-44-39-44Z" fill="${skin}" ${line(2.4)}/>
      <path d="M113 168c-1 22 1 40 7 56 6 14 14 24 22 29-10-12-18-28-21-46-2-14-3-26-1-40Z" fill="${shade}"/>
      <path d="M118 200c3 14 9 26 17 34-3-10-6-20-7-32Z" fill="${deep}" opacity=".35"/>
      ${rim('M182 150c4 18 3 40-3 58')}
      <path d="M118 198l4-1M182 198l-4-1M116 191l5 1M184 191l-5 1" stroke="${deep}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M139 212q-6 10-4 24M161 212q6 10 4 24" fill="none" stroke="${deep}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M140 246q10 5 20 0" fill="none" stroke="${shade}" stroke-width="1.6"/>
      <g class="j-hair"><path d="M110 168c-4-38 14-64 42-64 28 0 46 22 40 62-2-12-6-22-12-28-10-8-20-10-30-10-12 0-22 4-30 10-5 8-8 18-10 30Z" fill="${hair}" ${line(2.4)}/>
        <path d="M122 120q22-12 50-6M116 136q30-16 64-6M128 112q14-6 28-4M168 112q16 6 22 22M114 150q8-14 22-18" fill="none" stroke="#b3ada7" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M140 108q20-4 36 6" fill="none" stroke="${hairDark}" stroke-width="1.6"/>
        <path d="M110 166q-2 10 1 22M190 166q2 10-1 22" fill="none" stroke="#b3ada7" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M192 128q22-6 23 9-1 13-17 11" fill="${hair}" ${line(2)}/><path d="M198 136h13" stroke="${gold}" stroke-width="3"/></g>
      <g class="j-brows"><path d="M119 170q11-7 24-3" fill="none" stroke="${hairDark}" stroke-width="4.4" stroke-linecap="round"/><path d="M157 167q13-4 24 3" fill="none" stroke="${hairDark}" stroke-width="4.4" stroke-linecap="round"/>
        <path d="M122 168l4-2M130 165l4-1M168 165l4 1M176 167l4 2" stroke="#b3ada7" stroke-width="1.2"/></g>
      ${eye('arata', 'l', 132, 186, {w: 10, h: 4.6, iris: '#3a2a1e', skin, shade, slant: -4, lash: 2.8})}
      ${eye('arata', 'r', 168, 186, {w: 10, h: 4.6, iris: '#3a2a1e', skin, shade, slant: 4, lash: 2.8})}
      <path d="M124 195q8 4 16 0M160 195q8 4 16 0" fill="none" stroke="${shade}" stroke-width="1.3"/>
      <g class="j-specs" fill="none"><circle cx="132" cy="187" r="13" stroke="#8f6c33" stroke-width="1.7"/><circle cx="168" cy="187" r="13" stroke="#8f6c33" stroke-width="1.7"/><path d="M145 185q5-4 10 0M119 183l-8-3M181 183l8-3" stroke="#8f6c33" stroke-width="1.7"/>
        <path d="M124 179l5-4M160 179l5-4" stroke="#fff" stroke-width="1.6" opacity=".75"/></g>
      <path d="M147 190q-2 12-4 21" fill="none" stroke="${shade}" stroke-width="3" stroke-linecap="round" opacity=".7"/>
      <path d="M143 210q-1 6 5 7 5 1 9-2 2-3 0-6" fill="none" ${line(2)}/><path d="M144 213q2 2 4 2" fill="none" stroke="${deep}" stroke-width="1.4"/>
      <path d="M137 222q13-6 26 0-6 5-13 3-7 2-13-3Z" fill="${hairDark}" ${line(1.4)}/>
      ${mouth(150, 232, {w: 10, lip: '#a0614c'})}
    `)}</g>
  </g>
  <g class="j-hands">
    <g class="j-sleeve-l"><path d="M46 470q-2-56 24-80 34-10 60 12 10 30 2 68Z" fill="${robe}" ${line(2.4)}/><path d="M60 470q2-42 22-64" fill="none" stroke="${robeShade}" stroke-width="3"/><path d="M98 392q22 2 32 12" fill="none" stroke="${robeHi}" stroke-width="2.4"/>
      <path d="M104 428c8-8 26-9 36-2 7 6 6 15-2 19-12 5-28 3-34-3-3-4-3-10 0-14Z" fill="${skin}" ${line(2)}/><path d="M116 428q2 7 1 15M126 427q2 7 1 16M135 428q1 6 0 13" fill="none" stroke="${shade}" stroke-width="1.4"/></g>
    <g class="j-soroban" transform="translate(150 424)">
      <path d="M-2 0h108l-6 34H4Z" fill="#2c1b13" ${line(2)}/>
      <path d="M3 4h98v4H3ZM4 14h96v3H4ZM6 28h92v3H6Z" fill="${gold}" ${line(1)}/>
      ${[12, 24, 36, 48, 60, 72, 84, 96].map((x, i) => `<path d="M${x} 4v26" stroke="${gold}" stroke-width="1.2"/><g class="j-bead ${i % 3 === 0 ? 'j-bead-a' : i % 3 === 1 ? 'j-bead-b' : ''}"><rect x="${x - 4.5}" y="${i % 2 ? 8 : 9.5}" width="9" height="5" rx="2.5" fill="#7b3a26" ${line(0.9)}/></g><rect x="${x - 4.5}" y="${18 + (i % 3)}" width="9" height="5" rx="2.5" fill="#9a4a2e" ${line(0.9)}/>`).join('')}
      <path d="M4 3h96" stroke="#fff" stroke-width="1" opacity=".35"/>
    </g>
    <g class="j-hand-r"><path d="M254 470q2-56-24-80-34-8-58 14-8 30 2 66Z" fill="${robe}" ${line(2.4)}/><path d="M240 470q-2-42-20-64" fill="none" stroke="${robeShade}" stroke-width="3"/>
      <path d="M190 424c-10-6-26-4-32 6l-6 6c3 5 11 6 16 3 8 5 20 3 26-4 3-5 1-9-4-11Z" fill="${skin}" ${line(2)}/><path d="M152 436q-6-6-12-1" fill="none" ${line(1.8)}/><path d="M170 428q4 5 2 10M180 427q3 5 2 10" fill="none" stroke="${shade}" stroke-width="1.4"/></g>
  </g>`;
}

// ── Justice Imani Vale · Feasibility (presiding) ────────────────────────────
function vale() {
  const skin = '#8d5b3d', shade = '#6a3f28', deep = '#4f2c1b', hi = '#b47c55', hair = '#1c1411', robe = '#1e4c3f', robeShade = '#113026', robeHi = '#33705c', gold = '#d1ab5f';
  const braid = Array.from({length: 14}, (_, i) => {
    const a = Math.PI * (1.04 + i * 0.066), x = 150 + Math.cos(a) * 47, y = 152 + Math.sin(a) * 44;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(a * 180 / Math.PI + 90).toFixed(0)})"><ellipse rx="9.5" ry="6.5" fill="${i === 9 ? '#d4cfc6' : '#2a1e19'}" ${line(1.6)}/><path d="M-6-2q6-4 10 1" fill="none" stroke="${i === 9 ? '#fff' : '#5a463b'}" stroke-width="1.4" stroke-linecap="round"/></g>`;
  }).join('');
  return `${chair('#5c1f2b')}
  <g class="j-torso">
    <path d="M46 470C42 382 52 316 96 296Q124 282 138 264H162Q176 282 204 296C248 316 258 382 254 470Z" fill="${robe}" ${line(2.6)}/>
    <path d="M46 470C42 382 52 316 96 296Q112 288 124 278L112 470Z" fill="${robeShade}"/>
    <path d="M90 300Q150 356 210 300L218 334Q150 392 82 334Z" fill="#163a30" ${line(2)}/>
    <path d="M94 312Q150 362 206 312" fill="none" stroke="${gold}" stroke-width="2.4"/>
    <path d="M206 304Q236 322 242 356" fill="none" stroke="${robeHi}" stroke-width="3" stroke-linecap="round"/>
    ${[104, 120, 136, 164, 180, 196].map(x => `<path d="M${x} ${372 - Math.abs(150 - x) * 0.5}Q${x + (x < 150 ? -4 : 4)} 420 ${x} 470" fill="none" stroke="${robeShade}" stroke-width="2.4"/>`).join('')}
    <g class="j-jabot"><path d="M134 264q-16 22-8 44 8 20 24 32 16-12 24-32 8-22-8-44Z" fill="#f2ece0" ${line(1.8)}/>
      <path d="M128 286q6 4 11 0 6 4 11 0 6 4 11 0 6 4 11 0M126 304q7 5 12 0 6 5 12 0 6 5 12 0 6 5 12 0M134 322q4 4 8 0 4 4 8 0 4 4 8 0 4 4 8 0" fill="none" stroke="#b9ad9a" stroke-width="1.4"/><circle cx="150" cy="272" r="5" fill="${gold}" ${line(1.2)}/></g>
    ${neck(skin, shade)}
    <g class="j-head">${scaled(`
      <path d="M150 112C125 112 110 130 109 158c-1 20 2 36 7 50 5 16 13 28 23 36 5 4 8 6 11 6s6-2 11-6c10-8 18-20 23-36 5-14 8-30 7-50-1-28-16-46-41-46Z" fill="${skin}" ${line(2.4)}/>
      <path d="M112 170c-1 22 3 42 10 56 6 12 13 21 21 26-9-12-16-26-20-42-3-14-4-26-2-40Z" fill="${shade}"/>
      <path d="M120 204q6 14 16 22" fill="none" stroke="${deep}" stroke-width="3" opacity=".45" stroke-linecap="round"/>
      <ellipse cx="176" cy="204" rx="8" ry="5" fill="${hi}" opacity=".45"/>
      ${rim('M184 150c4 20 2 42-5 60')}
      <g class="j-earrings"><path d="M108 198v8M192 198v8" ${line(1.4)}/><path d="M108 206l-4 8 4 6 4-6Z" fill="${gold}" ${line(1.2)}/><path d="M192 206l-4 8 4 6 4-6Z" fill="${gold}" ${line(1.2)}/></g>
      <g class="j-hair"><path d="M106 176c-8-50 12-80 44-80s52 30 44 80c-2-16-6-30-14-38-8-6-18-8-30-8s-22 2-30 8c-8 8-12 22-14 38Z" fill="${hair}" ${line(2.4)}/>
        <path d="M118 140q14-12 32-12M156 128q18 2 28 16M112 160q2-12 10-20" fill="none" stroke="#5a463b" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M168 128q16 8 20 28" fill="none" stroke="#d6d0c8" stroke-width="3.6" stroke-linecap="round"/>
        ${braid}</g>
      <g class="j-brows"><path d="M117 164q13-9 26-4" fill="none" stroke="${hair}" stroke-width="3.6" stroke-linecap="round"/><path class="j-brow-arch" d="M157 160q13-6 26 4" fill="none" stroke="${hair}" stroke-width="3.6" stroke-linecap="round"/></g>
      ${eye('vale', 'l', 131, 182, {w: 11, h: 5.6, iris: '#3c2617', skin, shade, slant: -4, lash: 3.4})}
      ${eye('vale', 'r', 169, 182, {w: 11, h: 5.6, iris: '#3c2617', skin, shade, slant: 4, lash: 3.4})}
      <path d="M119 180l-4-3M181 180l4-3" ${line(2)}/>
      <path d="M147 188q-1 12-3 19" fill="none" stroke="${shade}" stroke-width="3" stroke-linecap="round" opacity=".8"/>
      <path d="M142 207q-2 6 3 7 3 2 5 0 2 2 5 0 5-1 3-7" fill="none" ${line(2)}/><path d="M146 214q4 2 8 0" fill="none" stroke="${deep}" stroke-width="1.4"/>
      
      ${mouth(150, 230, {w: 11, lip: '#86443a', dark: '#3b1714', curve: 5})}
      <path d="M137 226q-2 2-1 5M163 226q2 2 1 5" fill="none" stroke="${deep}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M142 244q8 3 16 0" fill="none" stroke="${shade}" stroke-width="1.6"/>
    `)}</g>
  </g>
  <g class="j-hands">
    <g class="j-watch" transform="translate(94 434)">
      <path d="M20-8q10-24 32-30" fill="none" stroke="${gold}" stroke-width="1.6" stroke-dasharray="2 2"/>
      <circle r="21" fill="${gold}" ${line(2)}/><circle r="16.5" fill="#f4ecdc" ${line(1.2)}/>
      ${Array.from({length: 12}, (_, i) => `<path d="M0-14v3" transform="rotate(${i * 30})" stroke="${INK}" stroke-width="${i % 3 ? 0.8 : 1.6}"/>`).join('')}
      <path d="M0 0V-9" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" transform="rotate(-40)"/><path d="M0 0V-12" stroke="${INK}" stroke-width="1.3" stroke-linecap="round" transform="rotate(64)"/>
      <path class="j-second" d="M0 3V-13" stroke="#a3392d" stroke-width=".9"/><circle r="1.6" fill="${INK}"/>
      <path d="M-10-13q6-5 14-4" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>
    </g>
    <g class="j-sleeve-l"><path d="M44 470q-4-56 22-80 34-8 58 14 6 30-2 66Z" fill="${robe}" ${line(2.4)}/><path d="M58 470q2-42 22-64" fill="none" stroke="${robeShade}" stroke-width="3"/>
      <path d="M72 396q26-6 52 10" fill="none" stroke="#f1ebdf" stroke-width="6"/><path d="M72 396q26-6 52 10" fill="none" stroke="#b9ad9a" stroke-width="1.2" stroke-dasharray="3 3"/>
      <path d="M108 418c8-6 22-6 28 2 5 7 2 15-6 18-10 3-22 0-26-6-2-5 0-10 4-14Z" fill="${skin}" ${line(2)}/><path d="M118 418q2 7 0 14M127 418q2 7 0 15" fill="none" stroke="${shade}" stroke-width="1.4"/></g>
    <g class="j-block" transform="translate(206 440)"><ellipse cx="0" cy="8" rx="26" ry="8" fill="#3a2418" ${line(1.8)}/><ellipse cx="0" cy="3" rx="26" ry="8" fill="#6b4329" ${line(1.8)}/><path d="M-18 1q18-6 36 0" fill="none" stroke="#a87a50" stroke-width="2" opacity=".6"/><ellipse class="j-impact" cx="0" cy="2" rx="30" ry="10" fill="none" stroke="#f3d79e" stroke-width="3"/></g>
    <g class="j-gavel-arm">
      <path d="M256 470q4-60-22-86-34-4-52 18-4 32 6 68Z" fill="${robe}" ${line(2.4)}/><path d="M242 470q-2-42-20-64" fill="none" stroke="${robeShade}" stroke-width="3"/>
      <path d="M172 402q26-10 58 4" fill="none" stroke="#f1ebdf" stroke-width="6"/><path d="M172 402q26-10 58 4" fill="none" stroke="#b9ad9a" stroke-width="1.2" stroke-dasharray="3 3"/>
      <g class="j-gavel"><path d="M196 414 216 360" stroke="#5a3520" stroke-width="7" stroke-linecap="round"/><path d="M198 410 216 362" stroke="#8a5a36" stroke-width="2" stroke-linecap="round"/>
        <g transform="rotate(20 216 352)"><rect x="198" y="340" width="38" height="21" rx="5" fill="#6b4329" ${line(2)}/><rect x="194" y="342" width="6" height="17" rx="2" fill="${gold}" ${line(1.2)}/><rect x="234" y="342" width="6" height="17" rx="2" fill="${gold}" ${line(1.2)}/><path d="M204 345h24" stroke="#a87a50" stroke-width="2"/></g></g>
      <path d="M180 402c-9 5-11 15-6 22 7 7 22 7 28 0 5-6 3-16-4-21-6-4-13-4-18-1Z" fill="${skin}" ${line(2)}/><path d="M180 411q9-3 18 0M180 418q9-3 18 0" fill="none" stroke="${shade}" stroke-width="1.4"/>
    </g>
  </g>`;
}

// ── Lord Justice Barnaby Thorne · Fairness ──────────────────────────────────
function thorne() {
  const skin = '#efc5a4', shade = '#d09a7a', deep = '#a8735a', wig = '#efe9de', wigShade = '#c4b9a6', gown = '#1d1a1f', gownShade = '#0c0a0e', gownHi = '#3d3844', gold = '#c9a25a';
  const curls = side => {
    const out = [];
    for (let row = 0; row < 6; row++) for (let col = 0; col < 2; col++) {
      const x = side * (56 + col * 17 + row * 3), y = 156 + row * 24 + col * 11;
      out.push(`<g transform="translate(${150 + x} ${y})"><ellipse rx="14" ry="12.5" fill="${col ? wigShade : wig}" ${line(1.8)}/><path d="M${-side * 7} 4q${side * 2} -12 ${side * 10} -6q${side * 4} 7 -4 8" fill="none" stroke="${col ? '#9f937f' : wigShade}" stroke-width="1.8" stroke-linecap="round"/></g>`);
    }
    return out.join('');
  };
  return `${chair('#5c1f2b')}
  <g class="j-torso">
    <g class="j-wig-back">${curls(-1)}${curls(1)}</g>
    <path d="M44 470C40 384 52 318 96 298Q124 284 136 268H164Q176 284 204 298C248 318 260 384 256 470Z" fill="${gown}" ${line(2.6)}/>
    <path d="M44 470C40 384 52 318 96 298Q112 290 122 282L110 470Z" fill="${gownShade}"/>
    <path d="M200 304Q238 322 246 372" fill="none" stroke="${gownHi}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M214 340q14 50 12 130M86 340q-12 50-10 130" fill="none" stroke="${gownShade}" stroke-width="2.4"/>
    <path d="M110 300 134 470M190 300 166 470" fill="none" stroke="${gold}" stroke-width="6"/><path d="M110 300 134 470M190 300 166 470" fill="none" stroke="#7a5a2c" stroke-width="2" stroke-dasharray="2 4"/>
    <path d="M128 276Q150 290 172 276L176 300Q150 314 124 300Z" fill="#f7f2e8" ${line(1.6)}/>
    <g class="j-bands"><path d="M139 300l-3 48 13 2 1-46ZM161 300l3 48-13 2-1-46Z" fill="#f7f2e8" ${line(1.6)}/><path d="M142 310v34M158 310v34" stroke="#d8d0c2" stroke-width="1.2"/></g>
    ${neck(skin, shade)}
    <g class="j-head">${scaled(`
      <path d="M150 112C122 112 106 134 105 164c-1 22 3 42 11 58 6 14 14 26 26 32 4 2 6 3 8 3s4-1 8-3c12-6 20-18 26-32 8-16 12-36 11-58-1-30-17-52-45-52Z" fill="${skin}" ${line(2.4)}/>
      <path d="M126 242q24 22 48 0-4 16-24 20-20-4-24-20Z" fill="${skin}" ${line(2)}/><path d="M130 250q20 14 40 0" fill="none" stroke="${shade}" stroke-width="1.6"/>
      <path d="M108 172c-1 24 4 44 12 58 6 12 14 20 22 25-10-12-17-26-21-42-3-14-4-28-2-41Z" fill="${shade}"/>
      ${rim('M188 156c4 22 2 44-6 62')}
      <ellipse class="j-blush" cx="123" cy="214" rx="12" ry="7" fill="#e2877a" opacity=".5"/><ellipse class="j-blush" cx="177" cy="214" rx="12" ry="7" fill="#e2877a" opacity=".5"/>
      <path d="M116 200q-2 5 2 10M184 200q2 5-2 10" fill="none" stroke="${deep}" stroke-width="1.3" stroke-linecap="round"/>
      <g class="j-wig"><path d="M98 172c-8-50 14-78 52-78s60 28 52 78q-6-30-16-38-36 6-72 0-10 8-16 38Z" fill="${wig}" ${line(2.4)}/>
        ${[[112,122],[131,110],[150,106],[169,110],[188,122],[120,140],[140,134],[160,134],[180,140]].map(([x, y]) => `<path d="M${x - 9} ${y + 3}q9-11 18 0" fill="none" stroke="${wigShade}" stroke-width="2.2" stroke-linecap="round"/>`).join('')}
        <path d="M100 162q-10 22-3 44M200 162q10 22 3 44" fill="none" ${line(1.6)}/><path d="M150 96q30 2 44 30" fill="none" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/></g>
      <g class="j-brows"><path d="M115 168q14-11 29-3" fill="none" stroke="#4a3123" stroke-width="6" stroke-linecap="round"/><path d="M156 165q15-8 29 3" fill="none" stroke="#4a3123" stroke-width="6" stroke-linecap="round"/>
        <path d="M118 166l-3-4M126 162l-1-4M174 162l1-4M182 166l3-4" stroke="#4a3123" stroke-width="1.6" stroke-linecap="round"/></g>
      ${eye('thorne', 'l', 131, 184, {w: 10, h: 5, iris: '#4a6a7a', skin, shade, slant: -2, lash: 2.6})}
      ${eye('thorne', 'r', 169, 184, {w: 10, h: 5, iris: '#4a6a7a', skin, shade, slant: 2, lash: 2.6})}
      <path d="M118 188q-4 2-5 5M182 188q4 2 5 5M120 192q-3 3-3 6M180 192q3 3 3 6" fill="none" stroke="${deep}" stroke-width="1.2" stroke-linecap="round"/>
      <g class="j-specs"><path d="M118 194q12-6 26 0v4q-13 7-26 0ZM156 194q13-6 26 0v4q-13 7-26 0Z" fill="#fff" fill-opacity=".16" stroke="#8f6c33" stroke-width="1.8"/><path d="M144 195q6-3 12 0" fill="none" stroke="#8f6c33" stroke-width="1.6"/>
        <path d="M118 196q-26 30-16 96" fill="none" stroke="#2a2a2a" stroke-width="1" opacity=".55"/></g>
      <path d="M147 192q-3 10-5 16" fill="none" stroke="${shade}" stroke-width="3.4" stroke-linecap="round" opacity=".7"/>
      <path d="M140 210c-4 6 0 12 7 11 3 3 8 3 11 0 7 1 9-6 5-11" fill="${'#eba98f'}" ${line(2)}/><path d="M152 206q6 1 7 6" fill="none" stroke="#fff" stroke-width="1.6" opacity=".6"/>
      <path d="M131 226q-4 8 0 16M169 226q4 8 0 16" fill="none" stroke="${deep}" stroke-width="1.5" stroke-linecap="round"/>
      ${mouth(150, 234, {w: 13, lip: '#b0635a', curve: 6})}
    `)}</g>
  </g>
  <g class="j-hands">
    <g class="j-scales" transform="translate(70 352)">
      <path d="M28 82h44l-6-9H34Z" fill="#8f6c33" ${line(1.8)}/><path d="M50 73V16" ${line(4.5)}/><path d="M50 73V16" stroke="${gold}" stroke-width="3"/><circle cx="50" cy="11" r="5" fill="${gold}" ${line(1.6)}/>
      <g class="j-beam"><path d="M12 16h76" ${line(5)}/><path d="M12 16h76" stroke="${gold}" stroke-width="3"/>
        <g class="j-pan-l"><path d="M12 16 2 50M12 16l10 34" stroke="#8f6c33" stroke-width="1.2"/><path d="M-2 50h28q-2 9-14 9T-2 50Z" fill="${gold}" ${line(1.6)}/></g>
        <g class="j-pan-r"><path d="M88 16 78 50M88 16l10 34" stroke="#8f6c33" stroke-width="1.2"/><path d="M74 50h28q-2 9-14 9t-14-9Z" fill="${gold}" ${line(1.6)}/></g></g>
    </g>
    <g class="j-sleeve-l"><path d="M42 470q-2-44 20-64 34-4 56 20 4 24-2 44Z" fill="${gown}" ${line(2.4)}/><path d="M66 406q24 0 44 16" fill="none" stroke="${gownHi}" stroke-width="2.4"/>
      <path d="M100 430c8-6 24-7 32-1 6 5 5 13-2 16-10 4-26 2-31-3-3-4-2-9 1-12Z" fill="${skin}" ${line(2)}/></g>
    <g class="j-hand-r"><path d="M258 470q2-56-24-82-34-4-54 18-4 32 6 64Z" fill="${gown}" ${line(2.4)}/><path d="M244 470q-2-42-20-64" fill="none" stroke="${gownShade}" stroke-width="3"/>
      <path class="j-finger" d="M164 420c-4-10-4-22 0-30 4-3 9-1 9 4l-1 26" fill="${skin}" ${line(1.8)}/>
      <path d="M180 414c-14-1-22 7-23 15 3 9 15 12 26 9 10-3 15-10 12-17-3-5-9-7-15-7Z" fill="${skin}" ${line(2)}/><path d="M164 424q10-2 18 2M164 431q10-2 18 2" fill="none" stroke="${shade}" stroke-width="1.4"/></g>
  </g>`;
}

const draw = {arata, vale, thorne};

// ── Rendering layer ─────────────────────────────────────────────────────────
// Every major inked shape gets volume from its own geometry: a key light from
// the upper right, a falloff to the left, and occlusion at its base. Cloth gets
// a woven texture; brass gets a brushed metallic ramp with a specular band.
const FABRIC = new Set(['#22304b', '#1e4c3f', '#1d1a1f', '#141c30', '#113026', '#0c0a0e']);
const SKIN = new Set(['#e3bc94', '#8d5b3d', '#efc5a4']);
const HAIR = new Set(['#77726e', '#1c1411', '#efe9de', '#ece5d8']);
function render(markup) {
  return markup
    .replace(/fill="#c9a25a"|fill="#d1ab5f"/g, 'fill="url(#metal)"')
    .replace(/<path d="([^"]+)" fill="(#[0-9a-f]{6})" stroke="#241812" stroke-width="(2\.4|2\.6|2)"([^>]*)\/>/g, (whole, d, fill) => {
      if (FABRIC.has(fill)) return `${whole}<path d="${d}" fill="url(#weave)"/><path d="${d}" fill="url(#vol-shade)"/><path d="${d}" fill="url(#vol-lit)" class="vol-lit"/><path d="${d}" fill="url(#vol-ao)"/>`;
      if (SKIN.has(fill)) return `${whole}<path d="${d}" fill="url(#skin-lit)" class="vol-lit"/><path d="${d}" fill="url(#vol-ao)" opacity=".7"/>`;
      if (HAIR.has(fill)) return `${whole}<path d="${d}" fill="url(#hair-sheen)"/><path d="${d}" fill="url(#vol-shade)" opacity=".7"/>`;
      return whole;
    });
}

function bench(perspectives) {
  const plaques = judges.map(judge => `<g transform="translate(${judge.x} 520)">
      <rect x="-132" y="-44" width="264" height="104" rx="4" fill="#3f2a1d" ${line(2)}/>
      <rect x="-120" y="-34" width="240" height="84" rx="3" fill="url(#bench-panel)" ${line(1.6)}/>
      <rect x="-120" y="-34" width="240" height="84" rx="3" fill="url(#grain)" opacity=".55"/>
      <path d="M-120 -34h240M-120 -34v84" stroke="#e0b07a" stroke-width="1.4" opacity=".45"/><path d="M120 -34v84H-120" stroke="#1b110b" stroke-width="2" opacity=".6"/>
      <rect x="-96" y="-10" width="192" height="48" rx="3" fill="#000" opacity=".22"/>
      <rect class="bench-plaque" x="-92" y="-14" width="184" height="44" rx="2" fill="url(#metal)" ${line(1.6)}/>
      <rect x="-92" y="-14" width="184" height="44" rx="2" fill="url(#brushed)" opacity=".5"/>
      <rect x="-86" y="-8" width="172" height="32" fill="none" stroke="#7a5a2c" stroke-width="1"/>
      <rect class="plaque-shine" x="-92" y="-14" width="40" height="44" fill="url(#shine)"/>
      <text y="6" text-anchor="middle" class="bench-name">${judge.name.replace('Lord Justice', 'Lord J.')}</text>
      <text y="22" text-anchor="middle" class="bench-role">${(perspectives[judge.id] ?? judge.perspective).toUpperCase()}</text>
    </g>`).join('');
  // Soft contact shadows where hands and instruments meet the bench top.
  const contact = judges.flatMap(judge => [judge.x - 25, judge.x + 45, judge.x + 95].map(x => `<ellipse cx="${x}" cy="452" rx="44" ry="6" fill="url(#contact)"/>`)).join('');
  return `<g class="j-bench">
    <path d="M60 452H1140V600H60Z" fill="url(#bench-wood)" ${line(3)}/>
    <path d="M60 452H1140V600H60Z" fill="url(#grain)" opacity=".7"/>
    <path d="M60 452H1140V600H60Z" fill="url(#bench-ao)"/>
    <path d="M40 436H1160L1150 456H50Z" fill="#8f633f" ${line(2.6)}/>
    <path d="M40 436H1160L1150 456H50Z" fill="url(#grain)" opacity=".6"/>
    <path d="M44 437H1156" stroke="#f3c890" stroke-width="2" opacity=".7"/>
    ${contact}
    <path d="M60 462H1140" stroke="#2a1a12" stroke-width="5" opacity=".5"/>
    ${Array.from({length: 54}, (_, i) => `<rect x="${66 + i * 20.3}" y="458" width="11" height="9" fill="#6e4a30" ${line(1)}/><path d="M${66 + i * 20.3} 458.5h11" stroke="#c89a62" stroke-width=".8" opacity=".6"/>`).join('')}
    ${plaques}
    <g transform="translate(425 532)"><circle r="22" fill="url(#metal)" ${line(1.8)}/><circle r="22" fill="url(#brushed)" opacity=".5"/><path d="M0-12V12M-12 0H12" stroke="#7a5a2c" stroke-width="2"/></g>
    <g transform="translate(775 532)"><circle r="22" fill="url(#metal)" ${line(1.8)}/><circle r="22" fill="url(#brushed)" opacity=".5"/><path d="M-10-10 10 10M10-10-10 10" stroke="#7a5a2c" stroke-width="2"/></g>
  </g>`;
}

const defs = `<defs>
  <linearGradient id="bench-wood" x2="0" y2="1"><stop stop-color="#7a5134"/><stop offset=".35" stop-color="#5a3a26"/><stop offset="1" stop-color="#2f1f16"/></linearGradient>
  <linearGradient id="bench-panel" x2="0" y2="1"><stop stop-color="#62402a"/><stop offset="1" stop-color="#3a2619"/></linearGradient>
  <linearGradient id="bench-ao" x2="0" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
  <linearGradient id="metal" x1="0" y1="0" x2=".35" y2="1"><stop stop-color="#fff1c8"/><stop offset=".18" stop-color="#e3c27f"/><stop offset=".45" stop-color="#b98f45"/><stop offset=".62" stop-color="#f2d798"/><stop offset=".8" stop-color="#8f6a30"/><stop offset="1" stop-color="#5e4219"/></linearGradient>
  <linearGradient id="shine" x2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <radialGradient id="vol-lit" cx=".78" cy=".18" r=".75"><stop stop-color="#ffe3b5" stop-opacity=".34"/><stop offset=".55" stop-color="#ffe3b5" stop-opacity=".06"/><stop offset="1" stop-color="#ffe3b5" stop-opacity="0"/></radialGradient>
  <radialGradient id="skin-lit" cx=".7" cy=".3" r=".65"><stop stop-color="#fff2dc" stop-opacity=".42"/><stop offset=".6" stop-color="#ffd7a8" stop-opacity=".08"/><stop offset="1" stop-color="#ffd7a8" stop-opacity="0"/></radialGradient>
  <linearGradient id="vol-shade" x2="1"><stop stop-color="#000" stop-opacity=".45"/><stop offset=".5" stop-color="#000" stop-opacity="0"/></linearGradient>
  <linearGradient id="vol-ao" x2="0" y2="1"><stop offset=".6" stop-color="#1a0c06" stop-opacity="0"/><stop offset="1" stop-color="#1a0c06" stop-opacity=".4"/></linearGradient>
  <linearGradient id="hair-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset=".25" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#fff" stop-opacity=".12"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <pattern id="weave" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><path d="M0 1h4M0 3h4" stroke="#fff" stroke-opacity=".05"/><path d="M1 0v4" stroke="#000" stroke-opacity=".12"/></pattern>
  <pattern id="velvet" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#000" opacity=".22"/><circle cx="2.4" cy="2.2" r=".5" fill="#fff" opacity=".05"/></pattern>
  <pattern id="grain" width="240" height="24" patternUnits="userSpaceOnUse"><path d="M0 4q60 -3 120 1t120 -1M0 11q50 3 110 0t130 1M0 18q70 -2 130 1t110 -1M30 7q20 -2 40 0M150 15q24 2 50 0" fill="none" stroke="#1b0f08" stroke-opacity=".35" stroke-width=".8"/><path d="M0 8q80 2 160 -1t80 1" fill="none" stroke="#f0c48c" stroke-opacity=".12"/></pattern>
  <pattern id="brushed" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M0 .5h2" stroke="#fff" stroke-opacity=".25" stroke-width=".4"/></pattern>
  <radialGradient id="bench-glow" cx=".5" cy=".2" r=".6"><stop stop-color="#f6d9a2" stop-opacity=".35"/><stop offset="1" stop-color="#f6d9a2" stop-opacity="0"/></radialGradient>
  <radialGradient id="candle" cx=".5" cy=".5" r=".5"><stop stop-color="#ffcf87" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf87" stop-opacity="0"/></radialGradient>
  <linearGradient id="ray" x2="0" y2="1"><stop stop-color="#ffe7bd" stop-opacity=".22"/><stop offset="1" stop-color="#ffe7bd" stop-opacity="0"/></linearGradient>
  <radialGradient id="contact"><stop stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <radialGradient id="castshadow"><stop stop-color="#000" stop-opacity=".5"/><stop offset=".7" stop-color="#000" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="haze" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
</defs>`;

// Judge chairs get velvet nap and the sitter's soft cast shadow.
const staging = judge => `<g transform="translate(${judge.x - 150} 0)" aria-hidden="true">
  <path d="M48 470V156Q50 108 86 94Q118 68 150 64Q182 68 214 94Q250 108 252 156V470Z" fill="url(#velvet)"/>
  <ellipse cx="128" cy="300" rx="110" ry="170" fill="url(#castshadow)"/>
</g>`;

export function benchMarkup({perspectives = {}} = {}) {
  const motes = Array.from({length: 18}, (_, i) => `<circle class="mote" cx="${160 + (i * 67) % 880}" cy="${110 + (i * 41) % 310}" r="${0.8 + (i % 3) * 0.7}"/>`).join('');
  const rays = [[700, 980, 760, 420], [860, 1010, 900, 640], [560, 640, 470, 330]];
  return `<svg class="bench-svg" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax meet" aria-hidden="false">
    ${defs}
    <g class="rays">${rays.map(([a, b, c, d]) => `<path class="ray" d="M${a} 0H${b}L${c} 600H${d}Z" fill="url(#ray)"/>`).join('')}</g>
    <ellipse class="bench-glow" cx="600" cy="230" rx="560" ry="260" fill="url(#bench-glow)"/>
    ${judges.map(judge => {
      const art = render(draw[judge.id]());
      const split = art.indexOf('</g>') + 4; // the chair group is drawn first
      return `<g transform="translate(${judge.x - 150} 0)">${art.slice(0, split)}</g>${staging(judge)}<g transform="translate(${judge.x - 150} 0)"><g class="judge" data-character="${judge.slot}" data-judge="${judge.id}" role="img" aria-label="${judge.name}, ${perspectives[judge.id] ?? judge.perspective}">${art.slice(split)}</g></g>`;
    }).join('')}
    ${bench(perspectives)}
    <ellipse class="candle-light" cx="1010" cy="160" rx="300" ry="220" fill="url(#candle)"/>
    <g class="motes" fill="#f6dcaa">${motes}</g>
  </svg>`;
}

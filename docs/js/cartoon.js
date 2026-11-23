// Lululingo – lille tegnefilmsmotor. Tegner scener, figurer og effekter i SVG
// og styrer dem ud fra afsnittets tidslinje (cues), så alt følger lyden – også når man spoler.
const INK = '#3E2C30';
const GROUND = 194;
const W = 400, H = 225;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const R = (a, x, y) => `rotate(${a.toFixed(2)} ${x} ${y})`;

const FACES = ['idle', 'happy', 'laugh', 'surprised', 'sad', 'cry', 'pout', 'shy', 'think', 'sleep', 'love', 'yum'];
const MOTIONS = { jump: 0.6, jump2: 1.2, hop: 0.4, wave: 1.8, nod: 0.9, shake: 0.9, point: 1.8, cheer: 1.6, bow: 1.4, dance: 0, bounce: 0, tremble: 0, eat: 0, clap: 0, run: 0 };
const LOOPED = { dance: 1, bounce: 1, tremble: 1, eat: 1, clap: 1 };
const FX = ['!', '?', 'heart', 'note', 'sweat', 'spark', 'zzz', 'tear', 'anger', 'idea', 'dots'];

// ---------- Figurer ----------
// Hver figur er én blød form (hoved og krop i ét) med små lemmer, der vokser ud af kroppen.
// Alle dele tegnes først som kontur (mørk, bred streg) og derefter som farve ovenpå,
// så samlingerne smelter sammen og lemmerne sidder fast. Fødderne står i (0,0).
const OW = 4.4; // konturbredde (det synlige er halvdelen)
const ell = (cx, cy, rx, ry) => `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
// kapsel der hænger ned fra (x,y): længde len, radius r
const cap = (x, y, len, r) => `M${x - r} ${y} V${y + len} A${r} ${r} 0 0 0 ${x + r} ${y + len} V${y} A${r} ${r} 0 0 0 ${x - r} ${y}Z`;

function eyeSet(lx, rx, y) {
  const both = (f) => f(lx, 1) + f(rx, -1);
  return `
<g data-eye="open">${both((x) => `<ellipse cx="${x}" cy="${y}" rx="4.3" ry="5.4" fill="${INK}"/><circle cx="${x + 1.4}" cy="${y - 2}" r="1.8" fill="#fff"/><circle cx="${x - 1.4}" cy="${y + 2.1}" r=".8" fill="#fff"/>`)}</g>
<g data-eye="up">${both((x) => `<ellipse cx="${x + 0.6}" cy="${y - 1.6}" rx="4.1" ry="5.1" fill="${INK}"/><circle cx="${x + 1.8}" cy="${y - 3.8}" r="1.7" fill="#fff"/>`)}</g>
<g data-eye="happy" fill="none" stroke="${INK}" stroke-width="2.3" stroke-linecap="round">${both((x) => `<path d="M${x - 4.6} ${y + 1.8} Q${x} ${y - 4.2} ${x + 4.6} ${y + 1.8}"/>`)}</g>
<g data-eye="closed" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round">${both((x) => `<path d="M${x - 4.4} ${y + 0.5} Q${x} ${y + 3} ${x + 4.4} ${y + 0.5}"/>`)}</g>
<g data-eye="surprised">${both((x) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${INK}"/>`)}</g>
<g data-eye="sad">${both((x, s) => `<ellipse cx="${x}" cy="${y + 0.8}" rx="4" ry="4.9" fill="${INK}"/><circle cx="${x + 1.3}" cy="${y - 1.2}" r="1.7" fill="#fff"/><path d="M${x - 5 * s} ${y - 7} Q${x} ${y - 10.5} ${x + 4.5 * s} ${y - 11.5}" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`)}</g>
<g data-eye="pout">${both((x, s) => `<ellipse cx="${x}" cy="${y + 0.6}" rx="4" ry="4.6" fill="${INK}"/><circle cx="${x + 1.3}" cy="${y - 1.2}" r="1.5" fill="#fff"/><path d="M${x - 5 * s} ${y - 10.5} L${x + 4 * s} ${y - 7}" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`)}</g>
<g data-eye="tight" fill="none" stroke="${INK}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${both((x, s) => `<path d="M${x - 4 * s} ${y - 4} L${x + 3.6 * s} ${y} L${x - 4 * s} ${y + 4}"/>`)}</g>
<g data-eye="heart">${both((x) => `<path d="M${x} ${y + 4.6} C${x - 7.5} ${y - 0.5} ${x - 3.8} ${y - 7} ${x} ${y - 2.8} C${x + 3.8} ${y - 7} ${x + 7.5} ${y - 0.5} ${x} ${y + 4.6}Z" fill="#F0457A" stroke="${INK}" stroke-width="1.3"/>`)}</g>`;
}

function mouthSet(y, cat) {
  const smile = cat
    ? `<path d="M-4.6 ${y} Q-2.3 ${y + 3} 0 ${y} Q2.3 ${y + 3} 4.6 ${y}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`
    : `<path d="M-3.6 ${y + 0.4} Q0 ${y + 3.2} 3.6 ${y + 0.4}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;
  return `
<g data-mouth="smile">${smile}</g>
<g data-mouth="grin"><path d="M-5.6 ${y - 0.6} Q0 ${y + 8} 5.6 ${y - 0.6} Q0 ${y + 1} -5.6 ${y - 0.6}Z" fill="#B93A58" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/><path d="M-2.8 ${y + 4.2} Q0 ${y + 2.4} 2.8 ${y + 4.2} Q0 ${y + 5.6} -2.8 ${y + 4.2}Z" fill="#F58BA6"/></g>
<g data-mouth="o"><ellipse cx="0" cy="${y + 1.6}" rx="2.4" ry="3" fill="#B93A58" stroke="${INK}" stroke-width="1.6"/></g>
<g data-mouth="frown"><path d="M-3.8 ${y + 2.6} Q0 ${y - 0.8} 3.8 ${y + 2.6}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/></g>
<g data-mouth="pout"><path d="M-3.4 ${y + 1.2} Q-1.7 ${y - 0.6} 0 ${y + 1.2} Q1.7 ${y + 3} 3.4 ${y + 1.2}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/></g>
<g data-mouth="talk"><ellipse data-p="talk" cx="0" cy="${y + 1.4}" rx="3.6" ry="2.6" fill="#B93A58" stroke="${INK}" stroke-width="1.6"/></g>`;
}

// Kinder med små skraverede streger
const cheeks = (x, y) => [-x, x].map((cx) => `<ellipse cx="${cx}" cy="${y}" rx="6.6" ry="4.2" fill="#FFB5C5"/><path d="M${cx - 3.2} ${y - 2} v4 M${cx - 1} ${y - 2.3} v4.6 M${cx + 1.2} ${y - 2.3} v4.6 M${cx + 3.4} ${y - 2} v4" stroke="#EC7C98" stroke-width="1" stroke-linecap="round"/>`).join('') +
  `<g data-p="shy" display="none" fill="#FF9DB4" opacity=".7">${[-x, x].map((cx) => `<ellipse cx="${cx}" cy="${y}" rx="9" ry="5.6"/>`).join('')}</g>`;

// En del = form(er) + omdrejningspunkt. tube = tyk streg-del (fx hale).
// shapes: [{ d, fill, inner }] – inner tegnes kun i farvelaget (indvendige detaljer).
const BODIES = {
  lulu: {
    top: 104, face: [0, 0], arm: { len: 12, r: 5.8 }, scale: 1,
    parts: [
      { id: 'legL', piv: [-13, -10], shapes: [{ d: cap(-13, -12, 5, 7), fill: '#fff' }] },
      { id: 'legR', piv: [13, -10], shapes: [{ d: cap(13, -12, 5, 7), fill: '#fff' }] },
      { id: 'tail', piv: [0, -14], tube: { d: 'M20 -14 C36 -13 44 -26 40 -44', w: 7, fill: '#fff' }, shapes: [{ d: ell(40, -45, 4.8, 4.8), fill: '#FFC27A' }] },
      { id: 'earL', piv: [-24, -84], shapes: [{ d: 'M-36 -72 C-39 -90 -36 -104 -29 -108 C-22 -104 -13 -96 -9 -88 Z', fill: '#FFC27A' }] },
      { id: 'earR', piv: [24, -84], shapes: [{ d: 'M36 -72 C39 -90 36 -104 29 -108 C22 -104 13 -96 9 -88 Z', fill: '#fff' }, { d: 'M29 -101 C25 -98 21 -94 19 -91 L31 -84 C32 -90 32 -96 29 -101Z', fill: '#FFCBD8', inner: true }] },
      { id: 'body', shapes: [{ d: 'M-30 -5 C-38 -18 -41 -40 -39 -58 C-37 -83 -19 -96 0 -96 C19 -96 37 -83 39 -58 C41 -40 38 -18 30 -5 C21 1 -21 1 -30 -5Z', fill: '#fff' }] },
      { id: 'armL', piv: [-29, -40], shapes: [{ d: cap(-29, -40, 12, 5.8), fill: '#fff' }] },
      { id: 'armR', piv: [29, -40], shapes: [{ d: cap(29, -40, 12, 5.8), fill: '#fff' }] }
    ],
    body: 'M-30 -5 C-38 -18 -41 -40 -39 -58 C-37 -83 -19 -96 0 -96 C19 -96 37 -83 39 -58 C41 -40 38 -18 30 -5 C21 1 -21 1 -30 -5Z',
    deco: `<path d="M-40 -62 C-38 -84 -20 -96 -4 -97 C-6 -84 -19 -72 -40 -60Z" fill="#FFC27A"/><path d="M-36 -33 Q0 -20 36 -33" fill="none" stroke="#F2708F" stroke-width="5.2" stroke-linecap="round"/>`,
    decoTop: `<circle cx="0" cy="-26" r="4.6" fill="#FFD45C" stroke="${INK}" stroke-width="1.5"/><path d="M-2.4 -25.4 H2.4" stroke="${INK}" stroke-width="1.1"/>`,
    faceSVG: () => `${eyeSet(-13, 13, -57)}${cheeks(25, -46)}<path d="M-1.8 -50.5 H1.8 L0 -48.6Z" fill="#F0457A" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/>${mouthSet(-47.5, true)}<path d="M-33 -51 l-8 -1.6 M-33 -46.5 l-8 1.2 M33 -51 l8 -1.6 M33 -46.5 l8 1.2" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>`
  },
  momo: {
    top: 120, face: [0, 0], arm: { len: 11, r: 5.5 }, scale: 1,
    parts: [
      { id: 'legL', piv: [-12, -10], shapes: [{ d: cap(-12, -12, 5, 6.6), fill: '#FFF1F5' }] },
      { id: 'legR', piv: [12, -10], shapes: [{ d: cap(12, -12, 5, 6.6), fill: '#FFF1F5' }] },
      { id: 'tail', piv: [0, -16], shapes: [{ d: ell(25, -17, 7.4, 7.4), fill: '#FFF1F5' }] },
      { id: 'earL', piv: [-12, -80], shapes: [{ d: ell(-14, -106, 8.6, 25), fill: '#FFF1F5' }, { d: ell(-14, -106, 3.8, 17), fill: '#FFC2D4', inner: true }] },
      { id: 'earR', piv: [12, -80], shapes: [{ d: ell(14, -106, 8.6, 25), fill: '#FFF1F5' }, { d: ell(14, -106, 3.8, 17), fill: '#FFC2D4', inner: true }] },
      { id: 'body', shapes: [{ d: 'M-28 -5 C-36 -18 -38 -38 -36 -54 C-34 -77 -17 -88 0 -88 C17 -88 34 -77 36 -54 C38 -38 36 -18 28 -5 C19 1 -19 1 -28 -5Z', fill: '#FFF1F5' }] },
      { id: 'armL', piv: [-27, -38], shapes: [{ d: cap(-27, -38, 11, 5.5), fill: '#FFF1F5' }] },
      { id: 'armR', piv: [27, -38], shapes: [{ d: cap(27, -38, 11, 5.5), fill: '#FFF1F5' }] }
    ],
    body: 'M-28 -5 C-36 -18 -38 -38 -36 -54 C-34 -77 -17 -88 0 -88 C17 -88 34 -77 36 -54 C38 -38 36 -18 28 -5 C19 1 -19 1 -28 -5Z',
    deco: `<path d="M-40 -22 Q0 -12 40 -22 V10 H-40Z" fill="#FF9DB9"/><path d="M-40 -22 Q0 -12 40 -22" fill="none" stroke="${INK}" stroke-width="1.5"/><circle cx="-14" cy="-12" r="1.8" fill="#fff"/><circle cx="2" cy="-8" r="1.8" fill="#fff"/><circle cx="16" cy="-14" r="1.8" fill="#fff"/><circle cx="-4" cy="-18" r="1.5" fill="#fff"/>`,
    decoTop: `<g transform="translate(17 -80)"><path d="M0 -6 C7 -6 9 1 0 9 C-9 1 -7 -6 0 -6Z" fill="#F0457A" stroke="${INK}" stroke-width="1.5"/><path d="M-4 -7 L0 -3 L4 -7 L0 -10Z" fill="#3FAE6A" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><circle cx="-2" cy="1" r=".9" fill="#FFE07A"/><circle cx="2" cy="3" r=".9" fill="#FFE07A"/></g>`,
    faceSVG: () => `${eyeSet(-12, 12, -51)}${cheeks(23, -41)}<ellipse cx="0" cy="-45.6" rx="2.2" ry="1.6" fill="#F0457A"/>${mouthSet(-43.5, false)}`
  },
  pon: {
    top: 128, face: [0, 0], arm: { len: 13, r: 6.6 }, scale: 1,
    parts: [
      { id: 'legL', piv: [-15, -11], shapes: [{ d: cap(-15, -13, 5, 8), fill: '#8E6A4E' }] },
      { id: 'legR', piv: [15, -11], shapes: [{ d: cap(15, -13, 5, 8), fill: '#8E6A4E' }] },
      { id: 'tail', piv: [0, -20], shapes: [{ d: 'M26 -16 C34 -40 62 -40 64 -24 C66 -10 40 -4 26 -16Z', fill: '#C79F78' }, { d: 'M44 -36 C48 -28 47 -18 42 -10 L48 -9 C53 -17 54 -28 50 -37Z M56 -33 C59 -27 59 -20 56 -13 L60 -14 C63 -21 63 -28 60 -32Z', fill: '#7A5642', inner: true }] },
      { id: 'earL', piv: [-28, -92], shapes: [{ d: ell(-30, -96, 10.5, 10.5), fill: '#C79F78' }, { d: ell(-30, -96, 5, 5), fill: '#7A5642', inner: true }] },
      { id: 'earR', piv: [28, -92], shapes: [{ d: ell(30, -96, 10.5, 10.5), fill: '#C79F78' }, { d: ell(30, -96, 5, 5), fill: '#7A5642', inner: true }] },
      { id: 'body', shapes: [{ d: 'M-36 -6 C-45 -20 -48 -44 -46 -62 C-43 -90 -22 -104 0 -104 C22 -104 43 -90 46 -62 C48 -44 45 -20 36 -6 C25 1 -25 1 -36 -6Z', fill: '#C79F78' }] },
      { id: 'hat', piv: [0, -100], shapes: [{ d: 'M-24 -94 C-31 -112 -15 -124 0 -117 C15 -124 31 -112 24 -94 C12 -90 -12 -90 -24 -94Z', fill: '#fff' }, { d: 'M-23 -94.5 C-12 -91 12 -91 23 -94.5', line: true }] },
      { id: 'armL', piv: [-35, -44], shapes: [{ d: cap(-35, -44, 13, 6.6), fill: '#C79F78' }] },
      { id: 'armR', piv: [35, -44], shapes: [{ d: cap(35, -44, 13, 6.6), fill: '#C79F78' }] }
    ],
    body: 'M-36 -6 C-45 -20 -48 -44 -46 -62 C-43 -90 -22 -104 0 -104 C22 -104 43 -90 46 -62 C48 -44 45 -20 36 -6 C25 1 -25 1 -36 -6Z',
    deco: `<ellipse cx="0" cy="-24" rx="26" ry="21" fill="#F4E2C6"/><path d="M-23 -47 H23 L26 -6 C14 0 -14 0 -26 -6Z" fill="#fff" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M-8 -32 H8 V-22 H-8Z" fill="none" stroke="#E2CDB8" stroke-width="1.6"/>`,
    decoTop: `<path d="M-14 -104 C-10 -108 -4 -108 0 -106 M6 -110 C9 -112 13 -111 16 -108" fill="none" stroke="#E6DCD6" stroke-width="1.4" stroke-linecap="round"/>`,
    faceSVG: () => `<path d="M-38 -64 C-34 -79 -16 -81 -5 -68 C-11 -57 -29 -53 -38 -64Z M38 -64 C34 -79 16 -81 5 -68 C11 -57 29 -53 38 -64Z" fill="#8A6249"/><ellipse cx="0" cy="-50" rx="15" ry="9.6" fill="#F4E2C6"/>${eyeSet(-17, 17, -66)}${cheeks(31, -50)}<ellipse cx="0" cy="-55" rx="4" ry="3" fill="${INK}"/>${mouthSet(-50, true)}`
  }
};

let uid = 0;
function charSVG(k) {
  const B = BODIES[k];
  const id = 'tb' + (++uid);
  const outline = (p) => `<g data-p="${p.id}">${p.tube ? `<path d="${p.tube.d}" fill="none" stroke="${INK}" stroke-width="${p.tube.w + OW}" stroke-linecap="round"/>` : ''}${p.shapes.filter((s) => !s.inner && !s.line).map((s) => `<path d="${s.d}"/>`).join('')}</g>`;
  const fill = (p) => `<g data-p="${p.id}">${p.tube ? `<path d="${p.tube.d}" fill="none" stroke="${p.tube.fill}" stroke-width="${p.tube.w}" stroke-linecap="round"/>` : ''}${p.shapes.map((s) => s.line ? `<path d="${s.d}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>` : `<path d="${s.d}" fill="${s.fill}"/>`).join('')}</g>`;
  return `<g data-ch="${k}">
<ellipse cx="0" cy="0" rx="${k === 'pon' ? 36 : 28}" ry="4.6" fill="#5A4048" opacity=".14" data-p="shadow"/>
<g data-p="bob">
  <clipPath id="${id}"><path d="${B.body}"/></clipPath>
  <g fill="${INK}" stroke="${INK}" stroke-width="${OW}" stroke-linejoin="round">${B.parts.map(outline).join('')}</g>
  <g>${B.parts.map(fill).join('')}</g>
  <g clip-path="url(#${id})">${B.deco}</g>
  ${B.decoTop}
  <g data-p="face">${B.faceSVG()}</g>
  <g data-p="item"></g>
</g>
<g data-p="fx"></g>
</g>`;
}

// ---------- Ting figurerne kan holde ----------
const ITEMS = {
  bread: `<g transform="translate(4 -4)"><ellipse cx="0" cy="0" rx="11" ry="9" fill="#F4C55E" stroke="${INK}" stroke-width="2.2"/><path d="M-7 -5 L5 6 M-2 -8 L8 2 M-9 1 L-1 8 M3 -8 L-8 4 M8 -3 L-2 8" stroke="#D49A3A" stroke-width="1.4"/></g>`,
  pinkbread: `<g transform="translate(4 -4)"><ellipse cx="0" cy="0" rx="11" ry="8.5" fill="#E9A964" stroke="${INK}" stroke-width="2.2"/><path d="M-8 -3 C-4 -8 4 -8 8 -3 C4 0 -4 0 -8 -3Z" fill="#FF9EBB"/><circle cx="0" cy="-6" r="2.6" fill="#F0457A" stroke="${INK}" stroke-width="1.2"/></g>`,
  strawberry: `<g transform="translate(3 -4)"><path d="M0 -7 C8 -7 10 1 0 10 C-10 1 -8 -7 0 -7Z" fill="#F0457A" stroke="${INK}" stroke-width="2"/><path d="M-5 -8 L0 -4 L5 -8 L0 -11Z" fill="#3FAE6A" stroke="${INK}" stroke-width="1.6"/></g>`,
  cup: `<g transform="translate(5 -2)"><path d="M-8 -9 H8 L6.5 6 C6 8 -6 8 -6.5 6Z" fill="#fff" stroke="${INK}" stroke-width="2.2"/><path d="M8 -6 C14 -6 14 2 7.5 2" fill="none" stroke="${INK}" stroke-width="2.2"/><path d="M-7 -6 H7" stroke="#9A5B3C" stroke-width="2.4"/><path d="M-2 4 l1.5 -2 1.5 2 -1.5 1.5z" fill="#FF9EBB"/><g class="toon-steam" fill="none" stroke="#C9BBD0" stroke-width="1.8" stroke-linecap="round"><path d="M-3 -12 q-3 -4 0 -8 q3 -4 0 -8"/><path d="M3 -13 q-3 -4 0 -8 q3 -4 0 -8"/></g></g>`,
  umbrella: `<g transform="translate(0 0)"><path d="M0 4 V-46" stroke="${INK}" stroke-width="2.6"/><path d="M0 4 q0 5 -5 5" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M-34 -42 C-30 -66 30 -66 34 -42 C28 -47 22 -47 17 -42 C11 -47 6 -47 0 -42 C-6 -47 -11 -47 -17 -42 C-22 -47 -28 -47 -34 -42Z" fill="#FFC93C" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M0 -60 C-6 -54 -9 -48 -9 -44 M0 -60 C6 -54 9 -48 9 -44" fill="none" stroke="#E0A520" stroke-width="1.8"/></g>`,
  crayon: `<g transform="translate(4 -4) rotate(-30)"><rect x="-3" y="-12" width="6" height="18" rx="1.5" fill="#7FB7FF" stroke="${INK}" stroke-width="1.8"/><path d="M-3 -12 L0 -18 L3 -12Z" fill="#3D7FE0" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/></g>`,
  picture: `<g transform="translate(8 -10)"><rect x="-15" y="-13" width="30" height="24" rx="2" fill="#fff" stroke="${INK}" stroke-width="2"/><ellipse cx="0" cy="0" rx="7.5" ry="6" fill="none" stroke="#F0457A" stroke-width="1.6"/><path d="M-4 -5 C-6 -16 -1 -16 -1.5 -6 M4 -5 C6 -16 1 -16 1.5 -6" fill="none" stroke="#F0457A" stroke-width="1.6"/><circle cx="-2.5" cy="0" r="1" fill="${INK}"/><circle cx="2.5" cy="0" r="1" fill="${INK}"/></g>`,
  picture2: `<g transform="translate(8 -10)"><rect x="-15" y="-13" width="30" height="24" rx="2" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M-9 4 C-12 -6 -6 -9 0 -8 C7 -9 11 -4 8 4 C4 8 -5 8 -9 4Z M-7 -6 L-9 -11 L-3 -8 M6 -6 L8 -11 L2 -8" fill="none" stroke="#3D7FE0" stroke-width="1.6" stroke-linejoin="round"/><path d="M-4 -2 l2 2 M3 -2 l-2 2 M-1 3 h3" stroke="#3D7FE0" stroke-width="1.4"/></g>`,
  gift: `<g transform="translate(8 -8)"><rect x="-11" y="-9" width="22" height="18" rx="2" fill="#9FD3FF" stroke="${INK}" stroke-width="2.2"/><path d="M0 -9 V9 M-11 -1 H11" stroke="#F0457A" stroke-width="3.4"/><path d="M0 -9 C-8 -17 -11 -9 0 -9 C11 -9 8 -17 0 -9Z" fill="#F0457A" stroke="${INK}" stroke-width="1.8"/></g>`,
  ribbon: `<g transform="translate(6 -8)"><path d="M0 0 C-6 -9 -14 -6 -12 1 C-10 7 -4 4 0 0 C4 4 10 7 12 1 C14 -6 6 -9 0 0Z" fill="#F0457A" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="0" cy="0" r="3" fill="#FF9EBB" stroke="${INK}" stroke-width="1.6"/></g>`,
  whisk: `<g transform="translate(4 -6) rotate(-20)"><path d="M0 8 V-6" stroke="#B9A08A" stroke-width="3.4" stroke-linecap="round"/><path d="M0 -6 C-6 -12 -5 -22 0 -24 C5 -22 6 -12 0 -6 M0 -6 C-2 -12 -2 -20 0 -24 C2 -20 2 -12 0 -6" fill="none" stroke="#8C8C9C" stroke-width="1.6"/></g>`,
  egg: `<g transform="translate(4 -5)"><ellipse cx="0" cy="0" rx="6" ry="7.5" fill="#FFF8EC" stroke="${INK}" stroke-width="2"/></g>`
};

// ---------- Ting i scenen ----------
const PROPS = {
  table: { layer: 'front', svg: (x) => `<g transform="translate(${x} ${GROUND + 8})"><ellipse cx="0" cy="-30" rx="58" ry="9" fill="#F2B6C9" stroke="${INK}" stroke-width="2.6"/><path d="M-58 -30 V-22 C-58 -16 58 -16 58 -22 V-30" fill="#E89AB2" stroke="${INK}" stroke-width="2.6"/><path d="M-30 -18 V0 M30 -18 V0" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M-30 -18 V0 M30 -18 V0" stroke="#C97A93" stroke-width="2.4" stroke-linecap="round"/></g>` },
  cake: { layer: 'front', svg: (x, env, y) => `<g transform="translate(${x} ${y || GROUND - 26})"><ellipse cx="0" cy="0" rx="26" ry="5" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M-20 -2 V-20 C-20 -25 20 -25 20 -20 V-2 C20 3 -20 3 -20 -2Z" fill="#FFF4E8" stroke="${INK}" stroke-width="2.2"/><path d="M-20 -12 C-14 -8 -8 -14 0 -10 C8 -14 14 -8 20 -12" fill="none" stroke="#FF9EBB" stroke-width="3"/><path d="M-20 -20 C-20 -25 20 -25 20 -20 C20 -16 -20 -16 -20 -20Z" fill="#fff" stroke="${INK}" stroke-width="2"/>${[-12, 0, 12].map((cx) => `<path d="M${cx} -25 C${cx + 4} -25 ${cx + 5} -20 ${cx} -17 C${cx - 5} -20 ${cx - 4} -25 ${cx} -25Z" fill="#F0457A" stroke="${INK}" stroke-width="1.2"/>`).join('')}${[-8, 4, 14].map((cx, i) => `<rect x="${cx - 1.6}" y="-34" width="3.2" height="11" rx="1" fill="${['#9FD3FF', '#FFC93C', '#B9E8A8'][i]}" stroke="${INK}" stroke-width="1"/>${env.candles ? `<path class="toon-flame" d="M${cx} -43 C${cx + 3} -39 ${cx + 2.4} -35 ${cx} -35 C${cx - 2.4} -35 ${cx - 3} -39 ${cx} -43Z" fill="#FFB020"/>` : ''}`).join('')}</g>` },
  bench: { layer: 'back', svg: (x) => `<g transform="translate(${x} ${GROUND - 2})"><path d="M-48 -26 H48" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M-48 -26 H48" stroke="#E9A964" stroke-width="5" stroke-linecap="round"/><path d="M-48 -42 H48" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M-48 -42 H48" stroke="#E9A964" stroke-width="4" stroke-linecap="round"/><path d="M-38 -26 V0 M38 -26 V0 M-38 -42 V-26 M38 -42 V-26" stroke="${INK}" stroke-width="3.4"/></g>` },
  balloons: { layer: 'back', svg: (x) => `<g transform="translate(${x} 0)" class="toon-sway">${[[-14, 64, '#FF9EBB'], [6, 54, '#9FD3FF'], [22, 70, '#FFC93C']].map(([bx, by, c]) => `<path d="M${bx} ${by + 14} Q${bx + 4} ${by + 40} ${bx - 2} ${by + 70}" fill="none" stroke="${INK}" stroke-width="1.2"/><ellipse cx="${bx}" cy="${by}" rx="11" ry="13.5" fill="${c}" stroke="${INK}" stroke-width="2.2"/><ellipse cx="${bx - 4}" cy="${by - 5}" rx="3" ry="4" fill="#fff" opacity=".6"/>`).join('')}</g>` },
  garland: { layer: 'back', svg: () => `<g><path d="M0 18 Q100 48 200 18 Q300 48 400 18" fill="none" stroke="${INK}" stroke-width="1.4"/>${Array.from({ length: 13 }, (_, i) => { const x = 14 + i * 29; const y = 18 + Math.sin((x / 200) * Math.PI) * 26 * (x < 200 ? 1 : 1) - 2; const c = ['#FF9EBB', '#FFC93C', '#9FD3FF', '#B9E8A8'][i % 4]; return `<path d="M${x - 7} ${y} L${x + 7} ${y} L${x} ${y + 14}Z" fill="${c}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`; }).join('')}</g>` }
};

// ---------- Baggrunde ----------
const SKY = { day: ['#A9DCFF', '#E6F6FF'], rain: ['#8E9AB4', '#C6CCDA'], night: ['#1F2552', '#454A8C'], sunset: ['#FFB79A', '#FFE7C2'] };

function defs() {
  return `<defs>
${Object.entries(SKY).map(([k, [a, b]]) => `<linearGradient id="sky-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join('')}
<radialGradient id="toon-title" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#FFF6D8"/><stop offset=".55" stop-color="#FFE0EC"/><stop offset="1" stop-color="#E5DBFF"/></radialGradient>
<radialGradient id="toon-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFD98A" stop-opacity=".55"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient>
<pattern id="toon-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.4" fill="#FFD3DF"/><circle cx="16" cy="16" r="2.4" fill="#FFE2B8"/></pattern>
<pattern id="toon-check" width="28" height="28" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="#F7E3C9"/><rect width="14" height="14" fill="#EFD3B0"/><rect x="14" y="14" width="14" height="14" fill="#EFD3B0"/></pattern>
<clipPath id="toon-win"><rect x="152" y="30" width="96" height="74" rx="6"/></clipPath>
</defs>`;
}

const cloud = (x, y, s, cls) => `<g class="${cls}" style="--x0:${x}px"><g transform="translate(${x} ${y}) scale(${s})"><path d="M-26 8 C-34 8 -34 -4 -24 -4 C-24 -16 -6 -18 -2 -8 C2 -18 22 -16 20 -2 C30 -2 30 8 22 8Z" fill="#fff" stroke="#D8E6F3" stroke-width="1.5"/></g></g>`;
const sun = (x, y) => `<g transform="translate(${x} ${y})"><g class="toon-spin">${Array.from({ length: 10 }, (_, i) => `<path d="M0 -27 L3 -20 L-3 -20Z" fill="#FFD25C" transform="rotate(${i * 36})"/>`).join('')}</g><circle r="16" fill="#FFD25C" stroke="#F2B53A" stroke-width="2"/><circle cx="-5" cy="-2" r="1.6" fill="${INK}"/><circle cx="5" cy="-2" r="1.6" fill="${INK}"/><path d="M-3.5 4 Q0 7 3.5 4" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="-9" cy="3" rx="3" ry="1.8" fill="#FF9EBB"/><ellipse cx="9" cy="3" rx="3" ry="1.8" fill="#FF9EBB"/></g>`;
const moon = (x, y) => `<g transform="translate(${x} ${y})"><path d="M8 -16 A17 17 0 1 0 12 12 A13 13 0 1 1 8 -16Z" fill="#FFF1B0"/></g>${[[30, 20], [80, 44], [120, 16], [230, 30], [300, 18], [360, 46], [270, 60]].map(([sx, sy], i) => `<path class="toon-twinkle" style="animation-delay:${i * 0.37}s" d="M${sx} ${sy - 4} L${sx + 1.2} ${sy - 1.2} L${sx + 4} ${sy} L${sx + 1.2} ${sy + 1.2} L${sx} ${sy + 4} L${sx - 1.2} ${sy + 1.2} L${sx - 4} ${sy} L${sx - 1.2} ${sy - 1.2}Z" fill="#FFF6C8"/>`).join('')}`;
const rainbow = (cx, cy, r) => `<g data-p="rainbow" opacity="0">${['#FF8FA8', '#FFB86B', '#FFE27A', '#9EE08E', '#8CC8FF', '#B9A2FF'].map((c, i) => `<path d="M${cx - r + i * 5} ${cy} A${r - i * 5} ${r - i * 5} 0 0 1 ${cx + r - i * 5} ${cy}" fill="none" stroke="${c}" stroke-width="5.4"/>`).join('')}</g>`;
const tree = (x, s = 1, c = '#8FD18A') => `<g transform="translate(${x} ${GROUND - 6}) scale(${s})"><path d="M-6 0 V-40 M6 0 V-40" stroke="${INK}" stroke-width="2.4"/><rect x="-6" y="-42" width="12" height="42" fill="#B98A5E"/><g class="toon-sway"><circle cx="0" cy="-66" r="30" fill="${c}" stroke="${INK}" stroke-width="2.4"/><circle cx="-22" cy="-50" r="18" fill="${c}" stroke="${INK}" stroke-width="2.4"/><circle cx="22" cy="-50" r="18" fill="${c}" stroke="${INK}" stroke-width="2.4"/><path d="M-20 -50 C-14 -40 14 -40 20 -50" fill="${c}"/><circle cx="-10" cy="-72" r="3" fill="#FF9EBB"/><circle cx="12" cy="-62" r="3" fill="#FF9EBB"/><circle cx="-2" cy="-52" r="3" fill="#FF9EBB"/></g></g>`;
const flowers = (xs, y) => xs.map((x, i) => `<g transform="translate(${x} ${y + (i % 2) * 6})"><path d="M0 0 V-8" stroke="#3FAE6A" stroke-width="1.6"/>${[0, 72, 144, 216, 288].map((a) => `<circle cx="0" cy="-12" r="2.8" fill="${['#FF9EBB', '#FFF', '#FFC93C', '#B9A2FF'][i % 4]}" transform="rotate(${a} 0 -9)"/>`).join('')}<circle cx="0" cy="-9" r="2" fill="#FFD25C"/></g>`).join('');
const outdoorSky = (env) => `<rect width="${W}" height="${H}" fill="url(#sky-${env.sky})"/>${env.sky === 'night' ? moon(330, 40) : env.sky === 'rain' ? '' : sun(345, 38)}${rainbow(200, 150, 120)}${env.sky === 'night' ? '' : cloud(60, 40, 1, 'toon-drift d1') + cloud(220, 26, 0.75, 'toon-drift d2') + cloud(330, 70, 0.6, 'toon-drift d3')}${env.sky === 'rain' ? cloud(140, 30, 1.3, 'toon-drift d2 grey') + cloud(300, 40, 1.2, 'toon-drift d1 grey') : ''}`;

const SCENES = {
  title: (env, E) => `<rect width="${W}" height="${H}" fill="url(#toon-title)"/>
<g class="toon-spin slow" style="transform-origin:200px 96px">${Array.from({ length: 16 }, (_, i) => `<path d="M200 96 L${200 + Math.cos((i / 16) * 2 * Math.PI) * 400} ${96 + Math.sin((i / 16) * 2 * Math.PI) * 400} L${200 + Math.cos(((i + 0.5) / 16) * 2 * Math.PI) * 400} ${96 + Math.sin(((i + 0.5) / 16) * 2 * Math.PI) * 400}Z" fill="#fff" opacity=".35"/>`).join('')}</g>
${[[40, 40, '#FF9EBB'], [360, 34, '#9FD3FF'], [70, 120, '#FFC93C'], [340, 118, '#B9E8A8'], [120, 22, '#B9A2FF'], [290, 22, '#FF9EBB']].map(([x, y, c], i) => `<path class="toon-twinkle" style="animation-delay:${i * 0.3}s" d="M${x} ${y - 8} L${x + 2.4} ${y - 2.4} L${x + 8} ${y} L${x + 2.4} ${y + 2.4} L${x} ${y + 8} L${x - 2.4} ${y + 2.4} L${x - 8} ${y} L${x - 2.4} ${y - 2.4}Z" fill="${c}"/>`).join('')}
<rect x="0" y="${GROUND - 6}" width="${W}" height="${H}" fill="#F6D9E6"/><path d="M0 ${GROUND - 6} H${W}" stroke="#EFC3D6" stroke-width="3"/>
<g class="toon-pop"><rect x="104" y="22" width="192" height="64" rx="30" fill="#fff" stroke="${INK}" stroke-width="3"/>
<text x="200" y="45" text-anchor="middle" font-family="'M PLUS Rounded 1c', sans-serif" font-weight="800" font-size="12" fill="#F0457A">ルルとモモ · Lulu og Momo</text>
<text x="200" y="72" text-anchor="middle" font-family="'M PLUS Rounded 1c', sans-serif" font-weight="800" font-size="${String(env.text || E.title || '').length > 9 ? 16 : 20}" fill="${INK}">${esc(env.text || E.title || '')}</text></g>`,
  room: (env) => `<rect width="${W}" height="170" fill="#FFEFF4"/><rect width="${W}" height="170" fill="url(#toon-dots)"/>
<rect x="0" y="150" width="${W}" height="20" fill="#FFE0EA"/><path d="M0 150 H${W}" stroke="#F4C4D4" stroke-width="2.5"/>
<rect x="0" y="170" width="${W}" height="55" fill="#F2D4B6"/><path d="M0 170 H${W}" stroke="#DDB592" stroke-width="3"/>${[60, 150, 250, 340].map((x) => `<path d="M${x} 172 L${x - 20} 225" stroke="#E3BF9C" stroke-width="2"/>`).join('')}
<g clip-path="url(#toon-win)"><rect x="150" y="28" width="100" height="80" fill="url(#sky-${env.sky})"/>${env.sky === 'night' ? `<path d="M226 44 A11 11 0 1 0 229 61 A8.5 8.5 0 1 1 226 44Z" fill="#FFF1B0"/><circle cx="170" cy="46" r="1.4" fill="#FFF6C8"/><circle cx="196" cy="62" r="1.2" fill="#FFF6C8"/>` : env.sky === 'rain' ? '' : `<circle cx="224" cy="50" r="10" fill="#FFD25C"/>`}${env.sky !== 'night' ? cloud(180, 70, 0.55, 'toon-drift d2 win') : ''}${rainbow(200, 104, 46)}${env.sky === 'rain' ? `<g class="toon-rain small">${Array.from({ length: 18 }, (_, i) => `<path d="M${150 + (i * 37) % 100} ${20 + (i * 23) % 80} l-3 9" stroke="#E8F0FF" stroke-width="1.6" stroke-linecap="round"/>`).join('')}</g>` : ''}</g>
<rect x="150" y="28" width="100" height="80" rx="7" fill="none" stroke="#fff" stroke-width="7"/><rect x="150" y="28" width="100" height="80" rx="7" fill="none" stroke="${INK}" stroke-width="2.4"/><path d="M200 30 V106 M152 68 H248" stroke="#fff" stroke-width="5"/><path d="M144 110 H256" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M144 110 H256" stroke="#FFF" stroke-width="3.6" stroke-linecap="round"/>
<path d="M136 22 C134 60 140 96 132 118 C146 112 150 70 154 22Z" fill="#FF9EBB" stroke="${INK}" stroke-width="2.2"/><path d="M264 22 C266 60 260 96 268 118 C254 112 250 70 246 22Z" fill="#FF9EBB" stroke="${INK}" stroke-width="2.2"/><path d="M128 22 H272" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
<path d="M24 78 H104" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M24 78 H104" stroke="#E9A964" stroke-width="3.6" stroke-linecap="round"/>
<rect x="34" y="56" width="8" height="20" rx="2" fill="#9FD3FF" stroke="${INK}" stroke-width="1.6"/><rect x="43" y="52" width="8" height="24" rx="2" fill="#FFC93C" stroke="${INK}" stroke-width="1.6"/><rect x="52" y="58" width="8" height="18" rx="2" fill="#B9E8A8" stroke="${INK}" stroke-width="1.6"/>
<path d="M80 76 L76 62 H96 L92 76Z" fill="#E9A964" stroke="${INK}" stroke-width="1.8"/><g class="toon-sway"><path d="M86 62 C78 50 80 40 86 36 C92 40 94 50 86 62Z M86 62 C96 54 102 54 104 48 C96 46 90 52 86 62Z M86 62 C76 54 70 54 68 48 C76 46 82 52 86 62Z" fill="#8FD18A" stroke="${INK}" stroke-width="1.8"/></g>
<g transform="translate(330 56)"><rect x="-26" y="-20" width="52" height="40" rx="4" fill="#fff" stroke="#E9A964" stroke-width="5"/><path d="M-12 2 C-6 -8 8 -8 12 2 C8 10 -6 10 -12 2Z M12 2 L20 -5 V9Z" fill="#8CC8FF" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="-5" cy="0" r="1.4" fill="${INK}"/></g>
<ellipse cx="200" cy="203" rx="140" ry="17" fill="#D8CCFA"/><ellipse cx="200" cy="203" rx="118" ry="12" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="6 7"/>
<g transform="translate(372 ${GROUND})"><path d="M0 0 V-92" stroke="${INK}" stroke-width="3"/><path d="M-10 0 H10" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M-16 -88 L-10 -112 H10 L16 -88Z" fill="#FFE7A0" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/></g>`,
  street: (env) => `${outdoorSky(env)}
<path d="M0 140 C60 110 120 118 180 132 C240 114 320 108 400 134 V${H} H0Z" fill="#C9EBC0"/>
${[[20, '#FF9EBB', 70], [104, '#9FD3FF', 60]].map(([x, roof, h]) => `<g transform="translate(${x} ${GROUND - 14})"><rect x="0" y="${-h}" width="70" height="${h}" fill="#FFF6EC" stroke="${INK}" stroke-width="2.4"/><path d="M-8 ${-h} L35 ${-h - 30} L78 ${-h}Z" fill="${roof}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><rect x="12" y="${-h + 14}" width="16" height="16" rx="2" fill="#BFE4FF" stroke="${INK}" stroke-width="2"/><rect x="42" y="${-h + 14}" width="16" height="16" rx="2" fill="#BFE4FF" stroke="${INK}" stroke-width="2"/><rect x="26" y="-26" width="18" height="26" rx="3" fill="#E9A964" stroke="${INK}" stroke-width="2"/></g>`).join('')}
<g transform="translate(206 ${GROUND - 14})"><rect x="0" y="-92" width="136" height="92" fill="#FFF6EC" stroke="${INK}" stroke-width="2.6"/><path d="M-6 -92 L68 -122 L142 -92Z" fill="#F4C55E" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
<path d="M-4 -70 H140 V-58 ${Array.from({ length: 9 }, (_, i) => `Q${140 - i * 16 - 8} -48 ${140 - (i + 1) * 16} -58`).join(' ')} Z" fill="#FF9EBB" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>${Array.from({ length: 4 }, (_, i) => `<rect x="${i * 36 + 4}" y="-70" width="18" height="12" fill="#fff"/>`).join('')}
<circle cx="68" cy="-98" r="14" fill="#fff" stroke="${INK}" stroke-width="2.4"/><text x="68" y="-93" text-anchor="middle" font-family="'M PLUS Rounded 1c', sans-serif" font-weight="800" font-size="12" fill="#B8742F">パン</text>
<rect x="12" y="-46" width="40" height="30" rx="3" fill="#BFE4FF" stroke="${INK}" stroke-width="2.2"/><ellipse cx="24" cy="-24" rx="7" ry="5" fill="#F4C55E" stroke="${INK}" stroke-width="1.4"/><ellipse cx="40" cy="-25" rx="7" ry="5" fill="#E9A964" stroke="${INK}" stroke-width="1.4"/>
<rect x="84" y="-48" width="34" height="48" rx="4" fill="#E9A964" stroke="${INK}" stroke-width="2.4"/><circle cx="110" cy="-24" r="2.4" fill="${INK}"/></g>
${tree(370, 0.9)}${tree(186, 0.62, '#A6DD95')}
<rect x="0" y="${GROUND - 14}" width="${W}" height="${H}" fill="#EADFD3"/><path d="M0 ${GROUND - 14} H${W}" stroke="#D6C6B5" stroke-width="3"/>${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 50 + 10} ${GROUND - 12} L${i * 50 - 6} ${H}" stroke="#DCCDBD" stroke-width="2"/>`).join('')}
${flowers([12, 92, 176], GROUND - 12)}`,
  bakery: (env) => `<rect width="${W}" height="${H}" fill="#FFF3DF"/>${Array.from({ length: 14 }, (_, i) => `<rect x="${i * 30}" y="0" width="15" height="170" fill="#FFEBCB"/>`).join('')}
<rect x="0" y="168" width="${W}" height="57" fill="url(#toon-check)"/><path d="M0 168 H${W}" stroke="#D9B48C" stroke-width="3"/>
${[48, 96].map((y) => `<path d="M14 ${y} H210" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M14 ${y} H210" stroke="#E9A964" stroke-width="4.4" stroke-linecap="round"/>`).join('')}
${[[30, 40, 'loaf'], [62, 40, 'melon'], [94, 40, 'melon'], [126, 41, 'croissant'], [160, 40, 'pink'], [190, 40, 'loaf'], [34, 88, 'pink'], [66, 88, 'croissant'], [100, 88, 'loaf'], [134, 88, 'melon'], [170, 88, 'pink']].map(([x, y, t]) => bread(x, y, t)).join('')}
<g transform="translate(112 132)"><rect x="-52" y="-16" width="104" height="30" rx="12" fill="#fff" stroke="${INK}" stroke-width="2.4"/><text x="0" y="5" text-anchor="middle" font-family="'M PLUS Rounded 1c', sans-serif" font-weight="800" font-size="13" fill="#B8742F">ポンのパン屋</text></g>
${[260, 340].map((x) => `<g class="toon-sway"><path d="M${x} 0 V22" stroke="${INK}" stroke-width="1.6"/><path d="M${x - 14} 34 C${x - 14} 18 ${x + 14} 18 ${x + 14} 34Z" fill="#FFC93C" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="38" r="4" fill="#FFF3B0"/></g>`).join('')}`,
  park: (env) => `${outdoorSky(env)}
<path d="M0 104 C30 92 50 100 70 94 C96 86 118 98 140 96 L140 120 H0Z M250 100 C276 88 300 98 322 90 C346 84 370 96 400 92 V120 H250Z" fill="#B8D99A" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M0 118 C90 102 170 108 240 114 C310 104 360 104 400 110 V${H} H0Z" fill="#F3EEDB"/>
${[[60, 140, 60, 10], [250, 128, 80, 9], [340, 170, 70, 12], [120, 186, 90, 11], [30, 212, 60, 9], [270, 214, 100, 12]].map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#D3E9B6"/>`).join('')}
${tree(48, 0.95, '#A9D58C')}
${Array.from({ length: 26 }, (_, i) => { const gx = (i * 71) % 400 + 6, gy = 124 + ((i * 47) % 96); return `<path d="M${gx} ${gy} l-2 -5 M${gx + 3} ${gy} l0 -6 M${gx + 6} ${gy} l2 -5" stroke="#6E5649" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>`; }).join('')}
${Array.from({ length: 8 }, (_, i) => `<path d="M${(i * 113) % 390 + 4} ${132 + ((i * 29) % 80)} h6 M${(i * 113) % 390 + 6} ${135 + ((i * 29) % 80)} h5" stroke="#6E5649" stroke-width="1" opacity=".55"/>`).join('')}
${env.sky === 'rain' || env.sky === 'night' ? '' : `<g class="toon-fly"><path d="M0 0 C-6 -8 -12 -2 -6 2 C-12 6 -6 10 0 4 C6 10 12 6 6 2 C12 -2 6 -8 0 0Z" fill="#FFC93C" stroke="${INK}" stroke-width="1.4"/></g>`}`
};
function bread(x, y, t) {
  if (t === 'melon') return `<g transform="translate(${x} ${y - 9})"><ellipse rx="12" ry="9.5" fill="#F4C55E" stroke="${INK}" stroke-width="2"/><path d="M-7 -6 L6 6 M-1 -9 L9 1 M-10 1 L-1 9 M4 -9 L-9 4" stroke="#D49A3A" stroke-width="1.3"/></g>`;
  if (t === 'croissant') return `<g transform="translate(${x} ${y - 7})"><path d="M-14 4 C-12 -10 12 -10 14 4 C8 -2 -8 -2 -14 4Z" fill="#E9A964" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M-5 -6 L-3 0 M3 -6 L2 0" stroke="#B8742F" stroke-width="1.4"/></g>`;
  if (t === 'pink') return `<g transform="translate(${x} ${y - 8})"><ellipse rx="11" ry="8.5" fill="#E9A964" stroke="${INK}" stroke-width="2"/><path d="M-8 -3 C-4 -8 4 -8 8 -3 C4 0 -4 0 -8 -3Z" fill="#FF9EBB"/><circle cx="0" cy="-6" r="2.4" fill="#F0457A"/></g>`;
  return `<g transform="translate(${x} ${y - 9})"><path d="M-14 8 C-16 -8 -8 -10 0 -10 C8 -10 16 -8 14 8Z" fill="#D99A55" stroke="${INK}" stroke-width="2"/><path d="M-6 -6 L-3 0 M1 -7 L4 -1 M8 -6 L10 -1" stroke="#B8742F" stroke-width="1.6"/></g>`;
}
SCENES.end = (env, E) => SCENES.title(Object.assign({}, env, { text: env.text || 'おしまい' }), E);
const COUNTER = `<g><rect x="238" y="146" width="170" height="90" rx="10" fill="#E9B98A" stroke="${INK}" stroke-width="2.8"/><path d="M238 158 H408" stroke="#D49A6A" stroke-width="3"/><rect x="252" y="166" width="140" height="34" rx="6" fill="#DFF1FF" stroke="${INK}" stroke-width="2.2"/>${bread(276, 194, 'melon')}${bread(306, 194, 'pink')}${bread(338, 194, 'croissant')}${bread(368, 194, 'loaf')}<g transform="translate(372 134)"><rect x="-16" y="-10" width="32" height="22" rx="4" fill="#9FD3FF" stroke="${INK}" stroke-width="2.2"/><rect x="-10" y="-6" width="20" height="7" rx="2" fill="#E6F6FF"/></g></g>`;

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- Effekter over hovedet ----------
function fxSVG(f, p, top) {
  const y = -top - 8;
  const pop = Math.min(1, p * 6);
  const sc = (0.4 + 0.6 * pop) * (p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1);
  const font = `font-family="'M PLUS Rounded 1c', sans-serif" font-weight="900"`;
  switch (f) {
    case '!': return `<g transform="translate(18 ${y}) scale(${sc})"><path d="M0 -20 L0 -6" stroke="${INK}" stroke-width="5.4" stroke-linecap="round"/><path d="M0 -20 L0 -6" stroke="#FFC93C" stroke-width="2.6" stroke-linecap="round"/><circle cx="0" cy="1" r="3" fill="#FFC93C" stroke="${INK}" stroke-width="1.6"/><path d="M-12 -18 l-5 -4 M12 -18 l5 -4 M-14 -8 h-6 M14 -8 h6" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/></g>`;
    case '?': return `<g transform="translate(20 ${y + Math.sin(p * 12) * 1.5}) scale(${sc}) rotate(${Math.sin(p * 8) * 8})"><text x="0" y="0" text-anchor="middle" ${font} font-size="22" fill="#8C7CF0" stroke="${INK}" stroke-width="1.2">?</text></g>`;
    case 'dots': return `<g transform="translate(22 ${y})">${[0, 1, 2].map((i) => `<circle cx="${i * 7 - 7}" cy="0" r="2.4" fill="${INK}" opacity="${((p * 3 - i * 0.3) % 1) > 0.2 ? 1 : 0.2}"/>`).join('')}</g>`;
    case 'heart': return [0, 1, 2].map((i) => { const q = clamp(p * 1.3 - i * 0.18, 0, 1); if (q <= 0) return ''; return `<g transform="translate(${-14 + i * 14 + Math.sin(q * 9 + i) * 4} ${y + 6 - q * 34}) scale(${0.7 + (i % 2) * 0.3})" opacity="${1 - q}"><path d="M0 6 C-10 -1 -5 -9 0 -4 C5 -9 10 -1 0 6Z" fill="#F0457A" stroke="${INK}" stroke-width="1.4"/></g>`; }).join('');
    case 'note': return [0, 1].map((i) => { const q = clamp(p * 1.2 - i * 0.25, 0, 1); if (q <= 0) return ''; return `<g transform="translate(${16 + i * 10 + Math.sin(q * 8) * 5} ${y + 8 - q * 30})" opacity="${1 - q * 0.9}"><text ${font} font-size="${16 - i * 3}" fill="#5B47D6">♪</text></g>`; }).join('');
    case 'sweat': return `<g transform="translate(26 ${y + 30 + p * 6})" opacity="${1 - p * 0.5}"><path d="M0 -8 C4 -2 5 2 0 4 C-5 2 -4 -2 0 -8Z" fill="#8CC8FF" stroke="${INK}" stroke-width="1.4"/></g>`;
    case 'spark': return [[-24, 10], [24, 2], [0, -6], [30, 30]].map(([sx, sy], i) => { const s = Math.abs(Math.sin(p * 10 + i * 1.7)); return `<path transform="translate(${sx} ${y + 24 + sy}) scale(${0.5 + s * 0.7})" d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6Z" fill="#FFC93C" stroke="${INK}" stroke-width=".8"/>`; }).join('');
    case 'zzz': return [0, 1, 2].map((i) => { const q = ((p * 2.5) + i / 3) % 1; return `<text x="${16 + q * 14}" y="${y + 12 - q * 24}" ${font} font-size="${9 + i * 2}" fill="#5B47D6" opacity="${1 - q}">z</text>`; }).join('');
    case 'tear': return [-11, 11].map((x) => `<path d="M${x} ${-top + 40} q${x > 0 ? 3 : -3} ${8 + (p * 30) % 10} 0 ${14 + (p * 30) % 10}" fill="none" stroke="#8CC8FF" stroke-width="3.4" stroke-linecap="round" opacity=".9"/>`).join('');
    case 'anger': return `<g transform="translate(24 ${y + 16}) scale(${sc * (1 + Math.sin(p * 30) * 0.08)})"><path d="M-6 -2 Q-2 -2 -2 -6 M2 -6 Q2 -2 6 -2 M6 2 Q2 2 2 6 M-2 6 Q-2 2 -6 2" fill="none" stroke="#F0457A" stroke-width="2.6" stroke-linecap="round"/></g>`;
    case 'idea': return `<g transform="translate(0 ${y - 4}) scale(${sc})"><path d="M-12 -18 l-4 -4 M12 -18 l4 -4 M0 -24 v-5 M-16 -8 h-5 M16 -8 h5" stroke="#FFC93C" stroke-width="2.2" stroke-linecap="round"/><path d="M0 -20 C9 -20 11 -10 5 -4 V1 H-5 V-4 C-11 -10 -9 -20 0 -20Z" fill="#FFE27A" stroke="${INK}" stroke-width="2"/><path d="M-4 4 H4" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/></g>`;
  }
  return '';
}

// ---------- Tidslinje ----------
function parseAct(s) {
  const out = { face: null, motion: null, fx: [], item: undefined };
  String(s || '').split(/\s+/).filter(Boolean).forEach((w) => {
    if (FACES.includes(w)) out.face = w;
    else if (w in MOTIONS) out.motion = w;
    else if (FX.includes(w)) out.fx.push(w);
  });
  return out;
}

function buildTimeline(E) {
  const cast = Object.keys(E.characters || {}).filter((k) => BODIES[k]);
  let cues = (E.cues && E.cues.length) ? E.cues.slice() : null;
  if (!cues) {
    // Ældre afsnit uden tidslinje: stil figurerne op i stuen og lad dem reagere lidt selv
    const pos = {}; cast.forEach((k, i) => { pos[k] = cast.length === 1 ? 200 : 120 + (i * 160) / Math.max(1, cast.length - 1); });
    cues = [{ t: 0, scene: 'room', pos }];
    (E.lines || []).forEach((l) => { if (/[！!]/.test(l.jp)) cues.push({ t: l.start, act: { [l.speaker]: 'happy hop' } }); else if (/[？?]/.test(l.jp)) cues.push({ t: l.start, act: { [l.speaker]: 'think' } }); });
  }
  cues.sort((a, b) => a.t - b.t);

  const envs = [];
  let env = { scene: 'room', sky: 'day', props: [], t: 0 };
  const ch = {}; cast.forEach((k) => { ch[k] = { segs: [], faces: [], motions: [], fxs: [], items: [], faceCue: [], vis: [] }; });
  const xNow = (k, t) => { const s = ch[k].segs; if (!s.length) return null; const g = s[s.length - 1]; return lerp(g.x0, g.x1, clamp((t - g.t0) / g.dur, 0, 1)); };
  const visNow = (k) => { const v = ch[k].vis; return v.length ? v[v.length - 1].on : false; };
  const cams = [];

  for (const c of cues) {
    const t = c.t;
    const fx = [].concat(c.fx || []);
    if (c.scene) {
      env = { scene: c.scene, sky: c.sky || (c.scene === 'room' || c.scene === 'bakery' ? 'day' : 'day'), props: c.props || [], text: c.text || '', t, sceneT: t, rainbowT: null, darkT: null, dark: false, confettiT: null, linesT: null, candles: false };
      cast.forEach((k) => { if (!(c.pos && k in c.pos)) { ch[k].vis.push({ t, on: false }); } ch[k].faces.push({ t, face: 'idle' }); ch[k].motions.push({ t, m: null }); ch[k].items.push({ t, item: null }); });
      cams.push({ t, z: 1, on: null, x: 200, cut: true });
    } else {
      env = Object.assign({}, env, { t });
      if (c.sky) env.sky = c.sky;
      if (c.props) env.props = c.props;
    }
    fx.forEach((f) => {
      if (f === 'rainbow') env.rainbowT = t; else if (f === 'norainbow') env.rainbowT = null;
      else if (f === 'dark') { env.dark = true; env.darkT = t; } else if (f === 'light') { env.dark = false; env.darkT = t; }
      else if (f === 'confetti') env.confettiT = t;
      else if (f === 'lines') env.linesT = t;
      else if (f === 'candles') env.candles = true; else if (f === 'nocandles') env.candles = false;
    });
    envs.push(env);

    if (c.pos) for (const k of Object.keys(c.pos)) {
      if (!ch[k]) continue;
      let v = c.pos[k];
      const run = c.act && /\brun\b/.test(c.act[k] || '');
      const seen = visNow(k) && !c.scene;
      let x0, x1;
      if (Array.isArray(v)) { x0 = v[0]; x1 = v[1]; }
      else if (v === 'outL' || v === 'outR' || v === 'out') { x0 = seen ? xNow(k, t) : 200; x1 = v === 'outL' ? -70 : v === 'outR' ? 470 : (x0 < 200 ? -70 : 470); }
      else { x1 = v; x0 = c.scene ? v : seen ? xNow(k, t) : (v < 200 ? -60 : 460); }
      const dur = Math.max(0.35, Math.abs(x1 - x0) / (run ? 150 : 75));
      ch[k].segs.push({ t0: t, x0, x1, dur: x0 === x1 ? 0.001 : dur });
      ch[k].vis.push({ t, on: true });
    }
    if (c.face) for (const k of Object.keys(c.face)) {
      if (!ch[k]) continue;
      if (!ch[k].faceDir) ch[k].faceDir = [];
      ch[k].faceDir.push({ t, d: c.face[k] });
    }
    if (c.act) for (const k of Object.keys(c.act)) {
      if (!ch[k]) continue;
      const a = parseAct(c.act[k]);
      if (a.face) ch[k].faces.push({ t, face: a.face });
      ch[k].motions.push({ t, m: a.motion });
      a.fx.forEach((f) => ch[k].fxs.push({ t, f }));
    }
    if (c.hold) for (const k of Object.keys(c.hold)) if (ch[k]) ch[k].items.push({ t, item: c.hold[k] });
    if (c.cam) {
      const cm = c.cam === 'wide' ? { z: 1, on: null, x: 200 } : { z: c.cam.z || 1.5, on: c.cam.on || null, x: c.cam.x != null ? c.cam.x : 200 };
      cams.push(Object.assign({ t }, cm));
    }
  }
  return { cast, envs, ch, cams };
}

const lastAt = (arr, t) => { let r = null; for (let i = 0; i < arr.length; i++) { if (arr[i].t <= t) r = arr[i]; else break; } return r; };
const lastIdx = (arr, t, key = 't') => { let r = -1; for (let i = 0; i < arr.length; i++) { if (arr[i][key] <= t) r = i; else break; } return r; };

// ---------- Selve motoren ----------
export function mountCartoon(host, E, getTime, isPlaying, { still = false } = {}) {
  let TL = buildTimeline(E);
  host.classList.add('toon');
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${defs()}
<g data-l="cam"><g data-l="bg"></g><g data-l="back"></g><g data-l="chars">${TL.cast.map(charSVG).join('')}</g><g data-l="front"></g><g data-l="weather"></g></g>
<rect data-l="dark" width="${W}" height="${H}" fill="#191433" opacity="0"/><circle data-l="glow" r="70" fill="url(#toon-glow)" opacity="0"/>
<g data-l="lines"></g><g data-l="confetti"></g><rect data-l="fade" width="${W}" height="${H}" fill="#fff" opacity="0"/></svg>`;
  const q = (s) => host.querySelector(s);
  const L = { cam: q('[data-l=cam]'), bg: q('[data-l=bg]'), back: q('[data-l=back]'), front: q('[data-l=front]'), weather: q('[data-l=weather]'), dark: q('[data-l=dark]'), glow: q('[data-l=glow]'), confetti: q('[data-l=confetti]'), lines: q('[data-l=lines]'), fade: q('[data-l=fade]') };
  const R_ = {};
  TL.cast.forEach((k) => {
    const g = q(`[data-ch="${k}"]`);
    const p = (n) => g.querySelector(`[data-p="${n}"]`);
    const parts = {};
    BODIES[k].parts.forEach((pt) => { parts[pt.id] = Array.from(g.querySelectorAll(`[data-p="${pt.id}"]`)); });
    R_[k] = { g, bob: p('bob'), face: p('face'), item: p('item'), fx: p('fx'), talk: p('talk'), shy: p('shy'), parts, phys: {}, eyes: g.querySelectorAll('[data-eye]'), mouths: g.querySelectorAll('[data-mouth]'), last: {} };
  });
  let envKey = '', propKey = '', fxKey = {}, confKey = '', linesKey = -1, lastT = -1, frameDt = 0.016, lastNow = performance.now();
  const seed = (k) => k.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  let raf = 0, dead = false;
  const start = performance.now();

  function camAt(t, xs) {
    const i = lastIdx(TL.cams, t);
    if (i < 0) return { z: 1, cx: 200 };
    const target = (c, tt) => ({ z: c.z, cx: c.on && xs[c.on] != null ? xs[c.on] : c.x });
    const c = TL.cams[i];
    const to = target(c, t);
    if (c.cut || i === 0) return to;
    const prev = TL.cams[i - 1];
    const from = target(prev, c.t);
    const k = ease((t - c.t) / 0.9);
    return { z: lerp(from.z, to.z, k), cx: lerp(from.cx, to.cx, k) };
  }

  function draw() {
    if (dead) return;
    const t = getTime() || 0;
    const now = performance.now();
    frameDt = (now - lastNow) / 1000; lastNow = now;
    const w = (now - start) / 1000;
    const playing = isPlaying();
    const env = lastAt(TL.envs, t) || TL.envs[0];

    // Baggrund og ting
    const ek = env.scene + '|' + env.sky + '|' + env.text;
    if (ek !== envKey) { envKey = ek; L.bg.innerHTML = (SCENES[env.scene] || SCENES.room)(env, E); L.weather.innerHTML = env.sky === 'rain' && env.scene !== 'room' && env.scene !== 'bakery' ? `<g class="toon-rain">${Array.from({ length: 60 }, (_, i) => `<path d="M${(i * 53) % 420 - 10} ${(i * 37) % 240 - 20} l-5 13" stroke="#E4ECFF" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>`).join('')}</g>` : ''; }
    const pk = env.scene + '|' + env.props.join(',') + '|' + env.candles;
    if (pk !== propKey) {
      propKey = pk;
      const parts = { back: '', front: env.scene === 'bakery' ? COUNTER : '' };
      env.props.forEach((p) => { const [n, x, y] = String(p).split('@'); const P = PROPS[n]; if (P) parts[P.layer] += P.svg(Number(x) || 200, env, Number(y) || 0); });
      L.back.innerHTML = parts.back; L.front.innerHTML = parts.front;
    }
    const rb = L.bg.querySelector('[data-p=rainbow]');
    if (rb) rb.setAttribute('opacity', env.rainbowT != null ? ease((t - env.rainbowT) / 2.2).toFixed(3) : 0);
    const darkK = env.darkT != null ? ease((t - env.darkT) / 0.6) : 1;
    const darkV = env.dark ? lerp(0, 0.74, darkK) : (env.darkT != null ? lerp(0.74, 0, darkK) : 0);
    L.dark.setAttribute('opacity', darkV.toFixed(3));
    const cake = env.props.find((p) => String(p).startsWith('cake'));
    if (cake && env.candles && darkV > 0.05) { L.glow.setAttribute('cx', Number(String(cake).split('@')[1]) || 200); L.glow.setAttribute('cy', (Number(String(cake).split('@')[2]) || GROUND - 26) - 34); L.glow.setAttribute('opacity', (darkV * (0.9 + Math.sin(w * 13) * 0.08)).toFixed(3)); } else L.glow.setAttribute('opacity', 0);
    L.fade.setAttribute('opacity', env.sceneT ?(1 - ease((t - env.sceneT) / 0.45)).toFixed(3) : 0);
    const ck = env.confettiT != null && t - env.confettiT < 6 ? String(env.confettiT) : '';
    if (ck !== confKey) { confKey = ck; L.confetti.innerHTML = ck ? Array.from({ length: 46 }, (_, i) => `<rect class="toon-confetti" style="animation-delay:${(i % 12) * 0.12}s;animation-duration:${2.4 + (i % 5) * 0.4}s" x="${(i * 89) % 400}" y="-12" width="${5 + (i % 3)}" height="${8 - (i % 3)}" rx="1.4" fill="${['#FF9EBB', '#FFC93C', '#9FD3FF', '#B9E8A8', '#B9A2FF'][i % 5]}"/>`).join('') : ''; }

    // Hvem taler nu?
    let talkK = null, amp = 0;
    const li = lastIdx(E.lines || [], t, 'start');
    if (li >= 0) {
      const l = E.lines[li];
      if (t <= l.end && playing) {
        talkK = l.speaker;
        if (l.m) { const d = l.m.charCodeAt(Math.min(l.m.length - 1, Math.floor((t - l.start) / 0.05))) - 48; amp = clamp(d / 9, 0, 1); }
        else amp = 0.5 + Math.sin(t * 22) * 0.5;
      }
    }

    // Figurerne
    const xs = {};
    TL.cast.forEach((k) => { const C = TL.ch[k]; const s = C.segs[lastIdx(C.segs, t, 't0')]; if (s) xs[k] = lerp(s.x0, s.x1, clamp((t - s.t0) / s.dur, 0, 1)); });
    const jumped = Math.abs(t - lastT) > 0.4; // spoling: lad fjedrene springe direkte på plads
    TL.cast.forEach((k) => {
      const C = TL.ch[k], Rk = R_[k], B = BODIES[k], sc = B.scale || 1, P = Rk.phys;
      const vis = lastAt(C.vis, t);
      const on = !!(vis && vis.on) && xs[k] != null;
      if (Rk.last.on !== on) { Rk.g.setAttribute('display', on ? 'inline' : 'none'); Rk.last.on = on; }
      if (!on) return;
      const seg = C.segs[lastIdx(C.segs, t, 't0')];
      const walking = seg && t < seg.t0 + seg.dur && seg.x0 !== seg.x1;
      const x = xs[k];
      // retning (1 = mod højre, -1 = mod venstre)
      let dir = 1;
      const fd = C.faceDir ? lastAt(C.faceDir, t) : null;
      if (walking) dir = seg.x1 >= seg.x0 ? 1 : -1;
      else if (fd && fd.d) dir = fd.d === 'left' ? -1 : 1;
      else {
        let best = null;
        TL.cast.forEach((o) => { if (o === k || xs[o] == null) return; const ov = lastAt(TL.ch[o].vis, t); if (!ov || !ov.on || xs[o] < -30 || xs[o] > 430) return; if (best == null || Math.abs(xs[o] - x) < Math.abs(best - x)) best = xs[o]; });
        dir = best == null ? 0 : best >= x ? 1 : -1;
      }
      const face = (lastAt(C.faces, t) || { face: 'idle' }).face;
      const mo = lastAt(C.motions, t);
      const motion = mo && mo.m;
      const mt = mo ? t - mo.t : 0;
      const loopT = playing ? t : w;
      const ph = seed(k);

      // Mål for stillingen. Arme: f = forreste arm, b = bagerste (negativ = op/ud).
      let y = 0, sqx = 1, sqy = 1 + Math.sin(w * 2.2 + ph) * 0.014, lean = Math.sin(w * 0.9 + ph) * 1.2;
      let f = -16, b = -16, legL = 0, legR = 0, jx = 0, fx2 = 0, fy2 = 0, earT = 0;
      if (walking) {
        const fast = Math.abs(seg.x1 - seg.x0) / seg.dur > 100;
        const wp = (t - seg.t0) * (fast ? 17 : 11.5);
        y -= Math.abs(Math.sin(wp)) * (fast ? 4 : 2.6);
        legL = -Math.max(0, Math.sin(wp)) * 4.5; legR = -Math.max(0, -Math.sin(wp)) * 4.5;
        lean = Math.sin(wp) * 6 + dir * (fast ? 7 : 3);
        f = -16 + Math.sin(wp) * 22; b = -16 - Math.sin(wp) * 22;
        earT = Math.cos(wp) * 6;
      }
      if (motion) {
        const dur = MOTIONS[motion];
        const p = dur ? mt / dur : 0;
        const active = LOOPED[motion] || (dur && p < 1);
        if (active) {
          if (motion === 'jump' || motion === 'jump2' || motion === 'hop') {
            const per = motion === 'hop' ? 0.42 : 0.6, hh = motion === 'hop' ? 9 : 24;
            const pp = (mt % per) / per;
            const air = Math.sin(Math.PI * pp);
            y -= air * hh;
            const land = Math.max(0, 1 - pp / 0.16) + Math.max(0, (pp - 0.86) / 0.14);
            sqy *= 1 + air * 0.07 - land * 0.13; sqx *= 1 - air * 0.04 + land * 0.11;
            f = -70 - air * 50; b = -70 - air * 50;
          } else if (motion === 'wave') { f = -150 + Math.sin(mt * 11) * 26; lean += Math.sin(mt * 5.5) * 3; }
          else if (motion === 'nod') { fy2 = Math.abs(Math.sin(p * Math.PI * 3)) * 3.5; sqy *= 1 - Math.abs(Math.sin(p * Math.PI * 3)) * 0.03; }
          else if (motion === 'shake') fx2 = Math.sin(p * Math.PI * 5) * 4;
          else if (motion === 'point') f = -92 + Math.sin(mt * 4) * 4;
          else if (motion === 'cheer') { const c = Math.abs(Math.sin(mt * 9)); f = -150 + c * 20; b = -150 + c * 20; y -= c * 5; }
          else if (motion === 'bow') { const bw = Math.sin(clamp(p, 0, 1) * Math.PI); lean += dir * bw * 14; fy2 = bw * 4; }
          else if (motion === 'dance') { const s = Math.sin(loopT * 6.5); lean += s * 10; y -= Math.abs(s) * 6; f = -90 + s * 50; b = -90 - s * 50; }
          else if (motion === 'bounce') { y -= Math.abs(Math.sin(loopT * 8)) * 6; f = -40; b = -40; }
          else if (motion === 'tremble') { jx = Math.sin(loopT * 70) * 0.8; f = 6; b = 6; sqx *= 0.97; }
          else if (motion === 'eat') { f = -128 + Math.sin(loopT * 9) * 14; fy2 = Math.max(0, Math.sin(loopT * 9)) * 1.2; }
          else if (motion === 'clap') { const c = Math.abs(Math.sin(loopT * 9)); f = -60 + c * 24; b = -60 + c * 24; }
        }
      }
      if (talkK === k) { y -= amp * 1.4; sqy *= 1 + amp * 0.025; lean += Math.sin(t * 6 + ph) * 2; }
      if (face === 'sad' || face === 'cry') { earT += 26; f = Math.max(f, -8); b = Math.max(b, -8); sqy *= 0.97; }
      if (face === 'happy' || face === 'laugh' || face === 'love') earT += Math.sin(w * 8) * 4;

      // Fjedre: giver bløde overgange og efterslæb (ører, arme, drejning)
      const dt = Math.min(0.05, Math.max(0.001, frameDt));
      const spring = (key, target, kk, cc) => {
        if (jumped || P[key] == null) { P[key] = target; P[key + 'v'] = 0; return target; }
        P[key + 'v'] += (kk * (target - P[key]) - cc * P[key + 'v']) * dt;
        P[key] += P[key + 'v'] * dt;
        return P[key];
      };
      const tau = spring('tau', dir, 55, 12);
      const leanS = spring('lean', lean, 120, 13);
      const fS = spring('f', f, 260, 17), bS = spring('b', b, 220, 16);
      const vy = P.lastY == null || jumped ? 0 : (y - P.lastY) / dt; P.lastY = y;
      const earS = spring('ear', earT + clamp(vy * 0.05, -22, 22), 90, 7);

      // forreste arm er den i den retning figuren kigger
      const right = tau >= 0;
      const aR = right ? fS : bS, aL = right ? -bS : -fS;
      Rk.g.setAttribute('transform', `translate(${(x + jx).toFixed(2)} ${GROUND}) scale(${sc})`);
      Rk.bob.setAttribute('transform', `translate(0 ${y.toFixed(2)}) ${R(leanS, 0, 0)} scale(${sqx.toFixed(3)} ${sqy.toFixed(3)})`);
      const part = (id, tr) => { const els = Rk.parts[id]; if (els) for (const e of els) e.setAttribute('transform', tr); };
      const piv = (id) => (B.parts.find((p) => p.id === id) || {}).piv || [0, 0];
      const pL = piv('armL'), pR = piv('armR');
      part('armL', R(aL, pL[0], pL[1]));
      part('armR', R(aR, pR[0], pR[1]));
      part('legL', `translate(0 ${legL.toFixed(2)})`);
      part('legR', `translate(0 ${legR.toFixed(2)})`);
      const happy = face === 'happy' || face === 'laugh' || face === 'love' || motion === 'dance';
      const wag = Math.sin(w * (happy ? 9 : 2.6) + ph) * (happy ? 14 : 6);
      const tp = piv('tail');
      part('tail', `translate(${(-tau * 2).toFixed(2)} 0) scale(${(-tau).toFixed(3)} 1) ${R(wag, tp[0] + 22, tp[1])}`);
      const eL = piv('earL'), eR = piv('earR');
      part('earL', `translate(${(tau * 2.5).toFixed(2)} 0) ${R(-earS, eL[0], eL[1])}`);
      part('earR', `translate(${(tau * 2.5).toFixed(2)} 0) ${R(earS, eR[0], eR[1])}`);
      part('hat', `translate(${(tau * 2.5).toFixed(2)} 0) ${R(-earS * 0.3, 0, -100)}`);
      // ansigtet glider til siden, så figuren ser ud til at dreje sig
      const fxo = tau * 6.5 + fx2, fyo = fy2;
      Rk.face.setAttribute('transform', `translate(${fxo.toFixed(2)} ${fyo.toFixed(2)})`);

      // ansigt
      const blink = (w + ph * 0.37) % 3.8 < 0.12;
      let eye = { idle: 'open', happy: 'happy', laugh: 'happy', surprised: 'surprised', sad: 'sad', cry: 'tight', pout: 'pout', shy: 'happy', think: 'up', sleep: 'closed', love: 'heart', yum: 'happy' }[face] || 'open';
      if (blink && (eye === 'open' || eye === 'up' || eye === 'sad' || eye === 'pout')) eye = 'closed';
      let mouth = { idle: 'smile', happy: 'grin', laugh: 'grin', surprised: 'o', sad: 'frown', cry: 'frown', pout: 'pout', shy: 'smile', think: 'pout', sleep: 'o', love: 'grin', yum: 'smile' }[face] || 'smile';
      if (face === 'yum' || motion === 'eat') mouth = Math.sin(loopT * 9) > 0 ? 'o' : 'smile';
      if (talkK === k) { mouth = 'talk'; Rk.talk.setAttribute('ry', (0.8 + amp * 4.2).toFixed(2)); Rk.talk.setAttribute('rx', (2.8 + amp * 1.4).toFixed(2)); }
      if (Rk.last.eye !== eye) { Rk.eyes.forEach((e) => e.setAttribute('display', e.dataset.eye === eye ? 'inline' : 'none')); Rk.last.eye = eye; }
      if (Rk.last.mouth !== mouth) { Rk.mouths.forEach((e) => e.setAttribute('display', e.dataset.mouth === mouth ? 'inline' : 'none')); Rk.last.mouth = mouth; }
      const shy = face === 'shy' || face === 'love';
      if (Rk.last.shy !== shy) { Rk.shy.setAttribute('display', shy ? 'inline' : 'none'); Rk.last.shy = shy; }

      // ting i den forreste hånd
      const it = (lastAt(C.items, t) || {}).item || '';
      if (Rk.last.item !== it) { Rk.item.innerHTML = ITEMS[it] || ''; Rk.last.item = it; }
      if (it) {
        const pv = right ? pR : pL, a = (right ? aR : aL) * Math.PI / 180, L2 = B.arm.len + B.arm.r * 0.6;
        const hx = pv[0] + -Math.sin(a) * L2, hy = pv[1] + Math.cos(a) * L2;
        Rk.item.setAttribute('transform', `translate(${hx.toFixed(2)} ${hy.toFixed(2)}) scale(${right ? 1 : -1} 1)`);
      }

      // effekter (vises ca. 2,4 sek.)
      const act = C.fxs.filter((ff) => t >= ff.t && t - ff.t < 2.4);
      if (face === 'sleep') act.push({ f: 'zzz', t: Math.floor(t / 2.4) * 2.4 });
      if (face === 'cry') act.push({ f: 'tear', t: Math.floor(t / 2.4) * 2.4 });
      const html = act.map((ff) => fxSVG(ff.f, (t - ff.t) / 2.4, B.top)).join('');
      if (html || fxKey[k]) { Rk.fx.innerHTML = html; Rk.fx.setAttribute('transform', `translate(${(fxo + y * 0).toFixed(1)} ${y.toFixed(1)})`); fxKey[k] = !!html; }
    });
    lastT = t;

    // Fartlinjer (ved store overraskelser)
    const lk = env.linesT != null && t - env.linesT < 1.8 && t >= env.linesT ? Math.floor((t - env.linesT) / 0.12) : -1;
    if (lk !== linesKey) {
      linesKey = lk;
      L.lines.innerHTML = lk < 0 ? '' : Array.from({ length: 34 }, (_, i) => { const a = (i / 34) * Math.PI * 2 + (lk % 3) * 0.05; const r0 = 120 + ((i * 37 + lk * 13) % 40); return `<path d="M${200 + Math.cos(a) * r0} ${112 + Math.sin(a) * r0 * 0.62} L${200 + Math.cos(a - 0.03) * 320} ${112 + Math.sin(a - 0.03) * 320} L${200 + Math.cos(a + 0.03) * 320} ${112 + Math.sin(a + 0.03) * 320}Z" fill="#5A4048" opacity=".55"/>`; }).join('');
    }

    // Kamera
    const cam = camAt(t, xs);
    const vw = W / cam.z;
    const cx = clamp(cam.cx, vw / 2, W - vw / 2);
    const vh = H / cam.z;
    const cy = clamp(GROUND - 62, vh / 2, H - vh / 2);
    L.cam.setAttribute('transform', cam.z === 1 ? '' : `translate(${W / 2} ${H / 2}) scale(${cam.z.toFixed(3)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`);

    if (!still) raf = requestAnimationFrame(draw);
  }
  if (still) draw(); else raf = requestAnimationFrame(draw);
  const stop = () => { dead = true; cancelAnimationFrame(raf); };
  // Live-styring (bruges af opkaldet med Lulu): tilføj en cue på et givet tidspunkt
  stop.cue = (c) => { E.cues = (E.cues || []).concat([c]); TL = buildTimeline(E); };
  return stop;
}

// Forside til et afsnit: ét stillbillede tegnet ud fra afsnittets "cover" i index.json
export function renderCover(host, ep) {
  const c = ep && ep.cover;
  if (!c) return false;
  const chars = {};
  (ep.cast || []).forEach((k) => { chars[k] = {}; });
  const { t = 0.3, ...cue } = c;
  const E = { title: ep.title, characters: chars, cues: [Object.assign({ t: 0 }, cue)], lines: [] };
  mountCartoon(host, E, () => t, () => false, { still: true });
  return true;
}

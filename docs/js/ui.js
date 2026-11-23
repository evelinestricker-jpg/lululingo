import { db } from './store.js';
import { isPiper, sayPiper, stopPiper, unlockAudio } from './voice.js';

// Små hjælpere til skærmene: sikker tekst, ikoner, figurer, ark, beskeder og oplæsning.
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

const P = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
  prev: '<path d="M6 5v14"/><path d="M18 6l-8 6 8 6z"/>',
  next: '<path d="M18 5v14"/><path d="M6 6l8 6-8 6z"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cards: '<rect x="7" y="3" width="13" height="16" rx="2.5"/><path d="M4 7v11a3 3 0 0 0 3 3h9"/>',
  chat: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 10h8M8 13h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z" fill="#FF9F1C" stroke="#7A4A00"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  replay: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  blocks: '<rect x="3" y="4" width="7" height="7" rx="2"/><rect x="14" y="4" width="7" height="7" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'
};

export function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

// Lulu, en lille maneki-neko-kat. mood: 'happy' (lukkede øjne) eller 'open'
export function lulu(size = 96, { mood = 'happy', talk = false } = {}) {
  const eyes = mood === 'open'
    ? '<circle cx="45" cy="62" r="6" fill="#241A3D"/><circle cx="75" cy="62" r="6" fill="#241A3D"/><circle cx="47" cy="60" r="2" fill="#fff"/><circle cx="77" cy="60" r="2" fill="#fff"/>'
    : '<path d="M38 64 Q45 56 52 64" fill="none" stroke="#241A3D" stroke-width="4" stroke-linecap="round"/><path d="M68 64 Q75 56 82 64" fill="none" stroke="#241A3D" stroke-width="4" stroke-linecap="round"/>';
  const mouth = talk
    ? '<ellipse class="mouth" cx="60" cy="83" rx="6" ry="5" fill="#CF2F66" stroke="#241A3D" stroke-width="2.5"/>'
    : '<path d="M53 80 Q56.5 85 60 80 Q63.5 85 67 80" fill="none" stroke="#241A3D" stroke-width="3" stroke-linecap="round"/>';
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
<path d="M18 60 L26 14 L56 36 Z" fill="#fff" stroke="#241A3D" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M102 60 L94 14 L64 36 Z" fill="#fff" stroke="#241A3D" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M28 26 L32 44 L44 36 Z" fill="#FFB3C8"/><path d="M92 26 L88 44 L76 36 Z" fill="#FFB3C8"/>
<ellipse cx="60" cy="66" rx="46" ry="38" fill="#fff" stroke="#241A3D" stroke-width="3.5"/>
<path d="M24 54 C30 38 46 31 58 32 C54 45 40 53 24 57 Z" fill="#FFB35C"/>
${eyes}
<ellipse cx="36" cy="77" rx="7" ry="4.5" fill="#FFB3C8"/><ellipse cx="84" cy="77" rx="7" ry="4.5" fill="#FFB3C8"/>
<path d="M56 72 L64 72 L60 76 Z" fill="#CF2F66"/>
${mouth}
<path d="M22 72 L8 69 M22 79 L9 81 M98 72 L112 69 M98 79 L111 81" stroke="#241A3D" stroke-width="2.5" stroke-linecap="round"/>
<path d="M30 98 Q60 112 90 98" fill="none" stroke="#CF2F66" stroke-width="7" stroke-linecap="round"/>
<circle cx="60" cy="106" r="7" fill="#FFC93C" stroke="#241A3D" stroke-width="2.5"/>
</svg>`;
}

// Momo, en kanin der elsker jordbær
export function momo(size = 96, { talk = false } = {}) {
  const mouth = talk
    ? '<ellipse class="mouth" cx="60" cy="90" rx="5" ry="4.5" fill="#CF2F66" stroke="#241A3D" stroke-width="2.5"/>'
    : '<path d="M54 88 Q57 92 60 88 Q63 92 66 88" fill="none" stroke="#241A3D" stroke-width="3" stroke-linecap="round"/>';
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
<path d="M36 52 C26 30 28 2 40 2 C52 2 54 30 50 50 Z" fill="#fff" stroke="#241A3D" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M84 52 C94 30 92 2 80 2 C68 2 66 30 70 50 Z" fill="#fff" stroke="#241A3D" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M40 12 C36 24 38 38 42 46 C46 36 46 22 40 12 Z" fill="#FFB3C8"/><path d="M80 12 C84 24 82 38 78 46 C74 36 74 22 80 12 Z" fill="#FFB3C8"/>
<ellipse cx="60" cy="74" rx="42" ry="34" fill="#fff" stroke="#241A3D" stroke-width="3.5"/>
<path d="M74 46 C80 40 90 42 90 50 C90 56 82 58 78 56 Z" fill="#CF2F66"/>
<path d="M80 44 L82 40 M86 44 L88 41" stroke="#17694A" stroke-width="2.5" stroke-linecap="round"/>
<path d="M40 72 Q46 66 52 72" fill="none" stroke="#241A3D" stroke-width="4" stroke-linecap="round"/>
<path d="M68 72 Q74 66 80 72" fill="none" stroke="#241A3D" stroke-width="4" stroke-linecap="round"/>
<ellipse cx="38" cy="84" rx="7" ry="4.5" fill="#FFB3C8"/><ellipse cx="82" cy="84" rx="7" ry="4.5" fill="#FFB3C8"/>
<ellipse cx="60" cy="80" rx="3.5" ry="2.5" fill="#CF2F66"/>
${mouth}
</svg>`;
}

export const CAST = {
  lulu: { name: 'ルル', da: 'Lulu', svg: (s, o) => lulu(s, Object.assign({ mood: 'open' }, o)) },
  momo: { name: 'モモ', da: 'Momo', svg: momo },
  pon: { name: 'ポン', da: 'Pon', svg: momo },
  narrator: { name: 'ナレーター', da: 'Fortæller', svg: () => '' }
};

export function sceneSVG() {
  return `<svg class="bg" viewBox="0 0 400 230" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<rect width="400" height="230" fill="#FFF4E8"/>
<rect x="140" y="20" width="120" height="90" rx="10" fill="#FFE1EB" stroke="#E7CDB8" stroke-width="6"/>
<circle cx="178" cy="58" r="18" fill="#FFB3C8"/><circle cx="212" cy="50" r="14" fill="#FFC6D6"/><circle cx="232" cy="74" r="12" fill="#FFB3C8"/>
<circle cx="340" cy="44" r="18" fill="#FFC93C"/>
<rect x="0" y="176" width="400" height="54" fill="#C9BEFA"/><rect x="0" y="170" width="400" height="10" fill="#B9AEF5"/>
</svg>`;
}

// Ark der glider op fra bunden
const sheetEl = () => document.getElementById('sheet');
let sheetClose = null;
export function openSheet(html, { label = 'Detaljer', onClose } = {}) {
  const s = sheetEl();
  s.querySelector('[role=dialog]').setAttribute('aria-label', label);
  document.getElementById('sheetBody').innerHTML = html;
  s.hidden = false;
  sheetClose = onClose || null;
  return document.getElementById('sheetBody');
}
export function closeSheet() {
  const s = sheetEl();
  if (s.hidden) return;
  s.hidden = true;
  document.getElementById('sheetBody').innerHTML = '';
  const f = sheetClose; sheetClose = null;
  if (f) f();
}
document.addEventListener('click', (e) => { if (e.target === sheetEl()) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

let toastT = null;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

// Stemmer: telefonens egne. Den stemme man har valgt under Indstillinger bruges først,
// ellers den bedste (Premium/Forbedret), ellers den første på sproget.
export function voicesFor(lang) {
  if (!('speechSynthesis' in window)) return [];
  return speechSynthesis.getVoices().filter((x) => x.lang && x.lang.toLowerCase().replace('_', '-').startsWith(lang));
}
export function pickVoice(lang) {
  const v = voicesFor(lang);
  const want = db.settings && db.settings.voices && db.settings.voices[lang];
  return (want && v.find((x) => x.voiceURI === want || x.name === want))
    || v.find((x) => /premium|enhanced|forbedret|siri/i.test(x.name)) || v[0] || null;
}
if ('speechSynthesis' in window) { try { speechSynthesis.getVoices(); speechSynthesis.addEventListener('voiceschanged', () => {}); } catch (e) {} }

// Japansk oplæsning med telefonens egen stemme (bruges til kana, kanji og Lulus chat)
export function speak(text, rate = 0.85, lang = 'ja') {
  try {
    const chosen = db.settings && db.settings.voices && db.settings.voices[lang];
    if (isPiper(chosen)) {
      unlockAudio();
      try { speechSynthesis.cancel(); } catch (e) {}
      stopPiper();
      sayPiper(lang, text, { rate: rate + 0.1 }).catch(() => {});
      return true;
    }
    if (!('speechSynthesis' in window)) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'ja' ? 'ja-JP' : lang === 'en' ? 'en-US' : 'da-DK';
    u.rate = rate;
    const best = pickVoice(lang);
    if (best) u.voice = best;
    speechSynthesis.speak(u);
    return true;
  } catch (e) { return false; }
}

export function fmtTime(s) {
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + (r < 10 ? '0' : '') + r;
}

export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

let indexCache = null;
const epCache = {};
export async function loadIndex() {
  if (!indexCache) indexCache = fetch('episodes/index.json').then((r) => r.json()).then((j) => j.episodes || []);
  return indexCache;
}
export async function loadEpisode(id) {
  if (!epCache[id]) epCache[id] = fetch('episodes/' + encodeURIComponent(id) + '/subtitles.json').then((r) => { if (!r.ok) throw new Error('mangler'); return r.json(); });
  return epCache[id];
}

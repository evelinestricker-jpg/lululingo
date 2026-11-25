// Lululingo – bygger de faste videoer (YouTube) til appen.
// To slags kilder i videos/<YouTube-id>/:
//   script.json – skrevet i hånden; ordene slås op i episodes/lexicon.json (som Lulu-afsnittene)
//   video.json  – lavet af appens AI (»Tilføj video«) og gemt med tools/serve.js (api/save-video)
// Resultat:   docs/videos/<YouTube-id>/subtitles.json og docs/videos/index.json
// Brug:       node tools/build-videos.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'videos');
const OUT = path.join(ROOT, 'docs', 'videos');
const lex = JSON.parse(fs.readFileSync(path.join(ROOT, 'episodes', 'lexicon.json'), 'utf8'));
const PUNCT = /^[。！？、…「」～!?,.\s]+$/;
const ID = /^[A-Za-z0-9_-]{11}$/;
// Kategorier i biblioteket (rækkefølgen er den, de vises i)
const CATEGORIES = ['easy', 'folk', 'anime', 'drama'];

const missing = new Set();
const problems = [];

// Ord adskilt med mellemrum -> tokens med læsning og betydning ("は@about" vælger en bestemt betydning)
function tokens(jp) {
  return jp.split(/\s+/).filter(Boolean).map((w) => {
    if (PUNCT.test(w)) return { w, p: true };
    const e = lex[w];
    if (!e) { missing.add(w); return null; }
    const t = { w: w.split('@')[0] };
    if (e[0]) t.r = e[0];
    return Object.assign(t, { ro: e[1], da: e[2], en: e[3], type: e[4], lvl: e[5] });
  });
}

function fromScript(s, dir) {
  return s.lines.map((l, i) => {
    if (!(l.end > l.start)) problems.push(`${dir}, replik ${i + 1}: "end" skal være efter "start"`);
    const tk = tokens(l.jp);
    return { n: i + 1, start: l.start, end: l.end, jp: tk.map((t) => (t ? t.w : '')).join(''), da: l.da, en: l.en, tokens: tk };
  });
}

// AI'en glemmer nogle gange betydningen af små ord (に, の …) – hent den fra ordbogen
function fill(t) {
  if (t.p) return t;
  const e = lex[t.w];
  if (!e) return t;
  if (!t.da) t.da = e[2];
  if (!t.en) t.en = e[3];
  if (!t.ro) t.ro = e[1];
  if ((!t.lvl || t.lvl === '–') && e[5] !== '–') t.lvl = e[5];
  return t;
}

function fromVideo(v, dir) {
  return v.lines.map((l, i) => {
    if (!(l.end >= l.start) || !Array.isArray(l.tokens) || !l.tokens.length) problems.push(`${dir}, replik ${i + 1} er ugyldig`);
    // Tankestreg for »ny person taler« fra YouTubes undertekster fjernes i starten af replikken
    const tk = l.tokens.map(fill).filter((t, k) => !(k === 0 && t.p && /^[-－‐—]+$/.test(t.w)));
    if (tk[0] && !tk[0].p) tk[0].w = tk[0].w.replace(/^[-－‐—]+/, '');
    const clean = (s) => String(s || '').replace(/^\s*[-－‐—]\s*/, '');
    return { n: i + 1, start: l.start, end: l.end, jp: tk.map((t) => t.w).join(''), da: clean(l.da), en: clean(l.en), tokens: tk.filter((t) => t.w) };
  });
}

const built = [];
const dirs = fs.readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
for (const dir of dirs) {
  const sFile = path.join(SRC, dir, 'script.json');
  const vFile = path.join(SRC, dir, 'video.json');
  const kind = fs.existsSync(sFile) ? 'script' : fs.existsSync(vFile) ? 'video' : '';
  if (!kind) continue;
  const s = JSON.parse(fs.readFileSync(kind === 'script' ? sFile : vFile, 'utf8'));
  const yt = s.yt || s.id || dir;
  if (!ID.test(yt)) { problems.push(`${dir}: "${yt}" er ikke et YouTube-id (11 tegn)`); continue; }
  const lines = kind === 'script' ? fromScript(s, dir) : fromVideo(s, dir);
  const category = CATEGORIES.includes(s.category) ? s.category : 'easy';
  const meta = { id: yt, title: s.title, titleDa: s.titleDa, titleEn: s.titleEn, level: s.level || 'N5', category, duration: Math.round(s.duration || 0), channel: s.channel || '', channelUrl: s.channelUrl || '' };
  built.push({ meta, lines, order: s.order || 0 });
}

if (missing.size) problems.push('Disse ord mangler i episodes/lexicon.json: ' + [...missing].join(', '));
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

fs.mkdirSync(OUT, { recursive: true });
for (const b of built) {
  fs.mkdirSync(path.join(OUT, b.meta.id), { recursive: true });
  fs.writeFileSync(path.join(OUT, b.meta.id, 'subtitles.json'), JSON.stringify(Object.assign({}, b.meta, { source: 'youtube', lines: b.lines })));
}
// Sortér efter kategori, så »order«, så sværhedsgrad
const lvl = (l) => ['N5', 'N4', 'N3', 'N2', 'N1'].indexOf(l);
built.sort((a, b) => CATEGORIES.indexOf(a.meta.category) - CATEGORIES.indexOf(b.meta.category) || a.order - b.order || lvl(a.meta.level) - lvl(b.meta.level));
const index = built.map((b) => Object.assign({}, b.meta, { lines: b.lines.length }));
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ videos: index }, null, 2) + '\n');
console.log(`${index.length} videoer bygget:\n` + index.map((v) => `  [${v.category}] ${v.id} ${v.level} ${v.lines} replikker – ${v.title}`).join('\n'));

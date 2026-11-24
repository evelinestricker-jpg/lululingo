// Lululingo – bygger de rigtige videoer (YouTube) til appen.
// Manuskript: videos/<YouTube-id>/script.json   Ordbog: episodes/lexicon.json (den samme som Lulu-afsnittene)
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

const index = [];
const dirs = fs.readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
for (const dir of dirs) {
  const file = path.join(SRC, dir, 'script.json');
  if (!fs.existsSync(file)) continue;
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const yt = s.yt || dir;
  if (!ID.test(yt)) { problems.push(`${dir}: "${yt}" er ikke et YouTube-id (11 tegn)`); continue; }
  const lines = s.lines.map((l, i) => {
    if (!(l.end > l.start)) problems.push(`${dir}, replik ${i + 1}: "end" skal være efter "start"`);
    const tk = tokens(l.jp);
    return { n: i + 1, start: l.start, end: l.end, jp: tk.map((t) => (t ? t.w : '')).join(''), da: l.da, en: l.en, tokens: tk };
  });
  const meta = { id: yt, title: s.title, titleDa: s.titleDa, titleEn: s.titleEn, level: s.level || 'N5', duration: s.duration, channel: s.channel || '', channelUrl: s.channelUrl || '' };
  index.push(Object.assign({}, meta, { lines: lines.length }));
  if (!missing.size && !problems.length) {
    fs.mkdirSync(path.join(OUT, yt), { recursive: true });
    fs.writeFileSync(path.join(OUT, yt, 'subtitles.json'), JSON.stringify(Object.assign({}, meta, { source: 'youtube', lines })));
  }
}

if (missing.size) problems.push('Disse ord mangler i episodes/lexicon.json: ' + [...missing].join(', '));
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ videos: index }, null, 2) + '\n');
console.log(`${index.length} videoer bygget: ` + index.map((v) => `${v.id} (${v.lines} replikker)`).join(', '));

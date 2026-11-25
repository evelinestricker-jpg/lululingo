// Egne videoer: hent undertekster fra YouTube, lav klikbare ord med AI, og gem det hele på telefonen.
import { db, save } from './store.js';

const ID = /^[A-Za-z0-9_-]{11}$/;
const VKEY = (id) => 'lululingo.video.' + id;

export function youtubeId(s) {
  s = String(s || '').trim();
  if (ID.test(s)) return s;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1, 12);
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/) || [])[1] || '';
    }
    return ID.test(id) ? id : '';
  } catch (e) { return ''; }
}

// Et YouTube-link hører ikke hjemme i feltet til undertekst-tjenesten
export function isYouTubeUrl(s) {
  return !!youtubeId(s) || /(^|\/\/|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)(\/|$)/i.test(String(s || ''));
}

// ---------- Gemte videoer ----------

export function myVideos() { return Array.isArray(db.myVideos) ? db.myVideos : []; }

export function getMyVideo(id) {
  try { return JSON.parse(localStorage.getItem(VKEY(id))); } catch (e) { return null; }
}

export function saveMyVideo(E) {
  try { localStorage.setItem(VKEY(E.id), JSON.stringify(E)); } catch (e) {
    throw new Error('Der er ikke mere plads på telefonen til videoer. Slet en video, du er færdig med, og prøv igen.');
  }
  const meta = { id: E.id, title: E.title, titleDa: E.titleDa, titleEn: E.titleEn, level: E.level, duration: E.duration, lines: E.lines.length, channel: E.channel, added: Date.now() };
  db.myVideos = [meta].concat(myVideos().filter((v) => v.id !== E.id));
  save();
}

export function deleteMyVideo(id) {
  try { localStorage.removeItem(VKEY(id)); } catch (e) {}
  db.myVideos = myVideos().filter((v) => v.id !== id);
  delete db.watched['yt:' + id];
  save();
}

// ---------- Undertekster ----------

// Adressen på undertekst-tjenesten (Cloudflare-workeren). Lokalt bruges den indbyggede i tools/serve.js.
export function captionsEndpoint() {
  const u = (db.settings.captionsUrl || '').trim();
  if (u && !isYouTubeUrl(u)) return u;
  return location.protocol === 'http:' ? 'api/captions' : '';
}

const CAPTIONS_FORMAT = 2; // 2 = automatiske undertekster delt i sætninger efter ordenes tider

export async function fetchCaptions(id) {
  const base = captionsEndpoint();
  if (!base) throw new Error('Automatisk hentning er ikke sat op endnu (se Indstillinger).');
  let res;
  // »f« er formatets version: når tjenesten ændres, hæves den, så browseren ikke genbruger et gammelt svar
  try { res = await fetch(base + (base.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(id) + '&f=' + CAPTIONS_FORMAT); } catch (e) {
    throw new Error('Kunne ikke nå undertekst-tjenesten. Tjek internettet og adressen under Indstillinger.');
  }
  let j = null;
  try { j = await res.json(); } catch (e) {}
  if (!res.ok || !j || j.error) {
    const err = new Error((j && j.message) || 'Undertekst-tjenesten svarede ' + res.status + '.');
    err.code = (j && j.error) || 'error';
    throw err;
  }
  j.segments = cleanSegments(j.segments || []);
  if (!j.segments.length) throw new Error('Videoen har ingen japanske undertekster, der kan bruges.');
  return j;
}

// Fjern lydmærker som [音楽] og [拍手], og tomme linjer
export function cleanSegments(segs) {
  return segs.map((s) => ({ start: +s.start || 0, end: +s.end || 0, text: String(s.text || '').replace(/\[[^\]]*\]|［[^］]*］|>>/g, ' ').replace(/\s+/g, ' ').trim() }))
    .filter((s) => s.text && /[぀-ヿ㐀-鿿０-９]/.test(s.text));
}

// Undertekster indsat som tekst: SRT, WebVTT eller YouTubes »Vis transskription« (0:01 + tekst)
export function parseSubtitleText(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map((l) => l.trim());
  const ts = (s) => { const p = s.replace(',', '.').split(':').map(Number); return p.reduce((a, b) => a * 60 + b, 0); };
  const segs = [];
  const arrow = /^((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})/;
  if (lines.some((l) => arrow.test(l))) {
    for (let i = 0; i < lines.length; i++) {
      const m = arrow.exec(lines[i]);
      if (!m) continue;
      const txt = [];
      while (i + 1 < lines.length && lines[i + 1] && !arrow.test(lines[i + 1])) txt.push(lines[++i]);
      segs.push({ start: ts(m[1]), end: ts(m[2]), text: txt.join(' ').replace(/<[^>]+>/g, '') });
    }
  } else {
    const stamp = /^(\d{1,2}(?::\d{2}){1,2})(?:\s+(.*))?$/;
    const noise = /^\d+\s*(sekund|second|minut|minute|time|hour|秒|分)/i;
    let cur = null;
    for (const l of lines) {
      const m = stamp.exec(l);
      if (m) { cur = { start: ts(m[1]), text: m[2] || '' }; segs.push(cur); continue; }
      if (cur && l && !noise.test(l)) cur.text += (cur.text ? ' ' : '') + l;
    }
    for (let i = 0; i < segs.length; i++) segs[i].end = i + 1 < segs.length ? segs[i + 1].start : segs[i].start + 4;
  }
  segs.sort((a, b) => a.start - b.start);
  return cleanSegments(segs);
}

// ---------- AI: ord, læsning og betydning ----------

const TYPES = ['Substantiv', 'Verbum', 'i-adjektiv', 'na-adjektiv', 'Adverbium', 'Partikel', 'Pronomen', 'Demonstrativ', 'Spørgeord', 'Konjunktion', 'Kopula', 'Hjælpeverbum', 'Udtryk', 'Navn', 'Tæller', 'Talord', 'Suffiks', 'Præfiks', 'Lydord'];
const LVLS = ['N5', 'N4', 'N3', 'N2', 'N1', '–'];
const str = { type: 'string' };
const SCHEMA = {
  type: 'object',
  properties: {
    title_da: str, title_en: str,
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'integer' }, to: { type: 'integer' }, da: str, en: str,
          tokens: {
            type: 'array',
            items: {
              type: 'object',
              properties: { w: str, punct: { type: 'boolean' }, r: str, ro: str, da: str, en: str, type: { type: 'string', enum: TYPES.concat(['']) }, lvl: { type: 'string', enum: LVLS.concat(['']) } },
              required: ['w', 'punct', 'r', 'ro', 'da', 'en', 'type', 'lvl'],
              additionalProperties: false
            }
          }
        },
        required: ['from', 'to', 'da', 'en', 'tokens'],
        additionalProperties: false
      }
    }
  },
  required: ['title_da', 'title_en', 'lines'],
  additionalProperties: false
};

const SYSTEM = `You prepare Japanese video subtitles for Lululingo, an app where Danish speakers learn Japanese by tapping the words in subtitles.

You get numbered subtitle segments (i, text) from one part of a video. Return "lines" in order. Each line covers consecutive segments from..to (inclusive). Normally one line per segment; merge consecutive segments only when one sentence is clearly split across them. Every segment index must be covered, in order, with no gaps.
If one segment contains several sentences (common in auto-generated captions), split it into several lines, one per sentence, and give each of those lines the same "from" and "to" (that segment's index). Keep each line to about one sentence.

For each line, split the Japanese into "tokens" so that joining all token "w" values gives the Japanese text of that line.
- Human-made captions (auto = false): keep the text exactly as written.
- Auto-generated captions (auto = true): fix obvious speech-recognition mistakes and add natural Japanese punctuation (、。？！), but do not invent content.

Token rules:
- One token per word as a learner would look it up. Keep conjugated verbs and adjectives together with their endings (食べました, 食べたい, 行かなければならない), keep particles separate (は, が, を …), keep numbers together with counters (３枚, １２時).
- Punctuation and symbols: "punct": true, "w" = the symbol(s), every other field "".
- "r": the reading in hiragana ONLY when "w" contains kanji, otherwise "".
- "ro": Hepburn romaji with macrons (ō, ū); the particles は = wa, へ = e, を = o.
- "da": a short Danish meaning that fits this sentence; for conjugated forms add the dictionary form, e.g. "spiste (fortid af 食べる)". "en": the same in short English.
- "type": the word class from the list. "lvl": the JLPT level of the word (N5 = easiest … N1); "–" for names and words outside the JLPT lists.

For every line also give "da" (a natural Danish translation of the whole line) and "en" (a natural English translation).
"title_da" and "title_en": a short, natural Danish and English version of the video title when one is given, otherwise "".`;

function cleanToken(t) {
  const w = String((t && t.w) || '');
  if (!w) return null;
  if (t.punct || /^[\s。、！？!?,.…「」『』（）()〜～ー・:："“”'‘’\-–—]+$/.test(w)) return { w, p: true };
  const out = { w };
  if (t.r && /[㐀-鿿々]/.test(w)) out.r = String(t.r);
  out.ro = String(t.ro || '');
  out.da = String(t.da || '');
  out.en = String(t.en || '');
  out.type = TYPES.includes(t.type) ? t.type : 'Udtryk';
  out.lvl = LVLS.includes(t.lvl) ? t.lvl : '–';
  // AI'en glemmer nogle gange betydningen af de små ord
  const p = PARTICLES[w];
  if (p) {
    if (!out.da) out.da = p[1];
    if (!out.en) out.en = p[2];
    if (!out.ro) out.ro = p[0];
    if (out.lvl === '–') out.lvl = 'N5';
  }
  return out;
}

const PARTICLES = {
  'は': ['wa', 'emne-partikel – det vi taler om', 'topic particle'],
  'が': ['ga', 'subjekt-partikel', 'subject particle'],
  'を': ['o', 'objekt-partikel (det man gør noget ved)', 'object particle'],
  'に': ['ni', 'i, på, til (tid, sted, retning)', 'in, at, to'],
  'で': ['de', 'i, på, med (sted for handlingen, middel)', 'at, in, by, with'],
  'の': ['no', 'ejefald – »min«, »Pons«', "possessive particle ('s, of)"],
  'と': ['to', 'og; sammen med', 'and; with'],
  'も': ['mo', 'også', 'also, too'],
  'へ': ['e', 'til, mod (retning)', 'to, towards'],
  'から': ['kara', 'fra; fordi', 'from; because'],
  'まで': ['made', 'indtil, til', 'until, to'],
  'や': ['ya', 'og (blandt andet)', 'and (among others)'],
  'よ': ['yo', 'altså! (fortæller noget nyt)', 'you know!'],
  'ね': ['ne', '…ikke? (blød afslutning)', 'right? (softening)'],
  'か': ['ka', 'spørge-partikel', 'question particle'],
  'けど': ['kedo', 'men', 'but'],
  'って': ['tte', '(citat) »…«; altså', '(quote) "…"; as for']
};

function provider() {
  const S = db.settings;
  const claude = S.provider === 'claude';
  return { claude, apiKey: claude ? S.apiKey : S.orKey, model: claude ? S.model : S.orModel };
}

export function hasAiKey() { return !!provider().apiKey; }

async function annotateBatch(segs, { title, auto }) {
  const P = provider();
  const mod = await import(P.claude ? './claude.js' : './openrouter.js');
  const user = JSON.stringify({ title: title || '', auto: !!auto, segments: segs.map((s, i) => ({ i, text: s.text })) });
  const res = await mod.askJson({ apiKey: P.apiKey, model: P.model, system: SYSTEM, user, schema: SCHEMA, name: 'subtitles', maxTokens: 16000 });
  const raw = Array.isArray(res && res.lines) ? res.lines : [];
  // Ryd op, så hvert segment hører til én replik i rækkefølge (eller flere, hvis AI'en har delt et langt segment op)
  const lines = [];
  let next = 0;
  for (const l of raw.slice().sort((a, b) => a.from - b.from)) {
    // Tankestreg for »ny person taler« i starten af en replik fjernes
    const tokens = (Array.isArray(l.tokens) ? l.tokens : []).map(cleanToken).filter(Boolean).filter((t, k) => !(k === 0 && t.p && /^[-－‐—]+$/.test(t.w)));
    if (!tokens.some((t) => !t.p)) continue;
    const lf = Math.floor(l.from), lt = Math.min(segs.length - 1, Math.floor(l.to));
    const prev = lines[lines.length - 1];
    const line = { da: String(l.da || '').replace(/^s*[-－‐—]s*/, ''), en: String(l.en || '').replace(/^s*[-－‐—]s*/, ''), tokens };
    if (prev && lf === lt && prev.from === lf && prev.to === lf) { lines.push(Object.assign(line, { from: lf, to: lf })); continue; }
    const from = next, to = lt; // huller lægges til denne replik
    if (!(to >= from) || lf < next) continue;
    lines.push(Object.assign(line, { from, to }));
    next = to + 1;
  }
  if (!lines.length) throw new Error('AI’en sendte ingen brugbare undertekster.');
  if (next < segs.length) lines[lines.length - 1].to = segs.length - 1;
  const out = lines.map((l) => ({ start: segs[l.from].start, end: segs[l.to].end, jp: l.tokens.map((t) => t.w).join(''), da: l.da, en: l.en, tokens: l.tokens }));
  // Et segment delt i flere replikker: fordel tiden efter, hvor lang hver sætning er
  for (let i = 0; i < lines.length;) {
    let j = i;
    while (j + 1 < lines.length && lines[j + 1].from === lines[i].from && lines[j + 1].to === lines[i].to) j++;
    if (j > i) {
      const seg = { start: out[i].start, end: out[i].end };
      const lens = out.slice(i, j + 1).map((o) => Math.max(1, o.jp.length));
      const total = lens.reduce((a, b) => a + b, 0);
      let t = seg.start;
      for (let k = i; k <= j; k++) { out[k].start = Math.round(t * 1000) / 1000; t += (seg.end - seg.start) * lens[k - i] / total; out[k].end = Math.round(t * 1000) / 1000; }
    }
    i = j + 1;
  }
  return { titleDa: String(res.title_da || ''), titleEn: String(res.title_en || ''), lines: out };
}

function estimateLevel(lines) {
  const order = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };
  const ws = lines.flatMap((l) => l.tokens).filter((t) => !t.p && order[t.lvl] !== undefined).map((t) => order[t.lvl]).sort((a, b) => a - b);
  if (!ws.length) return 'N5';
  return ['N5', 'N4', 'N3', 'N2', 'N1'][ws[Math.floor(ws.length * 0.9)]];
}

// Laver hele videoen klar til afspilleren. onProgress(færdige, i alt)
export async function buildVideo({ id, title, channel, duration, auto, segments }, onProgress = () => {}, isCancelled = () => false) {
  // Små bidder ad gangen, så AI'ens svar ikke bliver for langt (automatiske undertekster kan være lange klumper)
  const maxSegs = auto ? 14 : 10, maxChars = 260;
  const batches = [];
  let cur = [], chars = 0;
  for (const sg of segments) {
    if (cur.length && (cur.length >= maxSegs || chars + sg.text.length > maxChars)) { batches.push(cur); cur = []; chars = 0; }
    cur.push(sg); chars += sg.text.length;
  }
  if (cur.length) batches.push(cur);
  const results = new Array(batches.length);
  let done = 0, pos = 0, failed = false;
  onProgress(0, batches.length);
  async function worker() {
    while (pos < batches.length && !failed) {
      const k = pos++;
      let err = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (isCancelled() || failed) return;
        try { results[k] = await annotateBatch(batches[k], { title: k === 0 ? title : '', auto }); err = null; break; } catch (e) { err = e; }
      }
      if (err) { failed = true; throw err; }
      onProgress(++done, batches.length);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (isCancelled()) return null;
  const lines = results.flatMap((r) => r.lines).map((l, i) => Object.assign({ n: i + 1 }, l));
  const last = segments[segments.length - 1];
  // »Just Right | Complete Beginner …« → »Just Right«
  const short = String(title || '').split(/\s*[|｜│]\s*|【|】/).map((s) => s.trim()).filter(Boolean)[0] || title;
  return {
    id, source: 'youtube', mine: true,
    title: short || 'YouTube-video', titleDa: results[0].titleDa || title || '', titleEn: results[0].titleEn || title || '',
    level: estimateLevel(lines), duration: duration || Math.ceil(last.end), channel: String(channel || '').split(/\s*[|｜│]\s*/)[0].trim(), channelUrl: '', auto: !!auto,
    lines
  };
}

// Titel og kanal uden undertekst-tjenesten (YouTubes oEmbed)
export async function videoInfo(id) {
  try {
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    if (!r.ok) return null;
    const j = await r.json();
    return { title: j.title || '', channel: j.author_name || '' };
  } catch (e) { return null; }
}

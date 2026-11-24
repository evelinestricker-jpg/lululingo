// Lululingo – undertekst-tjeneste (Cloudflare Worker)
//
// Henter de japanske undertekster til en YouTube-video, så appen kan lave klikbare undertekster.
// En iPhone-app må ikke selv hente dem fra YouTube (browseren blokerer det), så denne lille tjeneste gør det.
//
// Brug:  GET https://<din-worker>.workers.dev/?v=<YouTube-id eller link>
// Svar:  { id, title, channel, duration, kind: "manual"|"asr", language, segments: [{ start, end, text }] }
//
// Læg den på Cloudflare: dash.cloudflare.com → Workers & Pages → Create → Worker → Edit code → indsæt denne fil → Deploy.
// Den samme fil bruges også af tools/serve.js, når appen kører lokalt (adressen api/captions).

// Kun disse sider må bruge tjenesten fra en browser
const ORIGINS = [
  /^https:\/\/evelinestricker-jpg\.github\.io$/,
  /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/
];

// YouTube-klienter vi prøver i rækkefølge (YouTube blokerer nogle gange den ene, men ikke den anden)
const CLIENTS = [
  {
    name: 'ANDROID', id: '3',
    context: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, osName: 'Android', osVersion: '11', hl: 'ja', gl: 'JP' },
    ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip'
  },
  {
    name: 'IOS', id: '5',
    context: { clientName: 'IOS', clientVersion: '20.10.4', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82', hl: 'ja', gl: 'JP' },
    ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)'
  }
];

const ID = /^[A-Za-z0-9_-]{11}$/;

export function videoId(s) {
  s = String(s || '').trim();
  if (ID.test(s)) return s;
  try {
    const u = new URL(s.startsWith('http') ? s : 'https://' + s);
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1, 12);
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/) || [])[1] || '';
    }
    return ID.test(id) ? id : '';
  } catch (e) { return ''; }
}

class Fail extends Error {
  constructor(code, message, status = 502) { super(message); this.code = code; this.status = status; }
}

async function player(id, c) {
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': c.ua, 'X-YouTube-Client-Name': c.id, 'X-YouTube-Client-Version': c.context.clientVersion, 'Accept-Language': 'ja,en;q=0.8' },
    body: JSON.stringify({ context: { client: c.context }, videoId: id, contentCheckOk: true, racyCheckOk: true })
  });
  if (res.status === 429) throw new Fail('blocked', 'YouTube afviser for mange forespørgsler lige nu. Prøv igen om lidt.', 503);
  if (!res.ok) throw new Fail('blocked', 'YouTube svarede ' + res.status + '.');
  return res.json();
}

const END = /[。？！?!]$/;
const NOISE = /^\s*[\[［][^\]］]*[\]］]\s*$/;

// Automatiske undertekster: YouTube giver tiden for hvert ord. Dem samler vi til én replik pr. sætning,
// så underteksten skifter præcis, når sætningen bliver sagt.
function asrSentences(events) {
  const evs = events.filter((e) => e.segs && e.segs.some((s) => (s.utf8 || '').trim()));
  const words = [];
  evs.forEach((e, k) => {
    const base = (e.tStartMs || 0) / 1000;
    const segs = e.segs.filter((s) => (s.utf8 || '').trim() && !NOISE.test(s.utf8));
    if (!segs.length) return;
    if (segs.length > 1 || segs.some((s) => s.tOffsetMs != null)) {
      for (const s of segs) words.push({ t: base + (s.tOffsetMs || 0) / 1000, w: s.utf8.replace(/\s*\n\s*/g, '') });
      return;
    }
    // En klump uden ordtider: del den i sætninger og fordel tiden (ca. 6 tegn i sekundet, højst til næste klump)
    const text = segs[0].utf8.replace(/\s*\n\s*/g, ' ').trim();
    const next = evs.slice(k + 1).find((x) => x.segs.some((s) => (s.utf8 || '').trim() && !NOISE.test(s.utf8)));
    const limit = next ? (next.tStartMs || 0) / 1000 : base + 60;
    const dur = Math.min(limit - base, Math.max((e.dDurationMs || 0) / 1000, text.length / 6));
    const parts = text.split(/(?<=[。？！?!])/).filter((x) => x.trim());
    let pos = 0;
    for (const p of parts) { words.push({ t: base + dur * (pos / text.length), w: p.trim() }); pos += p.length; }
  });
  words.sort((a, b) => a.t - b.t);
  const out = [];
  let cur = null;
  const close = () => { if (cur && cur.text.trim()) out.push(cur); cur = null; };
  for (const w of words) {
    // Ny replik ved en lang pause, selv uden tegnsætning
    if (cur && w.t - cur.last > 1.5) close();
    if (!cur) cur = { start: w.t, last: w.t, text: '' };
    cur.text += w.w; cur.last = w.t;
    if (END.test(w.w) || cur.text.length >= 45) close();
  }
  close();
  for (let i = 0; i < out.length; i++) {
    const next = i + 1 < out.length ? out[i + 1].start : out[i].last + 3;
    out[i].end = Math.min(next, out[i].last + 1.2);
    if (out[i].end - out[i].start < 0.6) out[i].end = Math.min(next, out[i].start + 0.6);
  }
  return out.map((s) => ({ start: Math.round(s.start * 1000) / 1000, end: Math.round(Math.max(s.end, s.start + 0.2) * 1000) / 1000, text: s.text.trim() }));
}

// json3-formatet: events med tStartMs, dDurationMs og segs[].utf8
function parseJson3(j, asr) {
  if (asr) { const s = asrSentences((j && j.events) || []); if (s.length) return s; }
  const out = [];
  for (const e of (j && j.events) || []) {
    if (!e.segs) continue;
    const text = e.segs.map((s) => s.utf8 || '').join('').replace(/\s*\n\s*/g, ' ').trim();
    if (!text) continue;
    const start = (e.tStartMs || 0) / 1000;
    out.push({ start, end: start + (e.dDurationMs || 0) / 1000, text });
  }
  // Automatiske undertekster overlapper hinanden – lad hver slutte, når den næste begynder
  out.sort((a, b) => a.start - b.start);
  for (let i = 0; i < out.length - 1; i++) if (out[i].end > out[i + 1].start) out[i].end = out[i + 1].start;
  for (const s of out) { s.start = Math.round(s.start * 1000) / 1000; s.end = Math.round(Math.max(s.end, s.start + 0.3) * 1000) / 1000; }
  return out;
}

export async function getCaptions(id) {
  let lastFail = null, sawVideo = false;
  for (const c of CLIENTS) {
    let p;
    try { p = await player(id, c); } catch (e) { lastFail = e instanceof Fail ? e : new Fail('blocked', 'Kunne ikke nå YouTube (' + ((e && e.cause && e.cause.code) || (e && e.message) || 'ukendt fejl') + ').'); continue; }
    const ps = (p && p.playabilityStatus) || {};
    if (ps.status === 'ERROR') throw new Fail('not_found', 'Videoen findes ikke eller er slettet.', 404);
    if (ps.status === 'LOGIN_REQUIRED' && /bot/i.test(ps.reason || '')) { lastFail = new Fail('blocked', 'YouTube tror, at tjenesten er en robot, og blokerer den lige nu.', 503); continue; }
    const d = p.videoDetails;
    if (!d) { lastFail = new Fail('blocked', 'YouTube sendte ingen oplysninger om videoen.'); continue; }
    sawVideo = true;
    const tracks = (((p.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks) || [];
    const ja = tracks.filter((t) => /^ja\b/i.test(t.languageCode || ''));
    const track = ja.find((t) => t.kind !== 'asr') || ja[0];
    if (!track) {
      if (!tracks.length) throw new Fail('no_captions', 'Videoen har ingen undertekster.', 404);
      throw new Fail('no_japanese', 'Videoen har ingen japanske undertekster (kun ' + [...new Set(tracks.map((t) => t.languageCode))].join(', ') + ').', 404);
    }
    const url = track.baseUrl.replace(/&fmt=[^&]*/g, '') + '&fmt=json3';
    let segments = [];
    try {
      const r = await fetch(url, { headers: { 'User-Agent': c.ua, 'Accept-Language': 'ja,en;q=0.8' } });
      const body = r.ok ? await r.text() : '';
      if (body) segments = parseJson3(JSON.parse(body), track.kind === 'asr');
    } catch (e) { /* prøv næste klient */ }
    if (!segments.length) { lastFail = new Fail('blocked', 'YouTube ville ikke udlevere underteksterne lige nu.'); continue; }
    return {
      id, title: d.title || '', channel: d.author || '', duration: Number(d.lengthSeconds) || 0,
      kind: track.kind === 'asr' ? 'asr' : 'manual', language: track.languageCode,
      embeddable: ps.playableInEmbed !== false, segments
    };
  }
  if (!sawVideo && lastFail) throw lastFail;
  throw lastFail || new Fail('blocked', 'Underteksterne kunne ikke hentes.');
}

function cors(origin) {
  const ok = origin && ORIGINS.some((r) => r.test(origin));
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Vary': 'Origin' } : { 'Vary': 'Origin' };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const h = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': status === 200 ? 'private, max-age=600' : 'no-store' }, h) });
    if (origin && !h['Access-Control-Allow-Origin']) return json({ error: 'origin', message: 'Denne side må ikke bruge tjenesten.' }, 403);
    const id = videoId(new URL(request.url).searchParams.get('v'));
    if (!id) return json({ error: 'bad_id', message: 'Det ligner ikke et YouTube-link.' }, 400);
    try {
      return json(await getCaptions(id));
    } catch (e) {
      const f = e instanceof Fail ? e : new Fail('error', 'Noget gik galt: ' + (e && e.message));
      return json({ error: f.code, message: f.message }, f.status);
    }
  }
};

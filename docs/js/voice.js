// Gratis neural stemme (Piper), der kører direkte på telefonen. Ingen API-nøgle.
// Første gang hentes stemmen (ca. 60 MB) – derefter virker den også uden internet.
// Stemmer: https://huggingface.co/rhasspy/piper-voices (MIT). Dansk: "talesyntese" (datasæt CC0).
export const PIPER = {
  da: { id: 'da_DK-talesyntese-medium', name: 'Piper – dansk (gratis, bedre kvalitet)', size: '≈ 60 MB' }
};
export const isPiper = (v) => typeof v === 'string' && v.startsWith('piper:');

let lib = null;
const load = () => (lib = lib || import('../vendor/piper/piper-entry.js'));

// Én fælles lydafspiller. iPhone kræver, at den "låses op" med et tryk, før den må spille senere.
const player = new Audio();
player.preload = 'auto';
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
let unlocked = false;
export function unlockAudio() {
  if (unlocked) return;
  try { player.src = SILENT; const p = player.play(); if (p) p.then(() => { unlocked = true; }).catch(() => {}); } catch (e) {}
}

// Er stemmen hentet? (gemt i telefonens filsystem, eller i appens offline-cache på ældre iPhones)
async function opfsSize(name) {
  try { const root = await navigator.storage.getDirectory(); const dir = await root.getDirectoryHandle('piper'); return (await (await dir.getFileHandle(name)).getFile()).size; } catch (e) { return 0; }
}
async function inCache(url) {
  try { return !!(await (await caches.open('lululingo-voices')).match(url)); } catch (e) { return false; }
}
export async function isStored(lang) {
  const v = PIPER[lang];
  if (!v) return false;
  try {
    const m = await load();
    const url = m.HF_BASE + '/' + m.PATH_MAP[v.id];
    return (await opfsSize(v.id + '.onnx')) > 1e6 || (await inCache(url));
  } catch (e) { return false; }
}

export async function downloadVoice(lang, onProgress) {
  const v = PIPER[lang];
  const m = await load();
  const seen = {};
  let modelTotal = 0;
  await m.download(v.id, (p) => {
    if (!p || !p.total) return;
    seen[p.url] = [p.loaded, p.total];
    if (p.url.endsWith('.onnx')) modelTotal = p.total;
    const all = Object.values(seen);
    const loaded = all.reduce((a, x) => a + x[0], 0), total = all.reduce((a, x) => a + x[1], 0);
    if (onProgress) onProgress(Math.min(99, Math.round((loaded / total) * 100)));
  });
  // Biblioteket gemmer filen i baggrunden – vent til den er skrevet helt færdig
  for (let i = 0; i < 120; i++) {
    const size = await opfsSize(v.id + '.onnx');
    if (size > 1e6 && (!modelTotal || size >= modelTotal)) break;
    if (i > 6 && (await inCache(m.HF_BASE + '/' + m.PATH_MAP[v.id]))) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (onProgress) onProgress(100);
}

export async function removeVoice(lang) {
  const m = await load();
  await m.remove(PIPER[lang].id);
}

let session = null, sessionId = '';
async function getSession(id) {
  if (session && sessionId === id) return session;
  const m = await load();
  try { session = await m.TtsSession.create({ voiceId: id }); }
  catch (e) { m.TtsSession._instance = null; session = null; throw e; }
  sessionId = id;
  return session;
}

// Læser tekst op med Piper. onStart/onEnd bruges fx til Lulus mund.
let gen = 0;
export async function sayPiper(lang, text, { rate = 1, onStart, onEnd } = {}) {
  const my = ++gen;
  const v = PIPER[lang];
  if (!v) throw new Error('Ingen Piper-stemme til ' + lang);
  const s = await getSession(v.id);
  const wav = await s.predict(text);
  if (my !== gen) return false; // der blev trykket stop, mens stemmen regnede
  const url = URL.createObjectURL(wav);
  return new Promise((resolve) => {
    let started = false;
    const done = () => { player.onended = player.onerror = null; URL.revokeObjectURL(url); if (onEnd) onEnd(); resolve(started); };
    player.onended = done;
    player.onerror = done;
    player.src = url;
    player.playbackRate = rate;
    player.play().then(() => { started = true; if (onStart) onStart(); }).catch(() => done());
  });
}

export function stopPiper() {
  gen++;
  try { player.pause(); player.onended && player.onended(); } catch (e) {}
}

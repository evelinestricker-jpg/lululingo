// Al data gemmes på telefonen (localStorage). Intet sendes nogen steder hen,
// undtagen chatbeskeder til Anthropic, når du bruger Snak med Lulu.
const KEY = 'lululingo.v1';

function defaults() {
  return {
    settings: {
      lang: 'da', level: 'N5', furi: true, ro: false, tr: true, goal: 10, speed: 1,
      provider: 'openrouter',                    // 'openrouter' (billigst) eller 'claude'
      orKey: '', orModel: 'z-ai/glm-5.3-flash',  // OpenRouter
      apiKey: '', model: 'claude-opus-5-5'       // Anthropic Claude
    },
    cards: {},          // id -> flashcard (se srs.js)
    watched: {},        // episode-id -> { t: sekunder, done: bool }
    stats: { days: {}, xp: 0, lastDay: null, streak: 0 },
    chat: { messages: [] },
    lastEpisode: null
  };
}

function load() {
  const d = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') {
      Object.assign(d, raw);
      d.settings = Object.assign(defaults().settings, raw.settings || {});
      d.stats = Object.assign(defaults().stats, raw.stats || {});
      d.chat = Object.assign(defaults().chat, raw.chat || {});
    }
  } catch (e) { /* tom eller ugyldig – start forfra */ }
  // Flyt ord fra den første testafspiller over
  try {
    const old = JSON.parse(localStorage.getItem('lululingo.cards'));
    if (old && typeof old === 'object') {
      for (const w of Object.keys(old)) {
        const c = old[w];
        const id = 'v:' + w;
        if (!d.cards[id]) d.cards[id] = { id, deck: 'video', w: c.w, r: c.r || '', ro: c.ro, da: c.da, en: c.en, type: c.type, lvl: c.lvl, ctx: c.ctx, ctxDa: c.ctxDa, ctxEn: c.ctxEn, ep: c.ep, start: c.time, end: null, due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0, added: c.added || Date.now() };
      }
      localStorage.removeItem('lululingo.cards');
    }
  } catch (e) {}
  return d;
}

export const db = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* fx privat tilstand – appen virker stadig */ }
}

export function dayKey(t = Date.now()) {
  const d = new Date(t);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function today() {
  const k = dayKey();
  if (!db.stats.days[k]) db.stats.days[k] = { newWords: 0, reviews: 0, xp: 0 };
  return db.stats.days[k];
}

// Kaldes når man laver noget lærerigt – holder styr på streak og XP
export function activity({ newWords = 0, reviews = 0, xp = 0 } = {}) {
  const k = dayKey();
  const t = today();
  t.newWords += newWords; t.reviews += reviews; t.xp += xp;
  db.stats.xp += xp;
  if (db.stats.lastDay !== k) {
    const y = dayKey(Date.now() - 864e5);
    db.stats.streak = db.stats.lastDay === y ? db.stats.streak + 1 : 1;
    db.stats.lastDay = k;
  }
  save();
}

export function streak() {
  const k = dayKey(), y = dayKey(Date.now() - 864e5);
  if (db.stats.lastDay === k || db.stats.lastDay === y) return db.stats.streak;
  return 0;
}

export function resetAll() {
  try { localStorage.removeItem(KEY); } catch (e) {}
  location.reload();
}

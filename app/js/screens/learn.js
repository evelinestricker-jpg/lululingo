import { db } from '../store.js';
import { addCard, hasCard, cardsIn } from '../srs.js';
import { HIRAGANA, KATAKANA, KANJI } from '../data.js';
import { esc, icon, lulu, openSheet, closeSheet, speak, toast } from '../ui.js';

let mode = 'hira';
const DAY = 864e5;

function items() {
  if (mode === 'kanji') return KANJI.map((k) => ({ ch: k.k, ro: k.da.split(',')[0], k }));
  return (mode === 'hira' ? HIRAGANA : KATAKANA);
}
function cid(ch) { return (mode === 'kanji' ? 'j:' : 'k:') + ch; }
function fields(it) {
  if (mode === 'kanji') {
    const k = it.k;
    const say = (k.kun && k.kun !== '–' ? k.kun : k.on).split(',')[0].replace(/[()]/g, '').trim();
    return { id: cid(k.k), deck: 'kanji', w: k.k, r: say, on: k.on, kun: k.kun, ro: '', da: k.da, en: k.en, type: 'Kanji', lvl: 'N5' };
  }
  return { id: cid(it.ch), deck: 'kana', w: it.ch, r: it.ch, ro: it.ro, da: 'udtales »' + it.ro + '«', en: 'pronounced "' + it.ro + '"', type: mode === 'hira' ? 'Hiragana' : 'Katakana', lvl: '–' };
}

export function render(view) {
  function status(ch) {
    const c = db.cards[cid(ch)];
    if (!c) return '';
    return c.interval >= DAY ? 'learned' : 'learning';
  }

  function draw() {
    const list = items();
    const real = list.filter(Boolean);
    const inCards = real.filter((it) => hasCard(cid(it.ch))).length;
    const learned = real.filter((it) => status(it.ch) === 'learned').length;
    const name = { hira: 'hiragana', kata: 'katakana', kanji: 'kanji' }[mode];
    const pct = Math.round((learned / real.length) * 100);
    view.innerHTML = `
      <div class="stack" style="gap:2px"><span class="eyebrow small muted">文字 · Skrifttegn</span><h1>Lær at læse</h1></div>
      <div class="seg" role="tablist" aria-label="Skriftsystem">
        ${[['hira', 'Hiragana'], ['kata', 'Katakana'], ['kanji', 'Kanji']].map(([k, n]) => `<button role="tab" data-mode="${k}" aria-selected="${k === mode}">${n}</button>`).join('')}
      </div>
      <div class="card bg-mint" style="border:0;display:flex;align-items:center;gap:12px">
        ${lulu(58, { mood: 'open' })}
        <div class="stack" style="flex:1;gap:6px;min-width:0">
          <b class="c-mint">${learned} af ${real.length} ${name} lært</b>
          <div class="bar" style="background:#fff;height:8px"><span style="width:${pct}%;background:var(--mint)"></span></div>
          <span class="small" style="color:#24453A">${inCards} er i dine flashcards</span>
        </div>
      </div>
      <section class="section">
        <div class="row-between">
          <h2>${mode === 'kanji' ? 'Første kanji' : mode === 'hira' ? 'Hiragana · あ–ん' : 'Katakana · ア–ン'}</h2>
          <div class="legend"><span><i style="background:var(--mint)"></i>Lært</span><span><i style="background:var(--pink)"></i>Øver</span></div>
        </div>
        <div class="kana-grid ${mode === 'kanji' ? 'k4' : ''}">
          ${list.map((it, i) => it ? `<button class="kcell ${status(it.ch)}" data-i="${i}" aria-label="${esc(it.ch + ', ' + it.ro)}"><span class="ch jp">${esc(it.ch)}</span><span class="ro">${esc(it.ro)}</span></button>` : '<span class="kcell blank" aria-hidden="true"></span>').join('')}
        </div>
        ${inCards < real.length ? `<button class="btn soft block" id="addAll">${icon('plus')} Læg alle ${real.length - inCards} nye ${name} i flashcards</button>` : ''}
      </section>
      <section class="section">
        <h2>Mini-spil</h2>
        <a class="game-link bg-yellow" href="#/game/particles"><span class="ic c-brown">は</span><span class="tx"><b>Partikel-jagt</b><span>Vælg den rigtige partikel</span></span>${icon('chevron')}</a>
        <a class="game-link bg-pink" href="#/game/builder"><span class="ic c-pink">${icon('blocks', 24)}</span><span class="tx"><b>Sætningsbyggeren</b><span>Sæt ordene i rigtig rækkefølge</span></span>${icon('chevron')}</a>
        <a class="game-link bg-violet" href="#/game/kana"><span class="ic c-violet">ア</span><span class="tx"><b>Kana-quiz</b><span>Hvad hedder tegnet?</span></span>${icon('chevron')}</a>
      </section>`;
    view.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { mode = b.dataset.mode; draw(); });
    view.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => openChar(list[Number(b.dataset.i)]));
    const all = view.querySelector('#addAll');
    if (all) all.onclick = () => {
      let n = 0;
      real.forEach((it) => { if (addCard(fields(it))) n++; });
      toast(n + ' tegn lagt i flashcards');
      draw();
    };
  }

  function openChar(it) {
    const f = fields(it);
    const isK = mode === 'kanji';
    const body = openSheet(`
      <div class="word-top">
        <span class="big jp" style="font-size:56px">${esc(it.ch)}</span>
        <div class="rd">
          ${isK ? `<b class="jp">${esc(it.k.kun)}</b><span>On: ${esc(it.k.on)}</span>` : `<b>${esc(it.ro)}</b><span>${mode === 'hira' ? 'Hiragana' : 'Katakana'}</span>`}
        </div>
        <button class="icon-btn soft" data-act="say" aria-label="Hør udtale">${icon('sound')}</button>
        <button class="icon-btn" data-act="close" aria-label="Luk">${icon('close', 18)}</button>
      </div>
      ${isK ? `<div class="meaning">${esc(db.settings.lang === 'en' ? it.k.en : it.k.da)}</div><div class="meaning2">${esc(db.settings.lang === 'en' ? 'DA: ' + it.k.da : 'EN: ' + it.k.en)}</div>` : ''}
      <span class="small muted">Tegn tegnet med fingeren oven på det lyse forbillede:</span>
      <div class="draw">
        <svg class="cross" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M50 4V96M4 50H96" stroke="#FFC6D6" stroke-width=".8" stroke-dasharray="3 3" fill="none"/></svg>
        <span class="guide jp">${esc(it.ch)}</span>
        <canvas aria-label="Tegneflade"></canvas>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn ghost" data-act="clear" style="flex:1">Ryd</button>
        ${hasCard(f.id) ? `<div class="saved-row" style="flex:2">${icon('check', 22)}<span>I dine flashcards</span></div>` : `<button class="btn pink" data-act="add" style="flex:2">${icon('plus')} Flashcard</button>`}
      </div>`, { label: 'Tegn ' + it.ch, onClose: draw });
    body.querySelector('[data-act=close]').onclick = closeSheet;
    body.querySelector('[data-act=say]').onclick = () => { if (!speak(f.r)) toast('Din browser kan ikke læse op'); };
    const add = body.querySelector('[data-act=add]');
    if (add) add.onclick = () => { addCard(f); toast('Lagt i flashcards'); closeSheet(); };
    setupCanvas(body.querySelector('canvas'), body.querySelector('[data-act=clear]'));
    speak(f.r);
  }

  draw();
}

function setupCanvas(cv, clearBtn) {
  const ctx = cv.getContext('2d');
  const size = () => {
    const r = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#241A3D'; ctx.lineWidth = Math.max(6, r.width / 28);
  };
  requestAnimationFrame(size);
  let drawing = false, last = null;
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => { drawing = true; last = pt(e); cv.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.arc(last[0], last[1], ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fillStyle = '#241A3D'; ctx.fill(); });
  cv.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pt(e); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; });
  const end = () => { drawing = false; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  clearBtn.onclick = () => { const r = cv.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height); };
}

export function kanaCardsCount() { return cardsIn('kana').length; }

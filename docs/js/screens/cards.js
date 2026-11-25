import { db, today, save } from '../store.js';
import { dueCards, cardsIn, learnedCount, review, nextInterval, fmtInterval, removeCard } from '../srs.js';
import { esc, icon, lulu, speak, toast } from '../ui.js';

const DECKS = [['video', 'Fra videoer'], ['kana', 'Kana'], ['kanji', 'Kanji']];
let deck = 'video';
const CHEERS = ['Du klarer det!', 'がんばって！', 'Godt gået!', 'Lige et kort til!', 'すごい！'];

export function render(view) {
  let queue = dueCards(deck);
  let cram = false;
  let flipped = false;
  let done = 0;
  let clip = null;
  const tr = (c) => (db.settings.lang === 'en' ? c.en : c.da);

  function stopClip() { if (clip) { clip.pause(); clip = null; } }

  function playClip(c) {
    stopClip();
    if (!c.ep || c.start == null) return;
    const a = new Audio('episodes/' + encodeURIComponent(c.ep) + '/episode.wav');
    clip = a;
    a.addEventListener('loadedmetadata', () => { a.currentTime = c.start; a.play().catch(() => {}); }, { once: true });
    a.addEventListener('timeupdate', () => { if (c.end != null && a.currentTime >= c.end + 0.05) a.pause(); });
  }

  function front(c) {
    if (c.deck === 'video') {
      const ctx = c.ctx || '';
      const i = ctx.indexOf(c.w);
      const ctxHtml = i >= 0 ? esc(ctx.slice(0, i)) + `<span class="hl">${esc(c.w)}</span>` + esc(ctx.slice(i + c.w.length)) : esc(ctx);
      return { word: c.w, ctxHtml, src: (c.epTitle || 'Lulu-afsnit') };
    }
    return { word: c.w, ctxHtml: '', src: c.deck === 'kana' ? 'Kana' : 'Kanji' };
  }

  function draw() {
    stopClip();
    const c = queue[0];
    const all = cardsIn(deck);
    const stats = `
      <div class="stats3">
        <div class="stat bg-pink"><b class="c-pink">${today().newWords}</b><span>Nye i dag</span></div>
        <div class="stat bg-violet"><b class="c-violet">${dueCards(deck).length}</b><span>Klar nu</span></div>
        <div class="stat bg-mint"><b class="c-mint">${learnedCount(deck)}</b><span>Lært</span></div>
      </div>`;
    const tabs = `<div class="seg" role="tablist" aria-label="Bunke">${DECKS.map(([k, n]) => `<button role="tab" data-deck="${k}" aria-selected="${k === deck}">${n}</button>`).join('')}</div>`;
    const head = `
      <div class="head">
        <div class="stack" style="gap:2px"><span class="eyebrow">単語カード · Ordkort</span><h1>Flashcards</h1></div>
        <div style="display:flex;align-items:center;gap:4px">
          <span class="chip" style="background:var(--ink);color:#fff;border-radius:14px 14px 4px 14px;height:auto;padding:6px 10px;font-size:12px">${esc(CHEERS[done % CHEERS.length])}</span>
          ${lulu(56, { mood: 'happy' })}
        </div>
      </div>`;

    if (!c) {
      const next = all.filter((x) => x.due > Date.now()).sort((a, b) => a.due - b.due)[0];
      view.innerHTML = head + stats + tabs + `
        <div class="card empty">
          ${lulu(90, { mood: 'happy' })}
          ${all.length
            ? `<p>${done ? `Flot! Du har gennemgået ${done} kort.` : 'Ingen kort klar lige nu.'}<br>${next ? 'Næste kort er klar om ' + fmtInterval(next.due - Date.now()) + '.' : ''}</p>
               <button class="btn soft" id="cram">${icon('replay')} Øv alle ${all.length} kort alligevel</button>`
            : `<p>${deck === 'video' ? 'Tryk på ord, mens du ser et afsnit. Så havner de her.' : 'Tilføj tegn fra Lær-skærmen, så havner de her.'}</p>
               <a class="btn primary" href="${deck === 'video' ? '#/library' : '#/learn'}">${deck === 'video' ? 'Se et afsnit' : 'Gå til Lær'}</a>`}
        </div>
        ${all.length ? listHtml(all) : ''}`;
      bindCommon();
      const cr = view.querySelector('#cram');
      if (cr) cr.onclick = () => { cram = true; queue = all.slice().sort(() => Math.random() - 0.5); flipped = false; draw(); };
      return;
    }

    const f = front(c);
    const total = done + queue.length;
    const pct = Math.round((done / Math.max(1, total)) * 100);
    view.innerHTML = head + stats + tabs + `
      <div style="display:flex;align-items:center;gap:10px">
        <div class="bar" style="flex:1;height:8px"><span style="width:${pct}%"></span></div>
        <span class="small muted">${done + 1} af ${total}${cram ? ' · ekstra øvelse' : ''}</span>
      </div>
      ${c.deck === 'kana' ? '' : `<div class="pills" style="justify-content:flex-end"><button class="pill" id="tRead" aria-pressed="${!!db.settings.cardReading}">Vis læsning før svar</button></div>`}
      <div class="flash-wrap">
        <div class="layer l1"></div><div class="layer l2"></div>
        <button class="flash" id="flash" aria-label="${flipped ? 'Kortet er vendt' : 'Vend kortet og se svaret'}">
          <span class="src">${esc(f.src)}</span>
          <span class="grow"></span>
          ${flipped ? `<span class="reading jp">${esc(backReading(c))}</span>` : frontReading(c) ? `<span class="reading jp">${esc(frontReading(c))}</span>` : ''}
          <span class="front-word jp">${esc(f.word)}</span>
          ${flipped ? `<span class="mean">${esc(tr(c))}</span>` : ''}
          <span class="grow"></span>
          ${f.ctxHtml ? `<span class="ctx"><span class="j jp">${f.ctxHtml}</span>${flipped ? `<span class="d">${esc(db.settings.lang === 'en' ? c.ctxEn : c.ctxDa)}</span>` : ''}</span>` : ''}
          ${flipped ? '' : '<span class="hint">Tryk for at vende kortet</span>'}
        </button>
      </div>
      ${flipped ? `
        <div style="display:flex;gap:8px">
          <button class="btn soft" id="hear" style="flex:1">${icon('sound')} ${c.deck === 'video' && c.ep ? 'Hør scenen' : 'Hør udtale'}</button>
        </div>
        <div class="rate">
          ${[['Igen', '#FFE1EB', '#A0204D'], ['Svært', '#FFF1C9', '#7A4A00'], ['Godt', '#DDF4EA', '#17694A'], ['Let', '#ECE8FF', '#5B47D6']].map(([n, bg, fg], r) =>
            `<button data-rate="${r}" style="background:${bg};color:${fg}">${n}<small>${fmtInterval(nextInterval(c, r))}</small></button>`).join('')}
        </div>` : `<button class="btn primary block" id="show">Vis svar</button>`}`;
    bindCommon();
    view.querySelector('#flash').onclick = () => { flipped = !flipped; draw(); };
    const tRead = view.querySelector('#tRead');
    if (tRead) tRead.onclick = () => { db.settings.cardReading = !db.settings.cardReading; save(); draw(); };
    const show = view.querySelector('#show');
    if (show) show.onclick = () => { flipped = true; draw(); };
    const hear = view.querySelector('#hear');
    if (hear) hear.onclick = () => { if (c.deck === 'video' && c.ep) playClip(c); else speak(c.r || c.w); };
    view.querySelectorAll('[data-rate]').forEach((b) => b.onclick = () => {
      const r = Number(b.dataset.rate);
      review(c, r);
      queue.shift();
      if (r === 0 && !cram) queue.push(c); // "Igen" kommer igen i denne runde
      done += 1; flipped = false; draw();
    });
  }

  // Læsningen i hiragana/katakana på forsiden, når »Vis læsning før svar« er slået til (aldrig på kana-kort)
  function frontReading(c) {
    if (!db.settings.cardReading || c.deck === 'kana') return '';
    if (c.deck === 'kanji') return [c.on, c.kun].filter((x) => x && x !== '–').join(' · ');
    return c.r && c.r !== c.w ? c.r : '';
  }

  function backReading(c) {
    if (c.deck === 'kanji') return [c.on, c.kun].filter((x) => x && x !== '–').join(' · ');
    if (c.deck === 'kana') return c.ro;
    return [c.r || c.w, c.ro].filter(Boolean).join(' · ');
  }

  function listHtml(all) {
    const items = all.slice().sort((a, b) => b.added - a.added).slice(0, 60);
    return `<section class="section"><h2>Dine kort (${all.length})</h2><div class="card stack" style="padding:6px 14px;gap:0">
      ${items.map((c) => `<div class="set-row"><span class="stack" style="gap:0"><b class="jp" style="font-size:18px">${esc(c.w)}</b><span class="small muted">${esc(tr(c))} · om ${c.due > Date.now() ? fmtInterval(c.due - Date.now()) : 'nu'}</span></span><button class="icon-btn" data-del="${esc(c.id)}" aria-label="Slet kortet ${esc(c.w)}">${icon('trash', 18)}</button></div>`).join('')}
    </div></section>`;
  }

  function bindCommon() {
    view.querySelectorAll('[data-deck]').forEach((b) => b.onclick = () => { deck = b.dataset.deck; queue = dueCards(deck); cram = false; done = 0; flipped = false; draw(); });
    view.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { removeCard(b.dataset.del); toast('Kortet er slettet'); queue = queue.filter((x) => x.id !== b.dataset.del); draw(); });
  }

  draw();
  return () => stopClip();
}

import { db, save, activity } from '../store.js';
import { addCard, removeCard, hasCard } from '../srs.js';
import { esc, icon, CAST, openSheet, closeSheet, fmtTime, loadEpisode, toast } from '../ui.js';
import { mountCartoon } from '../cartoon.js';

export async function render(view, params) {
  const id = params[0] || 'ep01';
  let E;
  try { E = await loadEpisode(id); } catch (e) {
    view.innerHTML = `<a class="icon-btn" href="#/library" aria-label="Tilbage">${icon('back')}</a><div class="err">Afsnittet kunne ikke findes.</div>`;
    return;
  }
  db.lastEpisode = id; save();
  const S = db.settings;
  const lines = E.lines;
  const cast = Object.keys(E.characters || {});
  const audio = new Audio('episodes/' + encodeURIComponent(id) + '/' + E.audio);
  audio.preload = 'auto';
  audio.playbackRate = S.speed || 1;
  const st = { cur: 0, sel: null, stopAt: null, raf: 0 };
  const resumeAt = db.watched[id] && !db.watched[id].done ? db.watched[id].t : 0;
  const L = () => lines[st.cur];
  const tr = (o) => (S.lang === 'en' ? o.en : o.da);
  const cardId = (t) => 'v:' + t.w;

  view.innerHTML = `
    <div class="topbar">
      <a class="icon-btn" href="#/library" aria-label="Tilbage til biblioteket">${icon('back')}</a>
      <div class="t"><b class="jp">${esc(E.title)}</b><span>${esc(tr({ da: E.titleDa, en: E.titleEn }))} · ${esc(E.level)}</span></div>
      <span class="chip bg-mint c-mint" id="savedChip"></span>
    </div>
    <div class="stage" id="stage" aria-hidden="true"></div>
    <div class="controls">
      <button class="pp" id="pp" aria-label="Afspil"></button>
      <span class="time" id="time">0:00 / ${fmtTime(E.duration)}</span>
      <input type="range" id="seek" min="0" max="1000" value="0" aria-label="Spol i afsnittet">
    </div>
    <div class="pills">
      <button class="pill" id="tFuri" aria-pressed="${S.furi}">Furigana</button>
      <button class="pill" id="tRo" aria-pressed="${S.ro}">Romaji</button>
      <button class="pill" id="tTr" aria-pressed="${S.tr}">Oversættelse</button>
      <span style="flex:1"></span>
      <button class="pill" id="tLang" aria-label="Skift ordbogssprog">${S.lang.toUpperCase()}</button>
      <button class="pill" id="tSpeed" aria-label="Afspilningshastighed">${S.speed === 1 ? '1' : '0,75'}×</button>
    </div>
    <section class="card sub-panel" aria-label="Undertekst">
      <div class="meta"><span id="lineNo"></span><span>Tryk på et ord</span></div>
      <div class="tokens" id="tokens"></div>
      <div class="romaji" id="ro"></div>
      <div class="trans" id="tr"></div>
      <div class="nav-row">
        <button class="icon-btn" id="prev" aria-label="Forrige replik">${icon('prev')}</button>
        <button class="btn soft" id="again">${icon('replay')} Gentag replik</button>
        <button class="icon-btn" id="next" aria-label="Næste replik">${icon('next')}</button>
      </div>
    </section>
    <section class="section">
      <h2 class="small muted" style="text-transform:uppercase;letter-spacing:.8px">Manuskript</h2>
      <div class="stack" id="rows" style="gap:6px"></div>
    </section>
    <p class="credits">Stemmer: ${esc((E.credits || []).join(' · '))}</p>`;

  const $ = (s) => view.querySelector(s);

  function savedCount() {
    const ws = new Set(lines.flatMap((l) => l.tokens.filter((t) => !t.p && hasCard(cardId(t))).map((t) => t.w)));
    $('#savedChip').textContent = ws.size + ' gemt';
  }

  function lineAt(t) {
    for (let i = lines.length - 1; i >= 0; i--) if (t >= lines[i].start - 0.05) return i;
    return 0;
  }

  // Tegnefilmen styrer selv figurerne ud fra lydens tid
  const stopToon = mountCartoon($('#stage'), E, () => audio.currentTime || 0, () => !audio.paused);
  function setActors() {}

  function renderLine() {
    const l = L();
    const who = CAST[l.speaker] ? CAST[l.speaker].da : l.speaker;
    $('#lineNo').textContent = `${who} · replik ${st.cur + 1} af ${lines.length}`;
    const box = $('#tokens');
    box.classList.toggle('hide-furi', !S.furi);
    box.innerHTML = l.tokens.map((t, i) => {
      const f = `<span class="f jp">${t.r ? esc(t.r) : '&nbsp;'}</span><span class="w jp">${esc(t.w)}</span>`;
      if (t.p) return `<span class="punct">${f}</span>`;
      const cls = ['tok'];
      if (hasCard(cardId(t))) cls.push('saved');
      if (st.sel && st.sel.line === st.cur && st.sel.i === i) cls.push('sel');
      return `<button class="${cls.join(' ')}" data-i="${i}" aria-label="${esc(t.w + (t.r ? ' (' + t.r + ')' : '') + ': ' + tr(t))}">${f}</button>`;
    }).join('');
    $('#ro').textContent = l.tokens.filter((t) => !t.p).map((t) => t.ro).join(' ');
    $('#ro').hidden = !S.ro;
    $('#tr').textContent = tr(l);
    $('#tr').hidden = !S.tr;
    view.querySelectorAll('.script-row').forEach((r, i) => r.classList.toggle('cur', i === st.cur));
    setActors();
  }

  function renderRows() {
    $('#rows').innerHTML = lines.map((l, i) => `<button class="script-row" data-row="${i}"><span class="who">${esc(CAST[l.speaker] ? CAST[l.speaker].da : l.speaker)}</span><span><span class="j jp">${esc(l.jp)}</span><span class="d">${esc(tr(l))}</span></span></button>`).join('');
  }

  function setIcon() {
    $('#pp').innerHTML = icon(audio.paused ? 'play' : 'pause', 18);
    $('#pp').setAttribute('aria-label', audio.paused ? 'Afspil' : 'Pause');
  }

  function remember() {
    if (st.dead) return;
    const t = audio.currentTime || 0;
    const done = t >= E.duration - 1 || (db.watched[id] && db.watched[id].done);
    db.watched[id] = { t, done: !!done };
    save();
  }

  function tick() {
    const t = audio.currentTime;
    if (st.stopAt !== null && t >= st.stopAt) { audio.pause(); st.stopAt = null; }
    const i = lineAt(t);
    if (i !== st.cur) { st.cur = i; renderLine(); } else setActors();
    $('#time').textContent = fmtTime(t) + ' / ' + fmtTime(E.duration);
    $('#seek').value = E.duration ? Math.round((t / E.duration) * 1000) : 0;
    if (!audio.paused) st.raf = requestAnimationFrame(tick);
  }

  function playLine(i) {
    st.cur = Math.max(0, Math.min(lines.length - 1, i));
    st.stopAt = lines[st.cur].end + 0.05;
    audio.currentTime = lines[st.cur].start;
    audio.play().catch(() => {});
    renderLine();
  }

  function cardFields(l, t) {
    return { id: cardId(t), deck: 'video', w: t.w, r: t.r || '', ro: t.ro, da: t.da, en: t.en, type: t.type, lvl: t.lvl, ctx: l.jp, ctxDa: l.da, ctxEn: l.en, ep: id, epTitle: E.title, start: l.start, end: l.end };
  }

  function openWord(li, ti) {
    audio.pause();
    const l = lines[li], t = l.tokens[ti];
    st.sel = { line: li, i: ti };
    if (addCard(cardFields(l, t))) toast('Gemt i dine flashcards');
    fillSheet();
    renderLine(); savedCount();
  }

  function fillSheet() {
    if (!st.sel) return;
    const l = lines[st.sel.line], t = l.tokens[st.sel.i];
    const saved = hasCard(cardId(t));
    const other = S.lang === 'en' ? 'DA: ' + t.da : 'EN: ' + t.en;
    const body = openSheet(`
      <div class="word-top">
        <span class="big jp">${esc(t.w)}</span>
        <div class="rd"><b class="jp">${esc(t.r || t.w)}</b><span>${esc(t.ro)}</span></div>
        <button class="icon-btn soft" data-act="hear" aria-label="Hør replikken">${icon('sound')}</button>
        <button class="icon-btn" data-act="close" aria-label="Luk">${icon('close', 18)}</button>
      </div>
      <div class="meaning">${esc(tr(t))}</div>
      <div class="meaning2">${esc(other)}</div>
      <div class="tags"><span class="tag">${esc(t.type || '')}</span><span class="tag mint">${t.lvl && t.lvl !== '–' ? 'JLPT ' + esc(t.lvl) : 'Navn'}</span><span class="tag gray">${esc(E.title)} · ${fmtTime(l.start)}</span></div>
      <div class="ctx"><span class="j jp">${esc(l.jp)}</span><span class="d">${esc(tr(l))}</span></div>
      ${saved
        ? `<div class="saved-row">${icon('check', 22)}<span>Tilføjet til dine flashcards</span><button data-act="undo">Fortryd</button></div>`
        : `<button class="btn pink block" data-act="add">${icon('plus')} Tilføj til flashcards</button>`}`,
      { label: 'Ordopslag', onClose: () => { st.sel = null; renderLine(); } });
    body.querySelector('[data-act=close]').onclick = closeSheet;
    body.querySelector('[data-act=hear]').onclick = () => playLine(st.sel.line);
    const undo = body.querySelector('[data-act=undo]');
    if (undo) undo.onclick = () => { removeCard(cardId(t)); fillSheet(); renderLine(); savedCount(); };
    const add = body.querySelector('[data-act=add]');
    if (add) add.onclick = () => { addCard(cardFields(l, t)); fillSheet(); renderLine(); savedCount(); };
  }

  const toggle = (sel, key) => $(sel).addEventListener('click', (e) => {
    S[key] = !S[key]; save();
    e.currentTarget.setAttribute('aria-pressed', S[key]);
    renderLine();
  });
  toggle('#tFuri', 'furi'); toggle('#tRo', 'ro'); toggle('#tTr', 'tr');
  $('#tLang').onclick = (e) => { S.lang = S.lang === 'da' ? 'en' : 'da'; save(); e.currentTarget.textContent = S.lang.toUpperCase(); renderRows(); renderLine(); };
  $('#tSpeed').onclick = (e) => { S.speed = S.speed === 1 ? 0.75 : 1; save(); audio.playbackRate = S.speed; e.currentTarget.textContent = (S.speed === 1 ? '1' : '0,75') + '×'; };
  $('#pp').onclick = () => { st.stopAt = null; if (audio.paused) audio.play().catch(() => {}); else audio.pause(); };
  $('#seek').oninput = (e) => { st.stopAt = null; audio.currentTime = (e.target.value / 1000) * E.duration; tick(); };
  $('#prev').onclick = () => playLine(st.cur - 1);
  $('#next').onclick = () => playLine(st.cur + 1);
  $('#again').onclick = () => playLine(st.cur);
  $('#tokens').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) openWord(st.cur, Number(b.dataset.i)); });
  $('#rows').addEventListener('click', (e) => { const b = e.target.closest('[data-row]'); if (b) playLine(Number(b.dataset.row)); });

  audio.addEventListener('play', () => { if (st.dead) return; setIcon(); cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(tick); });
  audio.addEventListener('pause', () => { if (st.dead) return; setIcon(); setActors(); remember(); });
  audio.addEventListener('ended', () => { if (st.dead) return; setIcon(); setActors(); db.watched[id] = { t: E.duration, done: true }; activity({ xp: 10 }); toast('Afsnit set! +10 XP'); });
  audio.addEventListener('loadedmetadata', () => { if (resumeAt > 0 && resumeAt < E.duration - 1) { audio.currentTime = resumeAt; st.cur = lineAt(resumeAt); renderLine(); tick(); } }, { once: true });

  renderRows(); renderLine(); savedCount(); setIcon();

  return () => { stopToon(); cancelAnimationFrame(st.raf); remember(); st.dead = true; audio.pause(); audio.removeAttribute('src'); audio.load(); };
}

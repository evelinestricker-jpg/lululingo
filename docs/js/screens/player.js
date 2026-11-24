import { db, save, activity } from '../store.js';
import { addCard, removeCard, hasCard } from '../srs.js';
import { esc, icon, CAST, openSheet, closeSheet, fmtTime, loadEpisode, loadVideo, toast } from '../ui.js';
import { mountCartoon } from '../cartoon.js';

// Afspilleren bruges både til Lulu-afsnit (#/play/ep01) og rigtige videoer fra YouTube (#/watch/<YouTube-id>).
export function render(view, params) { return open(view, 'episode', params[0] || 'ep01'); }
export function renderVideo(view, params) { return open(view, 'video', params[0] || ''); }

// Lulu-afsnit: almindelig lydfil
function audioMedia(src) {
  const a = new Audio(src);
  a.preload = 'auto';
  const names = { ready: 'loadedmetadata' };
  return {
    time: () => a.currentTime || 0,
    paused: () => a.paused,
    play: () => { a.play().catch(() => {}); },
    pause: () => a.pause(),
    seek: (t) => { a.currentTime = t; },
    rate: (r) => { a.playbackRate = r; },
    duration: () => a.duration || 0,
    on: (ev, fn) => a.addEventListener(names[ev] || ev, fn),
    destroy: () => { a.pause(); a.removeAttribute('src'); a.load(); }
  };
}

// Rigtige videoer: YouTubes egen afspiller (IFrame API)
let ytApi = null;
function loadYouTube() {
  if (!ytApi) ytApi = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytApi = null; s.remove(); reject(new Error('YouTube kunne ikke hentes')); };
    document.head.appendChild(s);
  });
  return ytApi;
}

function ytMedia(host, videoId, startAt) {
  const handlers = {};
  const emit = (ev, x) => (handlers[ev] || []).forEach((fn) => fn(x));
  let p = null, state = -1, rate = 1, dead = false;
  // YouTube melder kun tiden nogle gange i sekundet – imellem regner vi selv videre, så underteksterne følger jævnt med
  let base = startAt || 0, stamp = performance.now();
  const box = document.createElement('div');
  host.appendChild(box);
  loadYouTube().then((YT) => {
    if (dead) return;
    p = new YT.Player(box, {
      videoId, width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, cc_load_policy: 0, iv_load_policy: 3, modestbranding: 1, start: Math.floor(startAt || 0), origin: location.origin },
      events: {
        onReady: () => { if (dead) return; p.setPlaybackRate(rate); emit('ready'); },
        onStateChange: (e) => { if (dead) return; state = e.data; read(); if (state === 1) emit('play'); else if (state === 2) emit('pause'); else if (state === 0) emit('ended'); },
        onError: (e) => { if (!dead) emit('error', e.data); }
      }
    });
  }).catch(() => { if (!dead) emit('error', 'api'); });
  const started = () => p && p.getCurrentTime && state !== -1 && state !== 5;
  function read() { if (started()) { base = p.getCurrentTime() || 0; stamp = performance.now(); } }
  return {
    time() {
      if (started()) { const t = p.getCurrentTime() || 0; if (t !== base) { base = t; stamp = performance.now(); } }
      return state === 1 ? base + Math.min(0.5, (performance.now() - stamp) / 1000) * rate : base;
    },
    paused: () => !(state === 1 || state === 3),
    play: () => { if (p && p.playVideo) p.playVideo(); },
    pause: () => { if (p && p.pauseVideo) p.pauseVideo(); },
    seek: (t) => { if (p && p.seekTo) { p.seekTo(t, true); base = t; stamp = performance.now(); } },
    rate: (r) => { rate = r; if (p && p.setPlaybackRate) p.setPlaybackRate(r); },
    duration: () => (p && p.getDuration ? p.getDuration() : 0),
    on: (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); },
    destroy: () => { dead = true; try { if (p && p.destroy) p.destroy(); } catch (e) {} }
  };
}

async function open(view, kind, id) {
  const isVideo = kind === 'video';
  const back = `<a class="icon-btn" href="#/library" aria-label="Tilbage til biblioteket">${icon('back')}</a>`;
  let E;
  try { E = await (isVideo ? loadVideo(id) : loadEpisode(id)); } catch (e) {
    view.innerHTML = `${back}<div class="err">${isVideo ? 'Videoen' : 'Afsnittet'} kunne ikke findes.</div>`;
    return;
  }
  const key = isVideo ? 'yt:' + id : id; // nøgle i db.watched
  if (!isVideo) { db.lastEpisode = id; save(); }
  const S = db.settings;
  const lines = E.lines;
  let dur = E.duration;
  const st = { cur: 0, sel: null, stopAt: null, hold: null, raf: 0 };
  const resumeAt = db.watched[key] && !db.watched[key].done ? db.watched[key].t : 0;
  const L = () => lines[st.cur];
  const tr = (o) => (S.lang === 'en' ? o.en : o.da);
  const cardId = (t) => 'v:' + t.w;
  const ytUrl = 'https://www.youtube.com/watch?v=' + encodeURIComponent(id);
  const who = (l) => (l.speaker ? (CAST[l.speaker] ? CAST[l.speaker].da : l.speaker) : '');

  view.innerHTML = `
    <div class="topbar">
      ${back}
      <div class="t"><b class="jp">${esc(E.title)}</b><span>${esc(tr({ da: E.titleDa, en: E.titleEn }))} · ${esc(E.level)}</span></div>
      <span class="chip bg-mint c-mint" id="savedChip"></span>
    </div>
    <div class="stage${isVideo ? ' video' : ''}" id="stage"${isVideo ? '' : ' aria-hidden="true"'}></div>
    <div class="controls">
      <button class="pp" id="pp" aria-label="Afspil"></button>
      <span class="time" id="time">0:00 / ${fmtTime(dur)}</span>
      <input type="range" id="seek" min="0" max="1000" value="0" aria-label="Spol i ${isVideo ? 'videoen' : 'afsnittet'}">
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
    <p class="credits">${isVideo
      ? `Video: <a href="${esc(ytUrl)}" target="_blank" rel="noopener">${esc(E.channel || 'YouTube')} på YouTube</a>`
      : `Stemmer: ${esc((E.credits || []).join(' · '))}`}</p>`;

  const $ = (s) => view.querySelector(s);
  const stage = $('#stage');

  const media = isVideo ? ytMedia(stage, id, resumeAt) : audioMedia('episodes/' + encodeURIComponent(id) + '/' + E.audio);
  media.rate(S.speed || 1);
  // Tegnefilmen styrer selv figurerne ud fra lydens tid
  const stopToon = isVideo ? () => {} : mountCartoon(stage, E, media.time, () => !media.paused());

  function savedCount() {
    const ws = new Set(lines.flatMap((l) => l.tokens.filter((t) => !t.p && hasCard(cardId(t))).map((t) => t.w)));
    $('#savedChip').textContent = ws.size + ' gemt';
  }

  function lineAt(t) {
    for (let i = lines.length - 1; i >= 0; i--) if (t >= lines[i].start - 0.05) return i;
    return 0;
  }

  function renderLine() {
    const l = L();
    const w = who(l);
    $('#lineNo').textContent = (w ? w + ' · replik ' : 'Replik ') + `${st.cur + 1} af ${lines.length}`;
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
  }

  function renderRows() {
    $('#rows').innerHTML = lines.map((l, i) => `<button class="script-row" data-row="${i}"><span class="who">${esc(who(l) || fmtTime(l.start))}</span><span><span class="j jp">${esc(l.jp)}</span><span class="d">${esc(tr(l))}</span></span></button>`).join('');
  }

  function setIcon() {
    const paused = media.paused();
    $('#pp').innerHTML = icon(paused ? 'play' : 'pause', 18);
    $('#pp').setAttribute('aria-label', paused ? 'Afspil' : 'Pause');
  }

  function remember() {
    if (st.dead) return;
    const t = media.time();
    const done = t >= dur - 1 || (db.watched[key] && db.watched[key].done);
    db.watched[key] = { t, done: !!done };
    save();
  }

  function tick() {
    const t = media.time();
    // Efter »Gentag replik« bliver repliken stående, selvom afspilleren stoppede en anelse inde i den næste
    if (st.stopAt !== null && t >= st.stopAt) { media.pause(); st.stopAt = null; st.hold = st.cur; }
    const i = st.hold !== null ? st.hold : lineAt(t);
    if (i !== st.cur) { st.cur = i; renderLine(); }
    $('#time').textContent = fmtTime(t) + ' / ' + fmtTime(dur);
    $('#seek').value = dur ? Math.round((t / dur) * 1000) : 0;
    if (!media.paused()) st.raf = requestAnimationFrame(tick);
  }

  function playLine(i) {
    st.cur = Math.max(0, Math.min(lines.length - 1, i));
    st.stopAt = lines[st.cur].end + 0.05;
    st.hold = null;
    media.seek(lines[st.cur].start);
    media.play();
    renderLine();
  }

  function cardFields(l, t) {
    const f = { id: cardId(t), deck: 'video', w: t.w, r: t.r || '', ro: t.ro, da: t.da, en: t.en, type: t.type, lvl: t.lvl, ctx: l.jp, ctxDa: l.da, ctxEn: l.en, epTitle: E.title, start: l.start, end: l.end };
    if (isVideo) f.yt = id; else f.ep = id;
    return f;
  }

  function openWord(li, ti) {
    media.pause();
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

  function showVideoError(code) {
    const msg = code === 101 || code === 150 || code === 153
      ? 'Ejeren af videoen tillader ikke, at den vises i andre apps.'
      : code === 'api' ? 'YouTube kunne ikke hentes. Er du på nettet?' : 'Videoen kunne ikke afspilles.';
    const box = document.createElement('div');
    box.className = 'vid-err';
    box.innerHTML = `<b>${esc(msg)}</b><a class="btn soft" href="${esc(ytUrl)}" target="_blank" rel="noopener">Åbn på YouTube</a><span class="small">Underteksterne herunder virker stadig.</span>`;
    stage.appendChild(box);
  }

  const toggle = (sel, k) => $(sel).addEventListener('click', (e) => {
    S[k] = !S[k]; save();
    e.currentTarget.setAttribute('aria-pressed', S[k]);
    renderLine();
  });
  toggle('#tFuri', 'furi'); toggle('#tRo', 'ro'); toggle('#tTr', 'tr');
  $('#tLang').onclick = (e) => { S.lang = S.lang === 'da' ? 'en' : 'da'; save(); e.currentTarget.textContent = S.lang.toUpperCase(); renderRows(); renderLine(); };
  $('#tSpeed').onclick = (e) => { S.speed = S.speed === 1 ? 0.75 : 1; save(); media.rate(S.speed); e.currentTarget.textContent = (S.speed === 1 ? '1' : '0,75') + '×'; };
  $('#pp').onclick = () => { st.stopAt = null; st.hold = null; if (media.paused()) media.play(); else media.pause(); };
  $('#seek').oninput = (e) => { st.stopAt = null; st.hold = null; media.seek((e.target.value / 1000) * dur); tick(); };
  $('#prev').onclick = () => playLine(st.cur - 1);
  $('#next').onclick = () => playLine(st.cur + 1);
  $('#again').onclick = () => playLine(st.cur);
  $('#tokens').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) openWord(st.cur, Number(b.dataset.i)); });
  $('#rows').addEventListener('click', (e) => { const b = e.target.closest('[data-row]'); if (b) playLine(Number(b.dataset.row)); });

  media.on('play', () => { if (st.dead) return; if (st.stopAt === null) st.hold = null; setIcon(); cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(tick); });
  media.on('pause', () => { if (st.dead) return; setIcon(); remember(); });
  media.on('ended', () => { if (st.dead) return; setIcon(); db.watched[key] = { t: dur, done: true }; save(); activity({ xp: 10 }); toast((isVideo ? 'Video' : 'Afsnit') + ' set! +10 XP'); });
  media.on('error', (code) => { if (!st.dead) showVideoError(code); });
  let ready = false;
  media.on('ready', () => {
    if (st.dead || ready) return;
    ready = true;
    const d = media.duration();
    if (isVideo && d > 0) dur = d;
    if (resumeAt > 0 && resumeAt < dur - 1) {
      if (!isVideo) media.seek(resumeAt); // YouTube starter selv det rigtige sted
      st.cur = lineAt(resumeAt); renderLine();
    }
    tick();
  });

  renderRows(); renderLine(); savedCount(); setIcon();

  return () => { stopToon(); cancelAnimationFrame(st.raf); remember(); st.dead = true; media.destroy(); };
}

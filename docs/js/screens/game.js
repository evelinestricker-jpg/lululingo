import { db, activity } from '../store.js';
import { PARTICLES, PARTICLE_QS, HIRAGANA, KATAKANA } from '../data.js';
import { esc, icon, lulu, shuffle, speak, loadIndex, loadEpisode } from '../ui.js';

const ROUNDS = 8;

export async function render(view, params) {
  const kind = params[0] || 'particles';
  const tr = (o) => (db.settings.lang === 'en' ? o.en : o.da);
  let qs = [];

  if (kind === 'particles') {
    qs = shuffle(PARTICLE_QS).slice(0, ROUNDS).map((q) => {
      const others = shuffle(Object.keys(PARTICLES).filter((p) => p !== q.ans)).slice(0, 3);
      return Object.assign({}, q, { opts: shuffle([q.ans, ...others]) });
    });
  } else if (kind === 'kana') {
    const pool = HIRAGANA.concat(KATAKANA).filter(Boolean);
    qs = shuffle(pool).slice(0, 10).map((k) => {
      const others = shuffle(pool.filter((x) => x.ro !== k.ro)).map((x) => x.ro).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
      return { ch: k.ch, ans: k.ro, opts: shuffle([k.ro, ...others]) };
    });
  } else if (kind === 'builder') {
    const eps = await loadIndex().catch(() => []);
    const all = [];
    for (const e of eps) {
      try { const E = await loadEpisode(e.id); E.lines.forEach((l) => { const words = l.tokens.filter((t) => !t.p); if (words.length >= 3) all.push({ l, words }); }); } catch (err) {}
    }
    qs = shuffle(all).slice(0, ROUNDS).map(({ l, words }) => ({ l, words, bag: shuffle(words.map((w, i) => ({ w: w.w, i }))) }));
  }

  const titles = { particles: 'Partikel-jagt', kana: 'Kana-quiz', builder: 'Sætningsbyggeren' };
  const st = { n: 0, lives: 3, xp: 0, right: 0, picked: null, built: [] };

  function hearts() {
    return `<div class="hearts" aria-label="${st.lives} liv tilbage">${[0, 1, 2].map((i) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="${i < st.lives ? '#FF8FB1' : '#fff'}" stroke="#CF2F66" stroke-width="2" stroke-linejoin="round"/></svg>`).join('')}</div>`;
  }

  function top() {
    const pct = Math.round((st.n / qs.length) * 100);
    return `
      <div class="game-top">
        <a class="icon-btn" href="#/learn" aria-label="Afslut spillet">${icon('close')}</a>
        <div class="bar"><span style="width:${pct}%"></span></div>
        ${hearts()}
      </div>
      <div class="row-between"><h1 style="font-size:22px">${titles[kind]}</h1><span class="chip bg-yellow c-brown">${st.xp} XP</span></div>`;
  }

  function finish() {
    activity({ xp: st.xp });
    const lost = st.lives <= 0;
    view.innerHTML = top() + `
      <div class="card empty" style="margin-top:20px">
        ${lulu(110, { mood: lost ? 'open' : 'happy' })}
        <h2>${lost ? 'だいじょうぶ！ Prøv igen' : 'お疲れさま！ Godt spillet!'}</h2>
        <p>${st.right} af ${st.n} rigtige · +${st.xp} XP</p>
        <div style="display:flex;gap:8px;width:100%">
          <a class="btn ghost" href="#/learn" style="flex:1">Tilbage</a>
          <button class="btn primary" id="again" style="flex:1">Spil igen</button>
        </div>
      </div>`;
    view.querySelector('#again').onclick = () => render(view, params);
  }

  function next() {
    st.n += 1; st.picked = null; st.built = [];
    if (st.n >= qs.length || st.lives <= 0) return finish();
    draw();
  }

  function answer(ok) {
    if (ok) { st.xp += 10; st.right += 1; } else st.lives -= 1;
  }

  function feedback(ok, title, text) {
    return `<div class="feedback ${ok ? 'ok' : 'bad'}">
      <b>${esc(title)}</b>
      ${text ? `<p>${text}</p>` : ''}
      <button class="btn ${ok ? 'mint' : 'pink'} block" id="cont">${st.n + 1 >= qs.length || (!ok && st.lives <= 0) ? 'Se resultat' : 'Fortsæt'}</button>
    </div>`;
  }

  function draw() {
    if (!qs.length) {
      view.innerHTML = top() + `<div class="card empty"><p>Der er ikke nok sætninger endnu. Se et afsnit først.</p><a class="btn primary" href="#/library">Til biblioteket</a></div>`;
      return;
    }
    const q = qs[st.n];
    const answered = st.picked !== null;

    if (kind === 'particles') {
      const ok = answered && st.picked === q.ans;
      view.innerHTML = top() + `
        <div class="speech">${lulu(84, { mood: 'open' })}<span class="bubble">${!answered ? 'Hvilken partikel mangler?' : ok ? 'すごい！ Flot!' : 'だいじょうぶ！'}</span></div>
        <div class="q-card">
          <div class="q-sent jp"><span>${esc(q.pre)}</span><span class="blank ${answered ? (ok ? 'ok' : 'bad') : ''}">${answered ? esc(q.ans) : '？'}</span><span>${esc(q.post)}</span></div>
          <span class="small muted jp">${esc(q.read)}</span>
          <span style="font-size:15px;font-weight:600;color:var(--muted)">»${esc(tr(q))}«</span>
        </div>
        <div class="opts">${q.opts.map((p) => {
          let cls = '';
          if (answered && p === q.ans) cls = 'ok'; else if (answered && p === st.picked) cls = 'bad';
          return `<button class="opt ${cls}" data-p="${esc(p)}" ${answered ? 'disabled' : ''}><span class="p jp">${esc(p)}</span><span class="r">${esc(PARTICLES[p].ro)}</span></button>`;
        }).join('')}</div>
        ${answered ? feedback(ok, ok ? 'Rigtigt! +10 XP' : 'Ikke helt – svaret er ' + q.ans,
          (ok ? '' : esc(st.picked) + ' bruges til: ' + esc(tr(PARTICLES[st.picked])) + '. ') + esc(q.ans) + ' bruges til: ' + esc(tr(PARTICLES[q.ans])) + '.') : ''}`;
      view.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { st.picked = b.dataset.p; answer(st.picked === q.ans); draw(); });
    }

    if (kind === 'kana') {
      const ok = answered && st.picked === q.ans;
      view.innerHTML = top() + `
        <div class="speech">${lulu(84, { mood: 'open' })}<span class="bubble">${!answered ? 'Hvad hedder tegnet?' : ok ? 'せいかい！ Rigtigt!' : 'Næsten!'}</span></div>
        <div class="q-card"><span class="jp" style="font-size:96px;font-weight:700;line-height:1.1">${esc(q.ch)}</span>
          <button class="btn soft" id="say">${icon('sound')} Hør</button></div>
        <div class="opts">${q.opts.map((o) => {
          let cls = '';
          if (answered && o === q.ans) cls = 'ok'; else if (answered && o === st.picked) cls = 'bad';
          return `<button class="opt ${cls}" data-o="${esc(o)}" ${answered ? 'disabled' : ''}><span class="p" style="font-size:24px">${esc(o)}</span></button>`;
        }).join('')}</div>
        ${answered ? feedback(ok, ok ? 'Rigtigt! +10 XP' : `${q.ch} udtales »${q.ans}«`, '') : ''}`;
      view.querySelector('#say').onclick = () => speak(q.ch);
      view.querySelectorAll('[data-o]').forEach((b) => b.onclick = () => { st.picked = b.dataset.o; answer(st.picked === q.ans); speak(q.ch); draw(); });
    }

    if (kind === 'builder') {
      const target = q.words.map((w) => w.w);
      const built = st.built.map((i) => q.bag[i].w);
      const full = built.length === target.length;
      const ok = answered && st.picked === true;
      view.innerHTML = top() + `
        <div class="speech">${lulu(84, { mood: 'open' })}<span class="bubble">${!answered ? 'Byg sætningen på japansk' : ok ? 'かんぺき！ Perfekt!' : 'Næsten!'}</span></div>
        <div class="q-card"><span style="font-size:20px;font-weight:800">»${esc(tr(q.l))}«</span></div>
        <div class="builder" aria-label="Din sætning">${st.built.map((i, k) => `<button class="wchip jp" data-out="${k}" ${answered ? 'disabled' : ''}>${esc(q.bag[i].w)}</button>`).join('') || '<span class="small muted" style="align-self:center">Tryk på ordene nedenfor</span>'}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">${q.bag.map((b, i) => `<button class="wchip jp ${st.built.includes(i) ? 'used' : ''}" data-in="${i}" ${answered ? 'disabled' : ''}>${esc(b.w)}</button>`).join('')}</div>
        ${answered ? feedback(ok, ok ? 'Rigtigt! +10 XP' : 'Den rigtige rækkefølge:', ok ? esc(q.l.jp) : `<span class="jp" style="font-size:18px;font-weight:700">${esc(q.l.jp)}</span>`)
          : `<button class="btn primary block" id="check" ${full ? '' : 'disabled'}>Tjek</button>`}`;
      view.querySelectorAll('[data-in]').forEach((b) => b.onclick = () => { st.built.push(Number(b.dataset.in)); draw(); });
      view.querySelectorAll('[data-out]').forEach((b) => b.onclick = () => { st.built.splice(Number(b.dataset.out), 1); draw(); });
      const ch = view.querySelector('#check');
      if (ch) ch.onclick = () => { const good = built.join('|') === target.join('|'); st.picked = good; answer(good); draw(); };
    }

    const c = view.querySelector('#cont');
    if (c) c.onclick = next;
  }

  draw();
}

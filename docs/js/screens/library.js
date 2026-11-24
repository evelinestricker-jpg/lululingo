import { db } from '../store.js';
import { esc, icon, loadIndex, loadVideoIndex, fmtTime } from '../ui.js';
import { thumb, drawCovers } from './home.js';

let level = 'Alle';

export async function render(view) {
  const [eps, vids] = await Promise.all([loadIndex().catch(() => []), loadVideoIndex().catch(() => [])]);
  const draw = () => {
    const list = eps.filter((e) => level === 'Alle' || e.level === level);
    const vlist = vids.filter((v) => level === 'Alle' || v.level === level);
    view.innerHTML = `
      <div class="stack" style="gap:2px">
        <span class="eyebrow small muted">見て学ぶ · Se og lær</span>
        <h1>Bibliotek</h1>
      </div>
      <div class="pills" role="group" aria-label="Niveau">
        ${['Alle', 'N5', 'N4', 'N3'].map((l) => `<button class="pill" data-l="${l}" aria-pressed="${l === level}">${l}</button>`).join('')}
      </div>
      <section class="section">
        <h2>Lulu-afsnit</h2>
        ${list.length ? list.map((e) => {
          const w = db.watched[e.id];
          const prog = w ? Math.min(100, Math.round((w.t / e.duration) * 100)) : 0;
          return `<a class="ep-card" href="#/play/${esc(e.id)}">
            <div class="thumb"><div class="cover" data-cover="${esc(e.id)}">${thumb()}</div><span class="play">${icon('play')}</span><span class="badge">${esc(e.level)}</span><div class="prog"><span style="width:${prog}%"></span></div></div>
            <div class="info">
              <div class="ttl"><b class="jp">${esc(e.title)}</b><span class="small muted">${esc(db.settings.lang === 'en' ? e.titleEn : e.titleDa)}</span></div>
              <div class="tags"><span class="tag">${e.lines} replikker</span><span class="tag gray">${fmtTime(e.duration)}</span>${w && w.done ? '<span class="tag mint">Set</span>' : ''}</div>
            </div>
          </a>`;
        }).join('') : `<div class="card muted small" style="text-align:center">Ingen afsnit på niveau ${esc(level)} endnu.</div>`}
      </section>
      <section class="section">
        <h2>Rigtige videoer</h2>
        <p class="small muted" style="margin-top:-4px">Japansk som japanerne taler det – med de samme klikbare undertekster.</p>
        ${vlist.length ? vlist.map((v) => {
          const w = db.watched['yt:' + v.id];
          const prog = w ? Math.min(100, Math.round((w.t / v.duration) * 100)) : 0;
          return `<a class="ep-card" href="#/watch/${esc(v.id)}">
            <div class="thumb"><img class="yt" src="https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg" alt="" loading="lazy"><span class="play">${icon('play')}</span><span class="badge">${esc(v.level)}</span><div class="prog"><span style="width:${prog}%"></span></div></div>
            <div class="info">
              <div class="ttl"><b class="jp">${esc(v.title)}</b><span class="small muted">${esc(db.settings.lang === 'en' ? v.titleEn : v.titleDa)}</span></div>
              <div class="tags"><span class="tag">${v.lines} replikker</span><span class="tag gray">${fmtTime(v.duration)}</span><span class="tag gray jp">${esc(v.channel)}</span>${w && w.done ? '<span class="tag mint">Set</span>' : ''}</div>
            </div>
          </a>`;
        }).join('') : `<div class="card muted small" style="text-align:center">Ingen videoer på niveau ${esc(level)} endnu.</div>`}
      </section>`;
    drawCovers(view, eps);
    view.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', () => { level = b.dataset.l; draw(); }));
  };
  draw();
}

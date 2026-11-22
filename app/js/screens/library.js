import { db } from '../store.js';
import { esc, icon, loadIndex, fmtTime } from '../ui.js';
import { thumb } from './home.js';

let level = 'Alle';

export async function render(view) {
  const eps = await loadIndex().catch(() => []);
  const draw = () => {
    const list = eps.filter((e) => level === 'Alle' || e.level === level);
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
            <div class="thumb">${thumb()}<span class="play">${icon('play')}</span><span class="badge">${esc(e.level)}</span><div class="prog"><span style="width:${prog}%"></span></div></div>
            <div class="info">
              <div class="ttl"><b class="jp">${esc(e.title)}</b><span class="small muted">${esc(db.settings.lang === 'en' ? e.titleEn : e.titleDa)}</span></div>
              <div class="tags"><span class="tag">${e.lines} replikker</span><span class="tag gray">${fmtTime(e.duration)}</span>${w && w.done ? '<span class="tag mint">Set</span>' : ''}</div>
            </div>
          </a>`;
        }).join('') : `<div class="card muted small" style="text-align:center">Ingen afsnit på niveau ${esc(level)} endnu.</div>`}
      </section>
      <div class="soon">
        <span class="ic">${icon('link', 22)}</span>
        <span class="stack" style="gap:2px">
          <b>Flere kilder kommer</b>
          <span class="small muted">Nye Lulu-afsnit laves med VOICEVOX. Senere kan andre videoer tilføjes.</span>
        </span>
      </div>`;
    view.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', () => { level = b.dataset.l; draw(); }));
  };
  draw();
}

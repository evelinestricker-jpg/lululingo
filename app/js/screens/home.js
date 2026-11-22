import { db, today, streak } from '../store.js';
import { dueCards, cardsIn } from '../srs.js';
import { esc, icon, lulu, loadIndex } from '../ui.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 10) return ['おはよう！', 'Godmorgen'];
  if (h < 18) return ['こんにちは！', 'Goddag'];
  return ['こんばんは！', 'Godaften'];
}

export async function render(view) {
  const [jp, da] = greeting();
  const goal = db.settings.goal || 10;
  const done = today().newWords;
  const left = Math.max(0, goal - done);
  const pct = Math.min(100, Math.round((done / goal) * 100));
  const due = dueCards().length;
  const kanaLearned = cardsIn('kana').length;
  const eps = await loadIndex().catch(() => []);
  const last = eps.find((e) => e.id === db.lastEpisode) || eps[0];
  const w = last && db.watched[last.id];
  const prog = last && w ? Math.min(100, Math.round((w.t / last.duration) * 100)) : 0;
  const s = streak();

  const heroText = left > 0
    ? (done === 0 ? `Lad os lære ${goal} nye ord i dag!` : `Kun ${left} ord til, så har du nået dit mål!`)
    : 'Dagens mål er nået. すごい！';

  view.innerHTML = `
    <div class="head">
      <div class="stack" style="gap:2px">
        <span class="eyebrow">${da}</span>
        <h1 class="jp">${jp}</h1>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="chip bg-yellow c-brown" aria-label="${s} dages streak">${icon('flame', 18)} ${s} ${s === 1 ? 'dag' : 'dage'}</span>
        <a class="icon-btn" href="#/settings" aria-label="Indstillinger">${icon('gear')}</a>
      </div>
    </div>

    <section class="hero" aria-label="Dagens mål">
      <div class="t">
        <span class="eyebrow">Dagens mål</span>
        <span class="big">${esc(heroText)}</span>
        <div class="stack" style="gap:6px">
          <div class="bar" role="progressbar" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${goal}"><span style="width:${pct}%"></span></div>
          <span class="sub">${done} af ${goal} nye ord</span>
        </div>
        ${last ? `<a class="btn" href="#/play/${esc(last.id)}">${icon('play', 16)} ${w && !w.done ? 'Fortsæt afsnit' : 'Se et afsnit'}</a>` : ''}
      </div>
      <div class="mascot">${lulu(96)}</div>
    </section>

    ${last ? `
    <section class="section">
      <div class="row-between"><h2>Fortsæt med at se</h2><a href="#/library" class="small" style="padding:10px 0">Se alle</a></div>
      <a class="ep-card" href="#/play/${esc(last.id)}">
        <div class="thumb">${thumb()}<span class="play">${icon('play')}</span><span class="badge">Lulu-afsnit</span><div class="prog"><span style="width:${prog}%"></span></div></div>
        <div class="info">
          <div class="ttl"><b class="jp">${esc(last.title)}</b><span class="small muted">${esc(db.settings.lang === 'en' ? last.titleEn : last.titleDa)}</span></div>
          <div class="tags"><span class="tag mint">${esc(last.level)} · Begynder</span><span class="tag">${last.lines} replikker</span>${w ? `<span class="tag gray">${w.done ? 'Set færdig' : 'I gang'}</span>` : ''}</div>
        </div>
      </a>
    </section>` : ''}

    <section class="section">
      <h2>Dagens træning</h2>
      <div class="grid2">
        <a class="tile bg-pink" href="#/cards"><span class="ic c-pink">${icon('cards', 22)}</span><b>Flashcards</b><span class="s">${due ? due + ' kort klar' : 'Ingen kort lige nu'}</span></a>
        <a class="tile bg-violet" href="#/chat"><span class="ic c-violet">${icon('chat', 22)}</span><b>Snak med Lulu</b><span class="s">AI-samtale på japansk</span></a>
        <a class="tile bg-mint" href="#/learn"><span class="ic c-mint">あ</span><b>Kana &amp; kanji</b><span class="s">${kanaLearned} tegn i dine kort</span></a>
        <a class="tile bg-yellow" href="#/game/particles"><span class="ic c-brown">は</span><b>Partikel-jagt</b><span class="s">Grammatik-spil</span></a>
      </div>
    </section>`;
}

export function thumb() {
  return `<svg viewBox="0 0 350 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<rect width="350" height="170" fill="#FFF4E8"/>
<rect x="120" y="14" width="110" height="80" rx="10" fill="#FFE1EB" stroke="#E7CDB8" stroke-width="6"/>
<circle cx="155" cy="48" r="16" fill="#FFB3C8"/><circle cx="186" cy="40" r="12" fill="#FFC6D6"/><circle cx="205" cy="62" r="11" fill="#FFB3C8"/>
<circle cx="300" cy="38" r="16" fill="#FFC93C"/>
<rect x="0" y="130" width="350" height="40" fill="#C9BEFA"/>
<g transform="translate(40 52) scale(.78)"><path d="M18 60 L26 14 L56 36 Z" fill="#fff" stroke="#241A3D" stroke-width="4"/><path d="M102 60 L94 14 L64 36 Z" fill="#fff" stroke="#241A3D" stroke-width="4"/><ellipse cx="60" cy="66" rx="46" ry="38" fill="#fff" stroke="#241A3D" stroke-width="4"/><path d="M24 54 C30 38 46 31 58 32 C54 45 40 53 24 57 Z" fill="#FFB35C"/><circle cx="45" cy="62" r="6" fill="#241A3D"/><circle cx="75" cy="62" r="6" fill="#241A3D"/><ellipse cx="36" cy="77" rx="7" ry="4.5" fill="#FFB3C8"/><ellipse cx="84" cy="77" rx="7" ry="4.5" fill="#FFB3C8"/></g>
<g transform="translate(222 48) scale(.78)"><path d="M36 52 C26 30 28 2 40 2 C52 2 54 30 50 50 Z" fill="#fff" stroke="#241A3D" stroke-width="4"/><path d="M84 52 C94 30 92 2 80 2 C68 2 66 30 70 50 Z" fill="#fff" stroke="#241A3D" stroke-width="4"/><ellipse cx="60" cy="74" rx="42" ry="34" fill="#fff" stroke="#241A3D" stroke-width="4"/><path d="M74 46 C80 40 90 42 90 50 C90 56 82 58 78 56 Z" fill="#CF2F66"/><path d="M40 72 Q46 66 52 72 M68 72 Q74 66 80 72" fill="none" stroke="#241A3D" stroke-width="4" stroke-linecap="round"/><ellipse cx="38" cy="84" rx="7" ry="4.5" fill="#FFB3C8"/><ellipse cx="82" cy="84" rx="7" ry="4.5" fill="#FFB3C8"/></g>
</svg>`;
}

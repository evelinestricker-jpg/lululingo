import { db } from '../store.js';
import { esc, icon, fmtTime, toast, loadVideoIndex } from '../ui.js';
import { checkEmbed } from './player.js';
import { youtubeId, captionsEndpoint, fetchCaptions, parseSubtitleText, buildVideo, saveMyVideo, getMyVideo, hasAiKey, videoInfo } from '../videos.js';

// »Tilføj video«: indsæt et YouTube-link → hent japanske undertekster → AI laver klikbare ord → gem på telefonen
export async function render(view, params) {
  const st = { step: 'link', link: params[0] || '', id: '', cap: null, err: '', paste: '', title: '', done: 0, total: 0, dead: false };

  const top = `
    <div class="topbar">
      <a class="icon-btn" href="#/library" aria-label="Tilbage til biblioteket">${icon('back')}</a>
      <div class="t"><b>Tilføj video</b><span>Fra YouTube, med klikbare undertekster</span></div>
    </div>`;

  const thumb = (id) => `<img class="add-thumb" src="https://i.ytimg.com/vi/${esc(id)}/mqdefault.jpg" alt="">`;

  function draw() {
    const auto = !!captionsEndpoint();
    let body = '';
    if (st.step === 'link') {
      body = `
        <section class="card stack">
          <label class="field-label" for="link">YouTube-link</label>
          <input class="input" id="link" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://youtu.be/…" value="${esc(st.link)}">
          ${st.err ? `<div class="err">${esc(st.err)}</div>` : ''}
          <button class="btn primary" id="go">${icon('next')} ${auto ? 'Hent video' : 'Fortsæt'}</button>
          <p class="help">Videoen skal have <b>japanske undertekster</b>. Dem, som en person har skrevet, giver det bedste resultat. YouTubes automatiske undertekster virker også, men kan indeholde fejl. Tryk på »Del« → »Kopiér link« i YouTube-appen.</p>
          ${auto ? '' : `<p class="help">Automatisk hentning af undertekster er ikke sat op. Du kan indsætte underteksterne selv, eller sætte det op under <a href="#/settings">Indstillinger</a>.</p>`}
        </section>`;
    } else if (st.step === 'loading') {
      body = `<section class="card stack add-wait">${thumb(st.id)}<div class="spinner" aria-hidden="true"></div><b>Henter videoen fra YouTube…</b></section>`;
    } else if (st.step === 'found') {
      const c = st.cap;
      body = `
        <section class="card stack">
          ${thumb(st.id)}
          <div class="stack" style="gap:2px"><b class="jp">${esc(c.title || 'YouTube-video')}</b><span class="small muted">${esc(c.channel || '')}${c.duration ? ' · ' + fmtTime(c.duration) : ''}</span></div>
          <div class="tags"><span class="tag">${c.segments.length} undertekster</span>${c.kind === 'asr' ? '<span class="tag pink">Automatiske undertekster</span>' : '<span class="tag mint">Skrevet af en person</span>'}</div>
          ${c.kind === 'asr' ? '<p class="help">Underteksterne er lavet automatisk af YouTube. AI’en retter de værste fejl, men der kan være nogle tilbage.</p>' : ''}
          ${c.embeddable === false ? '<div class="err">Ejeren tillader ikke, at videoen vises i andre apps. Underteksterne kan laves, men selve videoen kan kun ses på YouTube.</div>' : ''}
          ${aiButton()}
          <button class="btn ghost" id="back">Vælg en anden video</button>
        </section>`;
    } else if (st.step === 'nocaps') {
      body = `
        <section class="card stack">
          ${thumb(st.id)}
          <div class="err">${esc(st.err)}</div>
          ${st.code === 'not_found' || st.code === 'blocked' ? '' : '<p class="help" style="margin:0">Appen kan kun lave klikbare undertekster, når videoen har <b>japanske undertekster på YouTube</b>. I YouTube-appen kan du se det ved, at der er en <b>CC</b>-knap på videoen, og at <b>Japansk</b> kan vælges under undertekster.</p>'}
          <button class="btn primary" id="back">Vælg en anden video</button>
          ${st.code === 'not_found' || st.code === 'blocked' ? '' : '<button class="btn ghost" id="own">Jeg har underteksterne som fil</button>'}
        </section>`;
    } else if (st.step === 'paste') {
      body = `
        <section class="card stack">
          ${thumb(st.id)}
          ${st.err ? `<div class="err">${esc(st.err)}</div>` : ''}
          <label class="field-label" for="paste">Indsæt de japanske undertekster med tider</label>
          <textarea class="input area" id="paste" rows="8" placeholder="0:01&#10;これは私の家族です。&#10;0:07&#10;今、昼の12時半です。" spellcheck="false">${esc(st.paste)}</textarea>
          <p class="help">Det kan være en SRT- eller VTT-fil, eller teksten fra YouTubes »Vis transskription« (på en computer: under videobeskrivelsen). Hver linje skal have en tid.</p>
          <label class="field-label" for="title">Titel (valgfri)</label>
          <input class="input" id="title" value="${esc(st.title)}" placeholder="Videoens titel">
          ${aiButton()}
          <button class="btn ghost" id="back">Vælg en anden video</button>
        </section>`;
    } else if (st.step === 'work') {
      const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
      body = `
        <section class="card stack add-wait">
          ${thumb(st.id)}
          <b>Laver klikbare undertekster…</b>
          <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" style="width:100%"><span style="width:${pct}%"></span></div>
          <span class="small muted">Del ${st.done} af ${st.total}. ${st.total > 12 ? 'En lang video tager et par minutter.' : 'Det tager typisk under et minut.'} Du må gerne bruge resten af appen imens, men luk den ikke.</span>
        </section>`;
    }
    view.innerHTML = top + body;
    bind();
  }

  function aiButton() {
    if (!hasAiKey()) return `<div class="notice">AI’en laver ordforklaringerne, så appen skal have en API-nøgle. Den lægges kun på din telefon.<a class="btn primary" href="#/settings">Tilføj API-nøgle</a></div>`;
    return `<button class="btn pink" id="make">${icon('plus')} Lav klikbare undertekster</button>
      <p class="help">AI’en (${db.settings.provider === 'claude' ? 'Claude' : 'OpenRouter'}) deler teksten op i ord og laver furigana, romaji og betydninger. Med GLM 5.3 Flash koster en video på 5 minutter typisk under 10 øre.</p>`;
  }

  const $ = (s) => view.querySelector(s);

  async function go() {
    st.link = $('#link').value.trim();
    st.err = '';
    const id = youtubeId(st.link);
    if (!id) { st.err = 'Det ligner ikke et YouTube-link. Kopiér linket fra YouTube og prøv igen.'; draw(); return; }
    st.id = id;
    const builtIn = (await loadVideoIndex().catch(() => [])).some((v) => v.id === id);
    if (builtIn || getMyVideo(id)) { toast('Den video har du allerede'); location.hash = '#/watch/' + id; return; }
    st.step = 'loading'; draw();
    // Tjek samtidig, om videoen overhovedet må vises i andre apps – ellers er der ingen grund til at bruge AI på den
    const embed = checkEmbed(id);
    let capErr = null;
    if (captionsEndpoint()) { try { st.cap = await fetchCaptions(id); } catch (e) { capErr = e; } }
    const emb = await embed;
    if (st.dead) return;
    if (emb === 'blocked' || emb === 'missing') {
      st.step = 'nocaps'; st.code = emb === 'missing' ? 'not_found' : 'blocked';
      st.err = emb === 'missing' ? 'Videoen findes ikke eller er slettet.' : 'Ejeren af videoen tillader ikke, at den vises i andre apps, så den kan ikke ses i Lululingo.';
      draw(); return;
    }
    if (!captionsEndpoint()) { toPaste(''); return; }
    try {
      if (capErr) throw capErr;
      st.step = 'found';
    } catch (e) {
      if (st.dead) return;
      // Ingen japanske undertekster: så hjælper det ikke at indsætte transskriptionen – vælg en anden video
      if (['no_captions', 'no_japanese', 'not_found'].includes(e.code)) { st.step = 'nocaps'; st.code = e.code; st.err = e.message; draw(); return; }
      toPaste(e.message + ' Du kan i stedet indsætte underteksterne selv.');
      return;
    }
    draw();
  }

  async function toPaste(err) {
    st.step = 'paste'; st.err = err; draw();
    if (!st.title) {
      const info = await videoInfo(st.id);
      if (info && !st.dead && st.step === 'paste' && !$('#title').value) { st.title = info.title; st.channel = info.channel; $('#title').value = info.title; }
    }
  }

  async function make() {
    let src;
    if (st.step === 'paste') {
      st.paste = $('#paste').value; st.title = $('#title').value.trim();
      if (!st.paste.trim()) { st.err = 'Feltet er tomt. Indsæt underteksterne i feltet først.'; draw(); return; }
      const segs = parseSubtitleText(st.paste);
      if (!segs.length) { st.err = 'Der blev ikke fundet japanske undertekster med tider i teksten. Hver linje skal have en tid, fx 0:01.'; draw(); return; }
      if (segs.length > 900) { st.err = 'Videoen er for lang (over 900 undertekster). Vælg en kortere video.'; draw(); return; }
      src = { id: st.id, title: st.title, channel: st.channel || '', duration: 0, auto: false, segments: segs };
    } else {
      const c = st.cap;
      if (c.segments.length > 900) { toast('Videoen er for lang. Vælg en kortere video.'); return; }
      src = { id: st.id, title: c.title, channel: c.channel, duration: c.duration, auto: c.kind === 'asr', segments: c.segments };
    }
    const back = st.step;
    st.step = 'work'; st.done = 0; st.total = 0; draw();
    // Arbejdet fortsætter, selvom man går til en anden side i appen – videoen gemmes, når den er færdig
    try {
      const E = await buildVideo(src, (d, t) => { if (st.dead) return; st.done = d; st.total = t; draw(); });
      if (!E) return;
      saveMyVideo(E);
      if (st.dead) { toast('»' + E.title + '« er klar under Mine videoer'); return; }
      toast('Videoen er klar!');
      location.hash = '#/watch/' + E.id;
    } catch (e) {
      if (st.dead) { toast('Videoen kunne ikke laves: ' + e.message); return; }
      st.step = back; st.err = e.message;
      if (back === 'found') toast(e.message);
      draw();
    }
  }

  function bind() {
    const g = $('#go');
    if (g) { g.onclick = go; $('#link').onkeydown = (e) => { if (e.key === 'Enter') go(); }; }
    const b = $('#back');
    if (b) b.onclick = () => { st.step = 'link'; st.err = ''; st.code = ''; st.link = ''; st.cap = null; st.title = ''; st.paste = ''; draw(); };
    const own = $('#own');
    if (own) own.onclick = () => toPaste('');
    const m = $('#make');
    if (m) m.onclick = make;
  }

  draw();
  if (st.link) go();
  return () => { st.dead = true; };
}

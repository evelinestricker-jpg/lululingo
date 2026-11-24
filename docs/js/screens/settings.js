import { db, save, resetAll } from '../store.js';
import { cardsIn } from '../srs.js';
import { OR_MODELS } from '../openrouter.js';
import { esc, icon, toast, voicesFor, pickVoice, speak, askConfirm } from '../ui.js';
import { isYouTubeUrl } from '../videos.js';
import { PIPER, isPiper, isStored, downloadVoice, removeVoice, unlockAudio } from '../voice.js';

const CLAUDE_MODELS = [
  ['claude-haiku-5-5', 'Claude Haiku 5.5 – billig'],
  ['claude-opus-5-5', 'Claude Opus 5.5 – bedst, men dyr']
];

export function render(view) {
  const S = db.settings;
  // Et YouTube-link i feltet til undertekst-tjenesten er en fejl – ryd det og forklar
  const wrongCap = !!S.captionsUrl && isYouTubeUrl(S.captionsUrl);
  if (wrongCap) { S.captionsUrl = ''; save(); }
  const or = S.provider !== 'claude';
  const known = OR_MODELS.some((m) => m.id === S.orModel);
  view.innerHTML = `
    <div class="topbar">
      <a class="icon-btn" href="#/" aria-label="Tilbage">${icon('back')}</a>
      <div class="t"><b>Indstillinger</b><span>Gemmes kun på denne telefon</span></div>
    </div>

    <section class="card stack">
      <h2>Læring</h2>
      <div>
        <label class="field-label" for="lang">Ordbogssprog</label>
        <select class="input" id="lang"><option value="da" ${S.lang === 'da' ? 'selected' : ''}>Dansk</option><option value="en" ${S.lang === 'en' ? 'selected' : ''}>English</option></select>
      </div>
      <div>
        <label class="field-label" for="level">Mit niveau (Lulu tilpasser sig)</label>
        <select class="input" id="level">${['N5', 'N4', 'N3'].map((l) => `<option ${S.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
      <div>
        <label class="field-label" for="goal">Dagligt mål (nye ord)</label>
        <select class="input" id="goal">${[5, 10, 15, 20, 30].map((g) => `<option value="${g}" ${S.goal === g ? 'selected' : ''}>${g} ord om dagen</option>`).join('')}</select>
      </div>
    </section>

    <section class="card stack">
      <h2>Snak med Lulu (AI)</h2>
      <div>
        <label class="field-label" for="provider">AI-udbyder</label>
        <select class="input" id="provider">
          <option value="openrouter" ${or ? 'selected' : ''}>OpenRouter – fx GLM (billigst)</option>
          <option value="claude" ${!or ? 'selected' : ''}>Anthropic Claude</option>
        </select>
      </div>
      ${or ? `
      <div>
        <label class="field-label" for="key">OpenRouter API-nøgle</label>
        <input class="input" id="key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sk-or-…" value="${esc(S.orKey)}">
        <p class="help">Lav en nøgle på openrouter.ai under »Keys«, og sæt et par dollars ind. Med GLM 5.3 Flash koster en besked typisk omkring en tiendedel af en øre. Nøglen gemmes kun i denne browser og sendes kun til OpenRouter.</p>
      </div>
      <div>
        <label class="field-label" for="model">Model</label>
        <select class="input" id="model">
          ${OR_MODELS.map((m) => `<option value="${m.id}" ${S.orModel === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
          <option value="__custom" ${known ? '' : 'selected'}>Anden model (skriv selv)</option>
        </select>
        <input class="input" id="custom" style="margin-top:8px" ${known ? 'hidden' : ''} placeholder="fx deepseek/deepseek-chat" value="${known ? '' : esc(S.orModel)}" autocapitalize="off" spellcheck="false" aria-label="Model-ID fra OpenRouter">
        <p class="help">Modellen skal kunne svare i JSON-format (»structured outputs« på OpenRouter).</p>
      </div>` : `
      <div>
        <label class="field-label" for="key">Anthropic API-nøgle</label>
        <input class="input" id="key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sk-ant-…" value="${esc(S.apiKey)}">
        <p class="help">Lav en nøgle på console.anthropic.com under »API Keys«. Nøglen gemmes kun i denne browser og sendes kun til Anthropic.</p>
      </div>
      <div>
        <label class="field-label" for="model">Model</label>
        <select class="input" id="model">${CLAUDE_MODELS.map(([id, n]) => `<option value="${id}" ${S.model === id ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <p class="help">Haiku 5.5 koster omkring 40 gange mindre pr. besked end Opus 5.5.</p>
      </div>`}
      <button class="btn primary" id="saveKey">${icon('check')} Gem</button>
      ${(or ? S.orKey : S.apiKey) ? '<button class="btn ghost" id="delKey">Fjern API-nøglen</button>' : ''}
      <p class="help">Del ikke din telefon eller appen med en gemt nøgle, og sæt gerne en forbrugsgrænse hos udbyderen.</p>
    </section>

    <section class="card stack">
      <h2>Egne videoer fra YouTube</h2>
      <div>
        <label class="field-label" for="capUrl">Adresse på undertekst-tjenesten (fra Cloudflare)</label>
        ${wrongCap ? '<div class="err">Her stod et YouTube-link, så det er fjernet. Videoer tilføjes under <b>Se → Tilføj en video fra YouTube</b>. Feltet her er kun til adressen på din Cloudflare-tjeneste.</div>' : ''}
        <input class="input" id="capUrl" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://lululingo-captions.….workers.dev" value="${esc(S.captionsUrl || '')}">
        <p class="help"><b>Ikke et YouTube-link</b> – videoer tilføjes under Se. Med tjenesten kan appen selv hente de japanske undertekster, når du tilføjer en video. Uden den kan du indsætte underteksterne selv. Tjenesten er gratis og lægges på din egen Cloudflare-konto. Se vejledningen i README på GitHub (afsnittet »Egne videoer«).</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn primary" id="capSave" style="flex:1">${icon('check')} Gem</button>
        <button class="btn soft" id="capTest" style="flex:1">Test</button>
      </div>
      <p class="help" id="capMsg" hidden></p>
    </section>

    <section class="card stack" id="voiceCard">
      <h2>Stemmer</h2>
      <div id="voiceRows"></div>
      <details class="help">
        <summary><b>Få en bedre stemme på iPhone</b></summary>
        <ol>
          <li>Åbn <b>Indstillinger</b> på iPhonen → <b>Tilgængelighed</b> → <b>Oplæst indhold</b> → <b>Stemmer</b>.</li>
          <li>Vælg <b>Dansk</b> (eller <b>Japansk</b>) og tryk på en stemme med <b>Forbedret</b> eller <b>Premium</b>. Tryk på sky-ikonet for at hente den.</li>
          <li>Luk Lululingo helt, åbn den igen, og vælg den nye stemme her.</li>
        </ol>
      </details>
    </section>

    <section class="card stack">
      <h2>Dine data</h2>
      <div class="set-row"><b>Flashcards</b><span class="muted small">${cardsIn().length} kort</span></div>
      <div class="set-row"><b>XP i alt</b><span class="muted small">${db.stats.xp}</span></div>
      <div class="set-row"><b>Chatbeskeder</b><span class="muted small">${db.chat.messages.length}</span></div>
      <button class="btn ghost" id="clearChat">Slet chat-historikken</button>
      <button class="btn ghost" id="reset" style="color:var(--pink-dark)">Nulstil hele appen</button>
    </section>

    <p class="credits">Lululingo · Stemmer lavet med VOICEVOX (猫使ビィ, 雨晴はう, 白上虎太郎, No.7) · Dansk oplæsning: Piper (talesyntese, MIT)</p>`;

  const $ = (s) => view.querySelector(s);

  // Stemmevalg (stemmerne kan dukke op lidt efter, at siden er åbnet)
  const SAMPLE = { da: ['da', 'Dansk stemme', 'Hej! Jeg hedder Lulu. Skal vi lære japansk sammen?'], ja: ['ja', 'Japansk stemme', 'こんにちは！わたしはルルです。いっしょにべんきょうしよう！'] };
  const piperHave = {};
  let piperBusy = '';
  async function checkPiper() { for (const l of Object.keys(PIPER)) piperHave[l] = await isStored(l); voiceRows(); }
  function voiceRows() {
    const box = $('#voiceRows');
    if (!box) return;
    box.innerHTML = Object.entries(SAMPLE).map(([k, [lang, label]]) => {
      const vs = voicesFor(lang);
      const cur = pickVoice(lang);
      const P = PIPER[lang];
      const chosen = (S.voices || {})[lang];
      const piperOpt = P && piperHave[lang] ? `<option value="piper:${lang}" ${isPiper(chosen) ? 'selected' : ''}>${esc(P.name)}</option>` : '';
      const piperRow = !P ? '' : piperHave[lang]
        ? `<p class="help">✓ Piper-stemmen er hentet og virker uden internet. <button class="linkish" data-pdel="${lang}">Slet den</button></p>`
        : `<button class="btn soft block" data-pget="${lang}" ${piperBusy ? 'disabled' : ''} style="margin-top:8px">${piperBusy === lang ? 'Henter stemmen…' : 'Hent gratis bedre stemme (Piper, ' + P.size + ')'}</button><div class="bar" id="pbar-${lang}" ${piperBusy === lang ? '' : 'hidden'} style="margin-top:8px"><span style="width:0%"></span></div>`;
      return `<div style="margin-bottom:12px">
        <label class="field-label" for="v-${k}">${label}</label>
        <div style="display:flex;gap:8px">
          <select class="input" id="v-${k}" data-lang="${lang}" ${vs.length || piperOpt ? '' : 'disabled'}>${piperOpt}${vs.length ? vs.map((v) => `<option value="${esc(v.voiceURI)}" ${!isPiper(chosen) && cur && cur.voiceURI === v.voiceURI ? 'selected' : ''}>${esc(v.name)}${v.localService === false ? ' (online)' : ''}</option>`).join('') : (piperOpt ? '' : '<option>Ingen stemme fundet</option>')}</select>
          <button class="icon-btn soft" data-test="${k}" aria-label="Prøv ${label.toLowerCase()}">${icon('sound')}</button>
        </div>
        ${piperRow}
      </div>`;
    }).join('');
    box.querySelectorAll('select[data-lang]').forEach((sel) => sel.onchange = () => {
      S.voices = Object.assign({}, S.voices, { [sel.dataset.lang]: sel.value }); save();
      unlockAudio();
      speak(SAMPLE[sel.dataset.lang][2], 0.95, sel.dataset.lang);
    });
    box.querySelectorAll('[data-pget]').forEach((b) => b.onclick = async () => {
      const lang = b.dataset.pget;
      piperBusy = lang; voiceRows();
      try {
        await downloadVoice(lang, (pct) => { const bar = $('#pbar-' + lang + ' span'); if (bar) bar.style.width = pct + '%'; });
        piperHave[lang] = true;
        S.voices = Object.assign({}, S.voices, { [lang]: 'piper:' + lang }); save();
        toast('Stemmen er hentet!');
      } catch (e) { toast('Kunne ikke hente stemmen. Tjek internettet og prøv igen.'); }
      piperBusy = ''; voiceRows();
    });
    box.querySelectorAll('[data-pdel]').forEach((b) => b.onclick = async () => {
      const lang = b.dataset.pdel;
      try { await removeVoice(lang); } catch (e) {}
      piperHave[lang] = false;
      if (isPiper((S.voices || {})[lang])) { S.voices = Object.assign({}, S.voices, { [lang]: '' }); save(); }
      voiceRows();
    });
    box.querySelectorAll('[data-test]').forEach((b) => b.onclick = () => { unlockAudio(); const [lang, , txt] = SAMPLE[b.dataset.test]; if (!speak(txt, 0.95, lang)) toast('Kan ikke læse op'); });
  }
  voiceRows();
  checkPiper();
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { if (document.body.contains(view)) voiceRows(); };
  $('#lang').onchange = (e) => { S.lang = e.target.value; save(); toast('Gemt'); };
  $('#level').onchange = (e) => { S.level = e.target.value; save(); toast('Gemt'); };
  $('#goal').onchange = (e) => { S.goal = Number(e.target.value); save(); toast('Gemt'); };
  $('#provider').onchange = (e) => { S.provider = e.target.value; save(); render(view); };
  $('#model').onchange = (e) => {
    if (or) {
      const custom = e.target.value === '__custom';
      $('#custom').hidden = !custom;
      if (!custom) { S.orModel = e.target.value; save(); toast('Gemt'); } else $('#custom').focus();
    } else { S.model = e.target.value; save(); toast('Gemt'); }
  };
  $('#saveKey').onclick = () => {
    const k = $('#key').value.trim();
    if (or) {
      if (k && !k.startsWith('sk-or-')) { toast('Det ligner ikke en OpenRouter-nøgle (sk-or-…)'); return; }
      S.orKey = k;
      if ($('#model').value === '__custom') {
        const m = $('#custom').value.trim();
        if (!m) { toast('Skriv model-ID’et, fx deepseek/deepseek-chat'); return; }
        S.orModel = m;
      }
    } else {
      if (k && !k.startsWith('sk-ant-')) { toast('Det ligner ikke en Anthropic-nøgle (sk-ant-…)'); return; }
      S.apiKey = k;
    }
    save(); toast(k ? 'Gemt – Lulu er klar' : 'Gemt'); render(view);
  };
  const capUrl = () => {
    const u = $('#capUrl').value.trim().replace(/\/+$/, '');
    return !u || /^https?:\/\//i.test(u) ? u : 'https://' + u;
  };
  $('#capSave').onclick = () => {
    const u = capUrl();
    if (isYouTubeUrl(u)) { toast('Det er et YouTube-link. Tilføj videoen under Se → Tilføj video.'); return; }
    if (u && !/^https:\/\//i.test(u) && !/^http:\/\/(localhost|127\.|192\.168\.|10\.)/i.test(u)) { toast('Adressen skal starte med https://'); return; }
    S.captionsUrl = u; save(); $('#capUrl').value = u; toast(u ? 'Gemt' : 'Adressen er fjernet');
  };
  $('#capTest').onclick = async () => {
    const msg = $('#capMsg');
    if (isYouTubeUrl(capUrl())) { $('#capMsg').hidden = false; $('#capMsg').textContent = '✗ Det er et YouTube-link. Her skal adressen på din Cloudflare-tjeneste stå, fx https://lululingo-captions.ditnavn.workers.dev'; return; }
    const u = capUrl() || (location.protocol === 'http:' ? 'api/captions' : '');
    msg.hidden = false;
    if (!u) { msg.textContent = 'Skriv adressen først.'; return; }
    msg.textContent = 'Tester…';
    try {
      const r = await fetch(u + (u.includes('?') ? '&' : '?') + 'v=qJfQyxwVIw4');
      const j = await r.json();
      msg.textContent = j.segments && j.segments.length ? `✓ Det virker! Fandt ${j.segments.length} japanske undertekster i en testvideo.` : '✗ ' + (j.message || 'Tjenesten svarede ' + r.status + '.');
    } catch (e) {
      msg.textContent = '✗ Kunne ikke nå tjenesten. Tjek adressen og internettet.';
    }
  };
  const del = $('#delKey');
  if (del) del.onclick = () => { if (or) S.orKey = ''; else S.apiKey = ''; save(); toast('API-nøglen er fjernet'); render(view); };
  $('#clearChat').onclick = async () => { if (await askConfirm({ title: 'Slet chatten?', text: 'Hele chatten med Lulu bliver slettet.', ok: 'Slet chatten' })) { db.chat.messages = []; save(); toast('Chatten er slettet'); render(view); } };
  $('#reset').onclick = async () => { if (await askConfirm({ title: 'Nulstil hele appen?', text: 'ALT bliver slettet: flashcards, fremskridt, chat, egne videoer og indstillinger. Det kan ikke fortrydes.', ok: 'Nulstil alt' })) resetAll(); };
}

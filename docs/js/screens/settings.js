import { db, save, resetAll } from '../store.js';
import { cardsIn } from '../srs.js';
import { OR_MODELS } from '../openrouter.js';
import { esc, icon, toast, voicesFor, pickVoice, speak } from '../ui.js';

const CLAUDE_MODELS = [
  ['claude-haiku-5-5', 'Claude Haiku 5.5 – billig'],
  ['claude-opus-5-5', 'Claude Opus 5.5 – bedst, men dyr']
];

export function render(view) {
  const S = db.settings;
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

    <p class="credits">Lululingo · Stemmer lavet med VOICEVOX (猫使ビィ, 雨晴はう)</p>`;

  const $ = (s) => view.querySelector(s);

  // Stemmevalg (stemmerne kan dukke op lidt efter, at siden er åbnet)
  const SAMPLE = { da: ['da', 'Dansk stemme', 'Hej! Jeg hedder Lulu. Skal vi lære japansk sammen?'], ja: ['ja', 'Japansk stemme', 'こんにちは！わたしはルルです。いっしょにべんきょうしよう！'] };
  function voiceRows() {
    const box = $('#voiceRows');
    if (!box) return;
    if (!('speechSynthesis' in window)) { box.innerHTML = '<p class="help">Din browser kan ikke læse op.</p>'; return; }
    box.innerHTML = Object.entries(SAMPLE).map(([k, [lang, label]]) => {
      const vs = voicesFor(lang);
      const cur = pickVoice(lang);
      return `<div style="margin-bottom:12px">
        <label class="field-label" for="v-${k}">${label}</label>
        <div style="display:flex;gap:8px">
          <select class="input" id="v-${k}" data-lang="${lang}" ${vs.length ? '' : 'disabled'}>${vs.length ? vs.map((v) => `<option value="${esc(v.voiceURI)}" ${cur && cur.voiceURI === v.voiceURI ? 'selected' : ''}>${esc(v.name)}${v.localService === false ? ' (online)' : ''}</option>`).join('') : '<option>Ingen stemme fundet</option>'}</select>
          <button class="icon-btn soft" data-test="${k}" aria-label="Prøv ${label.toLowerCase()}">${icon('sound')}</button>
        </div>
      </div>`;
    }).join('');
    box.querySelectorAll('select[data-lang]').forEach((sel) => sel.onchange = () => {
      S.voices = Object.assign({}, S.voices, { [sel.dataset.lang]: sel.value }); save();
      speak(SAMPLE[sel.dataset.lang][2], 0.95, sel.dataset.lang);
    });
    box.querySelectorAll('[data-test]').forEach((b) => b.onclick = () => { const [lang, , txt] = SAMPLE[b.dataset.test]; if (!speak(txt, 0.95, lang)) toast('Kan ikke læse op'); });
  }
  voiceRows();
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
  const del = $('#delKey');
  if (del) del.onclick = () => { if (or) S.orKey = ''; else S.apiKey = ''; save(); toast('API-nøglen er fjernet'); render(view); };
  $('#clearChat').onclick = () => { if (confirm('Slette hele chatten med Lulu?')) { db.chat.messages = []; save(); toast('Chatten er slettet'); render(view); } };
  $('#reset').onclick = () => { if (confirm('Slette ALT – flashcards, fremskridt, chat og indstillinger? Det kan ikke fortrydes.')) resetAll(); };
}

import { db, save, activity } from '../store.js';
import { cardsIn } from '../srs.js';
import { esc, icon, lulu, speak, toast, pickVoice } from '../ui.js';
import { mountCartoon } from '../cartoon.js';
import { isPiper, sayPiper, stopPiper, unlockAudio } from '../voice.js';

const GREETING = {
  N5: { reply_jp: 'こんにちは！わたしはルルです。あなたの なまえは？', reading: 'こんにちは！わたしはルルです。あなたの なまえは？', romaji: 'Konnichiwa! Watashi wa Ruru desu. Anata no namae wa?', translation: 'Hej! Jeg hedder Lulu. Hvad hedder du?', translationEn: 'Hi! I\'m Lulu. What\'s your name?', suggestions: ['わたしは〇〇です。', 'こんにちは！', 'わかりません'] },
  N4: { reply_jp: 'こんにちは！ルルです。今日は何をしましたか？', reading: 'こんにちは！ルルです。きょうはなにをしましたか？', romaji: 'Konnichiwa! Ruru desu. Kyō wa nani o shimashita ka?', translation: 'Hej! Det er Lulu. Hvad har du lavet i dag?', translationEn: 'Hi! It\'s Lulu. What did you do today?', suggestions: ['学校に行きました。', 'アニメを見ました。', 'わかりません'] },
  N3: { reply_jp: 'やっほー、ルルだよ！最近ハマっていることはある？', reading: 'やっほー、ルルだよ！さいきんハマっていることはある？', romaji: 'Yahhō, Ruru da yo! Saikin hamatte iru koto wa aru?', translation: 'Hejsa, det er Lulu! Er der noget, du er helt vild med for tiden?', translationEn: 'Hey, it\'s Lulu! Anything you\'re into lately?', suggestions: ['アニメにハマってる！', '日本語の勉強かな。', 'もう一度お願いします'] }
};
const MOOD_ACT = { happy: 'happy hop', laugh: 'laugh bounce note', surprised: 'surprised jump !', think: 'think ?', love: 'love heart', shy: 'shy', sad: 'sad', idle: 'idle nod' };

const PHONE = '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>';
const BULB = '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>';
const KEYS = '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>';
const svg = (p, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

let busy = false;

// ---------- Oplæsning (telefonens egne stemmer) ----------
// Læser en række stykker op efter hinanden. onTalk(true/false) bruges til Lulus mund.
let speakRun = 0;
function webSpeak(p, onTalk) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(false); return; }
    const u = new SpeechSynthesisUtterance(p.text);
    u.lang = p.lang === 'ja' ? 'ja-JP' : p.lang === 'en' ? 'en-US' : 'da-DK';
    const v = pickVoice(p.lang); if (v) u.voice = v;
    u.rate = p.rate || 0.9;
    u.pitch = p.lang === 'ja' ? 1.25 : 1.1;
    u.onstart = () => onTalk(true);
    u.onend = () => { onTalk(false); resolve(true); };
    u.onerror = () => { onTalk(false); resolve(false); };
    speechSynthesis.speak(u);
  });
}
// Læser en række stykker op efter hinanden – med Piper-stemmen, hvis den er valgt, ellers telefonens stemme.
// onTalk(true/false) bruges til Lulus mund.
async function speakParts(parts, onTalk) {
  const run = ++speakRun;
  try { speechSynthesis.cancel(); } catch (e) {}
  stopPiper();
  let any = false;
  for (const p of parts) {
    if (run !== speakRun) break;
    const chosen = db.settings.voices && db.settings.voices[p.lang];
    let ok = false;
    if (isPiper(chosen)) {
      try { ok = await sayPiper(p.lang, p.text, { rate: (p.rate || 0.9) + 0.1, onStart: () => onTalk(true), onEnd: () => onTalk(false) }); } catch (e) { ok = false; }
    }
    if (!ok && run === speakRun) ok = await webSpeak(p, onTalk);
    any = any || ok;
    if (run === speakRun) await new Promise((r) => setTimeout(r, 180));
  }
  onTalk(false);
  return any;
}
function hush() { speakRun++; try { speechSynthesis.cancel(); } catch (e) {} stopPiper(); }

export function render(view) {
  const S = db.settings;
  const msgs = db.chat.messages;
  if (!S.chatMode) S.chatMode = 'call';
  let error = '';
  let rec = null;
  let alive = true;
  let cleanup = [];

  function greet() {
    if (msgs.length) return;
    const g = GREETING[S.level] || GREETING.N5;
    msgs.push({ role: 'lulu', data: Object.assign({ correction: '', explanation: '', mood: 'happy' }, g, { translation: S.lang === 'en' ? g.translationEn : g.translation }), local: true });
    save();
  }
  const keyFor = () => (S.provider === 'claude' ? S.apiKey : S.orKey);
  const hasSpeech = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const lastLulu = () => [...msgs].reverse().find((m) => m.role === 'lulu');

  async function ask(text) {
    const claude = S.provider === 'claude';
    const { luluReply } = await import(claude ? '../claude.js' : '../openrouter.js');
    const history = msgs.slice(-30).map((m) => m.role === 'user'
      ? { role: 'user', content: m.text }
      : { role: 'assistant', content: JSON.stringify(m.data) });
    // Samtalen skal starte med en brugerbesked – Lulus hilsen kom først, så vi markerer starten
    if (history.length && history[0].role !== 'user') history.unshift({ role: 'user', content: '(The learner opened the chat.)' });
    const words = cardsIn('video').slice(-15).map((c) => c.w);
    return luluReply({ apiKey: keyFor(), model: claude ? S.model : S.orModel, level: S.level, lang: S.lang, history, words });
  }

  function stopAll() {
    cleanup.forEach((f) => { try { f(); } catch (e) {} });
    cleanup = [];
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    hush();
  }

  function header(extra = '') {
    return `<div class="chat-head">
      <span class="av">${lulu(40)}</span>
      <div class="t"><b>Lulu-sensei</b><span id="status">Tilpasser sig dit niveau</span></div>
      ${extra}
      <button class="pill" id="lvl" aria-label="Niveau ${esc(S.level)}, tryk for at skifte">${esc(S.level)}</button>
      <button class="pill" id="mode" aria-label="${S.chatMode === 'call' ? 'Skift til skrift' : 'Skift til opkald'}">${S.chatMode === 'call' ? svg(KEYS, 16) + ' Tekst' : svg(PHONE, 16) + ' Opkald'}</button>
    </div>`;
  }
  function bindHeader(redraw) {
    view.querySelector('#lvl').onclick = () => { S.level = { N5: 'N4', N4: 'N3', N3: 'N5' }[S.level] || 'N5'; save(); toast('Niveau: ' + S.level); redraw(); };
    view.querySelector('#mode').onclick = () => { stopAll(); S.chatMode = S.chatMode === 'call' ? 'text' : 'call'; save(); start(); };
  }
  const noKeyHtml = () => `<div class="notice">For at Lulu kan svare, skal appen have en API-nøgle fra ${S.provider === 'claude' ? 'Anthropic' : 'OpenRouter'}. Den lægges kun på din telefon.<a class="btn primary" href="#/settings">Tilføj API-nøgle</a></div>`;

  // ================= Opkald (tal med Lulu) =================
  function callMode() {
    const st = { inCall: false, t0: 0, phase: 'idle', you: '', showHints: false, typing: false, timer: 0 };
    const clock0 = performance.now();
    const now = () => (performance.now() - clock0) / 1000;
    const E = { title: '', characters: { lulu: {} }, lines: [], cues: [{ t: 0, scene: 'room', sky: 'day', pos: { lulu: 200 }, act: { lulu: 'happy wave' }, cam: { z: 1.45, on: 'lulu' } }] };

    view.innerHTML = `<div class="chat-page call">
      ${header()}
      ${keyFor() ? '' : noKeyHtml()}
      <div class="call-stage" id="stage" aria-hidden="true"></div>
      <div class="call-cap" id="cap" aria-live="polite"></div>
      <div class="call-you" id="you" hidden></div>
      <div class="sugg call-hints" id="hints" hidden></div>
      <form class="composer" id="form" hidden>
        <label class="field"><span class="sr">Besked til Lulu</span>
          <textarea id="input" rows="1" placeholder="Skriv på japansk eller dansk…"></textarea>
          <button class="send" type="submit" aria-label="Send">${icon('send')}</button>
        </label>
      </form>
      <div class="call-ctl" id="ctl"></div>
    </div>`;
    const $ = (s) => view.querySelector(s);
    const toon = mountCartoon($('#stage'), E, now, () => true);
    cleanup.push(toon);
    const act = (a) => toon.cue({ t: now(), act: { lulu: a } });

    let talkLine = null;
    const onTalk = (on) => {
      if (on) { talkLine = { speaker: 'lulu', start: now(), end: 1e9 }; E.lines.push(talkLine); }
      else if (talkLine) { talkLine.end = now(); talkLine = null; }
    };

    function status(txt) { const el = $('#status'); if (el) el.textContent = txt; }
    function tick() {
      if (!alive || !st.inCall) return;
      const s = Math.floor((performance.now() - st.t0) / 1000);
      const label = { listening: 'Lytter…', thinking: 'Tænker…', speaking: 'Taler…' }[st.phase] || 'I opkald';
      status(`${label} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    }

    function caption() {
      const m = lastLulu();
      const d = m && m.data;
      let h = '';
      if (error) h += `<div class="err">${esc(error)}</div>`;
      if (d) {
        if (d.correction) h += `<div class="tip">${icon('check')}<span><b>Lille tip</b>${esc(d.correction)}</span></div>`;
        if (d.explanation) h += `<div class="bub da"><span class="expl">${esc(d.explanation)}</span></div>`;
        h += `<div class="bub cap-main">
          <span class="jpt jp">${esc(d.reply_jp)}</span>
          ${d.reading && d.reading !== d.reply_jp ? `<span class="small muted jp">${esc(d.reading)}</span>` : ''}
          ${S.ro ? `<span class="rom">${esc(d.romaji)}</span>` : ''}
          ${S.tr ? `<span class="tr">${esc(d.translation)}</span>` : ''}
          <div class="acts"><button data-again>${icon('replay')} Igen</button><button data-slow>Langsomt</button><button data-tr aria-pressed="${S.tr}">Oversæt</button><button data-ro aria-pressed="${S.ro}">Romaji</button></div>
        </div>`;
      }
      $('#cap').innerHTML = h;
      const b = (sel, f) => { const el = $('#cap').querySelector(sel); if (el) el.onclick = f; };
      b('[data-again]', () => { unlockAudio(); sayLast(false); });
      b('[data-slow]', () => { unlockAudio(); sayLast(true); });
      b('[data-tr]', () => { S.tr = !S.tr; save(); caption(); });
      b('[data-ro]', () => { S.ro = !S.ro; save(); caption(); });
    }

    function hints() {
      const d = lastLulu() && lastLulu().data;
      const s = (d && d.suggestions) || [];
      const el = $('#hints');
      el.hidden = !st.showHints || !s.length || busy;
      el.innerHTML = s.map((x, i) => `<span class="hint"><button class="jp" data-hear="${i}" aria-label="Hør: ${esc(x)}">${icon('sound', 14)} ${esc(x)}</button><button class="go" data-use="${i}" aria-label="Send ${esc(x)}">${icon('send', 14)}</button></span>`).join('');
      el.querySelectorAll('[data-hear]').forEach((btn) => btn.onclick = () => speakParts([{ text: s[btn.dataset.hear], lang: 'ja', rate: 0.75 }], () => {}));
      el.querySelectorAll('[data-use]').forEach((btn) => btn.onclick = () => { st.showHints = false; userSays(s[btn.dataset.use]); });
    }

    function controls() {
      const noKey = !keyFor();
      const el = $('#ctl');
      if (!st.inCall) {
        el.innerHTML = `<button class="call-btn" id="call" ${noKey ? 'disabled' : ''}>${svg(PHONE, 26)}<span>Ring til Lulu</span></button>
          ${msgs.length > 1 ? '<button class="pill" id="reset">Ny samtale</button>' : ''}`;
        $('#call').onclick = startCall;
        const r = $('#reset');
        if (r) r.onclick = () => { msgs.length = 0; error = ''; greet(); save(); caption(); controls(); };
        return;
      }
      const listening = st.phase === 'listening';
      el.innerHTML = `
        <button class="round soft" id="kb" aria-label="Skriv i stedet" aria-pressed="${st.typing}">${svg(KEYS)}</button>
        ${hasSpeech() ? `<button class="talk ${listening ? 'rec' : ''}" id="talk" aria-label="${listening ? 'Stop og send' : 'Tal til Lulu'}" ${busy ? 'disabled' : ''}>${icon('mic', 34)}<span>${listening ? 'Jeg lytter…' : busy ? 'Lulu tænker…' : 'Tryk og tal'}</span></button>` : `<span class="small muted" style="flex:1;text-align:center">Din browser kan ikke høre tale – skriv i stedet.</span>`}
        <button class="round soft" id="hint" aria-label="Hjælp mig med et svar" aria-pressed="${st.showHints}">${svg(BULB)}</button>
        <button class="round hang" id="hang" aria-label="Læg på">${svg(PHONE)}</button>`;
      $('#kb').onclick = () => { st.typing = !st.typing; $('#form').hidden = !st.typing; controls(); if (st.typing) $('#input').focus(); };
      $('#hint').onclick = () => { st.showHints = !st.showHints; hints(); controls(); };
      $('#hang').onclick = endCall;
      const talk = $('#talk');
      if (talk) talk.onclick = () => { unlockAudio(); return rec ? rec.stop() : listen(); };
    }

    function you(text, interim) {
      const el = $('#you');
      el.hidden = !text;
      el.className = 'call-you' + (interim ? ' interim' : '');
      el.textContent = text || '';
    }

    async function sayLast(slow) {
      const d = lastLulu() && lastLulu().data;
      if (!d) return;
      if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
      st.phase = 'speaking'; tick(); controls();
      const parts = [];
      if (!slow && d.explanation) parts.push({ text: d.explanation, lang: S.lang === 'en' ? 'en' : 'da', rate: 1 });
      parts.push({ text: d.reading || d.reply_jp, lang: 'ja', rate: slow ? 0.6 : 0.9 });
      const ok = await speakParts(parts, onTalk);
      if (!ok) toast('Din telefon kan ikke læse op');
      if (!alive) return;
      st.phase = 'idle'; tick(); controls();
    }

    function listen() {
      if (busy) return;
      hush();
      onTalk(false);
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      rec = new R();
      rec.lang = 'ja-JP'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      let finalText = '';
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
        }
        you(finalText + interim, !!interim);
      };
      rec.onerror = (e) => {
        rec = null; st.phase = 'idle'; controls(); tick();
        if (e.error === 'no-speech') toast('Jeg hørte ikke noget – prøv igen');
        else if (e.error !== 'aborted') { toast('Mikrofonen virker ikke her. Du kan skrive i stedet.'); st.typing = true; $('#form').hidden = false; controls(); }
      };
      rec.onend = () => {
        const was = rec; rec = null;
        if (!alive || !was) return;
        st.phase = 'idle'; controls(); tick();
        const t = finalText.trim() || ($('#you').textContent || '').trim();
        if (t) userSays(t); else you('');
      };
      try { rec.start(); st.phase = 'listening'; you(''); act('think'); controls(); tick(); } catch (e) { rec = null; }
    }

    async function userSays(text) {
      text = (text || '').trim();
      if (!text || busy) return;
      msgs.push({ role: 'user', text });
      you(text, false);
      error = ''; busy = true; st.showHints = false; hints(); save();
      st.phase = 'thinking'; controls(); tick();
      act('think dots');
      const pump = setInterval(() => act('think dots'), 2300);
      try {
        const data = await ask(text);
        msgs.push({ role: 'lulu', data });
        activity({ xp: 3 });
        busy = false; clearInterval(pump);
        if (!alive) return;
        save(); caption(); hints();
        act(MOOD_ACT[data.mood] || 'happy');
        setTimeout(() => { if (alive) you(''); }, 1200);
        await sayLast(false);
      } catch (e) {
        busy = false; clearInterval(pump);
        error = e.message || String(e);
        save();
        if (!alive) return;
        act('sad sweat');
        st.phase = 'idle'; caption(); controls(); tick();
      }
    }

    function startCall() {
      unlockAudio();
      greet();
      st.inCall = true; st.t0 = performance.now();
      st.timer = setInterval(tick, 1000);
      cleanup.push(() => clearInterval(st.timer));
      act('happy jump');
      caption(); controls(); tick();
      sayLast(false); // kaldes direkte fra trykket, så iPhone tillader oplæsning
    }

    function endCall() {
      if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
      hush();
      onTalk(false);
      clearInterval(st.timer);
      st.inCall = false; st.phase = 'idle'; st.typing = false; st.showHints = false;
      $('#form').hidden = true; hints(); you('');
      act('happy wave');
      status('Opkaldet er slut · ' + msgs.filter((m) => m.role === 'user').length + ' svar fra dig');
      controls();
    }

    const input = $('#input');
    $('#form').onsubmit = (e) => { e.preventDefault(); const v = input.value; input.value = ''; userSays(v); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); const v = input.value; input.value = ''; userSays(v); } });
    bindHeader(() => { stopAll(); start(); });
    greet(); caption(); controls();
    status(keyFor() ? 'Tryk på knappen for at ringe' : 'Mangler API-nøgle');
  }

  // ================= Tekst (den klassiske chat) =================
  function luluHtml(m) {
    const d = m.data;
    let h = '';
    if (d.correction) h += `<div class="tip">${icon('check')}<span><b>Lille tip</b>${esc(d.correction)}</span></div>`;
    if (d.explanation) h += `<div class="msg-l"><span class="mini jp" aria-hidden="true">ル</span><div class="bub da"><span class="tag" style="align-self:flex-start;background:#fff">${S.lang === 'en' ? 'Explanation' : 'Forklaring på dansk'}</span><span class="expl">${esc(d.explanation)}</span></div></div>`;
    if (d.reply_jp) h += `<div class="msg-l"><span class="mini jp" aria-hidden="true">ル</span><div class="bub">
        <span class="jpt jp">${esc(d.reply_jp)}</span>
        ${d.reading && d.reading !== d.reply_jp ? `<span class="small muted jp">${esc(d.reading)}</span>` : ''}
        ${S.ro ? `<span class="rom">${esc(d.romaji)}</span>` : ''}
        ${S.tr ? `<span class="tr">${esc(d.translation)}</span>` : ''}
        <div class="acts"><button data-say="${esc(d.reading || d.reply_jp)}">${icon('sound')} Hør</button><button data-slow="${esc(d.reading || d.reply_jp)}">Langsomt</button></div>
      </div></div>`;
    return h;
  }

  function textMode() {
    const last = lastLulu();
    const sugg = busy ? [] : (last && last.data.suggestions) || [];
    const noKey = !keyFor();
    view.innerHTML = `
      <div class="chat-page">
        ${header(`<button class="pill" id="tr" aria-pressed="${S.tr}">Oversæt</button>`)}
        ${noKey ? noKeyHtml() : ''}
        <div class="msgs" id="msgs">
          ${msgs.map((m) => m.role === 'user' ? `<div class="msg-r">${esc(m.text)}</div>` : luluHtml(m)).join('')}
          ${busy ? `<div class="msg-l"><span class="mini jp" aria-hidden="true">ル</span><div class="bub" aria-label="Lulu skriver"><span class="typing"><i></i><i></i><i></i></span></div></div>` : ''}
          ${error ? `<div class="err">${esc(error)}</div>` : ''}
        </div>
        ${sugg.length ? `<div class="sugg" aria-label="Svarforslag">${sugg.map((s) => `<button class="jp" data-sugg="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
        <form class="composer" id="form">
          <label class="field">
            <span class="sr">Besked til Lulu</span>
            <textarea id="input" rows="1" placeholder="Skriv på japansk eller dansk…" ${noKey ? 'disabled' : ''}></textarea>
            <button class="send" type="submit" aria-label="Send" ${noKey ? 'disabled' : ''}>${icon('send')}</button>
          </label>
          ${hasSpeech() ? `<button type="button" class="mic ${rec ? 'rec' : ''}" id="mic" aria-label="${rec ? 'Stop optagelse' : 'Tal på japansk'}" ${noKey ? 'disabled' : ''}>${icon('mic', 22)}</button>` : ''}
        </form>
        <div style="display:flex;justify-content:center"><button class="pill" id="reset">Ny samtale</button></div>
      </div>`;
    bindText();
    const end = view.querySelector('#form');
    if (end && msgs.length > 1) end.scrollIntoView({ block: 'end' });
  }

  async function sendText(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    if (!keyFor()) { location.hash = '#/settings'; return; }
    msgs.push({ role: 'user', text });
    error = ''; busy = true; save(); textMode();
    try {
      const data = await ask(text);
      msgs.push({ role: 'lulu', data });
      activity({ xp: 3 });
    } catch (e) {
      error = e.message || String(e);
    }
    busy = false; save();
    if (alive && S.chatMode === 'text') textMode();
  }

  function bindText() {
    const input = view.querySelector('#input');
    view.querySelector('#form').onsubmit = (e) => { e.preventDefault(); sendText(input.value); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendText(input.value); } });
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });
    view.querySelectorAll('[data-sugg]').forEach((b) => b.onclick = () => sendText(b.dataset.sugg));
    view.querySelectorAll('[data-say]').forEach((b) => b.onclick = () => { if (!speak(b.dataset.say, 0.9)) toast('Din browser kan ikke læse op'); });
    view.querySelectorAll('[data-slow]').forEach((b) => b.onclick = () => speak(b.dataset.slow, 0.6));
    view.querySelector('#tr').onclick = () => { S.tr = !S.tr; save(); textMode(); };
    bindHeader(textMode);
    view.querySelector('#reset').onclick = () => { msgs.length = 0; error = ''; greet(); textMode(); };
    const mic = view.querySelector('#mic');
    if (mic) mic.onclick = () => {
      if (rec) { rec.stop(); return; }
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      rec = new R();
      rec.lang = 'ja-JP'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (e) => { const t = e.results[0][0].transcript; rec = null; sendText(t); };
      rec.onerror = () => { rec = null; toast('Kunne ikke høre dig. Tjek at mikrofonen er tilladt.'); textMode(); };
      rec.onend = () => { if (rec) { rec = null; textMode(); } };
      try { rec.start(); textMode(); } catch (e) { rec = null; }
    };
  }

  function start() {
    greet();
    if (S.chatMode === 'call') callMode(); else textMode();
  }

  start();
  return () => { alive = false; stopAll(); };
}

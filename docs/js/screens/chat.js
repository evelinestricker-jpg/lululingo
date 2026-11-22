import { db, save, activity } from '../store.js';
import { cardsIn } from '../srs.js';
import { esc, icon, lulu, speak, toast } from '../ui.js';

const GREETING = {
  N5: { reply_jp: 'こんにちは！わたしはルルです。あなたの なまえは？', reading: 'こんにちは！わたしはルルです。あなたの なまえは？', romaji: 'Konnichiwa! Watashi wa Ruru desu. Anata no namae wa?', translation: 'Hej! Jeg hedder Lulu. Hvad hedder du?', translationEn: 'Hi! I\'m Lulu. What\'s your name?', suggestions: ['わたしは〇〇です。', 'こんにちは！', 'わかりません'] },
  N4: { reply_jp: 'こんにちは！ルルです。今日は何をしましたか？', reading: 'こんにちは！ルルです。きょうはなにをしましたか？', romaji: 'Konnichiwa! Ruru desu. Kyō wa nani o shimashita ka?', translation: 'Hej! Det er Lulu. Hvad har du lavet i dag?', translationEn: 'Hi! It\'s Lulu. What did you do today?', suggestions: ['学校に行きました。', 'アニメを見ました。', 'わかりません'] },
  N3: { reply_jp: 'やっほー、ルルだよ！最近ハマっていることはある？', reading: 'やっほー、ルルだよ！さいきんハマっていることはある？', romaji: 'Yahhō, Ruru da yo! Saikin hamatte iru koto wa aru?', translation: 'Hejsa, det er Lulu! Er der noget, du er helt vild med for tiden?', translationEn: 'Hey, it\'s Lulu! Anything you\'re into lately?', suggestions: ['アニメにハマってる！', '日本語の勉強かな。', 'もう一度お願いします'] }
};

let busy = false;

export function render(view) {
  const S = db.settings;
  const msgs = db.chat.messages;
  let error = '';
  let rec = null;
  let alive = true;

  function greet() {
    if (msgs.length) return;
    const g = GREETING[S.level] || GREETING.N5;
    msgs.push({ role: 'lulu', data: Object.assign({ correction: '', explanation: '' }, g, { translation: S.lang === 'en' ? g.translationEn : g.translation }), local: true });
    save();
  }

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

  function draw() {
    const last = [...msgs].reverse().find((m) => m.role === 'lulu');
    const sugg = busy ? [] : (last && last.data.suggestions) || [];
    const noKey = !keyFor();
    view.innerHTML = `
      <div class="chat-page">
        <div class="chat-head">
          <span class="av">${lulu(40)}</span>
          <div class="t"><b>Lulu-sensei</b><span>Tilpasser sig dit niveau</span></div>
          <button class="pill" id="lvl" aria-label="Niveau ${esc(S.level)}, tryk for at skifte">${esc(S.level)}</button>
          <button class="pill" id="tr" aria-pressed="${S.tr}">Oversæt</button>
        </div>
        ${noKey ? `<div class="notice">For at Lulu kan svare, skal appen have en API-nøgle fra ${S.provider === 'claude' ? 'Anthropic' : 'OpenRouter'}. Den lægges kun på din telefon.<a class="btn primary" href="#/settings">Tilføj API-nøgle</a></div>` : ''}
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
    bind();
    const end = view.querySelector('#form');
    if (end && msgs.length > 1) end.scrollIntoView({ block: 'end' });
  }

  function keyFor() { return S.provider === 'claude' ? S.apiKey : S.orKey; }

  function hasSpeech() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

  async function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    if (!keyFor()) { location.hash = '#/settings'; return; }
    msgs.push({ role: 'user', text });
    error = ''; busy = true; save(); draw();
    try {
      const claude = S.provider === 'claude';
      const { luluReply } = await import(claude ? '../claude.js' : '../openrouter.js');
      const history = msgs.slice(-30).map((m) => m.role === 'user'
        ? { role: 'user', content: m.text }
        : { role: 'assistant', content: JSON.stringify(m.data) });
      // Samtalen skal starte med en brugerbesked – Lulus hilsen kom først, så vi markerer starten
      if (history.length && history[0].role !== 'user') history.unshift({ role: 'user', content: '(The learner opened the chat.)' });
      const words = cardsIn('video').slice(-15).map((c) => c.w);
      const data = await luluReply({ apiKey: keyFor(), model: claude ? S.model : S.orModel, level: S.level, lang: S.lang, history, words });
      msgs.push({ role: 'lulu', data });
      activity({ xp: 3 });
    } catch (e) {
      error = e.message || String(e);
    }
    busy = false; save();
    if (alive) draw();
  }

  function bind() {
    const input = view.querySelector('#input');
    view.querySelector('#form').onsubmit = (e) => { e.preventDefault(); send(input.value); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });
    view.querySelectorAll('[data-sugg]').forEach((b) => b.onclick = () => send(b.dataset.sugg));
    view.querySelectorAll('[data-say]').forEach((b) => b.onclick = () => { if (!speak(b.dataset.say, 0.9)) toast('Din browser kan ikke læse op'); });
    view.querySelectorAll('[data-slow]').forEach((b) => b.onclick = () => speak(b.dataset.slow, 0.6));
    view.querySelector('#tr').onclick = () => { S.tr = !S.tr; save(); draw(); };
    view.querySelector('#lvl').onclick = () => { S.level = { N5: 'N4', N4: 'N3', N3: 'N5' }[S.level] || 'N5'; save(); toast('Niveau: ' + S.level); draw(); };
    view.querySelector('#reset').onclick = () => { msgs.length = 0; error = ''; greet(); draw(); };
    const mic = view.querySelector('#mic');
    if (mic) mic.onclick = () => {
      if (rec) { rec.stop(); return; }
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      rec = new R();
      rec.lang = 'ja-JP'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (e) => { const t = e.results[0][0].transcript; rec = null; send(t); };
      rec.onerror = () => { rec = null; toast('Kunne ikke høre dig. Tjek at mikrofonen er tilladt.'); draw(); };
      rec.onend = () => { if (rec) { rec = null; draw(); } };
      try { rec.start(); draw(); } catch (e) { rec = null; }
    };
  }

  greet();
  draw();
  return () => { alive = false; if (rec) try { rec.abort(); } catch (e) {} };
}

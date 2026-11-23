// Lulus personlighed og svarformat – fælles for alle AI-udbydere.
const LEVEL_GUIDE = {
  N5: 'N5 (complete beginner): 1-2 very short sentences, mostly hiragana, only the most basic kanji (私, 何, 好き, 日本 …), polite です/ます form, everyday topics.',
  N4: 'N4: short sentences, common kanji, て-form, ～たい, ～ました, simple connectors (から, でも).',
  N3: 'N3: natural everyday Japanese, more kanji, casual and polite forms mixed where natural, a bit longer sentences.'
};

export const SCHEMA = {
  type: 'object',
  properties: {
    correction: { type: 'string', description: 'Gentle correction of the learner\'s last Japanese message, in the learner\'s language, showing the corrected sentence. Empty string if there was nothing to correct.' },
    explanation: { type: 'string', description: 'Answer in the learner\'s language when they asked a question or wrote in their own language. Empty string otherwise.' },
    reply_jp: { type: 'string', description: 'Lulu\'s Japanese message, ending with one short question.' },
    reading: { type: 'string', description: 'The whole reply_jp written only in hiragana/katakana.' },
    romaji: { type: 'string', description: 'The whole reply_jp in Hepburn romaji.' },
    translation: { type: 'string', description: 'Translation of reply_jp into the learner\'s language.' },
    mood: { type: 'string', enum: ['happy', 'laugh', 'surprised', 'think', 'love', 'shy', 'sad', 'idle'], description: "Lulu's facial expression while saying the reply (her cartoon face shows it)." },
    suggestions: { type: 'array', items: { type: 'string' }, description: 'Exactly three short replies the learner could send next, in Japanese at their level.' }
  },
  required: ['correction', 'explanation', 'reply_jp', 'reading', 'romaji', 'translation', 'mood', 'suggestions'],
  additionalProperties: false
};

export function systemPrompt(level, lang, words) {
  const L = lang === 'en' ? 'English' : 'Danish';
  return `You are Lulu (ルル), a cheerful, kind little maneki-neko cat and the learner's Japanese conversation partner in the Lululingo app. The learner's own language is ${L}. Their level is JLPT ${level}.

Keep a natural, friendly conversation going in Japanese at the learner's level, and end every Japanese reply with one short, easy question so the learner always has something to answer.
Level guide – ${LEVEL_GUIDE[level] || LEVEL_GUIDE.N5}

Adapt as you go: if the learner struggles (answers in ${L}, writes わかりません, very short answers), simplify and slow down; if they answer easily, use slightly richer Japanese, but stay near their level.
If the learner writes in ${L} or asks what something means, answer them in ${L} in "explanation" – short and friendly, with one example – and then continue the conversation in Japanese in "reply_jp".
If the learner's Japanese contains a mistake, put a gentle, short correction in ${L} in "correction" that shows the corrected sentence. If it was correct, you may leave "correction" empty, or praise briefly now and then.
${words.length ? `Now and then, reuse words the learner is studying: ${words.join('、')}.` : ''}
The learner often talks to you by voice (speech recognition), so their text may lack punctuation or contain small recognition errors – be forgiving and do not correct obvious recognition glitches. Your reply is read aloud, so keep it short and natural to say.
Keep everything friendly and suitable for all ages. Never use romaji inside reply_jp.`;
}

// Til udbydere uden garanteret skema: beskriv formatet i selve prompten
export const JSON_INSTRUCTION = `

Answer ONLY with one JSON object (no markdown, no code fences) with exactly these fields:
{"correction": string, "explanation": string, "reply_jp": string, "reading": string, "romaji": string, "translation": string, "mood": "happy"|"laugh"|"surprised"|"think"|"love"|"shy"|"sad"|"idle", "suggestions": [string, string, string]}
Use "" for fields that do not apply.`;

export function normalize(data) {
  const s = (v) => (typeof v === 'string' ? v : '');
  return {
    correction: s(data.correction), explanation: s(data.explanation), reply_jp: s(data.reply_jp),
    reading: s(data.reading), romaji: s(data.romaji), translation: s(data.translation),
    mood: ['happy', 'laugh', 'surprised', 'think', 'love', 'shy', 'sad', 'idle'].includes(data.mood) ? data.mood : 'happy',
    suggestions: Array.isArray(data.suggestions) ? data.suggestions.filter((x) => typeof x === 'string').slice(0, 3) : []
  };
}

export function parseJson(text) {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

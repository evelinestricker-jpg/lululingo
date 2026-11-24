// Snak med Lulu via OpenRouter – adgang til mange billige modeller, fx GLM fra Z.ai.
// API-nøglen ligger kun på din egen telefon og sendes kun til openrouter.ai.
import { SCHEMA, systemPrompt, JSON_INSTRUCTION, normalize, parseJson } from './prompt.js';

export const OR_MODELS = [
  { id: 'z-ai/glm-5.3-flash', name: 'GLM 5.3 Flash – billigst (anbefalet)' },
  { id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash – billig' },
  { id: 'qwen/qwen3.5-flash-02-23', name: 'Qwen 3.5 Flash – billig' },
  { id: 'z-ai/glm-5.3', name: 'GLM 5.3 – klogere, lidt dyrere' },
  { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B – gratis (begrænset)' },
  { id: 'baidu/ernie-5.5-flash-preview:free', name: 'ERNIE 5.5 Flash – gratis (begrænset)' }
];

const URL = 'https://openrouter.ai/api/v1/chat/completions';

async function errorText(res) {
  let msg = '';
  try { const j = await res.json(); msg = (j && j.error && j.error.message) || ''; } catch (e) {}
  if (res.status === 401) return 'OpenRouter-nøglen virker ikke. Tjek den under Indstillinger.';
  if (res.status === 402) return 'Der er ikke flere penge på din OpenRouter-konto. Fyld op på openrouter.ai.';
  if (res.status === 403) return 'OpenRouter afviste beskeden' + (msg ? ': ' + msg.slice(0, 160) : '.');
  if (res.status === 404) return 'Modellen findes ikke på OpenRouter. Vælg en anden under Indstillinger.';
  if (res.status === 429) return 'For mange beskeder lige nu (gratis modeller har en grænse pr. minut og pr. dag). Vent lidt, eller vælg en billig betalt model.';
  if (res.status >= 500) return 'OpenRouter har problemer lige nu (' + res.status + '). Prøv igen om lidt.';
  return 'Anmodningen blev afvist (' + res.status + ')' + (msg ? ': ' + msg.slice(0, 160) : '');
}

// Generel opgave med fast JSON-svar (bruges fx til at lave ordforklaringer til videoer)
export async function askJson({ apiKey, model, system, user, schema, name = 'result', maxTokens = 16000 }) {
  const body = {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
    provider: { require_parameters: true },
    // Et loft over modellens »tænkning«: GLM tænker ellers i tusindvis af tokens, så svaret tager dobbelt så lang tid
    reasoning: { max_tokens: 1000, exclude: true },
    max_tokens: maxTokens
  };
  // Et svar må højst tage 3 minutter – ellers prøver vi igen i stedet for at vente for evigt
  const send = (b) => fetch(URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'X-Title': 'Lululingo' },
    body: JSON.stringify(b),
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(180000) : undefined
  });
  let res;
  try {
    res = await send(body);
    if (res.status === 400 || res.status === 404) {
      const plain = Object.assign({}, body, { response_format: { type: 'json_object' } });
      plain.messages = [{ role: 'system', content: system + '\n\nAnswer ONLY with one JSON object matching this JSON schema (no markdown):\n' + JSON.stringify(schema) }, { role: 'user', content: user }];
      res = await send(plain);
    }
  } catch (e) {
    if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new Error('AI’en svarede ikke inden for 3 minutter.');
    throw new Error('Ingen forbindelse til OpenRouter. Tjek internettet og prøv igen.');
  }
  if (!res.ok) throw new Error(await errorText(res));
  const j = await res.json();
  const choice = j.choices && j.choices[0];
  if (!choice) throw new Error('OpenRouter sendte et tomt svar.');
  if (choice.finish_reason === 'length') throw new Error('Svaret blev for langt.');
  return parseJson(choice.message && choice.message.content);
}

export async function luluReply({ apiKey, model, level, lang, history, words }) {
  const body = {
    model,
    messages: [{ role: 'system', content: systemPrompt(level, lang, words) + JSON_INSTRUCTION }].concat(history),
    response_format: { type: 'json_schema', json_schema: { name: 'lulu_reply', strict: true, schema: SCHEMA } },
    // Kun udbydere der kan levere JSON-svar, og ingen lang tænkning – det gør svaret hurtigt og billigt
    provider: { require_parameters: true },
    reasoning: { effort: 'low', exclude: true },
    max_tokens: 4000
  };
  const send = (b) => fetch(URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'X-Title': 'Lululingo' },
    body: JSON.stringify(b)
  });
  let res;
  try {
    res = await send(body);
    // Nogle modeller (fx Gemma) kan kun »JSON-tilstand« uden fast skema – prøv igen med det
    if (res.status === 400 || res.status === 404) {
      res = await send(Object.assign({}, body, { response_format: { type: 'json_object' } }));
    }
  } catch (e) {
    throw new Error('Ingen forbindelse til OpenRouter. Tjek internettet og prøv igen.');
  }
  if (!res.ok) throw new Error(await errorText(res));
  const j = await res.json();
  const choice = j.choices && j.choices[0];
  if (!choice) throw new Error('OpenRouter sendte et tomt svar. Prøv igen.');
  if (choice.finish_reason === 'length') throw new Error('Svaret blev for langt. Prøv igen.');
  const text = choice.message && choice.message.content;
  try { return normalize(parseJson(text)); } catch (e) { throw new Error('Lulus svar kunne ikke læses. Prøv igen.'); }
}

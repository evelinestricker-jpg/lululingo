// Snak med Lulu via Anthropic Claude – bruger Anthropics officielle SDK (pakket i vendor/anthropic.js).
// API-nøglen ligger kun på din egen telefon og sendes kun til api.anthropic.com.
import Anthropic from '../vendor/anthropic.js';
import { SCHEMA, systemPrompt, normalize, parseJson } from './prompt.js';

function friendly(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'API-nøglen virker ikke. Tjek den under Indstillinger.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'Din API-nøgle har ikke adgang til denne model.';
  if (err instanceof Anthropic.RateLimitError) return 'Lulu har fået for mange beskeder lige nu. Vent lidt og prøv igen.';
  if (err instanceof Anthropic.APIConnectionError) return 'Ingen forbindelse til internettet. Prøv igen, når du er online.';
  if (err instanceof Anthropic.BadRequestError) return 'Anmodningen blev afvist: ' + (err.message || '').slice(0, 200);
  if (err instanceof Anthropic.APIError) return 'Der skete en fejl hos Anthropic (' + (err.status || '?') + '). Prøv igen om lidt.';
  return 'Noget gik galt: ' + (err && err.message ? err.message : String(err));
}

// Generel opgave med fast JSON-svar (bruges fx til at lave ordforklaringer til videoer)
export async function askJson({ apiKey, model, system, user, schema, maxTokens = 16000 }) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  let msg;
  try {
    msg = await client.messages.create({
      model, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema } }
    });
  } catch (e) {
    throw new Error(friendly(e));
  }
  if (msg.stop_reason === 'max_tokens') throw new Error('Svaret blev for langt.');
  if (msg.stop_reason === 'refusal') throw new Error('AI’en ville ikke behandle teksten.');
  return parseJson((msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

export async function luluReply({ apiKey, model, level, lang, history, words }) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const params = {
    model,
    max_tokens: 16000,
    system: systemPrompt(level, lang, words),
    messages: history,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } }
  };
  let msg;
  try {
    if (model === 'claude-opus-5-5') {
      // Hvis et svar bliver afvist af sikkerhedsfiltre, prøver Anthropic automatisk en anden model
      try {
        msg = await client.beta.messages.create(Object.assign({}, params, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }));
      } catch (e) {
        if (e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message || '')) msg = await client.messages.create(params);
        else throw e;
      }
    } else {
      msg = await client.messages.create(params);
    }
  } catch (e) {
    throw new Error(friendly(e));
  }
  if (msg.stop_reason === 'refusal') throw new Error('Lulu kan ikke svare på det. Prøv at spørge om noget andet.');
  if (msg.stop_reason === 'max_tokens') throw new Error('Svaret blev for langt. Prøv igen.');
  const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return normalize(parseJson(text)); } catch (e) { throw new Error('Lulus svar kunne ikke læses. Prøv igen.'); }
}

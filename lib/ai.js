import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "./config.js";

/**
 * שלושה ספקי AI, מפתח אחד.
 *
 * המשתמש מדביק מפתח אחד בשדה AI_API_KEY, והספק מזוהה לפי תחילת המפתח. כך אין
 * עוד שדה בטופס, ואין דרך לבחור ספק אחד ולהדביק מפתח של ספק אחר.
 * AI_PROVIDER ו-AI_MODEL נשארים לעקיפה ידנית.
 */
export const PROVIDERS = {
  anthropic: { label: "Claude (Anthropic)", fallbackModel: "claude-opus-5-5" },
  openai: { label: "ChatGPT (OpenAI)", fallbackModel: "gpt-5-mini" },
  google: { label: "Gemini (Google)", fallbackModel: "gemini-2.5-flash" },
};

export function detectProvider(key = env.aiKey(), override = env.aiProvider()) {
  if (override && PROVIDERS[override]) return override;
  if (!key) return null;
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("AIza")) return "google";
  if (key.startsWith("sk-")) return "openai";
  return null;
}

/**
 * בוחרים מודל מתוך מה שהמפתח באמת רואה, במקום שם קבוע בקוד. שמות מודלים
 * מתחלפים כל כמה חודשים, ובוט שהותקן היום צריך להמשיך לעבוד גם בשנה הבאה.
 * נקרא מעמוד /setup, והתוצאה נשמרת בהגדרות. זו גם הבדיקה שהמפתח עובד.
 */
export async function resolveModel(provider, key, fetchImpl = fetch) {
  if (provider === "anthropic") {
    const r = await fetchImpl("https://api.anthropic.com/v1/models?limit=100", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
    if (!r.ok) return { ok: false, status: r.status };
    const ids = ((await r.json()).data || []).map((m) => m.id);
    const pick = ids.includes(PROVIDERS.anthropic.fallbackModel) ? PROVIDERS.anthropic.fallbackModel : ids[0];
    return pick ? { ok: true, model: pick } : { ok: false, status: 404 };
  }

  if (provider === "openai") {
    const r = await fetchImpl("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!r.ok) return { ok: false, status: r.status };
    const ids = ((await r.json()).data || []).map((m) => m.id);
    const pick =
      newest(ids, /^gpt-(\d+(?:\.\d+)?)-mini$/) || newest(ids, /^gpt-(\d+(?:\.\d+)?)$/) || PROVIDERS.openai.fallbackModel;
    return { ok: true, model: pick };
  }

  if (provider === "google") {
    const r = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`
    );
    if (!r.ok) return { ok: false, status: r.status };
    const ids = ((await r.json()).models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => String(m.name).replace(/^models\//, ""));
    const pick = newest(ids, /^gemini-(\d+(?:\.\d+)?)-flash$/) || PROVIDERS.google.fallbackModel;
    return { ok: true, model: pick };
  }

  return { ok: false, status: 400 };
}

/** הגרסה הגבוהה ביותר מבין השמות שמתאימים לתבנית (קבוצה 1 = מספר הגרסה). */
export function newest(ids, re) {
  return (
    ids
      .map((id) => ({ id, m: re.exec(id) }))
      .filter((x) => x.m)
      .sort((a, b) => parseFloat(b.m[1]) - parseFloat(a.m[1]))[0]?.id || null
  );
}

let testModel = null;

/** לבדיקות בלבד: מודל מזויף במקום ספק אמיתי. */
export function useTestModel(model) {
  testModel = model;
}

/** המודל לשימוש בפועל: עקיפה ידנית, אחרת מה ש-/setup בחר, אחרת ברירת המחדל. */
export function languageModel(settings = {}) {
  if (testModel) return { provider: "test", modelId: "test", model: testModel };
  const key = env.aiKey();
  const provider = detectProvider(key);
  if (!provider) throw new Error("לא זוהה ספק AI. בדקו את AI_API_KEY בעמוד /setup.");
  const modelId = env.aiModel() || settings.ai_model || PROVIDERS[provider].fallbackModel;
  const factory = {
    anthropic: () => createAnthropic({ apiKey: key }),
    openai: () => createOpenAI({ apiKey: key }),
    google: () => createGoogleGenerativeAI({ apiKey: key }),
  }[provider];
  return { provider, modelId, model: factory()(modelId) };
}

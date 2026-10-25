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
  // Haiku: מספיק לתזכורות, רשימות ופתקים, ובערך 2–5 דולר בחודש. Opus עלה פי חמישה בערך (רועי, 25.10).
  anthropic: { label: "Claude (Anthropic)", fallbackModel: "claude-haiku-5-5" },
  openai: { label: "ChatGPT (OpenAI)", fallbackModel: "gpt-5-mini" },
  google: { label: "Gemini (Google)", fallbackModel: "gemini-2.5-flash" },
};

/**
 * המפתח: ממשתני הסביבה (מסלול Claude Code, או מי שהוסיף ב-Vercel), אחרת מה שהודבק
 * בעמוד ההקמה. כך הבוט עולה לאוויר בלי מפתח, והכרטיס אצל ספק ה-AI בא בסוף ("המוח בסוף").
 */
export function aiKeyOf(settings = {}) {
  return env.aiKey() || settings?.ai_key || "";
}

export function detectProvider(key = env.aiKey(), override = env.aiProvider()) {
  if (override && PROVIDERS[override]) return override;
  if (!key) return null;
  if (key.startsWith("sk-ant-")) return "anthropic";
  // Google: הפורמט הישן "AIza", והחדש (2026) "AQ.".
  if (key.startsWith("AIza") || key.startsWith("AQ.")) return "google";
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
    // ה-Haiku החדש ביותר (השם בלי תאריך, למשל claude-haiku-5-5)
    const pick = newest(ids, /^claude-haiku-(\d+(?:-\d+)?)$/) || ids[0];
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

/** הגרסה הגבוהה ביותר מבין השמות שמתאימים לתבנית (קבוצה 1 = מספר הגרסה, "4.5" או "4-5"). */
export function newest(ids, re) {
  const v = (x) => parseFloat(x.m[1].replace("-", "."));
  return (
    ids
      .map((id) => ({ id, m: re.exec(id) }))
      .filter((x) => x.m)
      .sort((a, b) => v(b) - v(a))[0]?.id || null
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
  const key = aiKeyOf(settings);
  const provider = detectProvider(key);
  if (!provider) throw new Error("לא זוהה ספק AI. בדקו את המפתח בעמוד /setup.");
  // מודל שנבחר לספק אחר לא נשלח לספק הנוכחי: מי שהחליף מפתח של Gemini במפתח של Claude מקבל את ברירת המחדל של Claude.
  const saved = settings.ai_provider === provider ? settings.ai_model : null;
  const modelId = env.aiModel() || saved || PROVIDERS[provider].fallbackModel;
  const factory = {
    anthropic: () => createAnthropic({ apiKey: key }),
    openai: () => createOpenAI({ apiKey: key }),
    google: () => createGoogleGenerativeAI({ apiKey: key }),
  }[provider];
  return { provider, modelId, model: factory()(modelId) };
}

/**
 * מכסה או יתרה שנגמרו אצל ספק ה-AI. זו לא תקלה מסתורית: בדרך כלל אמצעי התשלום לא
 * מחובר או שהיתרה נגמרה, ולכן אומרים למשתמש בדיוק מה קרה ומה לעשות.
 * ה-SDK עוטף את השגיאה (RetryError ‹ APICallError), ולכן בודקים גם את lastError.
 */
export function isQuotaError(e) {
  const errs = [e, e?.lastError, e?.cause].filter(Boolean);
  return errs.some((x) => x.statusCode === 429 || /quota|rate.?limit|credit balance|insufficient_quota/i.test(x.message || ""));
}

export const NO_BRAIN =
  "🧠 כמעט מוכן! חסר לי רק מוח.\n" +
  'בעמוד ההקמה (/setup), בשלב "מוסיפים לבוט מוח", מדביקים את המפתח של Claude. מיד אחר כך אפשר לכתוב לי.';

export const QUOTA_MESSAGE =
  "⏳ ספק ה-AI עצר את הבקשה בגלל מכסה או יתרה, ולכן לא הצלחתי לענות.\n" +
  "בודקים באתר של ספק ה-AI שאמצעי התשלום מחובר ושיש יתרה (בהדרכה: השלב \"מוסיפים לבוט מוח\").\n" +
  "אם הכול תקין שם, מחכים דקה ומנסים שוב.";

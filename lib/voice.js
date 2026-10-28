import { env } from "./config.js";

/**
 * תמלול הודעה קולית (תוספת "הודעות קוליות").
 * Groq מריץ Whisper בחינם ובמהירות, ומכיר עברית. בלי מפתח התוספת כבויה.
 * המפתח: GROQ_API_KEY ב-Vercel (מסלול Claude Code), אחרת מה שהודבק בעמוד ההקמה.
 */
export const groqKeyOf = (settings = {}) => env.groqKey() || settings?.groq_key || "";

export function voiceEnabled(settings) {
  return Boolean(groqKeyOf(settings));
}

/** בודק מול Groq שהמפתח עובד, לפני שהוא נשמר. מחזיר הודעת שגיאה, או null. */
export async function checkGroqKey(key) {
  if (!/^gsk_/.test(key)) return "המפתח של Groq מתחיל ב-gsk_. מעתיקים אותו שוב מ-Groq.";
  const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { authorization: `Bearer ${key}` } }).catch(() => null);
  if (r?.ok) return null;
  return r?.status === 401 ? "Groq לא מכיר את המפתח הזה. יוצרים מפתח חדש ב-Groq ומדביקים אותו." : "Groq לא ענה. מנסים שוב עוד דקה.";
}

export async function transcribe(audio, mimeType = "audio/ogg", key = env.groqKey()) {
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mimeType }), "voice.ogg");
  form.append("model", "whisper-large-v3");
  form.append("language", "he");
  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: form,
  });
  if (!r.ok) {
    console.error("transcription failed", r.status, await r.text().catch(() => ""));
    return "";
  }
  return ((await r.json()).text || "").trim();
}

/** תמלול נכנס לשיחה עם סימון, כדי שהמודל יידע שזה דיבור ולא טקסט שהוקלד. */
export function frameTranscript(text) {
  return text ? `[תמלול הודעה קולית]\n${text}\n[סוף התמלול]` : "";
}

import { env } from "./config.js";

/**
 * תמלול הודעה קולית (תוספת "הודעות קוליות").
 * Groq מריץ Whisper בחינם ובמהירות, ומכיר עברית. בלי GROQ_API_KEY התוספת כבויה.
 */
export function voiceEnabled() {
  return Boolean(env.groqKey());
}

export async function transcribe(audio, mimeType = "audio/ogg") {
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mimeType }), "voice.ogg");
  form.append("model", "whisper-large-v3");
  form.append("language", "he");
  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.groqKey()}` },
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

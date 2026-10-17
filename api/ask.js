import * as store from "../lib/db.js";
import { same } from "../lib/session.js";
import { converse } from "../lib/core.js";

/**
 * תוספת "Siri וקיצורי דרך": דלת שנייה לאותו עוזר, בלי טלגרם.
 * קיצור דרך באייפון שולח POST עם הטקסט שהוכתב ומקבל את התשובה כטקסט.
 *
 * POST /api/ask   Authorization: Bearer <המפתח מעמוד ההקמה>   {"text": "..."}
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const settings = await store.getSettings();
  if (!settings.ask_token || !same(req.headers.authorization, `Bearer ${settings.ask_token}`)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!settings.owner_chat_id) return res.status(409).json({ error: "הבוט עוד לא מחובר לבעלים" });

  const text = String((typeof req.body === "object" ? req.body?.text : req.body) || "").trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: "חסר טקסט" });

  try {
    const { text: reply } = await converse({ chatId: String(settings.owner_chat_id), text, inputKind: "ask", settings });
    // טקסט פשוט: קיצור הדרך מקריא אותו כמו שהוא.
    return res.status(200).setHeader("content-type", "text/plain; charset=utf-8").send(reply);
  } catch (e) {
    console.error("ask failed", e);
    return res.status(500).setHeader("content-type", "text/plain; charset=utf-8").send("משהו נשבר, נסו שוב עוד רגע.");
  }
}

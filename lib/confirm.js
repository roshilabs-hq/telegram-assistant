import * as store from "./db.js";

/**
 * אישור בשני שלבים לפעולות שאי אפשר לבטל: מחיקת אירוע, שליחת מייל, וזימון ביומן (Google שולח למוזמנים מייל).
 *
 * בקריאה הראשונה הכלי לא מבצע. הוא רושם בקשה ממתינה ומחזיר "צריך אישור",
 * והמודל מציג למשתמש מה עומד לקרות. רק בתור הבא, אחרי שהמשתמש אישר, אותה
 * קריאה מתבצעת. אישור שניתן באותו תור נדחה, כי זה המודל שמאשר לעצמו.
 *
 * הבקשות הממתינות נשמרות בשרת ומוצגות למודל בכל תור (pendingInstructions).
 * בלי זה המודל לא זוכר בתור הבא מה הציע, ומתחיל את ההצעה מחדש.
 */

const TTL_MS = 10 * 60 * 1000;
const keyOf = (chatId) => `pending:${chatId}`;

export async function listPending(chatId, now = Date.now()) {
  const v = await store.getSetting(keyOf(chatId), null);
  return (v?.items || []).filter((p) => now - p.at < TTL_MS);
}

async function savePending(chatId, items) {
  await store.setSetting(keyOf(chatId), { items });
}

/**
 * @returns {{ confirmed: true, item } | { confirmed: false, sameTurn?: boolean }}
 */
export async function gate(chatId, turnId, action, target, details = {}) {
  const items = await listPending(chatId);
  const hit = items.find((p) => p.action === action && p.target === String(target));
  if (hit && hit.turn !== turnId) {
    await savePending(chatId, items.filter((p) => p !== hit));
    return { confirmed: true, item: hit };
  }
  if (hit) return { confirmed: false, sameTurn: true };
  await savePending(chatId, [...items, { action, target: String(target), turn: turnId, at: Date.now(), ...details }]);
  return { confirmed: false };
}

export function pendingInstructions(pending) {
  if (!pending?.length) return null;
  // כותרות ונושאים מגיעים מ-Google, כלומר ממי ששלח את המייל או ההזמנה. JSON משאיר אותם בשורה אחת ובמירכאות.
  const q = (s) => JSON.stringify(String(s ?? ""));
  const lines = pending.map((p) => {
    if (p.action === "delete_event") return `- מחיקת האירוע ${q(p.summary)} — event_id: ${p.target}`;
    if (p.action === "send_email") return `- שליחת מייל אל ${q(p.to)}, נושא ${q(p.subject)} — draft_id: ${p.target}`;
    if (p.action === "send_draft") return `- שליחת הטיוטה אל ${q(p.to)}, נושא ${q(p.subject)} — gmail_draft_id: ${p.target}`;
    if (p.action === "create_event" || p.action === "update_event")
      return `- אירוע ${q(p.summary)} עם זימון אל ${q(p.to)} — ${p.action} עם confirm_id: ${p.target}`;
    return `- ${p.action} — ${p.target}`;
  });
  return `פעולות שכבר הצגת למשתמש/ת וממתינות לאישור:
${lines.join("\n")}

אם ההודעה האחרונה היא אישור ("כן", "מאשר", "שלח", "תמחק") — קרא/י לאותו כלי עם אותו מזהה בדיוק, פעם אחת, בלי לבקש אישור נוסף. אם המשתמש/ת סירב/ה או שינה/תה נושא — אל תבצע/י, ואל תחזור/י לזה מיוזמתך.`;
}

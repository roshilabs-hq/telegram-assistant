import { randomUUID } from "node:crypto";
import * as store from "./db.js";
import * as g from "./google.js";
import { sendMessage } from "./telegram.js";

/**
 * אישור לפעולות שיוצאות החוצה או שאי אפשר לבטל: שליחת מייל, שליחת טיוטה,
 * מחיקת אירוע, ואירוע עם מוזמנים (Google שולח להם מייל).
 *
 * הכלי לא מבצע. הוא רושם בקשה ממתינה, והשרת שולח לבעלים הודעה עם הפרטים
 * וכפתור "✅ לאשר". הפעולה רצה רק כשלוחצים על הכפתור (api/telegram.js),
 * בלי לעבור דרך המודל. ככה מייל זדוני שהמודל קורא לא יכול "לאשר" במקומך,
 * והפרטים בהודעה הם מה שבאמת יישלח, ולא מה שהמודל סיפר עליו.
 */

const TTL_MS = 60 * 60 * 1000;
const keyOf = (chatId) => `pending:${chatId}`;

export async function listPending(chatId, now = Date.now()) {
  const v = await store.getSetting(keyOf(chatId), null);
  return (v?.items || []).filter((p) => now - p.at < TTL_MS);
}

async function savePending(chatId, items) {
  await store.setSetting(keyOf(chatId), { items });
}

const RUN = {
  send_email: (p) => g.sendMail(p.mail),
  send_draft: (p) => g.sendDraft(p.target),
  delete_event: (p) => g.deleteEvent(p.target),
  create_event: (p, tz) => g.createEvent(tz, p.input),
  update_event: (p, tz) => g.updateEvent(tz, p.input),
};

const short = (s, n) => (String(s || "").length > n ? `${String(s).slice(0, n)}…` : String(s || ""));

/** הטקסט בהודעת האישור נבנה כאן מהנתונים עצמם. */
export function describe(p) {
  const list = (x) => (Array.isArray(x) ? x.join(", ") : x || "");
  if (p.action === "send_email")
    return [
      "📧 לשלוח את המייל?",
      `אל: ${list(p.mail.to)}`,
      p.mail.cc?.length ? `עותק: ${list(p.mail.cc)}` : null,
      `נושא: ${p.mail.subject || ""}`,
      "",
      short(p.mail.body, 1500),
    ].filter((l) => l !== null).join("\n");
  if (p.action === "send_draft") return `📧 לשלוח את הטיוטה?\nאל: ${p.to}\nנושא: ${p.subject}`;
  if (p.action === "delete_event") return `🗑 למחוק מהיומן?\n${p.summary}${p.when ? `\n${p.when}` : ""}`;
  const i = p.input;
  return [
    p.action === "create_event" ? "📅 לקבוע את האירוע ולשלוח זימון?" : "📅 לעדכן את האירוע ולשלוח זימון?",
    i.title ? `נושא: ${i.title}` : null,
    i.start ? `מתי: ${i.start}` : null,
    `מוזמנים (יקבלו מייל): ${list(i.attendees)}`,
    i.description ? `\nתיאור: ${short(i.description, 800)}` : null,
  ].filter((l) => l !== null).join("\n");
}

/** רושם בקשה ממתינה ושולח לבעלים הודעה עם כפתורים. */
export async function propose(chatId, action, details) {
  const item = { id: randomUUID().slice(0, 8), action, at: Date.now(), ...details };
  await savePending(chatId, [...(await listPending(chatId)), item]);
  await sendMessage(chatId, describe(item), {
    plain: true,
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ לאשר", callback_data: `c|y|${item.id}` },
        { text: "❌ לבטל", callback_data: `c|n|${item.id}` },
      ]],
    },
  });
  return { ok: true, waiting_for_button: true, summary: describe(item) };
}

/** לחיצה על כפתור: מוציא את הבקשה מהרשימה, ומבצע אותה רק אם אישרו. */
export async function decide(chatId, id, approve, tz) {
  const items = await listPending(chatId);
  const p = items.find((x) => x.id === id);
  if (!p) return { ok: false, text: "⌛ הבקשה כבר לא בתוקף. אפשר לבקש שוב." };
  await savePending(chatId, items.filter((x) => x !== p));
  // אחרי ההחלטה השאלה בשורה הראשונה כבר לא רלוונטית. נשארים רק הפרטים.
  const details = describe(p).split("\n").slice(1).join("\n");
  if (!approve) return { ok: true, text: `❌ בוטל. שום דבר לא יצא.\n${details}` };
  const r = await RUN[p.action](p, tz);
  return r?.ok === false
    ? { ok: false, text: `⚠️ לא הצליח: ${r.error || "שגיאה"}\n${details}` }
    : { ok: true, text: `✅ בוצע.\n${details}` };
}

export function pendingInstructions(pending) {
  if (!pending?.length) return null;
  // הנושאים מגיעים מ-Google, כלומר ממי ששלח את המייל או ההזמנה. JSON משאיר אותם בשורה אחת ובמירכאות.
  const lines = pending.map((p) => `- ${p.action} ${JSON.stringify(short(p.summary || p.subject || p.mail?.subject || p.input?.title, 80))}`);
  return `פעולות שממתינות לכפתור "✅ לאשר" בצ'אט:
${lines.join("\n")}

את האישור נותנים רק בכפתור. אם המשתמש/ת כותב/ת "כן", אמור/י לו/ה ללחוץ על הכפתור בהודעה. אל תקרא/י שוב לכלי בשביל לאשר.`;
}

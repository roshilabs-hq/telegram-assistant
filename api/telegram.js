import { secrets } from "../lib/config.js";
import { same } from "../lib/session.js";
import * as store from "../lib/db.js";
import { converse, isAllowed, tryPair, timezoneOf } from "../lib/core.js";
import { sendMessage, sendTyping, answerCallback, editMessageText, downloadFile } from "../lib/telegram.js";
import { voiceEnabled, transcribe, frameTranscript } from "../lib/voice.js";
import { isQuotaError, QUOTA_MESSAGE } from "../lib/ai.js";

const FAILURE = "משהו נשבר אצלי ולא הצלחתי לענות 😕 אפשר לנסות שוב עוד רגע.";
// חיבור Google שפג הוא לא תקלה מסתורית: זה דבר מסוים שמתקנים בדקה, ונשאר שבור עד שמתקנים.
const GOOGLE_EXPIRED =
  "🔑 החיבור ל-Google פג, ולכן אין לי גישה ליומן ולמייל.\n" +
  'מתקנים בעמוד ההקמה (/setup): בתוספת "יומן ו-Gmail" לוחצים "חיבור מחדש".\n' +
  "תזכורות, פתקים ורשימות ממשיכים לעבוד כרגיל.";
const NO_VOICE =
  "עוד לא מחברו אותי להודעות קוליות 🎙️ בינתיים אפשר לכתוב לי.\n(מי שהקים את הבוט יכול להוסיף את זה: תוספת \"הודעות קוליות\".)";
const WELCOME = (name) =>
  `🎉 מחוברים! מעכשיו אני העוזר/ת האישי/ת ${name ? `של ${name}` : "שלך"}.\n\n` +
  "אפשר לכתוב לי בחופשיות, למשל:\n" +
  "• תזכיר לי מחר ב-9 להתקשר לרופא\n" +
  "• כל יום ראשון ב-8 תזכיר לי להוציא את הפח\n" +
  "• תוסיף חלב וביצים לרשימת הקניות\n" +
  "• תרשום שהקוד של השער הוא 4521";

/** טלגרם שולח את הסוד שקבענו ב-setWebhook בכותרת. בלעדיו, הבקשה לא מטלגרם. */
const fromTelegram = (req) => same(req.headers["x-telegram-bot-api-secret-token"], secrets.webhook());

function when(tz, iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-CA", { timeZone: tz }) === new Date().toLocaleDateString("en-CA", { timeZone: tz }) ? "" : "מחר ";
  return `${day}ב-${d.toLocaleTimeString("he-IL", { timeZone: tz, hour: "2-digit", minute: "2-digit" })}`;
}

/** כפתורים מתחת לתזכורת. לא עוברים דרך המודל בכלל: לחיצה היא פעולה, לא שיחה. */
async function handleCallback(cb, settings) {
  const chatId = String(cb.message?.chat?.id || "");
  if (!isAllowed(chatId, settings) || !(await store.claim(`cb:${cb.id}`))) return answerCallback(cb.id);

  const [kind, op, id, mins] = String(cb.data || "").split("|");
  const action = { d: "done", t: "tomorrow", s: "snooze" }[op];
  if (kind !== "r" || !id || !action) return answerCallback(cb.id);

  const tz = timezoneOf(settings);
  const result = await store.reminderAction(tz, chatId, action, Number(id), Number(mins) || 10);
  if (!result.ok) return answerCallback(cb.id, "לא הצלחתי לעדכן");

  if (result.action === "done") {
    await answerCallback(cb.id, "סומן כבוצע");
    await editMessageText(chatId, cb.message.message_id, `✅ ${result.text}`);
  } else {
    const at = when(tz, result.due_at);
    await answerCallback(cb.id, `אזכיר ${at}`);
    await editMessageText(
      chatId,
      cb.message.message_id,
      `⏱ ${result.text}\nנדחה — אזכיר ${at}${result.kept_series ? " (התזכורת הקבועה נשארה כמו שהיא)" : ""}`
    );
  }
}

export default async function handler(req, res) {
  // תמיד 200 לטלגרם: תשובה אחרת גורמת לו לשלוח את אותו עדכון שוב ושוב.
  if (req.method !== "POST") return res.status(200).send("ok");
  if (!fromTelegram(req)) return res.status(401).send("unauthorized");

  let replyTo = null;
  try {
    const settings = await store.getSettings();

    if (req.body?.callback_query) {
      await handleCallback(req.body.callback_query, settings);
      return res.status(200).send("ok");
    }

    const msg = req.body?.message;
    if (!msg?.chat?.id || msg.chat.type !== "private") return res.status(200).send("ok");
    const chatId = String(msg.chat.id);

    if (!isAllowed(chatId, settings)) {
      // הזר היחיד שמקבל תשובה הוא מי ששלח את קוד הצימוד הנכון, וזה עובד רק פעם אחת.
      if (await tryPair(chatId, msg.text, settings)) {
        await sendMessage(chatId, WELCOME(settings.owner_name));
      }
      return res.status(200).send("ok");
    }
    replyTo = chatId;

    if (!(await store.claim(`tg_update:${req.body.update_id}`))) return res.status(200).send("ok");

    let text = msg.text || msg.caption || "";
    let inputKind = "text";
    if (msg.voice || msg.audio) {
      if (!voiceEnabled()) {
        await sendMessage(chatId, NO_VOICE);
        return res.status(200).send("ok");
      }
      await sendTyping(chatId);
      const file = msg.voice || msg.audio;
      text = frameTranscript(await transcribe(await downloadFile(file.file_id), file.mime_type || "audio/ogg"));
      inputKind = "voice";
      if (!text) {
        await sendMessage(chatId, "לא הצלחתי לתמלל את ההודעה הקולית 🤔 אפשר לנסות שוב או לכתוב.");
        return res.status(200).send("ok");
      }
    }
    if (!text) {
      await sendMessage(chatId, "כרגע אני מבין/ה רק טקסט והודעות קוליות 🙂");
      return res.status(200).send("ok");
    }

    await sendTyping(chatId);
    const { text: reply, links } = await converse({ chatId, text, inputKind, settings });

    // קישור בכפתור נפתח בלחיצה אחת. קישור בתוך טקסט מקפיץ קודם חלון "לפתוח את הקישור?".
    const keyboard = links.length
      ? { reply_markup: { inline_keyboard: [links.slice(0, 3).map((l) => ({ text: l.label, url: l.url }))] } }
      : {};
    await sendMessage(chatId, reply, keyboard);
    return res.status(200).send("ok");
  } catch (e) {
    console.error("telegram handler failed", e);
    if (replyTo) await sendMessage(replyTo, e?.expired ? GOOGLE_EXPIRED : isQuotaError(e) ? QUOTA_MESSAGE : FAILURE).catch(() => {});
    return res.status(200).send("ok");
  }
}

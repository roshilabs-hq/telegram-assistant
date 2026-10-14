import { randomInt } from "node:crypto";
import { env } from "./config.js";
import * as store from "./db.js";
import { languageModel } from "./ai.js";
import { think } from "./brain.js";

/** אזור הזמן: מה שנבחר ב-/setup, אחרת משתנה הסביבה, אחרת ישראל. */
export function timezoneOf(settings = {}) {
  return settings.timezone || env.timezone();
}

// ---------- בעלים וצימוד ----------

/**
 * מי מורשה לדבר עם הבוט: הבעלים שנקבע בצימוד, ועוד מספרים שהוגדרו ידנית
 * ב-ALLOWED_CHAT_IDS. בלי בעלים, אף אחד לא מורשה (סגור כברירת מחדל).
 */
export function isAllowed(chatId, settings = {}) {
  const id = String(chatId);
  if (settings.owner_chat_id && String(settings.owner_chat_id) === id) return true;
  return env.extraChatIds().includes(id);
}

export function newPairingCode() {
  return String(randomInt(100000, 1000000));
}

/**
 * הודעת צימוד: "/start 123456" (מה שקישור הצימוד שולח), או הקוד לבד.
 * עובדת רק כשעוד אין בעלים, ורק עם הקוד שמופיע בעמוד /setup.
 */
export function pairingCodeIn(text) {
  const m = /^\s*(?:\/start\s+)?(\d{6})\s*$/.exec(String(text || ""));
  return m ? m[1] : null;
}

export async function tryPair(chatId, text, settings) {
  if (settings.owner_chat_id) return false;
  const code = pairingCodeIn(text);
  if (!code || !settings.pairing_code || code !== String(settings.pairing_code)) return false;
  await store.setSetting("owner_chat_id", String(chatId));
  await store.setSetting("pairing_code", null);
  return true;
}

// ---------- מצב מערכת ----------

export async function systemStatus(chatId, settings, now = new Date()) {
  const beat = await store.lastHeartbeat();
  const { reminders } = await store.listReminders(chatId);
  const overdue = reminders.filter((r) => new Date(r.due_at) < new Date(now.getTime() - 5 * 60000)).length;
  let ai = null;
  try {
    const m = languageModel(settings);
    ai = { provider: m.provider, model: m.modelId };
  } catch {}
  return {
    scheduler: {
      healthy: Boolean(beat && now - beat < 3 * 60000),
      last_tick_minutes_ago: beat ? Math.round((now - beat) / 60000) : null,
    },
    reminders_open: reminders.length,
    reminders_overdue: overdue,
    ai,
    voice_enabled: Boolean(env.groqKey()),
    briefing_time: settings.briefing_time || null,
  };
}

// ---------- תור שיחה ----------

/**
 * העוזר בלי ערוץ: טוען היסטוריה, חושב, שומר את שני הצדדים.
 * כל מה שקשור לטלגרם עצמו (webhook, כפתורים, קול) נשאר ב-api/telegram.js,
 * כדי שערכת ה-WhatsApp תוכל להשתמש בדיוק באותו מוח.
 */
export async function converse({ chatId, text, inputKind = "text", settings }) {
  settings = settings || (await store.getSettings());
  const tz = timezoneOf(settings);
  const t0 = Date.now();
  const history = await store.getHistory(chatId);

  try {
    const ai = languageModel(settings);
    const out = await think({
      chatId,
      history,
      text,
      settings,
      tz,
      ai,
      status: () => systemStatus(chatId, settings),
    });
    await store.saveMessage(chatId, "user", text);
    await store.saveMessage(chatId, "assistant", out.text);
    await store.logTurn({ chat_id: chatId, input_kind: inputKind, ms: Date.now() - t0, ok: true, ...out.trace });
    return out;
  } catch (e) {
    await store.logTurn({
      chat_id: chatId,
      input_kind: inputKind,
      ms: Date.now() - t0,
      ok: false,
      error: String(e?.message || e).slice(0, 500),
    });
    throw e;
  }
}

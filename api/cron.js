import { timingSafeEqual } from "node:crypto";
import { secrets } from "../lib/config.js";
import * as store from "../lib/db.js";
import { timezoneOf } from "../lib/core.js";
import { sendMessage } from "../lib/telegram.js";
import { nextOccurrence, dayKey, hhmm, atWallTime } from "../lib/time.js";
import { googleConfigured, listEvents } from "../lib/google.js";

/**
 * רץ כל דקה. Supabase קורא לכתובת הזו (pg_cron), כי בחשבון החינמי של Vercel
 * תזמון רץ רק פעם ביום.
 */
function authorized(req) {
  const want = Buffer.from(`Bearer ${secrets.cron()}`);
  const got = Buffer.from(String(req.headers.authorization || ""));
  return secrets.cron() && got.length === want.length && timingSafeEqual(got, want);
}

export function reminderKeyboard(id) {
  // callback_data מוגבל ל-64 בתים, אז רק קוד פעולה ומספר.
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ בוצע", callback_data: `r|d|${id}` },
          { text: "⏱ 10 דק׳", callback_data: `r|s|${id}|10` },
          { text: "🌅 מחר 9:00", callback_data: `r|t|${id}` },
        ],
      ],
    },
  };
}

export async function deliverDueReminders(tz, send = sendMessage, now = new Date()) {
  let sent = 0;
  for (const id of await store.dueReminderIds(now)) {
    const r = await store.claimReminder(id);
    if (!r) continue; // ריצה אחרת כבר תפסה אותה

    try {
      await send(r.chat_id, `⏰ תזכורת: ${r.text}`, reminderKeyboard(r.id));
      sent++;
    } catch (e) {
      console.error("reminder send failed, releasing", r.id, e);
      await store.patchReminder(r.id, { done: false });
      continue;
    }

    // תזכורת חוזרת: אותה שורה מתגלגלת למופע הבא, במקום להישאר "בוצע".
    if (r.recurrence_kind) {
      const next = nextOccurrence(tz, r, now);
      await store.patchReminder(
        r.id,
        next ? { due_at: next.toISOString(), done: false } : { recurrence_kind: null, recurrence_until: null }
      );
    }
  }
  return sent;
}

/** @param events אירועי היומן של היום (תוספת יומן ו-Gmail), אם מחובר */
export function briefingText(rows, today, tz, events = []) {
  const dayOf = (iso) => dayKey(tz, new Date(iso));
  const todays = rows.filter((r) => dayOf(r.due_at) === today);
  const later = rows.filter((r) => dayOf(r.due_at) !== today);
  if (!todays.length && !later.length && !events.length) return "☀️ בוקר טוב! אין תזכורות מיוחדות להיום.";

  const time = (iso) => new Date(iso).toLocaleTimeString("he-IL", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const short = (iso) => {
    const [, m, d] = dayOf(iso).split("-");
    return `${Number(d)}.${Number(m)}`;
  };
  const lines = [
    ...events.map((e) => `• 📆 ${e.start?.all_day ? "כל היום" : time(e.start?.iso)} ${e.title}`),
    ...todays.map((r) => `• ${time(r.due_at)} ${r.text}${r.recurrence_kind ? " 🔁" : ""}`),
  ];
  if (later.length) {
    const shown = later.slice(0, 4).map((r) => `${r.text} (${short(r.due_at)})`).join(", ");
    const rest = later.length - Math.min(later.length, 4);
    lines.push(`📅 בהמשך השבוע: ${shown}${rest ? ` ועוד ${rest}` : ""}`);
  }
  return `☀️ בוקר טוב! מה על הפרק היום:\n${lines.join("\n")}`;
}

/**
 * תדריך בוקר (תוספת). נשלח בכל דקה בחצי השעה שאחרי השעה שנבחרה, אבל רק פעם
 * אחת ביום בזכות המנעול. כך דקה שהתזמון פספס לא מפילה את התדריך של כל היום.
 */
export async function maybeBriefing(settings, tz, send = sendMessage, now = new Date()) {
  const at = settings.briefing_time;
  const owner = settings.owner_chat_id;
  if (!at || !owner) return false;
  const [h, m] = at.split(":").map(Number);
  const nowMin = (([hh, mm]) => hh * 60 + mm)(hhmm(tz, now).split(":").map(Number));
  if (nowMin < h * 60 + m || nowMin >= h * 60 + m + 30) return false;

  const today = dayKey(tz, now);
  const key = `briefing:${today}:${owner}`;
  if (!(await store.claim(key))) return false;
  try {
    const horizon = new Date(now.getTime() + 7 * 86400000).toISOString();
    const rows = await store.upcomingReminders(String(owner), now.toISOString(), horizon);
    let events = [];
    if (googleConfigured() && settings.google?.refresh_token) {
      // יומן שלא עונה לא מפיל את התדריך: שולחים בלי האירועים.
      const endOfDay = atWallTime(tz, 1, 0, 0, now).toISOString();
      const r = await listEvents(tz, { time_min: now.toISOString(), time_max: endOfDay }).catch(() => null);
      if (r?.ok) events = r.events;
    }
    await send(owner, briefingText(rows, today, tz, events));
    return true;
  } catch (e) {
    console.error("briefing failed, releasing lock", e);
    await store.release(key);
    return false;
  }
}

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).send("unauthorized");

  await store.heartbeat();
  const settings = await store.getSettings();
  const tz = timezoneOf(settings);

  const sent = await deliverDueReminders(tz);
  const briefing = await maybeBriefing(settings, tz);
  if (hhmm(tz) === "04:00") await store.pruneLocks();

  return res.status(200).json({ ok: true, sent, briefing });
}

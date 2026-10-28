import { secrets } from "../lib/config.js";
import { same } from "../lib/session.js";
import * as store from "../lib/db.js";
import { timezoneOf } from "../lib/core.js";
import { sendMessage } from "../lib/telegram.js";
import { nextOccurrence, dayKey, hhmm, atWallTime } from "../lib/time.js";
import { googleConfigured, listEvents } from "../lib/google.js";
import { VERSION, latestVersion, isNewer } from "../lib/version.js";

/**
 * רץ כל דקה. Supabase קורא לכתובת הזו (pg_cron), כי בחשבון החינמי של Vercel
 * תזמון רץ רק פעם ביום.
 */
const authorized = (req) => Boolean(secrets.cron()) && same(req.headers.authorization, `Bearer ${secrets.cron()}`);

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

    const text = `⏰ תזכורת: ${r.text}`;
    try {
      await send(r.chat_id, text, reminderKeyboard(r.id));
      sent++;
    } catch (e) {
      console.error("reminder send failed, releasing", r.id, e);
      await store.patchReminder(r.id, { done: false });
      continue;
    }
    // גם התזכורת שנשלחה נכנסת לשיחה. בלי זה, אחרי שהיא נשלחה המודל לא מוצא אותה ו"מתקן" שהיא לא קיימת.
    await store.saveMessage(r.chat_id, "assistant", text).catch((e) => console.error("reminder history failed", r.id, e));

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

/** אחרי עדכון: הודעה אחת לבעלים בטלגרם. בהתקנה הראשונה רק נרשמת הגרסה, בלי הודעה. */
export async function maybeAnnounceUpdate(settings, send = sendMessage, version = VERSION) {
  if (settings.version_seen === version) return false;
  if (!(await store.claim(`version:${version}`))) return false; // ריצה מקבילה כבר שלחה
  await store.setSetting("version_seen", version);
  if (!settings.version_seen || !settings.owner_chat_id) return false;
  await send(
    settings.owner_chat_id,
    `✅ הבוט עודכן לבד לגרסה ${version}. אין צורך לעשות כלום.
מה חדש: ${CHANGELOG}`
  );
  return true;
}

const CHANGELOG = "https://github.com/roshilabs-hq/telegram-assistant/blob/main/CHANGELOG.md";
const DAY = 86400000;

/**
 * יש גרסה חדשה, והבוט עדיין לא קיבל אותה (העדכונים האוטומטיים כבויים, או שהקוד שונה ביד):
 * הודעה אחת לגרסה, ביומיים אחרי שהיא נראתה לראשונה. מי שהפעיל עדכונים מקבל אותה לבד לפני כן.
 * בודקים פעם ביום, ב-10:00.
 */
export async function maybeNotifyNewVersion(settings, url, send = sendMessage, now = new Date(), latestFn = latestVersion) {
  const latest = await latestFn();
  if (!latest || !isNewer(latest, VERSION)) return false;
  const seen = settings.newer_seen;
  if (seen?.v !== latest) {
    await store.setSetting("newer_seen", { v: latest, at: now.toISOString() });
    return false;
  }
  if (seen.told || now - new Date(seen.at) < 2 * DAY || !settings.owner_chat_id) return false;
  if (!(await store.claim(`newer:${latest}`))) return false;
  await store.setSetting("newer_seen", { ...seen, told: true });
  await send(
    settings.owner_chat_id,
    [
      `🔔 יש גרסה חדשה של העוזר (${latest}). הגרסה שלך: ${VERSION}.`,
      `כדי לקבל אותה, ומעכשיו כל עדכון לבד: בעמוד ההקמה ${url}/setup לוחצים "הפעלת עדכונים אוטומטיים", ואז שתי לחיצות Commit. תוך כמה דקות הבוט מתעדכן ומודיע לך.`,
      `שינית את הבוט בעצמך עם Claude Code? כותבים ל-Claude: "תעדכן את הבוט מהערכה".`,
      `מה חדש: ${CHANGELOG}`,
    ].join("\n\n")
  );
  return true;
}

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).send("unauthorized");

  await store.heartbeat();
  const settings = await store.getSettings();
  const tz = timezoneOf(settings);

  const sent = await deliverDueReminders(tz);
  const briefing = await maybeBriefing(settings, tz);
  await maybeAnnounceUpdate(settings).catch((e) => console.error("update notice failed", e));
  if (hhmm(tz) === "10:00")
    await maybeNotifyNewVersion(settings, `https://${req.headers.host}`).catch((e) => console.error("new version notice failed", e));
  if (hhmm(tz) === "04:00") await store.pruneLocks();

  return res.status(200).json({ ok: true, sent, briefing });
}

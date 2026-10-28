import { randomBytes } from "node:crypto";
import * as store from "./db.js";

/**
 * תוספת "יומן ו-Gmail": יומן Google ותיבת Gmail של המשתמש.
 *
 * החיבור הוא סקריפט קטן שהמשתמש מדביק ב-script.google.com (הקוד ב-google-script.js).
 * הוא רץ בחשבון שלו, ועונה רק לבקשה עם הסיסמה שבתוכו. בהגדרות נשמרים:
 * google = { secret, url, email }. יש secret כבר כשהקוד מוצג, ו-url רק אחרי החיבור.
 */

export const SCRIPT_URL = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;

export const googleConnected = (settings) => Boolean(settings?.google?.url);

/** הסיסמה שנכנסת לקוד שהמשתמש מעתיק. נוצרת פעם אחת, וחיבור מחדש משתמש באותה סיסמה. */
export async function scriptSecret() {
  const g = (await store.getSetting("google")) || {};
  if (g.secret) return g.secret;
  const secret = randomBytes(24).toString("base64url");
  await store.setSetting("google", { ...g, secret });
  return secret;
}

export const EXPIRED_MESSAGE =
  'החיבור ל-Google לא עונה. בעמוד ההקמה (/setup), בתוספת "יומן Google ו-Gmail", מדביקים מחדש את הקוד ופורסים שוב.';

async function call(op, args = {}, g) {
  g ||= await store.getSetting("google");
  if (!g?.url) return { ok: false, error: "Google עוד לא מחובר." };
  const r = await fetch(g.url, { method: "POST", body: JSON.stringify({ secret: g.secret, op, args }) }).catch(() => null);
  const j = await r?.json().catch(() => null);
  // לא JSON: הסקריפט נמחק, הפריסה בוטלה או שהגישה הוסרה. מתקנים בחיבור מחדש, לא בניסיון חוזר.
  if (!j || j.code === 401) return { ok: false, expired: true, error: EXPIRED_MESSAGE };
  return j;
}

/** מהטופס בעמוד ההקמה: בודקים שהכתובת באמת עונה עם הסיסמה, ורק אז שומרים. */
export async function connect(url) {
  url = String(url || "").trim();
  if (!SCRIPT_URL.test(url)) return { ok: false, error: "זו לא כתובת של סקריפט. מעתיקים את הכתובת שמסתיימת ב-/exec מחלון הפריסה." };
  const g = { secret: await scriptSecret(), url };
  const r = await call("ping", {}, g);
  if (!r.ok) return { ok: false, error: "הסקריפט לא עונה. בודקים שהדבקת את הקוד מהעמוד הזה, ושבחרת \"כולם\" ב\"למי יש גישה\"." };
  await store.setSetting("google", { ...g, email: r.email || null });
  return { ok: true, email: r.email };
}

/** בודק באמת מול הסקריפט, ולא רק שיש שורה במסד. */
export async function checkConnection() {
  const g = await store.getSetting("google");
  if (!g?.url) return { connected: false, reason: "never" };
  const r = await call("ping", {}, g);
  return r.ok ? { connected: true, email: r.email || g.email } : { connected: false, reason: r.expired ? "expired" : "error", email: g.email };
}

// ---------- יומן ----------

function fmt(tz, t) {
  if (!t) return null;
  if (t.all_day) return { all_day: true, date: t.date };
  return {
    all_day: false,
    when: new Date(t.iso).toLocaleString("he-IL", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    iso: t.iso,
  };
}

const emails = (list) =>
  (Array.isArray(list) ? list : [])
    .map((a) => (typeof a === "string" ? a : a?.email))
    .filter((e) => typeof e === "string" && e.includes("@"))
    .map((e) => e.trim());

const plus = (iso, minutes) => new Date(new Date(iso).getTime() + minutes * 60000).toISOString();

export async function listEvents(tz, { time_min, time_max, max_results = 20 }) {
  const res = await call("list_events", { time_min: time_min || new Date().toISOString(), time_max, max: max_results });
  if (!res.ok) return res;
  const events = res.events.map((e) => ({
    id: e.id,
    title: e.title || "(ללא כותרת)",
    location: e.location,
    start: fmt(tz, e.start),
    end: fmt(tz, e.end),
  }));
  return { ok: true, count: events.length, events };
}

/** אירועים שחופפים לזמן מסוים. אירוע של יום שלם או הזמנה שנדחתה לא נחשבים התנגשות. */
export async function findConflicts(tz, start, end) {
  const res = await call("list_events", { time_min: start, time_max: end, max: 10 });
  if (!res.ok) return [];
  return res.events
    .filter((e) => !e.start.all_day && !e.declined)
    .map((e) => ({ id: e.id, title: e.title || "(ללא כותרת)", start: fmt(tz, e.start) }));
}

export async function createEvent(tz, { title, start, end, duration_minutes, location, description, attendees }) {
  if (!start) return { ok: false, error: "חסר זמן התחלה" };
  const endIso = end || plus(start, Number(duration_minutes) || 60);
  // נבדק לפני היצירה, כדי שהאירוע החדש לא יתנגש עם עצמו. מדווחים ולא חוסמים.
  const conflicts = await findConflicts(tz, start, endIso);
  // עם מוזמנים הסקריפט שולח להם זימון אמיתי.
  const res = await call("create_event", { title, start, end: endIso, location, description, guests: emails(attendees) });
  if (!res.ok) return res;
  return {
    ok: true,
    id: res.event.id,
    title: res.event.title,
    start: fmt(tz, res.event.start),
    invited: res.event.guests,
    ...(conflicts.length ? { conflicts } : {}),
  };
}

export async function getEvent(tz, id) {
  const res = await call("get_event", { id });
  if (!res.ok) return res;
  return { ok: true, id: res.event.id, title: res.event.title || "(ללא כותרת)", start: fmt(tz, res.event.start), attendees: res.event.guests };
}

export async function updateEvent(tz, { event_id, title, start, end, duration_minutes, location, description, attendees }) {
  const args = { id: event_id, title, location, description };
  if (start !== undefined) {
    args.start = start;
    args.end = end;
    if (!end && duration_minutes) args.end = plus(start, duration_minutes);
    if (!args.end) {
      // הזזה בלי משך: שומרים על המשך הקיים של האירוע
      const cur = await call("get_event", { id: event_id });
      if (!cur.ok) return cur;
      const was = cur.event.start.iso && cur.event.end.iso ? (new Date(cur.event.end.iso) - new Date(cur.event.start.iso)) / 60000 : 60;
      args.end = plus(start, was);
    }
  }
  if (attendees !== undefined) args.guests = emails(attendees);
  if (Object.values(args).filter((v) => v !== undefined).length < 2) return { ok: false, error: "אין מה לעדכן" };
  const res = await call("update_event", args);
  if (!res.ok) return res;
  return { ok: true, id: res.event.id, title: res.event.title, start: fmt(tz, res.event.start), end: fmt(tz, res.event.end) };
}

export async function deleteEvent(id) {
  const res = await call("delete_event", { id });
  return res.ok ? { ok: true, deleted: true } : res;
}

// ---------- Gmail ----------

/** רשימה עם שורה ראשונה בלבד: חיפוש אחד יכול להחזיר עשרות מיילים, והגוף המלא נקרא רק כשצריך. */
export async function searchEmails({ query, max_results = 10 }) {
  const res = await call("search_mail", { query, max: max_results });
  if (!res.ok) return res;
  return {
    ok: true,
    messages: res.messages.map((m) => ({ id: m.id, from: m.from, subject: m.subject, date: m.date, snippet: m.body, unread: m.unread })),
  };
}

export async function readEmail(id) {
  if (!id) return { ok: false, error: "חסר id" };
  const res = await call("read_mail", { id });
  return res.ok ? { ok: true, ...res.message } : res;
}

/** טיוטה בלבד: נשמרת ב-Gmail ואף אחד לא מקבל אותה. לכן לא צריך אישור. */
export async function draftReply({ message_id, body }) {
  if (!body?.trim()) return { ok: false, error: "חסר גוף" };
  const res = await call("draft_reply", { id: message_id, body });
  return res.ok ? { ok: true, gmail_draft_id: res.draft_id, to: res.to, subject: res.subject } : res;
}

export async function getDraft(id) {
  // כולל הגוף: בהודעת האישור מראים בדיוק מה יוצא
  return call("get_draft", { id });
}

export async function sendDraft(id) {
  const res = await call("send_draft", { id });
  return res.ok ? { ok: true, sent: true } : res;
}

export async function sendMail({ to, cc, subject, body }) {
  if (!to || (Array.isArray(to) && !to.length)) return { ok: false, error: "חסר נמען" };
  const res = await call("send_mail", { to, cc, subject, body });
  return res.ok ? { ok: true, sent: true, to, subject } : res;
}

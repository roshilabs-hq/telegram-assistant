import { randomUUID } from "node:crypto";
import { env } from "./config.js";
import * as store from "./db.js";

/**
 * תוספת "יומן ו-Gmail": יומן Google ותיבת Gmail של המשתמש.
 *
 * החיבור נשמר כ-refresh token בטבלת ההגדרות (רק השרת ניגש אליה). ממנו מבקשים
 * מ-Google מפתח גישה לשעה, ושומרים אותו בזיכרון של השרת עד שהוא פג.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const CAL = "https://www.googleapis.com/calendar/v3";

export function googleConfigured() {
  return Boolean(env.googleClientId() && env.googleClientSecret());
}

export function redirectUri(base) {
  return `${base}/api/google/callback`;
}

export function consentUrl(base, state) {
  const p = new URLSearchParams({
    client_id: env.googleClientId(),
    redirect_uri: redirectUri(base),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** Google אומר שהחיבור מת (בוטל, פג, או שהסיסמה הוחלפה). מתקנים בחיבור מחדש, לא בניסיון חוזר. */
export class GoogleAuthExpired extends Error {
  constructor(detail) {
    super("החיבור ל-Google פג");
    this.expired = true;
    this.detail = detail;
  }
}

async function tokenRequest(body) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (j.error === "invalid_grant") throw new GoogleAuthExpired(j.error_description || "");
    throw new Error(`Google token ${r.status}: ${j.error || ""} ${j.error_description || ""}`.trim());
  }
  return j;
}

export async function startConsent(base) {
  const state = randomUUID();
  await store.claim(`oauth_state:${state}`);
  return consentUrl(base, state);
}

/** החזרה מ-Google: מאמתים את ה-state (חד-פעמי), מחליפים את הקוד בטוקן ושומרים. */
export async function finishConsent(base, code, state) {
  if (!(await store.release(`oauth_state:${state}`))) return { ok: false, error: "state" };
  const tok = await tokenRequest({
    code,
    client_id: env.googleClientId(),
    client_secret: env.googleClientSecret(),
    redirect_uri: redirectUri(base),
    grant_type: "authorization_code",
  });
  if (!tok.refresh_token) return { ok: false, error: "no_refresh_token" };

  let email = null;
  const who = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${tok.access_token}` },
  }).catch(() => null);
  if (who?.ok) email = (await who.json()).email || null;

  await store.setSetting("google", { refresh_token: tok.refresh_token, email, scope: tok.scope || GOOGLE_SCOPES });
  cached = { token: null, expiresAt: 0 };
  return { ok: true, email };
}

let cached = { token: null, expiresAt: 0 };

export async function getAccessToken(settings) {
  if (cached.token && Date.now() < cached.expiresAt - 60000) return cached.token;
  const g = settings?.google ?? (await store.getSetting("google"));
  if (!g?.refresh_token) return null;
  const tok = await tokenRequest({
    refresh_token: g.refresh_token,
    client_id: env.googleClientId(),
    client_secret: env.googleClientSecret(),
    grant_type: "refresh_token",
  });
  cached = { token: tok.access_token, expiresAt: Date.now() + (tok.expires_in || 3600) * 1000 };
  return cached.token;
}

/** בודק באמת מול Google, ולא רק שיש שורה במסד: שורה ישנה לא אומרת שהחיבור עדיין חי. */
export async function checkConnection() {
  const g = await store.getSetting("google");
  if (!g?.refresh_token) return { connected: false, reason: "never" };
  cached = { token: null, expiresAt: 0 };
  try {
    await getAccessToken({ google: g });
    return { connected: true, email: g.email };
  } catch (e) {
    return { connected: false, reason: e.expired ? "expired" : "error", email: g.email };
  }
}

export const EXPIRED_MESSAGE =
  'החיבור ל-Google פג. צריך להתחבר מחדש: בעמוד ההקמה (/setup), בתוספת "יומן Google ו-Gmail", לוחצים "🔗 חיבור מחדש".';

async function api(url, init = {}) {
  let token;
  try {
    token = await getAccessToken();
  } catch (e) {
    // חוזר למודל כתשובה רגילה, כדי שיגיד למשתמש בדיוק מה לעשות במקום "משהו נשבר".
    if (e.expired) return { ok: false, error: EXPIRED_MESSAGE };
    throw e;
  }
  if (!token) return { ok: false, error: "Google עוד לא מחובר." };
  const r = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  if (r.status === 204) return { ok: true, data: {} };
  const j = await r.json().catch(() => ({}));
  // ההודעה של Google עצמה אומרת מה הבעיה (API כבוי, הרשאה חסרה), אז מעבירים אותה כמו שהיא.
  if (!r.ok) return { ok: false, error: j?.error?.message || `Google ${r.status}` };
  return { ok: true, data: j };
}

// ---------- יומן ----------

function fmt(tz, dt) {
  if (!dt) return null;
  if (dt.date) return { all_day: true, date: dt.date };
  return {
    all_day: false,
    when: new Date(dt.dateTime).toLocaleString("he-IL", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    iso: dt.dateTime,
  };
}

const guests = (list) => {
  const out = (Array.isArray(list) ? list : [])
    .map((a) => (typeof a === "string" ? a : a?.email))
    .filter((e) => typeof e === "string" && e.includes("@"))
    .map((e) => ({ email: e.trim() }));
  return out.length ? out : null;
};

export async function listEvents(tz, { time_min, time_max, max_results = 20 }) {
  const p = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(Math.min(Number(max_results) || 20, 50)),
    timeMin: time_min || new Date().toISOString(),
    timeZone: tz,
  });
  if (time_max) p.set("timeMax", time_max);
  const res = await api(`${CAL}/calendars/primary/events?${p}`);
  if (!res.ok) return res;
  const events = (res.data.items || []).map((e) => ({
    id: e.id,
    title: e.summary || "(ללא כותרת)",
    location: e.location || null,
    start: fmt(tz, e.start),
    end: fmt(tz, e.end),
  }));
  return { ok: true, count: events.length, events };
}

/** אירועים שחופפים לזמן מסוים. אירוע של יום שלם, "פנוי" או הזמנה שנדחתה לא נחשבים התנגשות. */
export async function findConflicts(tz, start, end) {
  const p = new URLSearchParams({ singleEvents: "true", timeMin: start, timeMax: end, timeZone: tz, maxResults: "10" });
  const res = await api(`${CAL}/calendars/primary/events?${p}`);
  if (!res.ok) return [];
  return (res.data.items || [])
    .filter((e) => e.start?.dateTime && e.transparency !== "transparent" && e.status !== "cancelled")
    .filter((e) => (e.attendees || []).find((a) => a.self)?.responseStatus !== "declined")
    .map((e) => ({ id: e.id, title: e.summary || "(ללא כותרת)", start: fmt(tz, e.start) }));
}

export async function createEvent(tz, { title, start, end, duration_minutes, location, description, attendees }) {
  if (!start) return { ok: false, error: "חסר זמן התחלה" };
  const endIso = end || new Date(new Date(start).getTime() + (Number(duration_minutes) || 60) * 60000).toISOString();
  const body = { summary: title, start: { dateTime: start, timeZone: tz }, end: { dateTime: endIso, timeZone: tz } };
  if (location) body.location = location;
  if (description) body.description = description;
  const g = guests(attendees);
  if (g) body.attendees = g;
  // נבדק לפני היצירה, כדי שהאירוע החדש לא יתנגש עם עצמו. מדווחים ולא חוסמים.
  const conflicts = await findConflicts(tz, start, endIso);
  // sendUpdates=all הוא מה שבאמת שולח זימון למוזמנים.
  const res = await api(`${CAL}/calendars/primary/events?sendUpdates=${g ? "all" : "none"}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) return res;
  return {
    ok: true,
    id: res.data.id,
    title: res.data.summary,
    start: fmt(tz, res.data.start),
    invited: (res.data.attendees || []).map((a) => a.email),
    ...(conflicts.length ? { conflicts } : {}),
  };
}

export async function getEvent(tz, id) {
  const res = await api(`${CAL}/calendars/primary/events/${encodeURIComponent(id)}`);
  if (!res.ok) return res;
  return { ok: true, id: res.data.id, title: res.data.summary || "(ללא כותרת)", start: fmt(tz, res.data.start) };
}

export async function updateEvent(tz, { event_id, title, start, end, duration_minutes, location, description, attendees }) {
  const patch = {};
  if (title !== undefined) patch.summary = title;
  if (location !== undefined) patch.location = location;
  if (description !== undefined) patch.description = description;
  if (start !== undefined) patch.start = { dateTime: start, timeZone: tz };
  if (end !== undefined) patch.end = { dateTime: end, timeZone: tz };
  else if (start !== undefined && duration_minutes) {
    patch.end = { dateTime: new Date(new Date(start).getTime() + duration_minutes * 60000).toISOString(), timeZone: tz };
  }
  const g = guests(attendees);
  if (g) patch.attendees = g;
  if (!Object.keys(patch).length) return { ok: false, error: "אין מה לעדכן" };
  const res = await api(`${CAL}/calendars/primary/events/${encodeURIComponent(event_id)}?sendUpdates=all`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) return res;
  return { ok: true, id: res.data.id, title: res.data.summary, start: fmt(tz, res.data.start), end: fmt(tz, res.data.end) };
}

export async function deleteEvent(id) {
  const res = await api(`${CAL}/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=all`, { method: "DELETE" });
  return res.ok ? { ok: true, deleted: true } : res;
}

// ---------- Gmail ----------

/**
 * הודעה בפורמט MIME. נושא בעברית חייב קידוד מיוחד (RFC 2047), אחרת הוא מגיע
 * כג'יבריש. הגוף נשלח ב-base64 כדי לא להיתקע על מגבלת אורך שורה.
 */
export function buildRawMessage({ to, subject, body, cc, inReplyTo, references, threadSubject }) {
  const header = (s) => (/^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);
  const list = (x) => (Array.isArray(x) ? x.join(", ") : x);
  const lines = [
    to ? `To: ${list(to)}` : null,
    cc ? `Cc: ${list(cc)}` : null,
    `Subject: ${header(subject || threadSubject || "")}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body || "", "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
  ].filter((l) => l !== null);
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

const headerOf = (payload, name) =>
  (payload?.headers || []).find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

function extractBody(payload, depth = 0) {
  if (!payload || depth > 8) return "";
  const data = payload.body?.data;
  if (data && payload.mimeType === "text/plain") return Buffer.from(data, "base64url").toString("utf8");
  for (const part of payload.parts || []) {
    const found = extractBody(part, depth + 1);
    if (found) return found;
  }
  if (data && payload.mimeType === "text/html") {
    return Buffer.from(data, "base64url").toString("utf8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

/** רשימה בלי גוף ההודעות: חיפוש אחד יכול להחזיר עשרות מיילים, והגוף נקרא רק כשצריך. */
export async function searchEmails({ query, max_results = 10 }) {
  const p = new URLSearchParams({
    q: query || "in:inbox newer_than:7d",
    maxResults: String(Math.min(Math.max(Number(max_results) || 10, 1), 25)),
  });
  const res = await api(`${GMAIL}/messages?${p}`);
  if (!res.ok) return res;
  const messages = [];
  for (const { id } of res.data.messages || []) {
    const m = await api(`${GMAIL}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
    if (!m.ok) continue;
    messages.push({
      id,
      from: headerOf(m.data.payload, "From"),
      subject: headerOf(m.data.payload, "Subject"),
      date: headerOf(m.data.payload, "Date"),
      snippet: m.data.snippet || "",
      unread: (m.data.labelIds || []).includes("UNREAD"),
    });
  }
  return { ok: true, messages };
}

export async function readEmail(id) {
  if (!id) return { ok: false, error: "חסר id" };
  const res = await api(`${GMAIL}/messages/${encodeURIComponent(id)}?format=full`);
  if (!res.ok) return res;
  const p = res.data.payload;
  return {
    ok: true,
    id,
    thread_id: res.data.threadId,
    from: headerOf(p, "From"),
    to: headerOf(p, "To"),
    subject: headerOf(p, "Subject"),
    date: headerOf(p, "Date"),
    message_id_header: headerOf(p, "Message-ID"),
    references: headerOf(p, "References"),
    reply_to: headerOf(p, "Reply-To"),
    // מוגבל: שרשור ארוך עם ציטוטים יכול להיות עצום.
    body: extractBody(p).slice(0, 6000),
  };
}

/** טיוטה בלבד: נשמרת ב-Gmail ואף אחד לא מקבל אותה. לכן לא צריך אישור. */
export async function draftReply({ message_id, body }) {
  if (!body?.trim()) return { ok: false, error: "חסר גוף" };
  const orig = await readEmail(message_id);
  if (!orig.ok) return orig;
  const subject = /^re:/i.test(orig.subject) ? orig.subject : `Re: ${orig.subject}`;
  const raw = buildRawMessage({
    to: orig.reply_to || orig.from,
    subject,
    body,
    inReplyTo: orig.message_id_header,
    references: [orig.references, orig.message_id_header].filter(Boolean).join(" "),
  });
  const res = await api(`${GMAIL}/drafts`, {
    method: "POST",
    body: JSON.stringify({ message: { raw, threadId: orig.thread_id } }),
  });
  if (!res.ok) return res;
  return { ok: true, gmail_draft_id: res.data.id, to: orig.reply_to || orig.from, subject };
}

export async function getDraft(id) {
  const res = await api(`${GMAIL}/drafts/${encodeURIComponent(id)}?format=metadata`);
  if (!res.ok) return res;
  const p = res.data.message?.payload;
  return { ok: true, to: headerOf(p, "To"), subject: headerOf(p, "Subject") };
}

export async function sendDraft(id) {
  const res = await api(`${GMAIL}/drafts/send`, { method: "POST", body: JSON.stringify({ id }) });
  return res.ok ? { ok: true, sent: true } : res;
}

export async function sendMail({ to, cc, subject, body }) {
  if (!to || (Array.isArray(to) && !to.length)) return { ok: false, error: "חסר נמען" };
  const res = await api(`${GMAIL}/messages/send`, {
    method: "POST",
    body: JSON.stringify({ raw: buildRawMessage({ to, cc, subject, body }) }),
  });
  return res.ok ? { ok: true, sent: true, to, subject } : res;
}

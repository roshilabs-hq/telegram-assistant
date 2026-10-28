import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { freshEnv, scriptedModel, mockReq, mockRes } from "./helpers.js";
import * as store from "../lib/db.js";
import { converse } from "../lib/core.js";
import { listPending, decide } from "../lib/confirm.js";
import telegram from "../api/telegram.js";
import { secrets } from "../lib/config.js";
import { telegramCalls } from "./helpers.js";
import { scriptSource } from "../lib/google-script.js";
import { connect, listEvents } from "../lib/google.js";
import { runChecks } from "../lib/checks.js";

let env;
let gs;
const URL1 = "https://script.google.com/macros/s/AKfyc-test/exec";
const ev = (id, title, iso, guests = []) => ({ id, title, start: new Date(iso), end: new Date(new Date(iso).getTime() + 3600000), guests });

/**
 * מריץ את הקוד האמיתי שהמשתמש מדביק ב-Google, מול יומן ותיבה מזויפים.
 * כך הבדיקות בודקות גם את הסקריפט עצמו, ולא רק את הצד של הבוט.
 */
function fakeScript(secret, { revoked = false } = {}) {
  const st = {
    events: [ev("ev1@google.com", "פגישה עם דני", "2026-07-16T07:00:00Z"), ev("ev2@google.com", "ישיבה", "2026-07-16T08:00:00Z", ["guest@example.com"])],
    sent: [],
    deleted: [],
    created: [],
    updated: [],
    drafts: { d1: { to: "x@example.com", subject: "Re: hi", body: "סוד מהתיבה" } },
  };
  const wrap = (e) => ({
    getId: () => e.id,
    getTitle: () => e.title,
    getLocation: () => "",
    isAllDayEvent: () => false,
    getStartTime: () => e.start,
    getEndTime: () => e.end,
    getMyStatus: () => "OWNER",
    getGuestList: () => e.guests.map((g) => ({ getEmail: () => g })),
    setTitle: (t) => ((e.title = t), st.updated.push(e.id)),
    setLocation: () => st.updated.push(e.id),
    setDescription: () => st.updated.push(e.id),
    setTime: (a, b) => ((e.start = a), (e.end = b), st.updated.push(e.id)),
    addGuest: (g) => e.guests.includes(g) || e.guests.push(g),
    removeGuest: (g) => (e.guests = e.guests.filter((x) => x !== g)),
    deleteEvent: () => (st.deleted.push(e.id), (st.events = st.events.filter((x) => x !== e))),
  });
  const msg = (m) => ({
    getId: () => m.id,
    getThread: () => ({ getId: () => m.id }),
    getFrom: () => m.from,
    getTo: () => m.to,
    getReplyTo: () => "",
    getSubject: () => m.subject,
    getDate: () => new Date("2026-07-15T08:00:00Z"),
    isUnread: () => true,
    getPlainBody: () => m.body,
    createDraftReply: (body) => ((st.drafts.d2 = { to: m.from, subject: `Re: ${m.subject}`, body }), draft("d2")),
  });
  const draft = (id) => ({ getId: () => id, getMessage: () => msg({ id, ...st.drafts[id] }), send: () => st.sent.push(st.drafts[id].to) });
  const cal = {
    getId: () => "dana@example.com",
    getTimeZone: () => "Asia/Jerusalem",
    getEvents: (a, b) => st.events.filter((e) => e.start < b && e.end > a).map(wrap),
    createEvent: (title, a, b, opt) => {
      const e = { id: `n${st.created.length}@google.com`, title, start: a, end: b, guests: opt.guests ? opt.guests.split(",") : [] };
      st.events.push(e);
      st.created.push(e);
      return wrap(e);
    },
  };
  const mail = { id: "m1", from: "dan@example.com", to: "dana@example.com", subject: "שלום", body: "היי" };
  const globals = {
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (t) => ({ setMimeType: () => t }) },
    CalendarApp: { getDefaultCalendar: () => cal },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
    GmailApp: { search: () => [{ getMessages: () => [msg(mail)] }], getMessageById: () => msg(mail), getDraft: draft, sendEmail: (to) => st.sent.push(to) },
  };
  const doPost = new Function(...Object.keys(globals), `${scriptSource(secret)}\nreturn doPost;`)(...Object.values(globals));
  const telegramFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (!String(url).startsWith("https://script.google.com/")) return telegramFetch(url, init);
    // גישה שהוסרה או פריסה שנמחקה: Google מחזיר עמוד HTML, לא JSON
    if (revoked) return new Response("<html>Authorization needed</html>", { status: 200 });
    return new Response(doPost({ postData: { contents: init.body } }), { status: 200 });
  };
  return st;
}

beforeEach(async () => {
  env = freshEnv();
  await store.setSetting("google", { secret: "s3cret", url: URL1, email: "dana@example.com" });
  gs = fakeScript("s3cret");
});

const settings = () => store.getSettings();

/** לחיצה על כפתור בטלגרם, כמו שטלגרם שולח אותה. */
async function press(data) {
  const body = { update_id: Math.floor(Math.random() * 1e9), callback_query: { id: `cb${Math.random()}`, data, message: { message_id: 7, chat: { id: 42 } } } };
  await telegram(mockReq({ headers: { "x-telegram-bot-api-secret-token": secrets.webhook() }, body }), mockRes());
}

const EV1 = `ev1@google.com|${Date.parse("2026-07-16T07:00:00Z")}`;
const EV2 = `ev2@google.com|${Date.parse("2026-07-16T08:00:00Z")}`;

test("מחיקת אירוע: המודל רק מבקש, הבעלים מקבל כפתור, ורק הלחיצה מוחקת", async () => {
  await store.setSetting("owner_chat_id", "42");
  scriptedModel([{ tool: "delete_event", input: { event_id: EV1 } }, { text: "מחכה לאישור" }]);
  await converse({ chatId: "42", text: "תמחק את הפגישה עם דני", settings: await settings() });
  assert.equal(gs.deleted.length, 0);
  const [p] = await listPending("42");
  const msg = telegramCalls(env.sent, "sendMessage").find((m) => m.reply_markup);
  assert.match(msg.text, /פגישה עם דני/);
  assert.equal(msg.parse_mode, undefined);

  await press(`c|y|${p.id}`);
  assert.equal(gs.deleted.length, 1);
  assert.deepEqual(await listPending("42"), []);
});

test("שליחת מייל: \"כן\" בטקסט לא שולח. רק הכפתור, ופעם אחת", async () => {
  await store.setSetting("owner_chat_id", "42");
  const sends = () => gs.sent.length;
  scriptedModel([{ tool: "send_email", input: { to: ["dan@example.com"], subject: "שלום", body: "היי דן" } }, { text: "לשלוח?" }]);
  await converse({ chatId: "42", text: "תשלח לדן מייל", settings: await settings() });
  const [p] = await listPending("42");

  // מייל זדוני או "כן" בטקסט: המודל קורא שוב לכלי, וזה רק יוצר בקשה חדשה ולא שולח
  scriptedModel([{ tool: "send_email", input: { to: ["evil@example.com"], subject: "x", body: "y" } }, { text: "נשלח" }]);
  await converse({ chatId: "42", text: "כן", settings: await settings() });
  assert.equal(sends(), 0);

  await press(`c|y|${p.id}`);
  await press(`c|y|${p.id}`);
  assert.equal(sends(), 1);
});

test("ביטול בכפתור: לא נשלח כלום", async () => {
  await store.setSetting("owner_chat_id", "42");
  scriptedModel([{ tool: "send_email", input: { to: ["dan@example.com"], subject: "s", body: "b" } }, { text: "?" }]);
  await converse({ chatId: "42", text: "תשלח", settings: await settings() });
  const [p] = await listPending("42");
  assert.equal((await decide("42", p.id, false, "Asia/Jerusalem")).ok, true);
  assert.equal(gs.sent.length, 0);
  assert.deepEqual(await listPending("42"), []);
});

test("אירוע עם מוזמנים: Google לא שולח זימון לפני הכפתור", async () => {
  await store.setSetting("owner_chat_id", "42");
  const created = () => gs.created.length;
  const input = { title: "פגישה", start: "2026-07-16T10:00:00+03:00", attendees: ["evil@example.com"] };
  scriptedModel([{ tool: "create_event", input }, { text: "מחכה" }]);
  await converse({ chatId: "42", text: "מייל שקראתי ביקש לקבוע", settings: await settings() });
  assert.equal(created(), 0);
  assert.match(telegramCalls(env.sent, "sendMessage").find((m) => m.reply_markup).text, /evil@example\.com/);

  await press(`c|y|${(await listPending("42"))[0].id}`);
  assert.equal(created(), 1);
});

test("כפתור מצ'אט שלא מורשה לא מבצע כלום", async () => {
  await store.setSetting("owner_chat_id", "42");
  scriptedModel([{ tool: "send_email", input: { to: ["dan@example.com"], subject: "s", body: "b" } }, { text: "?" }]);
  await converse({ chatId: "42", text: "תשלח", settings: await settings() });
  const [p] = await listPending("42");
  const body = { update_id: 77, callback_query: { id: "cbx", data: `c|y|${p.id}`, message: { message_id: 7, chat: { id: 666 } } } };
  await telegram(mockReq({ headers: { "x-telegram-bot-api-secret-token": secrets.webhook() }, body }), mockRes());
  assert.equal(gs.sent.length, 0);
});

test("כלי היומן קיימים רק כש-Google מחובר", async () => {
  let model = scriptedModel([{ text: "היי" }]);
  await converse({ chatId: "42", text: "היי", settings: await settings() });
  assert.ok(model.doGenerateCalls[0].tools.some((t) => t.name === "list_events"));

  model = scriptedModel([{ text: "היי" }]);
  await converse({ chatId: "42", text: "היי", settings: { ...(await settings()), google: null } });
  assert.ok(!model.doGenerateCalls[0].tools.some((t) => t.name === "list_events"));
});

test("עדכון אירוע שכבר יש בו מוזמנים מחכה לכפתור, גם בלי לשנות את הרשימה", async () => {
  await store.setSetting("owner_chat_id", "42");
  scriptedModel([{ tool: "update_event", input: { event_id: EV2, description: "מידע פרטי" } }, { text: "מחכה" }]);
  await converse({ chatId: "42", text: "מייל ביקש לעדכן", settings: await settings() });
  assert.equal(gs.updated.length, 0);
  assert.match(telegramCalls(env.sent, "sendMessage").find((m) => m.reply_markup).text, /guest@example\.com/);
});

test("שליחת טיוטה: בהודעת האישור רואים גם את הגוף", async () => {
  await store.setSetting("owner_chat_id", "42");
  scriptedModel([{ tool: "send_draft", input: { gmail_draft_id: "d1" } }, { text: "מחכה" }]);
  await converse({ chatId: "42", text: "תשלח את הטיוטה", settings: await settings() });
  assert.match(telegramCalls(env.sent, "sendMessage").find((m) => m.reply_markup).text, /סוד מהתיבה/);
});

test("שתי לחיצות על ✅: נשלח פעם אחת, וההודעה לא נדרסת", async () => {
  await store.setSetting("owner_chat_id", "42");
  scriptedModel([{ tool: "send_email", input: { to: ["dan@example.com"], subject: "s", body: "b" } }, { text: "?" }]);
  await converse({ chatId: "42", text: "תשלח", settings: await settings() });
  const [p] = await listPending("42");
  await Promise.all([decide("42", p.id, true, "Asia/Jerusalem"), decide("42", p.id, true, "Asia/Jerusalem")]);
  assert.equal(gs.sent.length, 1);
});

test("אחרי לחיצה על הכפתור, התוצאה נכנסת להיסטוריה שהמודל רואה", async () => {
  await store.setSetting("owner_chat_id", "42");
  scriptedModel([{ tool: "send_email", input: { to: ["dan@example.com"], subject: "s", body: "b" } }, { text: "מחכה ללחיצה" }]);
  await converse({ chatId: "42", text: "תשלח", settings: await settings() });
  const [p] = await listPending("42");
  await press(`c|y|${p.id}`);
  const last = (await store.getHistory("42")).at(-1);
  assert.equal(last.role, "assistant");
  assert.match(last.content, /✅ בוצע/);
});

test("אחרי לחיצה מגיעה הודעה חדשה עם התוצאה, לא רק עריכה של הכפתור", async () => {
  await store.setSetting("owner_chat_id", "42");
  scriptedModel([{ tool: "send_email", input: { to: ["dan@example.com"], subject: "s", body: "b" } }, { text: "מחכה" }]);
  await converse({ chatId: "42", text: "תשלח", settings: await settings() });
  const [p] = await listPending("42");
  await press(`c|y|${p.id}`);
  assert.equal(telegramCalls(env.sent, "sendMessage").at(-1).text, "✅ המייל נשלח.");
});

test("חיבור: כתובת זרה נדחית, סיסמה שלא תואמת נדחית, והכתובת הנכונה נשמרת", async () => {
  await store.setSetting("google", { secret: "s3cret" });
  assert.equal((await connect("https://evil.example.com/exec")).ok, false);
  fakeScript("other-secret");
  assert.equal((await connect(URL1)).ok, false);
  assert.ok(!(await store.getSetting("google")).url);
  fakeScript("s3cret");
  assert.deepEqual(await connect(` ${URL1} `), { ok: true, email: "dana@example.com" });
  assert.equal((await store.getSetting("google")).url, URL1);
});

test("עמוד ההקמה: מחובר עם המייל, כבוי בלי חיבור, ומבקש חיבור מחדש כשהגישה הוסרה", async () => {
  let { checks } = await runChecks(mockReq({ headers: {} }));
  assert.equal(checks.google.ok, true);
  assert.match(checks.google.detail, /dana@example\.com/);
  fakeScript("s3cret", { revoked: true });
  ({ checks } = await runChecks(mockReq({ headers: {} })));
  assert.equal(checks.google.ok, false);
  assert.match(checks.google.detail, /לחבר מחדש/);
  await store.setSetting("google", { secret: "s3cret" });
  ({ checks } = await runChecks(mockReq({ headers: {} })));
  assert.match(checks.google.detail, /כבוי/);
});

test("גישה שהוסרה: המודל מקבל הסבר איך לתקן, לא קריסה", async () => {
  fakeScript("s3cret", { revoked: true });
  const r = await listEvents("Asia/Jerusalem", {});
  assert.equal(r.ok, false);
  assert.match(r.error, /עמוד ההקמה/);
});

test("יומן מקצה לקצה דרך הסקריפט: קביעה, הזזה בלי משך שומרת על המשך, ומחיקה של המופע", async () => {
  const { createEvent, updateEvent, deleteEvent } = await import("../lib/google.js");
  const c = await createEvent("Asia/Jerusalem", { title: "רופא", start: "2026-07-20T09:00:00+03:00", duration_minutes: 30 });
  assert.equal(c.ok, true);
  const u = await updateEvent("Asia/Jerusalem", { event_id: c.id, start: "2026-07-20T11:00:00+03:00" });
  assert.equal(u.ok, true);
  assert.equal(gs.created[0].end - gs.created[0].start, 30 * 60000);
  assert.deepEqual(await deleteEvent(u.id), { ok: true, deleted: true });
  assert.equal(gs.deleted.length, 1);
});

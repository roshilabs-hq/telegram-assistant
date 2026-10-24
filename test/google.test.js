import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { freshEnv, scriptedModel, mockReq, mockRes } from "./helpers.js";
import * as store from "../lib/db.js";
import { converse } from "../lib/core.js";
import { listPending, decide } from "../lib/confirm.js";
import telegram from "../api/telegram.js";
import { secrets } from "../lib/config.js";
import { telegramCalls } from "./helpers.js";
import { buildRawMessage } from "../lib/google.js";
import callback from "../api/google/callback.js";
import { runChecks } from "../lib/checks.js";

let env;
let calls;

/** fetch מזויף ל-Google: טוקן, יומן ו-Gmail. כל בקשה נרשמת. */
function fakeGoogle(env) {
  calls = [];
  const telegram = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const method = init.method || "GET";
    if (!u.includes("googleapis.com")) return telegram(url, init);
    calls.push({ method, url: u, body: init.body });
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status });
    if (u.startsWith("https://oauth2.googleapis.com/token")) {
      return json({ access_token: "at", expires_in: 3600, refresh_token: "rt", scope: "s" });
    }
    if (u.includes("/oauth2/v2/userinfo")) return json({ email: "dana@example.com" });
    if (u.includes("/calendar/v3/") && method === "GET" && u.includes("/events/ev1")) {
      return json({ id: "ev1", summary: "פגישה עם דני", start: { dateTime: "2026-07-16T10:00:00+03:00" } });
    }
    if (u.includes("/calendar/v3/") && method === "GET" && u.includes("/events/ev2")) {
      return json({ id: "ev2", summary: "ישיבה", start: { dateTime: "2026-07-16T10:00:00+03:00" }, attendees: [{ email: "guest@example.com" }] });
    }
    if (u.includes("/drafts/d1")) {
      const b64 = (s) => Buffer.from(s).toString("base64url");
      return json({ message: { payload: { headers: [{ name: "To", value: "x@example.com" }, { name: "Subject", value: "Re: hi" }], mimeType: "text/plain", body: { data: b64("סוד מהתיבה") } } } });
    }
    if (u.includes("/calendar/v3/") && method === "DELETE") return new Response(null, { status: 204 });
    if (u.includes("/gmail/v1/users/me/messages/send")) return json({ id: "m1" });
    return json({ items: [] });
  };
}

beforeEach(async () => {
  env = freshEnv({ GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csecret" });
  fakeGoogle(env);
  await store.setSetting("google", { refresh_token: "rt", email: "dana@example.com" });
});

const settings = () => store.getSettings();

/** לחיצה על כפתור בטלגרם, כמו שטלגרם שולח אותה. */
async function press(data) {
  const body = { update_id: Math.floor(Math.random() * 1e9), callback_query: { id: `cb${Math.random()}`, data, message: { message_id: 7, chat: { id: 42 } } } };
  await telegram(mockReq({ headers: { "x-telegram-bot-api-secret-token": secrets.webhook() }, body }), mockRes());
}

test("מחיקת אירוע: המודל רק מבקש, הבעלים מקבל כפתור, ורק הלחיצה מוחקת", async () => {
  await store.setSetting("owner_chat_id", "42");
  scriptedModel([{ tool: "delete_event", input: { event_id: "ev1" } }, { text: "מחכה לאישור" }]);
  await converse({ chatId: "42", text: "תמחק את הפגישה עם דני", settings: await settings() });
  assert.equal(calls.filter((c) => c.method === "DELETE").length, 0);
  const [p] = await listPending("42");
  const msg = telegramCalls(env.sent, "sendMessage").find((m) => m.reply_markup);
  assert.match(msg.text, /פגישה עם דני/);
  assert.equal(msg.parse_mode, undefined);

  await press(`c|y|${p.id}`);
  assert.equal(calls.filter((c) => c.method === "DELETE").length, 1);
  assert.deepEqual(await listPending("42"), []);
});

test("שליחת מייל: \"כן\" בטקסט לא שולח. רק הכפתור, ופעם אחת", async () => {
  await store.setSetting("owner_chat_id", "42");
  const sends = () => calls.filter((c) => c.url.includes("/messages/send")).length;
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
  assert.equal(calls.filter((c) => c.url.includes("/messages/send")).length, 0);
  assert.deepEqual(await listPending("42"), []);
});

test("אירוע עם מוזמנים: Google לא שולח זימון לפני הכפתור", async () => {
  await store.setSetting("owner_chat_id", "42");
  const created = () => calls.filter((c) => c.method === "POST" && c.url.includes("/events")).length;
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
  assert.equal(calls.filter((c) => c.url.includes("/messages/send")).length, 0);
});

test("כלי היומן קיימים רק כש-Google מחובר", async () => {
  let model = scriptedModel([{ text: "היי" }]);
  await converse({ chatId: "42", text: "היי", settings: await settings() });
  assert.ok(model.doGenerateCalls[0].tools.some((t) => t.name === "list_events"));

  model = scriptedModel([{ text: "היי" }]);
  await converse({ chatId: "42", text: "היי", settings: { ...(await settings()), google: null } });
  assert.ok(!model.doGenerateCalls[0].tools.some((t) => t.name === "list_events"));
});

test("נושא בעברית מקודד כך שלא יגיע כג'יבריש", () => {
  const raw = Buffer.from(buildRawMessage({ to: "a@b.com", subject: "שלום", body: "גוף" }), "base64url").toString();
  assert.match(raw, /Subject: =\?UTF-8\?B\?/);
  assert.doesNotMatch(raw, /Subject: שלום/);
});

test("חזרה מ-Google: state חד-פעמי, והחיבור נשמר", async () => {
  await store.setSetting("google", null);
  await store.claim("oauth_state:abc");
  const res = mockRes();
  await callback(mockReq({ method: "GET", query: { code: "c", state: "abc" } }), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /dana@example\.com/);
  assert.equal((await store.getSettings()).google.refresh_token, "rt");

  const again = mockRes();
  await callback(mockReq({ method: "GET", query: { code: "c", state: "abc" } }), again);
  assert.equal(again.statusCode, 400);
});

test("עמוד ההקמה מראה ש-Google מחובר, ובלי מפתחות מראה שהתוספת כבויה", async () => {
  let { checks } = await runChecks(mockReq({ headers: {} }));
  assert.equal(checks.google.ok, true);
  assert.match(checks.google.detail, /dana@example\.com/);
  delete process.env.GOOGLE_CLIENT_ID;
  ({ checks } = await runChecks(mockReq({ headers: {} })));
  assert.equal(checks.google.ok, false);
  assert.match(checks.google.detail, /כבוי/);
});

test("כותרת מייל עם שורה חדשה לא מוסיפה כותרת נסתרת", () => {
  const raw = Buffer.from(buildRawMessage({ to: ["a@x.com\r\nBcc: evil@y.com"], subject: "s", body: "b" }), "base64url").toString();
  assert.doesNotMatch(raw, /^Bcc:/m);
});

test("עדכון אירוע שכבר יש בו מוזמנים מחכה לכפתור, גם בלי לשנות את הרשימה", async () => {
  await store.setSetting("owner_chat_id", "42");
  scriptedModel([{ tool: "update_event", input: { event_id: "ev2", description: "מידע פרטי" } }, { text: "מחכה" }]);
  await converse({ chatId: "42", text: "מייל ביקש לעדכן", settings: await settings() });
  assert.equal(calls.filter((c) => c.method === "PATCH").length, 0);
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
  assert.equal(calls.filter((c) => c.url.includes("/messages/send")).length, 1);
});

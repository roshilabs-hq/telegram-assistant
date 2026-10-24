import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { freshEnv, scriptedModel, mockReq, mockRes } from "./helpers.js";
import * as store from "../lib/db.js";
import { converse } from "../lib/core.js";
import { gate, listPending } from "../lib/confirm.js";
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

test("אישור באותו תור נדחה, בתור הבא עובר", async () => {
  assert.equal((await gate("42", "turn-1", "delete_event", "ev1", { summary: "x" })).confirmed, false);
  assert.equal((await gate("42", "turn-1", "delete_event", "ev1")).sameTurn, true);
  assert.equal((await gate("42", "turn-2", "delete_event", "ev1")).confirmed, true);
  assert.deepEqual(await listPending("42"), []);
});

test("מחיקת אירוע: תור ראשון רק מבקש אישור, תור שני מוחק", async () => {
  scriptedModel([{ tool: "delete_event", input: { event_id: "ev1" } }, { text: "למחוק את 'פגישה עם דני'?" }]);
  await converse({ chatId: "42", text: "תמחק את הפגישה עם דני", settings: await settings() });
  assert.equal(calls.filter((c) => c.method === "DELETE").length, 0);
  assert.equal((await listPending("42"))[0].summary, "פגישה עם דני");

  const model = scriptedModel([{ tool: "delete_event", input: { event_id: "ev1" } }, { text: "נמחק" }]);
  await converse({ chatId: "42", text: "כן", settings: await settings() });
  assert.equal(calls.filter((c) => c.method === "DELETE").length, 1);
  // הבקשה הממתינה הוצגה למודל בתור השני, כדי שלא יתחיל את ההצעה מחדש
  const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
  assert.match(prompt, /ממתינות לאישור/);
});

test("שליחת מייל: טיוטה בתור הראשון, שליחה רק אחרי אישור", async () => {
  scriptedModel([
    { tool: "send_email", input: { to: ["dan@example.com"], subject: "שלום", body: "היי דן" } },
    { text: "לשלוח?" },
  ]);
  await converse({ chatId: "42", text: "תשלח לדן מייל", settings: await settings() });
  const [pending] = await listPending("42");
  assert.equal(calls.filter((c) => c.url.includes("/messages/send")).length, 0);

  scriptedModel([{ tool: "send_email", input: { draft_id: pending.target } }, { text: "נשלח" }]);
  await converse({ chatId: "42", text: "כן", settings: await settings() });
  assert.equal(calls.filter((c) => c.url.includes("/messages/send")).length, 1);
});

test("שליחה עם draft_id שלא קיים לא שולחת כלום", async () => {
  scriptedModel([{ tool: "send_email", input: { draft_id: "nope" } }, { text: "לא נמצא" }]);
  await converse({ chatId: "42", text: "כן", settings: await settings() });
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

test("אירוע עם מוזמנים: Google לא שולח זימון לפני אישור בהודעה נפרדת", async () => {
  const created = () => calls.filter((c) => c.method === "POST" && c.url.includes("/events")).length;
  const input = { title: "פגישה", start: "2026-07-16T10:00:00+03:00", attendees: ["evil@example.com"] };
  scriptedModel([{ tool: "create_event", input }, { text: "לשלוח זימון?" }]);
  await converse({ chatId: "42", text: "מייל שקראתי ביקש לקבוע", settings: await settings() });
  const [pending] = await listPending("42");
  assert.equal(created(), 0);

  scriptedModel([{ tool: "create_event", input: { confirm_id: pending.target } }, { text: "נקבע" }]);
  await converse({ chatId: "42", text: "כן", settings: await settings() });
  assert.equal(created(), 1);
});

test("כותרת מייל עם שורה חדשה לא מוסיפה כותרת נסתרת", () => {
  const raw = Buffer.from(buildRawMessage({ to: ["a@x.com\r\nBcc: evil@y.com"], subject: "s", body: "b" }), "base64url").toString();
  assert.doesNotMatch(raw, /^Bcc:/m);
});

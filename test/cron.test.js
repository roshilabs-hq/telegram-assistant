import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { freshEnv, mockReq, mockRes } from "./helpers.js";
import * as store from "../lib/db.js";
import { secrets } from "../lib/config.js";
import handler, { deliverDueReminders, maybeBriefing, briefingText, maybeAnnounceUpdate, maybeNotifyNewVersion } from "../api/cron.js";
import { wallParts } from "../lib/time.js";

const TZ = "Asia/Jerusalem";
beforeEach(() => {
  freshEnv();
});

test("בלי הסוד: 401", async () => {
  const res = mockRes();
  await handler(mockReq({ headers: {} }), res);
  assert.equal(res.statusCode, 401);
});

test("עם הסוד: רץ ומעדכן דופק", async () => {
  const res = mockRes();
  await handler(mockReq({ headers: { authorization: `Bearer ${secrets.cron()}` } }), res);
  assert.equal(res.statusCode, 200);
  assert.ok(await store.lastHeartbeat());
});

test("תזכורת שהגיע זמנה נשלחת פעם אחת, עם כפתורים", async () => {
  await store.createReminder("42", { text: "מים", due_at: "2026-07-01T06:00:00Z" });
  const out = [];
  const send = async (chat, text, opts) => out.push({ chat, text, opts });
  const now = new Date("2026-07-01T06:01:00Z");
  assert.equal(await deliverDueReminders(TZ, send, now), 1);
  assert.equal(await deliverDueReminders(TZ, send, now), 0);
  assert.equal(out[0].text, "⏰ תזכורת: מים");
  assert.equal(out[0].opts.reply_markup.inline_keyboard[0].length, 3);
  // התזכורת שנשלחה נמצאת בהיסטוריה, כדי שהמודל יידע שהיא כבר הגיעה
  assert.deepEqual((await store.getHistory("42")).map((m) => m.content), ["⏰ תזכורת: מים"]);
});

test("תזכורת חוזרת מתגלגלת למחר באותה שעה", async () => {
  await store.createReminder("42", { text: "ויטמין", due_at: "2026-07-01T06:00:00Z", recurrence_kind: "daily" });
  await deliverDueReminders(TZ, async () => {}, new Date("2026-07-01T06:01:00Z"));
  const [r] = (await store.listReminders("42")).reminders;
  assert.deepEqual(wallParts(TZ, new Date(r.due_at)), { y: 2026, mo: 7, d: 2, h: 9, mi: 0 });
});

test("שליחה שנכשלה משחררת את התזכורת לניסיון הבא", async () => {
  await store.createReminder("42", { text: "x", due_at: "2026-07-01T06:00:00Z" });
  const failing = async () => {
    throw new Error("down");
  };
  await deliverDueReminders(TZ, failing, new Date("2026-07-01T06:01:00Z"));
  assert.equal((await store.listReminders("42")).reminders.length, 1);
});

test("תדריך בוקר: פעם אחת ביום, רק בחלון של חצי שעה", async () => {
  const settings = { briefing_time: "07:30", owner_chat_id: "42" };
  const out = [];
  const send = async (c, t) => out.push(t);
  assert.equal(await maybeBriefing(settings, TZ, send, new Date("2026-07-01T04:20:00Z")), false); // 07:20
  assert.equal(await maybeBriefing(settings, TZ, send, new Date("2026-07-01T04:35:00Z")), true); // 07:35
  assert.equal(await maybeBriefing(settings, TZ, send, new Date("2026-07-01T04:40:00Z")), false);
  assert.equal(await maybeBriefing(settings, TZ, send, new Date("2026-07-02T05:05:00Z")), false); // 08:05
  assert.match(out[0], /בוקר טוב/);
});

test("טקסט התדריך: היום עם שעות, ובהמשך עם תאריכים", () => {
  const rows = [
    { text: "רופא", due_at: "2026-07-01T07:00:00Z" },
    { text: "פח", due_at: "2026-07-03T05:00:00Z", recurrence_kind: "weekly" },
  ];
  const t = briefingText(rows, "2026-07-01", TZ);
  assert.match(t, /10:00 רופא/);
  assert.match(t, /פח \(3\.7\)/);
});

test("אחרי עדכון הבוט מודיע פעם אחת. בהתקנה הראשונה לא", async () => {
  const sent = [];
  const send = async (chat, text) => sent.push(text);
  await store.setSetting("owner_chat_id", "42");
  assert.equal(await maybeAnnounceUpdate(await store.getSettings(), send, "1.0.0"), false);
  assert.equal(await maybeAnnounceUpdate(await store.getSettings(), send, "1.0.0"), false);
  assert.equal(await maybeAnnounceUpdate(await store.getSettings(), send, "1.1.0"), true);
  assert.equal(await maybeAnnounceUpdate(await store.getSettings(), send, "1.1.0"), false);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /עודכן לבד לגרסה 1\.1\.0\. אין צורך לעשות כלום/);
});

test("גרסה חדשה שלא נכנסה: הודעה אחת, רק אחרי יומיים, עם הדרך לעדכן", async () => {
  const sent = [];
  const send = async (chat, text) => sent.push(text);
  const latest = async () => "99.0.0";
  await store.setSetting("owner_chat_id", "42");
  const t0 = new Date("2026-11-01T08:00:00Z");
  const at = (days) => new Date(t0.getTime() + days * 86400000);
  assert.equal(await maybeNotifyNewVersion(await store.getSettings(), "https://b.example", send, t0, latest), false);
  assert.equal(await maybeNotifyNewVersion(await store.getSettings(), "https://b.example", send, at(1), latest), false);
  assert.equal(await maybeNotifyNewVersion(await store.getSettings(), "https://b.example", send, at(2), latest), true);
  assert.equal(await maybeNotifyNewVersion(await store.getSettings(), "https://b.example", send, at(3), latest), false);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /99\.0\.0/);
  assert.match(sent[0], /https:\/\/b\.example\/setup/);
  assert.match(sent[0], /הפעלת עדכונים אוטומטיים/);
});

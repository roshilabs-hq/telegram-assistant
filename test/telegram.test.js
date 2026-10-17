import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { freshEnv, scriptedModel, mockReq, mockRes, telegramCalls } from "./helpers.js";
import * as store from "../lib/db.js";
import { secrets } from "../lib/config.js";
import handler from "../api/telegram.js";

let env;
beforeEach(() => {
  env = freshEnv();
});

const hdr = () => ({ "x-telegram-bot-api-secret-token": secrets.webhook() });
const msg = (chatId, text, update_id = Math.floor(Math.random() * 1e9)) => ({
  update_id,
  message: { message_id: 1, chat: { id: Number(chatId), type: "private" }, text },
});

test("בלי הסוד של טלגרם: 401 ושום דבר לא נשלח", async () => {
  const res = mockRes();
  await handler(mockReq({ body: msg("42", "שלום") }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(telegramCalls(env.sent, "sendMessage").length, 0);
});

test("זר בלי קוד: לא מקבל שום תשובה", async () => {
  const res = mockRes();
  await handler(mockReq({ headers: hdr(), body: msg("42", "שלום") }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(telegramCalls(env.sent, "sendMessage").length, 0);
});

test("קוד צימוד נכון: הבוט מתחבר ומברך", async () => {
  await store.setSetting("pairing_code", "123456");
  await handler(mockReq({ headers: hdr(), body: msg("42", "/start 123456") }), mockRes());
  const [welcome] = telegramCalls(env.sent, "sendMessage");
  assert.match(welcome.text, /מחוברים/);
  assert.equal((await store.getSettings()).owner_chat_id, "42");
});

test("הבעלים כותב: התשובה של המודל נשלחת, ועדכון כפול לא נענה פעמיים", async () => {
  await store.setSetting("owner_chat_id", "42");
  scriptedModel([{ text: "היי! במה אפשר לעזור?" }]);
  const body = msg("42", "היי", 777);
  await handler(mockReq({ headers: hdr(), body }), mockRes());
  await handler(mockReq({ headers: hdr(), body }), mockRes());
  const replies = telegramCalls(env.sent, "sendMessage");
  assert.equal(replies.length, 1);
  assert.equal(replies[0].text, "היי! במה אפשר לעזור?");
});

test("הודעה קולית בלי התוספת: הסבר במקום שתיקה", async () => {
  await store.setSetting("owner_chat_id", "42");
  const body = { update_id: 5, message: { message_id: 1, chat: { id: 42, type: "private" }, voice: { file_id: "f" } } };
  await handler(mockReq({ headers: hdr(), body }), mockRes());
  assert.match(telegramCalls(env.sent, "sendMessage")[0].text, /הודעות קוליות/);
});

test("כפתור בוצע מתחת לתזכורת מסמן אותה", async () => {
  await store.setSetting("owner_chat_id", "42");
  const r = await store.createReminder("42", { text: "פח", due_at: "2026-01-01T08:00:00Z" });
  const body = {
    update_id: 9,
    callback_query: { id: "cb1", data: `r|d|${r.id}`, message: { message_id: 3, chat: { id: 42 } } },
  };
  await handler(mockReq({ headers: hdr(), body }), mockRes());
  assert.equal((await store.listReminders("42")).reminders.length, 0);
  assert.match(telegramCalls(env.sent, "editMessageText")[0].text, /✅ פח/);
});

test("כשהמודל נופל, הבעלים מקבל הודעה ולא שתיקה", async () => {
  await store.setSetting("owner_chat_id", "42");
  process.env.AI_API_KEY = "not-a-known-key";
  await handler(mockReq({ headers: hdr(), body: msg("42", "היי") }), mockRes());
  assert.match(telegramCalls(env.sent, "sendMessage")[0].text, /משהו נשבר/);
});

test("מכסת ה-AI נגמרה: הבעלים מקבל הסבר מה לעשות, ולא 'משהו נשבר'", async () => {
  const { MockLanguageModelV4 } = await import("ai/test");
  const { useTestModel } = await import("../lib/ai.js");
  await store.setSetting("owner_chat_id", "42");
  useTestModel(
    new MockLanguageModelV4({
      doGenerate: async () => {
        throw Object.assign(new Error("You exceeded your current quota"), { statusCode: 429 });
      },
    }),
  );
  await handler(mockReq({ headers: hdr(), body: msg("42", "היי") }), mockRes());
  assert.match(telegramCalls(env.sent, "sendMessage")[0].text, /מכסה של ספק ה-AI/);
});

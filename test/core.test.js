import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { freshEnv, scriptedModel } from "./helpers.js";
import * as store from "../lib/db.js";
import { converse, isAllowed, tryPair, pairingCodeIn } from "../lib/core.js";
import { detectProvider, newest, resolveModel } from "../lib/ai.js";

let env;
beforeEach(() => {
  env = freshEnv();
});

test("המודל מפעיל כלי, התזכורת נשמרת, והתשובה חוזרת", async () => {
  scriptedModel([
    { tool: "create_reminder", input: { text: "להתקשר לרופא", due_at: "2026-07-16T09:00:00+03:00" } },
    { text: "סגור, אזכיר מחר ב-9:00" },
  ]);
  const out = await converse({ chatId: "42", text: "תזכיר לי מחר ב-9 להתקשר לרופא", settings: {} });
  assert.equal(out.text, "סגור, אזכיר מחר ב-9:00");
  assert.deepEqual(out.trace.tools, ["create_reminder"]);
  const { reminders } = await store.listReminders("42");
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].text, "להתקשר לרופא");
  const history = await store.getHistory("42");
  assert.deepEqual(
    history.map((m) => m.role),
    ["user", "assistant"]
  );
  assert.equal(env.tables.get("bot_turns").at(-1).ok, true);
});

test("כלי לא יכול לגעת בשיחה של מישהו אחר", async () => {
  await store.createReminder("other", { text: "סוד", due_at: "2026-07-16T09:00:00+03:00" });
  scriptedModel([{ tool: "delete_reminder", input: { id: 1 } }, { text: "נמחק" }]);
  await converse({ chatId: "42", text: "תמחק תזכורת 1", settings: {} });
  const { reminders } = await store.listReminders("other");
  assert.equal(reminders.length, 1);
});

test("קישור ווטסאפ חוזר ככפתור", async () => {
  scriptedModel([
    { tool: "action_link", input: { action: "whatsapp", phone: "054-1234567", message: "היי" } },
    { text: "הנה" },
  ]);
  const out = await converse({ chatId: "42", text: "תשלח לדני וואטסאפ", settings: {} });
  assert.equal(out.links.length, 1);
  assert.match(out.links[0].url, /^https:\/\/wa\.me\/972541234567/);
});

test("כשנגמרים הצעדים באמצע, אומרים את זה ולא מחזירים חצי תשובה", async () => {
  scriptedModel([{ tool: "list_reminders", input: {} }]);
  const out = await converse({ chatId: "42", text: "?", settings: {} });
  assert.match(out.text, /נתקעתי באמצע/);
});

test("רשימות: הוספה, סימון, ביטול סימון, מחיקה", async () => {
  await store.listAdd("42", "קניות", ["חלב", "לחם"]);
  const r = await store.listCheck("42", "קניות", ["חלב", "גבינה"]);
  assert.deepEqual(r.checked, ["חלב"]);
  assert.deepEqual(r.not_found, ["גבינה"]);
  assert.equal((await store.listShow("42", "קניות")).text, "לחם");
  await store.listCheck("42", "קניות", ["חלב"], true);
  assert.equal((await store.listShow("42", "קניות")).text, "חלב\nלחם");
  await store.listRemove("42", "קניות", null, true);
  assert.deepEqual((await store.listsAll("42")).lists, []);
});

test("פתקים: מאגר קטן חוזר במלואו", async () => {
  await store.saveNote("42", { content: "הקוד של השער 4521" });
  const r = await store.searchNotes("42", "שער");
  assert.equal(r.complete, true);
  assert.equal(r.notes.length, 1);
});

test("מנעול: הראשון זוכה, השני נדחה", async () => {
  assert.equal(await store.claim("x"), true);
  assert.equal(await store.claim("x"), false);
});

test("צימוד: רק עם הקוד הנכון, ורק פעם אחת", async () => {
  await store.setSetting("pairing_code", "123456");
  let s = await store.getSettings();
  assert.equal(isAllowed("42", s), false);
  assert.equal(await tryPair("42", "/start 999999", s), false);
  assert.equal(await tryPair("42", "/start 123456", s), true);
  s = await store.getSettings();
  assert.equal(isAllowed("42", s), true);
  assert.equal(await tryPair("43", "123456", s), false);
  assert.equal(isAllowed("43", s), false);
});

test("ALLOWED_CHAT_IDS מוסיף מורשים בלי צימוד", () => {
  process.env.ALLOWED_CHAT_IDS = "7, 8";
  assert.equal(isAllowed("8", {}), true);
  assert.equal(isAllowed("9", {}), false);
});

test("זיהוי קוד צימוד", () => {
  assert.equal(pairingCodeIn("/start 123456"), "123456");
  assert.equal(pairingCodeIn(" 654321 "), "654321");
  assert.equal(pairingCodeIn("/start"), null);
  assert.equal(pairingCodeIn("שלום 123456"), null);
});

test("זיהוי ספק לפי המפתח", () => {
  assert.equal(detectProvider("sk-ant-abc", ""), "anthropic");
  assert.equal(detectProvider("sk-proj-abc", ""), "openai");
  assert.equal(detectProvider("AIzaXYZ", ""), "google");
  assert.equal(detectProvider("weird", ""), null);
  assert.equal(detectProvider("weird", "google"), "google");
});

test("בחירת המודל החדש ביותר", async () => {
  const flash = /^gemini-(\d+(?:\.\d+)?)-flash$/;
  assert.equal(newest(["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3-flash"], flash), "gemini-3-flash");
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        models: [
          { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
          { name: "models/gemini-9-flash", supportedGenerationMethods: ["embedContent"] },
        ],
      })
    );
  assert.deepEqual(await resolveModel("google", "AIza", fakeFetch), { ok: true, model: "gemini-2.5-flash" });
  const denied = async () => new Response("{}", { status: 401 });
  assert.deepEqual(await resolveModel("anthropic", "sk-ant-x", denied), { ok: false, status: 401 });
});

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
  // בהיסטוריה רואים שהתזכורת באמת נקבעה, כדי שהתור הבא לא ייצור אותה שוב
  assert.equal(history[1].content, "סגור, אזכיר מחר ב-9:00\n\n[פעולות שבוצעו: create_reminder]");
});

test("רישום הפעולות מההיסטוריה לא מגיע למשתמש, ותשובה בלי כלים נשמרת כמו שהיא", async () => {
  scriptedModel([{ text: "שלום!\n\n[פעולות שבוצעו: create_reminder]" }]);
  const out = await converse({ chatId: "42", text: "היי", settings: {} });
  assert.equal(out.text, "שלום!");
  assert.equal((await store.getHistory("42"))[1].content, "שלום!");
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
  assert.equal(detectProvider("AQ.Ab8RN6xyz", ""), "google");
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
  // Claude: ה-Haiku החדש ביותר, גם כש-Opus ברשימה ראשון
  const claude = async () =>
    new Response(JSON.stringify({ data: ["claude-opus-5-5", "claude-haiku-4-5-20251001", "claude-haiku-4-5", "claude-haiku-5-5", "claude-sonnet-5-5"].map((id) => ({ id })) }));
  assert.deepEqual(await resolveModel("anthropic", "sk-ant-x", claude), { ok: true, model: "claude-haiku-5-5" });
  const denied = async () => new Response("{}", { status: 401 });
  assert.deepEqual(await resolveModel("anthropic", "sk-ant-x", denied), { ok: false, status: 401 });
});

test("החלפת ספק: מודל שנשמר לספק אחר לא נשלח לספק החדש", async () => {
  const { languageModel } = await import("../lib/ai.js");
  process.env.AI_API_KEY = "sk-ant-test";
  const m = languageModel({ ai_model: "gemini-2.5-flash", ai_provider: "google" });
  assert.equal(m.provider, "anthropic");
  assert.notEqual(m.modelId, "gemini-2.5-flash");
  assert.equal(languageModel({ ai_model: "claude-haiku-5-5", ai_provider: "anthropic" }).modelId, "claude-haiku-5-5");
});

test("צימוד: אחרי 5 ניחושים שגויים הקוד נמחק", async () => {
  await store.setSetting("pairing_code", "123456");
  for (let i = 0; i < 5; i++) await tryPair("666", "/start 000000", await store.getSettings());
  const s = await store.getSettings();
  assert.equal(s.pairing_code ?? null, null);
  assert.equal(await tryPair("666", "/start 123456", s), false);
  assert.equal(isAllowed("666", await store.getSettings()), false);
});

test("כל הודעת משתמש קודמת מקבלת זמן: תאריך מאתמול, שעה מהיום (גם מלפני 5 דקות)", async () => {
  const { datedHistory } = await import("../lib/brain.js");
  const now = new Date("2026-10-18T07:00:00Z");
  const out = datedHistory(
    [
      { role: "user", content: "מה יש לי מחר?", created_at: "2026-10-17T09:06:00Z" },
      { role: "assistant", content: "מחר, יום ראשון", created_at: "2026-10-17T09:06:10Z" },
      { role: "user", content: "תזכיר לי בעוד 2 דקות", created_at: "2026-10-18T06:03:00Z" },
      { role: "user", content: "תודה", created_at: "2026-10-18T06:55:00Z" },
    ],
    "Asia/Jerusalem",
    now,
  );
  assert.deepEqual(out, [
    { role: "user", content: "[17.10] מה יש לי מחר?" },
    { role: "assistant", content: "מחר, יום ראשון" },
    { role: "user", content: "[09:03] תזכיר לי בעוד 2 דקות" },
    { role: "user", content: "[09:55] תודה" },
  ]);
});

test("גרסאות: השוואה, ו-GitHub שלא עונה לא מפיל את הבדיקה", async () => {
  const { isNewer, latestVersion } = await import("../lib/version.js");
  assert.equal(isNewer("1.2.0", "1.1.9"), true);
  assert.equal(isNewer("1.10.0", "1.9.0"), true);
  assert.equal(isNewer("1.1.0", "1.1.0"), false);
  assert.equal(isNewer("1.0.9", "1.1.0"), false);
  assert.equal(await latestVersion(async () => new Response(JSON.stringify({ version: "2.0.0" }))), "2.0.0");
  assert.equal(await latestVersion(async () => { throw new Error("offline"); }), null);
});

test("צימוד: ניחושים שגויים שנשלחים במקביל נספרים, והקוד נמחק", async () => {
  await store.setSetting("pairing_code", "123456");
  const snapshot = await store.getSettings();
  await Promise.all(Array.from({ length: 5 }, () => tryPair("666", "/start 000000", snapshot)));
  assert.equal((await store.getSettings()).pairing_code ?? null, null);
});

test("תזכורת בתאריך שאחרי מעבר שעון נשמרת בשעה שביקשו (כל יום בשנה)", async () => {
  const { offsetString, fromWallParts } = await import("../lib/time.js");
  const tz = "Asia/Jerusalem";
  // תאריך בעונה ההפוכה להיום, עם ההיסט של היום, כמו שהמודל כותב
  const date = offsetString(tz) === offsetString(tz, new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 15)))
    ? `${new Date().getUTCFullYear() + 1}-07-15` : `${new Date().getUTCFullYear() + 1}-01-15`;
  await store.setSetting("owner_chat_id", "42");
  scriptedModel([{ tool: "create_reminder", input: { text: "רופא", due_at: `${date}T10:00:00${offsetString(tz)}` } }, { text: "נקבע" }]);
  await converse({ chatId: "42", text: "תזכיר לי", settings: await store.getSettings() });
  const [r] = (await store.listReminders("42")).reminders;
  const [y, mo, d] = date.split("-").map(Number);
  assert.equal(new Date(r.due_at).getTime(), fromWallParts(tz, { y, mo, d, h: 10, mi: 0 }).getTime());
});

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { freshEnv, mockReq, mockRes, telegramCalls } from "./helpers.js";
import * as store from "../lib/db.js";
import { secrets } from "../lib/config.js";
import handler, { stepStatus, ACTIONS } from "../api/setup.js";

let env;
beforeEach(() => {
  env = freshEnv();
});

test("בלי סיסמה: עמוד כניסה, ולא מידע", async () => {
  const res = mockRes();
  await handler(mockReq({ method: "GET" }), res);
  assert.match(res.body, /סיסמת ההקמה/);
  assert.doesNotMatch(res.body, /שלבי ההקמה/);
});

test("סיסמה שגויה: 401", async () => {
  const res = mockRes();
  await handler(mockReq({ body: { action: "login", password: "wrong" } }), res);
  assert.equal(res.statusCode, 401);
});

test("סיסמה נכונה: עוגייה שאינה הסיסמה עצמה, וחזרה לעמוד", async () => {
  const res = mockRes();
  await handler(mockReq({ body: { action: "login", password: "correct-horse" } }), res);
  assert.equal(res.statusCode, 303);
  assert.match(res.headers["set-cookie"], /HttpOnly; Secure; SameSite=Strict/);
  assert.doesNotMatch(res.headers["set-cookie"], /correct-horse/);
});

test("JSON למסלול Claude Code: כל השלבים עם מצב, בלי ערכי סודות", async () => {
  const res = mockRes();
  await handler(
    mockReq({ method: "GET", headers: { "x-setup-password": "correct-horse" }, query: { format: "json" } }),
    res
  );
  const text = JSON.stringify(res.body);
  assert.ok(res.body.steps.length >= 6);
  assert.equal(res.body.checks.telegram_token.ok, true);
  assert.doesNotMatch(text, /AAH-test-token|correct-horse|AIza-test/);
});

test("העמוד יוצר קוד צימוד לבד ומציג קישור לטלגרם", async () => {
  // השלבים הקודמים ירוקים: הבוט מחובר, ה-AI נבדק, התזכורות רצות.
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) =>
    String(url).endsWith("/getWebhookInfo")
      ? new Response(JSON.stringify({ ok: true, result: { url: "https://bot.example.vercel.app/api/telegram" } }))
      : realFetch(url, init);
  await store.setSetting("ai_model", "gemini-2.5-flash");
  await store.setSetting("ai_provider", "google");
  await store.heartbeat();
  const res = mockRes();
  await handler(mockReq({ method: "GET", headers: { cookie: `setup_session=${secrets.session()}` } }), res);
  const code = (await store.getSettings()).pairing_code;
  assert.match(code, /^\d{6}$/);
  assert.match(res.body, new RegExp(`t\\.me/test_helper_bot\\?start=${code}`));
});

test("הפעילו הכול בלי כתובת מסד: מחבר את הבוט ובודק את ה-AI", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) =>
    String(url).includes("generativelanguage")
      ? new Response(
          JSON.stringify({ models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] })
        )
      : realFetch(url, init);
  const errors = await ACTIONS.activate(mockReq({ headers: {} }));
  assert.deepEqual(errors, []);
  assert.equal((await store.getSettings()).ai_model, "gemini-2.5-flash");
  const [hook] = telegramCalls(env.sent, "setWebhook");
  assert.equal(hook.url, "https://bot.example.vercel.app/api/telegram");
  assert.equal(hook.secret_token, secrets.webhook());
});

test("אחרי פעולה עם שגיאה: חזרה לעמוד, והשגיאה עוברת בעוגייה קצרה", async () => {
  const res = mockRes();
  const cookie = `setup_session=${secrets.session()}`;
  await handler(mockReq({ headers: { cookie }, body: { action: "save_settings", briefing_time: "7" } }), res);
  assert.equal(res.statusCode, 303);
  assert.match(res.headers["set-cookie"], /setup_flash=/);
  const flash = res.headers["set-cookie"].split(";")[0];
  const page = mockRes();
  await handler(mockReq({ method: "GET", headers: { cookie: `${cookie}; ${flash}` } }), page);
  assert.match(page.body, /שעת התדריך צריכה להיות בפורמט 07:30/);
});

test("שלב מורכב ירוק רק כשכל החלקים ירוקים", () => {
  const checks = { database: { ok: true }, ai_model: { ok: true }, telegram_webhook: { ok: false }, scheduler: { ok: true } };
  assert.equal(stepStatus("activate", checks).ok, false);
  checks.telegram_webhook.ok = true;
  assert.equal(stepStatus("activate", checks).ok, true);
});

test("קבצי ההדרכה מעודכנים (npm run guide לא משנה כלום)", () => {
  execFileSync(process.execPath, ["scripts/build-guide.mjs", "--check"], { stdio: "pipe" });
});

test("דף הבית ומדיניות הפרטיות (Google דורש את שתיהן לפני Publish)", async () => {
  const { default: home } = await import("../api/home.js");
  const page = mockRes();
  home(mockReq({ method: "GET" }), page);
  assert.match(page.body, /href="\/privacy"/);
  const privacy = mockRes();
  home(mockReq({ method: "GET", query: { privacy: "" } }), privacy);
  assert.match(privacy.body, /מדיניות פרטיות/);
  assert.match(privacy.body, /myaccount\.google\.com\/permissions/);
});

test("ההדרכות שנוצרו כוללות את כל חלקי התוספת של Google (טקסט שלפני ### לא נעלם)", async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of ["docs/browser.md", "docs/claude-code.md"]) {
    const doc = readFileSync(f, "utf8");
    for (const part of ["חלק א׳", "חלק ב׳", "חלק ג׳", "חלק ד׳", "חלק ה׳"]) assert.match(doc, new RegExp(part), `${f}: חסר ${part}`);
  }
});

test("ניחוש סיסמה: אחרי 10 ניסיונות בדקה מאותה כתובת — 429, גם לסיסמה הנכונה", async () => {
  const login = async (password) => {
    const res = mockRes();
    await handler(mockReq({ headers: { "x-real-ip": "1.2.3.4" }, body: { action: "login", password } }), res);
    return res.statusCode;
  };
  for (let i = 0; i < 10; i++) assert.equal(await login("wrong"), 401);
  assert.equal(await login("correct-horse"), 429);
});

test("סיסמה קצרה מ-8 תווים לא פותחת את העמוד, ומסבירה מה לעשות", async () => {
  freshEnv({ SETUP_PASSWORD: "short" });
  const res = mockRes();
  await handler(mockReq({ body: { action: "login", password: "short" } }), res);
  assert.equal(res.statusCode, 401);
  assert.match(res.body, /קצרה/);
});

test("סיסמה בכותרת: גם ב-POST של פעולה וגם בחיבור Google סופרים ניסיונות", async () => {
  const start = (await import("../api/google/start.js")).default;
  const headers = { "x-real-ip": "5.6.7.8", "x-setup-password": "wrong-guess" };
  for (let i = 0; i < 10; i++) await handler(mockReq({ headers, body: { action: "new_pairing" } }), mockRes());
  const res = mockRes();
  await start(mockReq({ method: "GET", headers }), res);
  assert.equal(res.statusCode, 429);
});

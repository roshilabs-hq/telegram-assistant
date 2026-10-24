import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { env, secrets, baseUrl } from "../lib/config.js";
import { cookies, authed, sessionCookie, passwordOk, tooManyTries, MIN_PASSWORD } from "../lib/session.js";
import { googleConfigured, redirectUri } from "../lib/google.js";
import { VERSION, ownRepo } from "../lib/version.js";
import { runChecks, cronSql } from "../lib/checks.js";
import { detectProvider, resolveModel } from "../lib/ai.js";
import * as store from "../lib/db.js";
import { newPairingCode } from "../lib/core.js";
import { setWebhook } from "../lib/telegram.js";
import { STEPS, ADDONS } from "../lib/steps.generated.js";

/**
 * עמוד ההקמה: וי ירוק או איקס אדום לכל שלב, וכפתור לכל דבר שהמכונה יכולה
 * לעשות לבד. מוגן בסיסמת ההקמה (SETUP_PASSWORD).
 *
 * GET  מציג בלבד ולא משנה כלום.
 * POST מבצע פעולה אחת (action) וחוזר לעמוד.
 * ?format=json מחזיר את מצב הבדיקות, בשביל check-config של מסלול Claude Code.
 */

export const DOCS = "https://github.com/roshilabs-hq/telegram-assistant/blob/main/docs";
const FLASH = "setup_flash";

const COMPOSITE = {
  deploy: ["setup_password", "supabase_env"],
  activate: ["database", "ai_model", "telegram_webhook", "scheduler"],
};

export function stepStatus(check, checks) {
  const parts = COMPOSITE[check] || [check];
  const ok = parts.every((p) => checks[p]?.ok);
  return { ok, parts: parts.map((p) => ({ id: p, ...(checks[p] || { ok: false, detail: "" }) })) };
}

// ---------- פעולות ----------

function schemaSql() {
  return readFileSync(join(process.cwd(), "supabase", "migrations", "0001_init.sql"), "utf8");
}

async function runSql(sqlText) {
  const sql = postgres(env.databaseUrl(), { ssl: "require", max: 1, prepare: false });
  try {
    await sql.unsafe(sqlText);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * אחרי יצירת הטבלאות, ה-API של Supabase צריך כמה שניות לטעון אותן מחדש. בלי ההמתנה,
 * בלחיצה הראשונה על "הפעילו הכול" הבדיקה הבאה נכשלה ב-"schema cache" (נמצא בהרצה 24.10).
 */
async function waitForTables(tries = 15) {
  for (let i = 0; i < tries; i++) {
    const { error } = await store.db().from("bot_settings").select("key").limit(1);
    if (!error) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function checkAi() {
  const key = env.aiKey();
  const provider = detectProvider(key);
  if (!provider) return "לא זוהה ספק AI. בדקו את AI_API_KEY.";
  const r = await resolveModel(provider, key);
  if (!r.ok) {
    return r.status === 401 || r.status === 403
      ? "הספק דחה את המפתח. כדאי להעתיק אותו שוב, בלי רווחים."
      : r.status === 429
        ? "הספק אומר שנגמרה המכסה או שאין יתרה בחשבון."
        : `הבדיקה מול הספק נכשלה (קוד ${r.status}).`;
  }
  await store.setSetting("ai_model", r.model);
  await store.setSetting("ai_provider", provider);
  return null;
}

export const ACTIONS = {
  async activate(req) {
    const errors = [];
    const url = baseUrl(req);
    if (env.databaseUrl()) {
      try {
        await runSql(schemaSql());
        await waitForTables();
      } catch (e) {
        errors.push(`יצירת הטבלאות נכשלה: ${e.message}`);
      }
    }
    try {
      const e = await checkAi();
      if (e) errors.push(e);
    } catch (e) {
      errors.push(`בדיקת ה-AI נכשלה: ${e.message}`);
    }
    const hook = await setWebhook(`${url}/api/telegram`, secrets.webhook()).catch((e) => ({ ok: false, description: e.message }));
    if (!hook.ok) errors.push(`חיבור הבוט לטלגרם נכשל: ${hook.description || ""}`);
    if (env.databaseUrl()) {
      try {
        await runSql(cronSql(url));
      } catch (e) {
        errors.push(`הפעלת התזמון נכשלה: ${e.message}`);
      }
    }
    return errors;
  },
  async check_ai() {
    const e = await checkAi();
    return e ? [e] : [];
  },
  async set_webhook(req) {
    const hook = await setWebhook(`${baseUrl(req)}/api/telegram`, secrets.webhook());
    return hook.ok ? [] : [`חיבור הבוט לטלגרם נכשל: ${hook.description || ""}`];
  },
  async new_pairing() {
    await store.setSetting("pairing_code", newPairingCode());
    return [];
  },
  async reset_owner(req, form) {
    if (form.confirm !== "כן") return ["כדי לנתק, כתבו כן בתיבה."];
    await store.setSetting("owner_chat_id", null);
    await store.setSetting("pairing_code", newPairingCode());
    return [];
  },
  async save_settings(req, form) {
    const name = String(form.owner_name || "").trim().slice(0, 40);
    await store.setSetting("owner_name", name || null);
    const t = String(form.briefing_time || "").trim();
    if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return ["שעת התדריך צריכה להיות בפורמט 07:30"];
    await store.setSetting("briefing_time", t || null);
    return [];
  },
  async new_ask_token() {
    await store.setSetting("ask_token", randomBytes(24).toString("base64url"));
    return [];
  },
};

// ---------- תצוגה ----------

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function page(body) {
  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>הקמת העוזר האישי</title>
<style>
:root{--bg:#f7f7f5;--card:#fff;--ink:#1b1b1b;--muted:#6b6b6b;--ok:#1f8a4c;--bad:#c0392b;--line:#e5e5e0;--accent:#2563eb}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--card:#1e1e1e;--ink:#f1f1f1;--muted:#a0a0a0;--line:#333;--accent:#60a5fa}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
main{max-width:640px;margin:0 auto;padding:24px 16px 64px}h1{font-size:1.5rem;margin:0 0 4px}h2{font-size:1.1rem;margin:28px 0 8px}
.muted{color:var(--muted)}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:10px 0}
.step{display:flex;gap:12px;align-items:flex-start}.icon{font-size:1.3rem;line-height:1.4}.step .t{display:block;font-weight:700}
.next{border:2px solid var(--accent)}.parts{margin:6px 0 0;padding:0;list-style:none;font-size:.9rem}
button,.btn{display:inline-block;background:var(--accent);color:#fff;border:0;border-radius:10px;padding:12px 18px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;margin-top:8px}
.ghost{background:transparent;color:var(--accent);border:1px solid var(--accent)}
input,textarea{width:100%;font:inherit;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}
textarea{direction:ltr;font-family:ui-monospace,monospace;font-size:.8rem;height:140px}
.err{background:#fdecea;color:#7a1f16;border-color:#f5c2bd}.code{font-size:2rem;letter-spacing:.3em;font-weight:700;direction:ltr;text-align:center}
label{display:block;margin-top:10px;font-weight:600}a{color:var(--accent)}
</style></head><body><main>${body}<p class="muted" style="text-align:center">גרסה ${VERSION}</p></main></body></html>`;
}

function loginPage(error) {
  return page(`<h1>הקמת העוזר האישי</h1>
<p class="muted">מקלידים את סיסמת ההקמה שבחרתם בטופס של Vercel (השדה SETUP_PASSWORD).</p>
${error ? `<div class="card err">${esc(error)}</div>` : ""}
${env.setupPassword() ? "" : `<div class="card err">עוד לא הוגדרה סיסמת הקמה. מוסיפים את SETUP_PASSWORD ב-Vercel ‹ Settings ‹ Environment Variables, ועושים Redeploy.</div>`}
<form method="post" class="card"><input type="hidden" name="action" value="login">
<label for="pw">סיסמת ההקמה</label><input id="pw" name="password" type="password" autocomplete="current-password" required>
<button type="submit">כניסה</button></form>`);
}

function supabaseSqlEditor() {
  const m = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(env.supabaseUrl());
  return m ? `https://supabase.com/dashboard/project/${m[1]}/sql/new` : "https://supabase.com/dashboard";
}

function actionPanel(check, checks, ctx) {
  const btn = (action, label, cls = "") =>
    `<form method="post"><input type="hidden" name="action" value="${action}"><button class="${cls}" type="submit">${label}</button></form>`;

  if (check === "deploy" || check === "telegram_token" || check === "ai_key") {
    return `<p>חסר משהו בהגדרות של Vercel. נכנסים ל-<a href="https://vercel.com/dashboard" target="_blank" rel="noopener">Vercel</a> ‹ הפרויקט ‹ <b>Settings</b> ‹ <b>Environment Variables</b>, מתקנים, ואז <b>Deployments</b> ‹ <b>Redeploy</b>.</p>`;
  }
  if (check === "activate") {
    const manual = !env.databaseUrl() && (!checks.database.ok || !checks.scheduler.ok);
    return `${btn("activate", "🚀 הפעילו הכול")}
${manual ? `<p>יש עוד פעולה אחת שאני לא יכול לעשות לבד: להריץ פקודות במסד. הן יוצרות את הטבלאות של הבוט ומפעילות את התזמון, ולא נוגעות בשום דבר אחר. לוחצים <b>העתקה</b>, פותחים את <a href="${supabaseSqlEditor()}" target="_blank" rel="noopener">עורך ה-SQL של Supabase</a>, מדביקים, ולוחצים <b>Run</b>. אחר כך חוזרים לכאן ומרעננים.</p>
<textarea id="sql" readonly>${esc(schemaSql() + "\n\n" + cronSql(ctx.url))}</textarea>
<button class="ghost" type="button" onclick="navigator.clipboard.writeText(document.getElementById('sql').value);this.textContent='הועתק ✓'">העתקה</button>` : ""}`;
  }
  if (check === "owner") {
    const code = ctx.settings.pairing_code;
    if (!code) return btn("new_pairing", "יצירת קוד צימוד");
    const link = ctx.bot ? `https://t.me/${ctx.bot.username}?start=${code}` : null;
    return `<p>זה הקוד שמחבר בין הבוט לבינך. בטלפון לוחצים על הכפתור, ובטלגרם לוחצים <b>Start</b> (או <b>התחל</b>).</p>
${link ? `<a class="btn" href="${esc(link)}">📲 פתיחת הבוט בטלגרם</a>` : ""}
<p class="muted">מהמחשב: שולחים לבוט את הקוד הזה</p><div class="code">${esc(code)}</div>`;
  }
  return "";
}

function settingsPanel(s) {
  return `<h2>הגדרות</h2><form method="post" class="card"><input type="hidden" name="action" value="save_settings">
<label for="n">איך הבוט יקרא לך? (לא חובה)</label><input id="n" name="owner_name" value="${esc(s.owner_name || "")}" maxlength="40">
<label for="b">תדריך בוקר — באיזו שעה? (ריק = כבוי)</label><input id="b" name="briefing_time" value="${esc(s.briefing_time || "")}" placeholder="07:30" inputmode="numeric" dir="ltr">
<button type="submit">שמירה</button></form>`;
}

function askPanel(s, url) {
  if (!s.ask_token) {
    return `<form method="post"><input type="hidden" name="action" value="new_ask_token"><button class="ghost" type="submit">הפעלת גישה מ-Siri</button></form>`;
  }
  return `<p class="muted">הכתובת והמפתח לקיצור הדרך באייפון (ההדרכה בתוספת "Siri"):</p>
<textarea readonly style="height:70px">${esc(`${url}/api/ask`)}\n${esc(s.ask_token)}</textarea>`;
}

/**
 * תוספת "עדכונים אוטומטיים": קישורים ישירים לריפו של הלקוח ב-GitHub, כדי שלא יחפש
 * את Settings ‹ Actions לבד. בלי הכתובת של הריפו (מחוץ ל-Vercel) מציגים רק את הגרסה.
 */
function updatesPanel(check) {
  const repo = ownRepo();
  if (!repo) return "";
  return check?.ok
    ? `<p class="muted"><a href="${repo}/settings/actions" target="_blank" rel="noopener">ההגדרה ב-GitHub (חד-פעמי)</a></p>`
    : `<a class="btn" href="${repo}/pulls" target="_blank" rel="noopener">🔄 לבקשת העדכון ב-GitHub</a>`;
}

const copyField = (id, label, value) => `<p class="muted">${label}</p>
<textarea id="${id}" readonly style="height:48px">${esc(value)}</textarea>
<button class="ghost" type="button" onclick="navigator.clipboard.writeText(document.getElementById('${id}').value);this.textContent='הועתק ✓'">העתקה</button>`;

/**
 * תוספת יומן ו-Gmail. את הכתובות המשתמש צריך להעתיק ל-Google Cloud בדיוק
 * כמו שהן, ולכן הן מוצגות כאן מוכנות להעתקה, ולא כהוראה "תרכיבו כתובת".
 */
function googlePanel(check, url, wasConnected) {
  const copy =
    copyField("gh", "דף הבית (Application home page):", url) +
    copyField("gp", "מדיניות פרטיות (Application privacy policy link):", `${url}/privacy`) +
    copyField("ru", "כתובת החזרה (Authorized redirect URI):", redirectUri(url));
  if (!googleConfigured()) return copy;
  // מי שהתחבר בעבר רואה "חיבור מחדש": זה השם שההודעות על חיבור שפג מפנות אליו.
  const label = wasConnected ? "🔗 חיבור מחדש" : "🔗 חיבור לחשבון Google";
  return `<a class="btn ${check?.ok ? "ghost" : ""}" href="/api/google/start">${label}</a>${check?.ok ? "" : copy}`;
}

function dashboard({ checks, settings, bot, url }, errors) {
  // העמוד משמש את שני המסלולים, אבל שלב "מורידים את הקוד" קיים רק במסלול Claude Code ואין לו בדיקה.
  const all = STEPS.filter((s) => s.only !== "claude").map((s, i) => ({ ...s, n: i + 1 }));
  let nextShown = false;
  const rows = all
    .map((s) => {
      const st = stepStatus(s.check, checks);
      const ok = s.check === "none" ? checks.owner?.ok : st.ok;
      const isNext = !ok && !nextShown;
      if (isNext) nextShown = true;
      const parts =
        st.parts.length > 1 || !ok
          ? `<ul class="parts">${st.parts.map((p) => `<li>${p.ok ? "✅" : "▫️"} ${esc(p.detail)}</li>`).join("")}</ul>`
          : `<span class="muted">${esc(st.parts[0]?.detail)}</span>`;
      return `<div class="card step ${isNext ? "next" : ""}"><span class="icon">${ok ? "✅" : isNext ? "👉" : "⬜"}</span>
<div style="flex:1"><span class="t">שלב ${s.n} מתוך ${all.length} · ${esc(s.title)}</span>${s.check === "none" ? "" : parts}
${isNext ? actionPanel(s.check, checks, { settings, bot, url }) : ""}
<div><a href="${DOCS}/browser.md#step-${s.id}" target="_blank" rel="noopener">הסבר מלא לשלב הזה</a></div></div></div>`;
    })
    .join("");

  const addons = ADDONS.map((a) => {
    const ok = checks[a.check]?.ok;
    return `<div class="card step"><span class="icon">${ok ? "✅" : "➕"}</span><div style="flex:1"><span class="t">${esc(a.title)}</span>
<span class="muted">${esc(checks[a.check]?.detail)}</span>${a.check === "ask" && checks.database?.ok ? askPanel(settings, url) : ""}${a.check === "google" && checks.database?.ok ? googlePanel(checks.google, url, Boolean(settings.google?.refresh_token)) : ""}${a.check === "updates" ? updatesPanel(checks.updates) : ""}
<div><a href="${DOCS}/browser.md#step-${a.id}" target="_blank" rel="noopener">איך מוסיפים</a></div></div></div>`;
  }).join("");

  const done = !nextShown;
  return page(`<h1>הקמת העוזר האישי</h1>
<p class="muted">${bot ? `הבוט: <b dir="ltr">@${esc(bot.username)}</b> · ` : ""}הדף מתעדכן כשמרעננים.</p>
${errors.length ? `<div class="card err">${errors.map(esc).join("<br>")}</div>` : ""}
${done ? `<div class="card" style="border-color:var(--ok)">🎉 <b>הכול מוכן!</b> הבוט עובד. אפשר לסגור את הדף.</div>` : ""}
<h2>שלבי ההקמה</h2>${rows}
${checks.database?.ok ? settingsPanel(settings) : ""}
${ADDONS.length ? `<h2>תוספות (לא חובה)</h2>${addons}` : ""}
${checks.owner?.ok ? `<h2>אזור מתקדם</h2><form method="post" class="card"><input type="hidden" name="action" value="reset_owner">
<label for="c">ניתוק הבוט מהחשבון שלך (למשל כדי לחבר טלפון אחר). כתבו "כן" לאישור:</label><input id="c" name="confirm">
<button class="ghost" type="submit">ניתוק</button></form>` : ""}`);
}

async function readForm(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return Object.fromEntries(new URLSearchParams(req.body));
  return {};
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "no-referrer");
  const wantsJson = String(req.query?.format || "") === "json";
  // מסלול Claude Code שולח את הסיסמה בכותרת, בכל סוג בקשה. גם שם סופרים ניסיונות.
  if (req.headers["x-setup-password"] && (await tooManyTries(req))) return res.status(429).json({ error: "too many tries, wait a minute" });

  if (req.method === "POST") {
    const form = await readForm(req);
    if (form.action === "login") {
      const page = (code, msg) => res.status(code).setHeader("content-type", "text/html; charset=utf-8").send(loginPage(msg));
      if (await tooManyTries(req)) return page(429, "יותר מדי ניסיונות. מחכים דקה ומנסים שוב.");
      if (env.setupPassword() && env.setupPassword().length < MIN_PASSWORD)
        return page(401, `הסיסמה שהוגדרה ב-Vercel קצרה מ-${MIN_PASSWORD} תווים. משנים את SETUP_PASSWORD ב-Vercel ‹ Settings ‹ Environment Variables, ואז Redeploy.`);
      if (!passwordOk(form.password)) return page(401, "הסיסמה לא נכונה.");
      res.setHeader("set-cookie", sessionCookie());
      return res.redirect(303, "/setup");
    }
    if (!authed(req)) return res.status(401).setHeader("content-type", "text/html; charset=utf-8").send(loginPage());
    const fn = Object.hasOwn(ACTIONS, form.action) ? ACTIONS[form.action] : null;
    let errors = [];
    try {
      errors = fn ? await fn(req, form) : ["פעולה לא מוכרת"];
    } catch (e) {
      errors = [`משהו נכשל: ${e.message}`];
    }
    if (wantsJson) return res.status(200).json({ errors, checks: (await runChecks(req)).checks });
    // אחרי פעולה חוזרים לעמוד הרגיל (ולא מציגים אותו כתשובה ל-POST), כדי שרענון
    // לא יקפיץ "לשלוח את הטופס שוב?". השגיאות עוברות בעוגייה קצרה.
    if (errors.length) {
      const value = encodeURIComponent(JSON.stringify(errors.map((e) => String(e).slice(0, 300))));
      res.setHeader("set-cookie", `${FLASH}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=60`);
    }
    return res.redirect(303, "/setup");
  }

  if (!authed(req)) {
    if (wantsJson) return res.status(401).json({ error: "unauthorized" });
    return res.status(200).setHeader("content-type", "text/html; charset=utf-8").send(loginPage());
  }

  let flash = [];
  try {
    flash = JSON.parse(decodeURIComponent(cookies(req)[FLASH] || "[]"));
  } catch {}
  if (flash.length) res.setHeader("set-cookie", `${FLASH}=; Path=/; Max-Age=0`);

  const state = await runChecks(req);
  // קוד צימוד נוצר לבד בפעם הראשונה שאפשר, כדי לחסוך לחיצה.
  if (state.checks.database.ok && !state.settings.owner_chat_id && !state.settings.pairing_code) {
    await store.setSetting("pairing_code", newPairingCode());
    state.settings.pairing_code = (await store.getSettings()).pairing_code;
  }
  if (wantsJson) {
    const steps = [...STEPS, ...ADDONS].map((s) => ({ id: s.id, kind: s.kind, title: s.title, ...stepStatus(s.check, state.checks) }));
    // קישור החיבור, כדי ש-Claude ייתן אותו למשתמש במסלול Claude Code. רק עד שיש בעלים.
    const code = state.settings.owner_chat_id ? null : state.settings.pairing_code;
    const pair_link = code && state.bot?.username ? `https://t.me/${state.bot.username}?start=${code}` : null;
    return res.status(200).json({ steps, checks: state.checks, pair_link });
  }
  return res.status(200).setHeader("content-type", "text/html; charset=utf-8").send(dashboard(state, Array.isArray(flash) ? flash : []));
}

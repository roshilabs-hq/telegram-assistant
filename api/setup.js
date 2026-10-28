import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { env, secrets, baseUrl } from "../lib/config.js";
import { cookies, authed, sessionCookie, passwordOk, tooManyTries, MIN_PASSWORD } from "../lib/session.js";
import { scriptSecret, connect as connectGoogle } from "../lib/google.js";
import { checkGroqKey } from "../lib/voice.js";
import { scriptSource } from "../lib/google-script.js";
import { VERSION, ownRepo } from "../lib/version.js";
import { runChecks, cronSql } from "../lib/checks.js";
import { generateText } from "ai";
import { detectProvider, resolveModel, languageModel, isQuotaError, aiKeyOf } from "../lib/ai.js";
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
  activate: ["database", "telegram_webhook", "scheduler"],
  brain: ["ai_key", "ai_model"],
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

/** בדיקה אמיתית של מפתח: מזהה ספק, בוחר מודל, ומבקש תשובה של מילה. null = עובד. */
async function checkAi(key) {
  const provider = detectProvider(key);
  if (!provider) return "זה לא נראה כמו מפתח של Claude. מעתיקים אותו שוב, כולו (הוא מתחיל ב-sk-ant-).";
  const r = await resolveModel(provider, key);
  if (!r.ok) {
    return r.status === 401 || r.status === 403
      ? "הספק דחה את המפתח. כדאי להעתיק אותו שוב, בלי רווחים."
      : r.status === 429
        ? "הספק אומר שנגמרה המכסה או שאין יתרה בחשבון."
        : `הבדיקה מול הספק נכשלה (קוד ${r.status}).`;
  }
  // רשימת המודלים נפתחת גם למפתח בלי יתרה. תשובה אמיתית אחת, של מילה, מוכיחה שהבוט יוכל לענות.
  try {
    await generateText({ model: languageModel({ ai_provider: provider, ai_model: r.model, ai_key: key }).model, prompt: "hi", maxOutputTokens: 1 });
  } catch (e) {
    return isQuotaError(e)
      ? "המפתח תקין, אבל אין בחשבון אצל הספק יתרה או אמצעי תשלום. מחברים תשלום (השלב \"מוסיפים לבוט מוח\"), ולוחצים שוב."
      : `הספק לא ענה לבקשת בדיקה: ${String(e.message).slice(0, 160)}`;
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
    // המוח בא בסוף: בלי מפתח עדיין לא בודקים AI, וזו לא שגיאה
    const key = aiKeyOf(await store.getSettings().catch(() => ({})));
    if (key) {
      try {
        const e = await checkAi(key);
        if (e) errors.push(e);
      } catch (e) {
        errors.push(`בדיקת ה-AI נכשלה: ${e.message}`);
      }
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
    const e = await checkAi(aiKeyOf(await store.getSettings()));
    return e ? [e] : [];
  },
  // "המוח בסוף": המפתח מודבק כאן ונשמר במסד, רק אחרי שהוכח שהוא עונה
  async save_ai_key(req, form) {
    const key = String(form.ai_key || "").trim();
    if (!key) return ["מדביקים את המפתח בתיבה, ואז לוחצים על הכפתור."];
    const e = await checkAi(key);
    if (e) return [e];
    await store.setSetting("ai_key", key);
    return [];
  },
  async set_webhook(req) {
    const hook = await setWebhook(`${baseUrl(req)}/api/telegram`, secrets.webhook());
    return hook.ok ? [] : [`חיבור הבוט לטלגרם נכשל: ${hook.description || ""}`];
  },
  // הודעות קוליות: כמו המפתח של Claude, מודבק כאן ונשמר רק אחרי ש-Groq אישר אותו
  async save_groq_key(req, form) {
    const key = String(form.groq_key || "").trim();
    if (!key) return ["מדביקים את המפתח בתיבה, ואז לוחצים על הכפתור."];
    const e = await checkGroqKey(key);
    if (e) return [e];
    await store.setSetting("groq_key", key);
    return [];
  },
  async google_connect(req, form) {
    const r = await connectGoogle(form.url);
    return r.ok ? [] : [r.error];
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
  // רק שדות שנשלחו משתנים: Claude שולח מרחוק רק את שעת התדריך, ואסור שזה ימחק את השם
  async save_settings(req, form) {
    if ("owner_name" in form) await store.setSetting("owner_name", String(form.owner_name || "").trim().slice(0, 40) || null);
    if (!("briefing_time" in form)) return [];
    // מקבלים גם 7, 07, 730 או 7.30 (מקלדת ספרות בטלפון), ושומרים תמיד כ-07:30.
    const m = /^(\d{1,2})(?:[:.]?(\d{2}))?$/.exec(String(form.briefing_time || "").trim());
    const t = m ? `${m[1].padStart(2, "0")}:${m[2] || "00"}` : String(form.briefing_time || "").trim();
    if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return ["שעת התדריך צריכה להיות שעה ביום, למשל 07:30 (או פשוט 7)"];
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
</style></head><body><main>${body}<p class="muted" style="text-align:center">גרסה ${VERSION}</p></main>
<script>
// חוזרים ללשונית (למשל מטלגרם): הדף מתרענן לבד, אלא אם יש שגיאה על המסך או שהתחלת להקליד.
document.addEventListener("visibilitychange", () => {
  if (document.hidden || document.querySelector(".err") || [...document.querySelectorAll("input,textarea")].some((e) => e.type !== "hidden" && e.value)) return;
  location.replace(location.pathname);
});
</script></body></html>`;
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

  if (check === "brain") {
    // מפתח שהוגדר ב-Vercel גובר. אז נשאר רק לבדוק אותו.
    if (env.aiKey()) return btn("check_ai", "🧠 בדיקת המפתח");
    return `<p>מדביקים כאן את המפתח של Claude. הוא מתחיל ב: <bdi dir="ltr">sk-ant-</bdi>. הוא נבדק מול Claude ונשמר רק אצלך, במסד של הבוט.</p>
<form method="post"><input type="hidden" name="action" value="save_ai_key">
<label for="ak">המפתח של Claude</label><input id="ak" name="ai_key" type="password" autocomplete="off" spellcheck="false" dir="ltr" placeholder="sk-ant-..." required>
<button type="submit">🧠 שמירה ובדיקה</button></form>`;
  }
  if (check === "deploy" || check === "telegram_token") {
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
    return `<p>זה הקוד שמחבר בין הבוט לבינך. בטלפון לוחצים על הכפתור, ובטלגרם לוחצים <b>Start</b> (או <b>התחל</b>). הקוד עובר לבד דרך הכפתור, ובצ'אט יופיע רק /start.</p>
${link ? `<a class="btn" href="${esc(link)}">📲 פתיחת הבוט בטלגרם</a>` : ""}
<p class="muted">מהמחשב: שולחים לבוט את הקוד הזה</p><div class="code">${esc(code)}</div>`;
  }
  return "";
}

function settingsPanel(s) {
  return `<h2>הגדרות</h2><form method="post" class="card"><input type="hidden" name="action" value="save_settings">
<label for="n">איך הבוט יקרא לך? (לא חובה)</label><input id="n" name="owner_name" value="${esc(s.owner_name || "")}" maxlength="40">
<label for="b">תדריך בוקר — באיזו שעה? (ריק = כבוי)</label><input id="b" name="briefing_time" value="${esc(s.briefing_time || "")}" type="time" placeholder="07:30" dir="ltr">
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
 * תוספת "עדכונים אוטומטיים": קישור אחד שמוסיף את קובץ העדכון לריפו של הלקוח ב-GitHub.
 * בלי הכתובת של הריפו (מחוץ ל-Vercel) מציגים רק את הגרסה.
 */
function updatesPanel(check) {
  const repo = ownRepo();
  if (!repo) return "";
  // Vercel לא מעתיק את .github/workflows כשהוא יוצר את הריפו, ולכן מוסיפים את קובץ העדכון ידנית:
  // הקישור פותח ב-GitHub קובץ חדש עם השם והתוכן מוכנים, ונשאר רק לאשר.
  const newFile = `${repo}/new/main?filename=.github/workflows/update.yml&value=`;
  const raw = "https://raw.githubusercontent.com/roshilabs-hq/telegram-assistant/main/.github/workflows/update.yml";
  // הוספת הקובץ מריצה מיד את העדכון. אחר כך העדכונים נכנסים לבד, והבוט מודיע בטלגרם.
  const setup = `<p class="muted"><a href="#" onclick="fetch('${raw}').then(r=>r.text()).then(t=>location.href='${newFile}'+encodeURIComponent(t));return false">הפעלת עדכונים אוטומטיים (פעם אחת)</a>. אחר כך העדכונים נכנסים לבד, והבוט מודיע לך בטלגרם. (GitHub כותב "A file with the same name already exists"? העדכונים כבר פועלים.)</p>`;
  return check?.ok ? setup : `<a class="btn" href="${repo}/actions/workflows/update.yml" target="_blank" rel="noopener">🔄 לעדכן עכשיו</a>${setup}`;
}

const voicePanel = () => `<form method="post"><input type="hidden" name="action" value="save_groq_key">
<label for="gk">המפתח של Groq (מתחיל ב-<bdi dir="ltr">gsk_</bdi>)</label><input id="gk" name="groq_key" type="password" autocomplete="off" spellcheck="false" dir="ltr" placeholder="gsk_..." required>
<button type="submit">🎙️ שמירה ובדיקה</button></form>`;

const copyField = (id, label, value) => `<p class="muted">${label}</p>
<textarea id="${id}" readonly style="height:48px">${esc(value)}</textarea>
<button class="ghost" type="button" onclick="navigator.clipboard.writeText(document.getElementById('${id}').value);this.textContent='הועתק ✓'">העתקה</button>`;

/**
 * תוספת יומן ו-Gmail: הקוד להדבקה ב-script.google.com (עם הסיסמה של הבוט הזה בתוכו),
 * ותיבה לכתובת שחוזרת מהפריסה. מחובר: רק "חיבור מחדש" מקופל.
 */
function googlePanel(check, secret) {
  const form = `<p>1. מעתיקים את הקוד (יש בו סיסמה, לא שולחים אותו לאף אחד):</p>
<textarea id="gs" readonly dir="ltr" style="height:48px">${esc(scriptSource(secret))}</textarea>
<button type="button" onclick="navigator.clipboard.writeText(document.getElementById('gs').value);this.textContent='הועתק ✓'">📋 העתקת הקוד</button>
<p>2. פותחים <a href="https://script.google.com/create" target="_blank" rel="noopener">script.google.com/create</a>, מוחקים את מה שכתוב שם, מדביקים ושומרים (Ctrl+S).</p>
<p>3. <b>פריסה</b> ‹ <b>פריסה חדשה</b> ‹ ⚙️ <b>אפליקציית אינטרנט</b> ‹ "למי יש גישה": <b>כולם</b> ‹ <b>פריסה</b>, ומאשרים את הגישה.</p>
<p>4. מדביקים כאן את הכתובת שמתקבלת (מסתיימת ב-<bdi>/exec</bdi>):</p>
<form method="post"><input type="hidden" name="action" value="google_connect"><input name="url" placeholder="https://script.google.com/macros/s/.../exec" dir="ltr"><button type="submit">חיבור</button></form>`;
  return check?.ok ? `<details><summary class="muted">חיבור מחדש</summary>${form}</details>` : form;
}

function dashboard({ checks, settings, bot, url }, errors) {
  // העמוד משמש את שני המסלולים, אבל שלב "מורידים את הקוד" קיים רק במסלול Claude Code ואין לו בדיקה.
  const all = STEPS.filter((s) => s.only !== "claude").map((s, i) => ({ ...s, n: i + 1 }));
  let nextShown = false;
  const rows = all
    .map((s) => {
      const st = stepStatus(s.check, checks);
      // שלב בלי בדיקה (ההודעה הראשונה) ירוק רק כשכל מה שלפניו ירוק
      const ok = s.check === "none" ? !nextShown && checks.owner?.ok : st.ok;
      const isNext = !ok && !nextShown;
      if (isNext) nextShown = true;
      const parts =
        st.parts.length > 1 || !ok
          ? `<ul class="parts">${st.parts.filter((p) => p.detail).map((p) => `<li>${p.ok ? "✅" : "▫️"} ${esc(p.detail)}</li>`).join("")}</ul>`
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
<span class="muted">${esc(checks[a.check]?.detail)}</span>${a.check === "ask" && checks.database?.ok ? askPanel(settings, url) : ""}${a.check === "google" && checks.database?.ok ? googlePanel(checks.google, settings.google?.secret) : ""}${a.check === "updates" ? updatesPanel(checks.updates) : ""}${a.check === "voice" && checks.database?.ok && !checks.voice?.ok ? voicePanel() : ""}
<div><a href="${DOCS}/browser.md#step-${a.id}" target="_blank" rel="noopener">איך מוסיפים</a></div></div></div>`;
  }).join("");

  const done = !nextShown;
  return page(`<h1>הקמת העוזר האישי</h1>
<p class="muted">${bot ? `הבוט: <b dir="ltr">@${esc(bot.username)}</b> · ` : ""}הדף מתעדכן לבד כשחוזרים אליו (או כשמרעננים).</p>
${errors.length ? `<div class="card err">${errors.map(esc).join("<br>")}</div>` : ""}
${done ? `<div class="card" style="border-color:var(--ok)">🎉 <b>הכול מוכן!</b> הבוט עובד. אפשר לסגור את הדף.</div>` : ""}
<h2>שלבי ההקמה</h2>${rows}
${checks.database?.ok ? settingsPanel(settings) : ""}
${ADDONS.length ? `<h2>תוספות (לא חובה)</h2>${addons}` : ""}
${checks.owner?.ok ? `<h2>אזור מתקדם</h2><form method="post" class="card"><input type="hidden" name="action" value="reset_owner">
<label for="c">ניתוק הבוט מהחשבון שלך (למשל כדי לחבר טלפון אחר). כתבו "כן" לאישור:</label><input id="c" name="confirm">
<button class="ghost" type="submit">ניתוק</button></form>
<form method="post" class="card"><input type="hidden" name="action" value="activate"><p class="muted">משהו הפסיק לעבוד, או שגרסה חדשה ביקשה? מריצים שוב את "הפעילו הכול". זה לא מוחק כלום.</p><button class="ghost" type="submit">🚀 הפעילו הכול שוב</button></form>` : ""}
${checks.ai_model?.ok && !env.aiKey() ? `<form method="post" class="card"><input type="hidden" name="action" value="save_ai_key">
<label for="ak2">החלפת המפתח של Claude (למשל אם פג או נמחק). המפתח החדש נבדק לפני שהוא מחליף את הישן:</label><input id="ak2" name="ai_key" type="password" autocomplete="off" spellcheck="false" dir="ltr" placeholder="sk-ant-..." required>
<button class="ghost" type="submit">החלפה ובדיקה</button></form>` : ""}`);
}

async function readForm(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return Object.fromEntries(new URLSearchParams(req.body));
  return {};
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-frame-options", "DENY");
  // same-origin ולא no-referrer: עם no-referrer הדפדפן שולח Origin: null בטופס של העמוד עצמו, והבדיקה למטה דחתה את הכניסה
  res.setHeader("referrer-policy", "same-origin");
  const wantsJson = String(req.query?.format || "") === "json";
  // מסלול Claude Code שולח את הסיסמה בכותרת, בכל סוג בקשה. גם שם סופרים ניסיונות.
  if (req.headers["x-setup-password"] && (await tooManyTries(req))) return res.status(429).json({ error: "too many tries, wait a minute" });

  if (req.method === "POST") {
    // בנוסף לעוגייה עם SameSite=Strict: טופס שנשלח מאתר אחר נדחה (CSRF).
    // "null" מגיע מדפדפנים ששומרים על פרטיות. אתר זר עם "null" לא שולח את העוגייה (SameSite=Strict), ולכן נעצר בכל מקרה.
    const origin = req.headers.origin;
    if (origin && origin !== "null" && origin !== `https://${req.headers.host}`) return res.status(403).send("forbidden");
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
  // הסיסמה לקוד של Google נוצרת מראש, כדי שהקוד להעתקה יהיה מוכן בתוספת
  if (state.checks.database.ok && !state.settings.google?.secret) {
    await scriptSecret();
    state.settings.google = await store.getSetting("google");
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

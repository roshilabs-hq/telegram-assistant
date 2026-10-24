import { env, secrets, baseUrl } from "./config.js";
import { detectProvider, PROVIDERS } from "./ai.js";
import * as store from "./db.js";
import { getMe, getWebhookInfo } from "./telegram.js";
import { googleConfigured, checkConnection } from "./google.js";
import { VERSION, latestVersion, isNewer } from "./version.js";
import { MIN_PASSWORD } from "./session.js";

/**
 * הבדיקות של כל שלב. מקור אחד: עמוד /setup מציג אותן, ו-check-config של
 * מסלול Claude Code קורא אותן דרך /api/setup?format=json.
 *
 * כל בדיקה מחזירה { ok, detail } ב-עברית פשוטה. אף בדיקה לא מחזירה ערך של סוד.
 */
export async function runChecks(req) {
  const out = {};
  const url = baseUrl(req);

  // --- משתני סביבה ---
  out.setup_password = env.setupPassword().length >= MIN_PASSWORD
    ? { ok: true, detail: "הוגדרה" }
    : { ok: false, detail: `צריך SETUP_PASSWORD באורך ${MIN_PASSWORD} תווים לפחות` };

  const token = env.telegramToken();
  let bot = null;
  if (!token) {
    out.telegram_token = { ok: false, detail: "חסר TELEGRAM_TOKEN" };
  } else {
    const me = await getMe().catch(() => ({ ok: false }));
    bot = me.ok ? me.result : null;
    out.telegram_token = bot
      ? { ok: true, detail: `הבוט ‎@${bot.username}` } // סימן כיווניות: שה-@ יישאר בצד של השם
      : { ok: false, detail: "טלגרם לא מכיר את הטוקן. כדאי להעתיק אותו שוב מ-BotFather" };
  }

  const provider = detectProvider();
  out.ai_key = !env.aiKey()
    ? { ok: false, detail: "חסר AI_API_KEY" }
    : provider
      ? { ok: true, detail: PROVIDERS[provider].label }
      : { ok: false, detail: "לא הצלחתי לזהות לאיזה ספק שייך המפתח" };

  out.supabase_env =
    env.supabaseUrl() && env.supabaseKey()
      ? { ok: true, detail: "פרטי החיבור קיימים" }
      : { ok: false, detail: "חסרים SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY" };

  // --- מסד ---
  let settings = null;
  if (out.supabase_env.ok) {
    try {
      settings = await store.getSettings();
      out.database = { ok: true, detail: "הטבלאות קיימות" };
    } catch (e) {
      out.database = { ok: false, detail: "הטבלאות עוד לא נוצרו" };
    }
  } else {
    out.database = { ok: false, detail: "קודם צריך חיבור ל-Supabase" };
  }

  out.ai_model =
    settings?.ai_model && settings.ai_provider === provider
      ? { ok: true, detail: `המודל: ${env.aiModel() || settings.ai_model}` }
      : {
          ok: false,
          detail: settings?.ai_model ? "המפתח הוחלף בספק אחר. לוחצים שוב \"הפעילו הכול\"" : "עוד לא נבדק שהמפתח עובד",
        };

  // --- טלגרם ---
  if (bot) {
    const info = await getWebhookInfo().catch(() => ({}));
    const want = `${url}/api/telegram`;
    const have = info?.result?.url || "";
    const lastError = info?.result?.last_error_message;
    const fresh = info?.result?.last_error_date && Date.now() / 1000 - info.result.last_error_date < 600;
    out.telegram_webhook =
      have !== want
        ? { ok: false, detail: have ? "הבוט מחובר לכתובת אחרת" : "הבוט עוד לא מחובר" }
        : lastError && fresh
          ? { ok: false, detail: `טלגרם מדווח על שגיאה: ${lastError}` }
          : { ok: true, detail: "מחובר" };
  } else {
    out.telegram_webhook = { ok: false, detail: "קודם צריך טוקן תקין" };
  }

  out.owner = settings?.owner_chat_id
    ? { ok: true, detail: "הבוט מכיר אותך" }
    : { ok: false, detail: "עוד לא נשלח קוד הצימוד" };

  // --- תזמון ---
  if (settings) {
    const beat = await store.lastHeartbeat().catch(() => null);
    const ago = beat ? Math.round((Date.now() - beat.getTime()) / 60000) : null;
    out.scheduler =
      ago !== null && ago < 3
        ? { ok: true, detail: "רץ כל דקה" }
        : { ok: false, detail: ago === null ? "עוד לא הופעל" : `לא רץ כבר ${ago} דקות` };
  } else {
    out.scheduler = { ok: false, detail: "קודם צריך טבלאות" };
  }

  // --- תוספות ---
  out.voice = env.groqKey() ? { ok: true, detail: "מופעל" } : { ok: false, detail: "כבוי (חסר GROQ_API_KEY)" };
  out.briefing = settings?.briefing_time
    ? { ok: true, detail: `כל יום ב-${settings.briefing_time}` }
    : { ok: false, detail: "כבוי" };
  out.ask = settings?.ask_token ? { ok: true, detail: "מופעל" } : { ok: false, detail: "כבוי" };

  if (!googleConfigured()) {
    out.google = { ok: false, detail: "כבוי (חסרים GOOGLE_CLIENT_ID ו-GOOGLE_CLIENT_SECRET)" };
  } else if (!settings?.google?.refresh_token) {
    out.google = { ok: false, detail: "המפתחות קיימים, עוד לא התחברת לחשבון Google" };
  } else {
    const c = await checkConnection().catch(() => ({ connected: false, reason: "error" }));
    out.google = c.connected
      ? { ok: true, detail: `מחובר${c.email ? ` (${c.email})` : ""}` }
      : { ok: false, detail: c.reason === "expired" ? "החיבור פג, צריך להתחבר מחדש" : "Google לא עונה כרגע" };
  }

  const latest = await latestVersion();
  out.updates = latest && isNewer(latest, VERSION)
    ? { ok: false, detail: `יש גרסה חדשה (${latest}). הגרסה שלך: ${VERSION}` }
    : { ok: true, detail: `מעודכן (גרסה ${VERSION})` };

  out.none = { ok: true, detail: "" };

  return { checks: out, settings: settings || {}, bot, url };
}

/** הסוד שהמשתמש צריך לראות ב-/setup בשביל pg_cron. מוצג רק בעמוד המוגן. */
export function cronSql(url) {
  const auth = `Bearer ${secrets.cron()}`;
  return `-- הפעלת התזמון: Supabase יקרא לבוט כל דקה.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.unschedule(jobid) from cron.job where jobname = 'telegram-assistant';
select cron.schedule(
  'telegram-assistant',
  '* * * * *',
  $cron$ select net.http_post(
    url := '${url}/api/cron',
    headers := jsonb_build_object('Authorization', '${auth}', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $cron$
);`;
}

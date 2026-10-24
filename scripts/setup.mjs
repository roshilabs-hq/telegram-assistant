#!/usr/bin/env node
/**
 * הקמה במסלול Claude Code: כל מה שאפשר לעשות מתוך המחשב, בלי לפתוח אתרים.
 * Claude מריץ את השלבים לפי הסדר (.claude/commands/start.md), ובאתרים המשתמש לוחץ בעצמו.
 *
 *   node scripts/setup.mjs preflight   מה מותקן, ומה צריך לפני שמתחילים
 *   node scripts/setup.mjs login       התחברות ל-Vercel (נפתח דפדפן)
 *   node scripts/setup.mjs env         יוצר את .env.local ומייצר סיסמת הקמה
 *   node scripts/setup.mjs verify      בודק את הטוקן מול טלגרם, ואת מפתח ה-AI בבקשה אמיתית
 *   node scripts/setup.mjs accounts    לאיזה חשבון GitHub ולאיזה צוות Vercel שייכים הטוקנים
 *   node scripts/setup.mjs confirm <github> <vercel> <bot>   שומר את אישור המשתמש. בלעדיו repo ו-deploy לא רצים
 *   node scripts/setup.mjs repo        יוצר את העותק הפרטי מהתבנית בחשבון שאושר
 *   node scripts/setup.mjs deploy      יוצר פרויקט ב-Vercel בצוות שאושר, מחבר Supabase ו-GitHub, ומעלה
 *   node scripts/setup.mjs url <כתובת>  שומר את הכתובת הקבועה, כשאי אפשר לאמת אותה לבד
 *   node scripts/setup.mjs activate    "הפעילו הכול" מרחוק, ומחזיר את קישור החיבור (--take-over רק באישור)
 *   node scripts/setup.mjs updates     תוספת: עדכונים אוטומטיים (ההגדרה ב-GitHub, דרך הטוקן)
 *   node scripts/setup.mjs briefing 07:30   תוספת: תדריך בוקר (בלי שעה: מכבה)
 *   node scripts/setup.mjs voice       תוספת: הודעות קוליות (GROQ_API_KEY עובר ל-Vercel)
 *
 * לעולם לא מדפיס ערך של סוד. סודות עוברים ל-Vercel דרך stdin, וטוקנים דרך סביבת התהליך,
 * כדי שלא יופיעו בשורת הפקודה. כל שלב בטוח להרצה חוזרת.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { hostname } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(ROOT, ".env.local");
const VERCEL = "vercel@54.1.0";
const REQUIRED = ["TELEGRAM_TOKEN", "AI_API_KEY", "SETUP_PASSWORD"];

const say = (ok, text) => console.log(`${ok === null ? "▫️" : ok ? "✅" : "❌"} ${text}`);

export function readEnv(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** מוסיף או מחליף שורה אחת, ומשאיר את כל השאר כמו שהוא. */
export function setEnvLine(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  return re.test(text) ? text.replace(re, line) : `${text.replace(/\s*$/, "")}\n${line}\n`;
}

export const TEMPLATE = `# הסודות של הבוט. הקובץ הזה נשאר רק במחשב שלך (הוא ב-.gitignore), ו-Claude לא קורא אותו.
# מדביקים אחרי ה-= בלי רווחים ובלי מירכאות.

# --- שני טוקנים להקמה בלבד. הם קובעים באיזה חשבון הכול נוצר, ולא עולים לבוט. ---
# GitHub: נכנסים לקישור, בוחרים Expiration של 7 ימים, לוחצים Generate token ומעתיקים (מתחיל ב-ghp_)
# https://github.com/settings/tokens/new?scopes=repo,workflow&description=telegram-assistant-setup
GITHUB_TOKEN=
# Vercel: נכנסים לקישור, Create Token, נותנים שם, Expiration של 7 ימים, Create ומעתיקים
# https://vercel.com/account/settings/tokens
VERCEL_TOKEN=

# --- הבוט ---
# הטוקן מ-BotFather, נראה כמו 123456789:AAH...
TELEGRAM_TOKEN=

# מפתח ה-AI מהספק (Gemini, ChatGPT או Claude)
AI_API_KEY=

# סיסמת עמוד ההקמה. Claude כבר יצר אותה, לא צריך לגעת.
SETUP_PASSWORD=

# --- תוספת "הודעות קוליות" (לא חובה) ---
# נכנסים עם Google, Create API Key, ומעתיקים (מתחיל ב-gsk_). חינמי.
# https://console.groq.com/keys
GROQ_API_KEY=
`;

const envNow = () => (existsSync(ENV_FILE) ? readEnv(readFileSync(ENV_FILE, "utf8")) : null);

// NODE_OPTIONS מוחק לוכסנים הפוכים, ולכן הנתיב נכתב עם /
const PRELOAD = `--require "${join(ROOT, "scripts", "ascii-hostname.cjs").replace(/\\/g, "/")}"`;

function run(cmd, args, { input, quiet = false, env: extra = {} } = {}) {
  // ב-Windows הפקודות הן קובצי .cmd, שרצים רק דרך shell. כל הארגומנטים כאן שלנו, לא של המשתמש.
  const line = [cmd, ...args.map((a) => (/^[\w@.:=/-]+$/.test(a) ? a : JSON.stringify(a)))].join(" ");
  const r = spawnSync(line, {
    cwd: ROOT,
    input,
    encoding: "utf8",
    shell: true,
    stdio: [input === undefined ? "inherit" : "pipe", "pipe", "pipe"],
    env: { ...process.env, NODE_OPTIONS: PRELOAD, ...extra },
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`.replace(/<claude-code-hint[^>]*>\s*/g, "");
  if (!quiet && r.status !== 0) console.log(out.trim().split("\n").slice(-6).join("\n"));
  return { ok: r.status === 0, out };
}

/**
 * לאיזה פרויקט התיקייה מחוברת ב-Vercel. גרסאות ישנות של ה-CLI כותבות .vercel/project.json,
 * וגרסאות חדשות (בתיקייה של git) כותבות .vercel/repo.json עם רשימת פרויקטים.
 */
export function linkedProject(dir = ROOT) {
  const read = (f) => (existsSync(join(dir, ".vercel", f)) ? JSON.parse(readFileSync(join(dir, ".vercel", f), "utf8")) : null);
  const p = read("project.json");
  if (p?.projectId) return { id: p.projectId, orgId: p.orgId, name: p.projectName || null };
  const r = read("repo.json")?.projects?.[0];
  return r?.id ? { id: r.id, orgId: r.orgId, name: r.name || null } : null;
}

/** מצב ההקמה (בלי סודות): מה המשתמש אישר. נשמר ב-.vercel, שלא עולה ל-git. */
function readState(name) {
  const f = join(ROOT, ".vercel", `setup-${name}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}
function writeState(name, data) {
  mkdirSync(join(ROOT, ".vercel"), { recursive: true });
  writeFileSync(join(ROOT, ".vercel", `setup-${name}.json`), JSON.stringify(data, null, 2));
}

// Vercel CLI שכבר מותקן חוסך הורדה, אבל רק מגרסה 54: גרסה ישנה לא קוראת את VERCEL_TOKEN מהסביבה,
// ואז הייתה עובדת בשקט מול החשבון שמחובר במחשב. אחרת npx מוריד גרסה קבועה.
let hasVercel;
const hasVercelNow = () => (hasVercel ??= Number(/(\d+)\.\d+\.\d+/.exec(run("vercel", ["--version"], { quiet: true }).out)?.[1] || 0) >= 54);

const vercel = (args, opts = {}) => {
  // הטוקן בסביבת התהליך, ולא בשורת הפקודה (שם הוא גלוי ברשימת התהליכים של המחשב)
  const t = envNow()?.VERCEL_TOKEN;
  const all = [...args];
  // הצוות של הפרויקט, או הצוות שהמשתמש אישר. לא הצוות שבמקרה מוגדר במחשב.
  const team = linkedProject()?.orgId || readState("confirmed")?.teamId;
  if (team && !["login", "whoami", "--version"].includes(args[0])) all.push("--scope", team);
  const o = { ...opts, env: t ? { VERCEL_TOKEN: t } : {} };
  return hasVercelNow() ? run("vercel", all, o) : run("npx", ["--yes", VERCEL, ...all], o);
};

const gh = async (path, token, init = {}) => {
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", ...init.headers },
  }).catch(() => null);
  return { status: r?.status || 0, data: r ? await r.json().catch(() => ({})) : {} };
};
const vapi = (path, token) =>
  fetch(`https://api.vercel.com${path}`, { headers: { authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

/** למי שייכים הטוקנים: משתמש ב-GitHub, ומשתמש וצוות ב-Vercel (שם ייווצר הפרויקט). */
async function identity() {
  const e = envNow() || {};
  const out = {};
  if (e.GITHUB_TOKEN) {
    const u = await gh("/user", e.GITHUB_TOKEN);
    if (u.status === 200) out.github = u.data.login;
  } else {
    // בלי טוקן: החשבון שמחובר ב-GitHub CLI (המסלול למי שלא יוצר טוקנים)
    const g = run("gh", ["api", "user", "--jq", ".login"], { quiet: true });
    if (g.ok) out.github = g.out.trim();
  }
  if (e.VERCEL_TOKEN) {
    const u = (await vapi("/v2/user", e.VERCEL_TOKEN))?.user;
    if (u) {
      out.vercelUser = u.username;
      const team = u.defaultTeamId ? await vapi(`/v2/teams/${u.defaultTeamId}`, e.VERCEL_TOKEN) : null;
      if (team) Object.assign(out, { teamId: team.id, teamSlug: team.slug, teamName: team.name });
    }
  } else {
    const w = vercel(["whoami"], { quiet: true });
    if (w.ok) out.vercelUser = w.out.trim().split("\n").pop();
  }
  return out;
}

/** עוצר אם החשבון שיוצרים בו הוא לא זה שהמשתמש אישר, או שהטוקן הוחלף מאז האישור. */
async function confirmedFor(kind) {
  const c = readState("confirmed");
  if (!c) {
    say(false, "החשבונות עוד לא אושרו. מראים למשתמש את accounts, ורק אחרי \"כן\" מריצים confirm.");
    return false;
  }
  const now = await identity();
  const ok = kind === "github" ? Boolean(now.github) && now.github === c.github : c.teamId ? now.teamId === c.teamId : now.vercelUser === c.vercelUser;
  if (!ok) say(false, "הטוקן שייך עכשיו לחשבון אחר ממה שאושר. מריצים שוב accounts, מראים למשתמש, ומאשרים מחדש.");
  return ok;
}

// ---------- השלבים ----------

function preflight() {
  const [major] = process.versions.node.split(".").map(Number);
  say(major >= 20, `Node.js ${process.versions.node}${major >= 20 ? "" : " (צריך 20 ומעלה)"}`);
  say(run("git", ["--version"], { quiet: true }).ok, "Git");
  const g = run("gh", ["auth", "status"], { quiet: true });
  if (g.ok) say(true, "GitHub CLI מחובר (גיבוי, למי שלא יוצר טוקנים)");
  else say(null, "אין GitHub CLI מחובר. זה בסדר: את העותק יוצרים עם הטוקן");
  if (/[^\x20-\x7E]/.test(hostname())) say(null, "שם המחשב בעברית. Vercel CLI נשבר מזה, ואנחנו עוקפים את זה אוטומטית.");
  if (envNow()?.VERCEL_TOKEN) return;
  // החשבון שמחובר במחשב הוא רק גיבוי. בדרך הרגילה החשבון נקבע לפי הטוקן בשלב הבא.
  const who = vercel(["whoami"], { quiet: true });
  say(null, who.ok ? `Vercel מחובר במחשב לחשבון ${who.out.trim().split("\n").pop()}. נשתמש בו רק אם תאשר.` : "Vercel: נחבר עם טוקן בשלב הבא");
}

/** מוסיף לקובץ קיים שדות חדשים מהתבנית (למשל של תוספת), יחד עם ההסבר והקישור שמעליהם. */
export function addMissingFields(text) {
  const have = readEnv(text);
  const lines = TEMPLATE.split("\n");
  let out = text.replace(/\s*$/, "\n");
  lines.forEach((line, i) => {
    const key = /^([A-Z0-9_]+)=/.exec(line)?.[1];
    if (!key || key in have) return;
    let start = i;
    while (start > 0 && lines[start - 1].startsWith("#")) start--;
    out += `\n${lines.slice(start, i + 1).join("\n")}\n`;
  });
  return out;
}

function env() {
  let text = existsSync(ENV_FILE) ? addMissingFields(readFileSync(ENV_FILE, "utf8")) : TEMPLATE;
  if (!(readEnv(text).SETUP_PASSWORD || "").length) text = setEnvLine(text, "SETUP_PASSWORD", randomBytes(18).toString("base64url"));
  writeFileSync(ENV_FILE, text);
  const e = readEnv(text);
  for (const k of REQUIRED) say(Boolean(e[k]), `${k}: ${e[k] ? "יש" : "חסר"}`);
}

/** איזה מודל זול לבדיקה, מתוך רשימת המודלים שהספק החזיר. */
export function cheapModel(provider, list) {
  const ids =
    provider === "google"
      ? (list.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => m.name)
      : (list.data || []).map((m) => m.id);
  const want = { google: /flash/, openai: /^gpt-.*mini/, anthropic: /haiku/ }[provider];
  return ids.find((id) => want.test(id)) || ids[0] || null;
}

/** בקשה אמיתית אחת, של מילה אחת: מוכיחה שהמפתח עובד ושיש אמצעי תשלום, לא רק שהמפתח קיים. */
async function tryAnswer(provider, key, model) {
  const req = {
    google: [`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${encodeURIComponent(key)}`, { contents: [{ parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 1 } }, {}],
    openai: ["https://api.openai.com/v1/chat/completions", { model, messages: [{ role: "user", content: "hi" }], max_completion_tokens: 1 }, { authorization: `Bearer ${key}` }],
    anthropic: ["https://api.anthropic.com/v1/messages", { model, max_tokens: 1, messages: [{ role: "user", content: "hi" }] }, { "x-api-key": key, "anthropic-version": "2023-06-01" }],
  }[provider];
  const r = await fetch(req[0], { method: "POST", headers: { "content-type": "application/json", ...req[2] }, body: JSON.stringify(req[1]) }).catch(() => null);
  if (!r) return { ok: null };
  if (r.ok) return { ok: true };
  const text = await r.text().catch(() => "");
  if ([400, 402, 403, 429].includes(r.status) && /quota|billing|credit|balance|insufficient|payment/i.test(text)) return { ok: false, billing: true };
  if (r.status === 401 || r.status === 403) return { ok: false };
  return { ok: null, status: r.status }; // תשובה לא צפויה: לא חוסמים, אבל מדווחים
}

async function verify() {
  const e = envNow() || {};
  const result = { ai: false, bot: null };
  // כל כישלון כאן מחזיר קוד יציאה שאינו 0, ו-deploy לא ירוץ בלי בדיקה מוצלחת
  const done = () => {
    writeState("verified", result);
    if (!result.ai || !result.bot) process.exitCode = 1;
  };
  const t = e.TELEGRAM_TOKEN || "";
  if (!t) say(false, "TELEGRAM_TOKEN חסר ב-.env.local");
  else {
    const r = await fetch(`https://api.telegram.org/bot${t}/getMe`).then((x) => x.json()).catch(() => null);
    if (r?.ok) result.bot = { id: r.result.id, username: r.result.username };
    say(Boolean(r?.ok), r?.ok ? `הטוקן תקין: הבוט @${r.result.username}. מוודאים עם המשתמש שזה הבוט החדש שיצר עכשיו.` : "טלגרם לא מכיר את הטוקן. מעתיקים אותו שוב מ-BotFather, רק את הקוד עצמו.");
  }
  const k = e.AI_API_KEY || "";
  const p = k.startsWith("sk-ant-") ? "anthropic" : k.startsWith("AIza") || k.startsWith("AQ.") ? "google" : k.startsWith("sk-") ? "openai" : null;
  if (!p) return say(false, k ? "המפתח לא נראה כמו מפתח של Gemini, ChatGPT או Claude" : "AI_API_KEY חסר ב-.env.local"), done();
  const name = { google: "Gemini", openai: "ChatGPT", anthropic: "Claude" }[p];
  const listReq = {
    google: [`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k)}`, {}],
    openai: ["https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${k}` } }],
    anthropic: ["https://api.anthropic.com/v1/models", { headers: { "x-api-key": k, "anthropic-version": "2023-06-01" } }],
  }[p];
  const list = await fetch(...listReq).catch(() => null);
  if (!list?.ok) return say(false, `הספק (${name}) דחה את המפתח${list ? ` (קוד ${list.status})` : ""}. בודקים שהועתק כולו.`), done();
  const model = cheapModel(p, await list.json().catch(() => ({})));
  const a = model ? await tryAnswer(p, k, model) : { ok: null };
  result.ai = a.ok === true;
  if (a.ok) say(true, `מפתח ${name} תקין, והוא עונה`);
  else if (a.billing) say(false, `המפתח של ${name} תקין, אבל אין בחשבון יתרה או אמצעי תשלום. מחברים תשלום לפי השלב "מוציאים מפתח לבינה המלאכותית", ומריצים שוב.`);
  else if (a.ok === false) say(false, `${name} דחה את המפתח. בודקים שהועתק כולו.`);
  else say(false, `לא הצלחתי לוודא שמפתח ${name} עונה${a.status ? ` (קוד ${a.status})` : " (בעיית רשת?)"}. מריצים שוב verify בעוד רגע.`);
  done();
}

/** לאיזה חשבון כל טוקן שייך. Claude מראה את זה למשתמש ושואל לפני שיוצרים משהו. */
async function accounts() {
  const e = envNow() || {};
  const id = await identity();
  if (!e.GITHUB_TOKEN) say(false, "GITHUB_TOKEN חסר ב-.env.local");
  else say(Boolean(id.github), id.github ? `GitHub: ${id.github}` : "GitHub לא מכיר את הטוקן. יוצרים חדש בקישור שבקובץ, ומעתיקים את כולו.");
  if (!e.VERCEL_TOKEN) say(null, id.vercelUser ? `אין VERCEL_TOKEN. במחשב מחובר Vercel של ${id.vercelUser}` : "אין VERCEL_TOKEN, ו-Vercel לא מחובר במחשב");
  else if (!id.vercelUser) say(false, "Vercel לא מכיר את הטוקן. יוצרים חדש בקישור שבקובץ.");
  else say(true, `Vercel: ${id.vercelUser}${id.teamName ? `, צוות: ${id.teamName} (${id.teamSlug})` : ""}`);
  const bot = readState("verified")?.bot;
  say(Boolean(bot), bot ? `הבוט בטלגרם: @${bot.username}` : "עוד לא נבדק הבוט בטלגרם. מריצים קודם verify.");
  const vercelName = id.teamSlug || id.vercelUser;
  if (id.github && vercelName && bot) console.log(`\nאחרי שהמשתמש אישר: node scripts/setup.mjs confirm ${id.github} ${vercelName} ${bot.username}`);
}

/** המשתמש אישר. השמות חייבים להתאים לטוקנים ברגע הזה, אחרת לא נשמר אישור. */
async function confirm() {
  const [github, vercelName, botName] = process.argv.slice(3);
  const id = await identity();
  const now = id.teamSlug || id.vercelUser;
  const bot = readState("verified")?.bot;
  if (!github || github !== id.github) return say(false, `GitHub שאושר (${github || "-"}) לא תואם לטוקן (${id.github || "-"})`);
  if (!vercelName || vercelName !== now) return say(false, `Vercel שאושר (${vercelName || "-"}) לא תואם לטוקן (${now || "-"})`);
  if (!bot || botName !== bot.username) return say(false, `הבוט שאושר (${botName || "-"}) לא תואם לטוקן של טלגרם (${bot?.username || "-"})`);
  writeState("confirmed", { github: id.github, vercelUser: id.vercelUser || null, teamId: id.teamId || null, teamSlug: id.teamSlug || null, botId: bot.id, at: new Date().toISOString() });
  say(true, `אושר: GitHub ${id.github}, Vercel ${vercelName}, הבוט @${bot.username}`);
}

/** הכתובת הקבועה של הבוט, כשהמשתמש העתיק אותה מ-Vercel: node scripts/setup.mjs url https://... */
function url() {
  const u = String(process.argv[3] || "").replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(u)) return say(false, "צריך כתובת מלאה, למשל https://telegram-assistant-2.vercel.app");
  writeFileSync(ENV_FILE, setEnvLine(readFileSync(ENV_FILE, "utf8"), "KIT_URL", u));
  say(true, `הכתובת נשמרה: ${u}`);
}

/**
 * יוצר את העותק הפרטי מהתבנית בחשבון שאושר, ומחבר אליו את התיקייה הזו.
 * הקבצים לא משתנים (אותה תבנית), ו-.env.local נשאר כי הוא ב-.gitignore.
 */
async function repo() {
  const t = envNow()?.GITHUB_TOKEN;
  if (!t) return say(false, "GITHUB_TOKEN חסר ב-.env.local");
  if (!(await confirmedFor("github"))) return;
  const me = await gh("/user", t);
  if (me.status !== 200) return say(false, "GitHub לא מכיר את הטוקן");
  const setIdentity = () => {
    // שינוי שהמשתמש יבקש בעתיד ייכתב בשם החשבון שלו. אחרת Vercel בתוכנית החינמית חוסם את ההעלאה.
    run("git", ["config", "user.name", me.data.login], { quiet: true });
    run("git", ["config", "user.email", `${me.data.id}+${me.data.login}@users.noreply.github.com`], { quiet: true });
  };

  // הרצה חוזרת: התיקייה כבר מחוברת לעותק של המשתמש, ולא יוצרים עוד אחד
  const origin = run("git", ["remote", "get-url", "origin"], { quiet: true }).out.trim();
  const current = /github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/.exec(origin);
  const auth = {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${t}`).toString("base64")}`,
  };
  /** מושך את העותק ומעביר אליו את התיקייה. GitHub בונה עותק חדש כמה שניות, אז מנסים כמה פעמים. */
  const pull = async () => {
    let fetched = false;
    for (let i = 0; i < 6 && !fetched; i++) {
      fetched = run("git", ["fetch", "origin"], { quiet: true, env: auth }).ok;
      if (!fetched) await new Promise((ok) => setTimeout(ok, 3000));
    }
    if (!fetched || !run("git", ["reset", "--hard", "origin/main"], { quiet: true }).ok) return false;
    run("git", ["branch", "--set-upstream-to=origin/main", "main"], { quiet: true });
    return true;
  };
  const dirty = () => Boolean(run("git", ["status", "--porcelain"], { quiet: true }).out.trim());

  if (current && current[1] !== "roshilabs-hq") {
    if (current[1].toLowerCase() !== me.data.login.toLowerCase()) return say(false, `התיקייה מחוברת לעותק של ${current[1]}, ולא של ${me.data.login}. עוצרים ושואלים את המשתמש.`);
    // הרצה חוזרת אחרי שהמשיכה נכשלה: העותק קיים, אבל התיקייה עוד לא עליו
    // התיקייה מסונכרנת אם היא כבר מבוססת על העותק (גם אם יש בה קומיט חדש שעוד לא נדחף, ואותו לא מוחקים)
    const based = run("git", ["merge-base", "--is-ancestor", "origin/main", "HEAD"], { quiet: true }).ok;
    if (!based) {
      if (dirty()) return say(false, "יש בתיקייה שינויים שלא נשמרו, והיא עוד לא מסונכרנת עם העותק. עוצרים ושואלים את המשתמש.");
      if (!(await pull())) return say(false, "העותק קיים, אבל לא הצלחתי למשוך אותו. מריצים שוב repo בעוד רגע.");
    }
    setIdentity();
    return say(true, `כבר יש לך עותק: https://github.com/${current[1]}/${current[2]} (פרטי)`);
  }
  // הקבצים עומדים להתחלף בקבצים של העותק החדש. שינוי מקומי היה נמחק, אז עוצרים.
  if (dirty()) return say(false, "יש בתיקייה שינויים שלא נשמרו. עוצרים ושואלים את המשתמש לפני שיוצרים את העותק.");

  let made;
  for (let i = 1; i <= 9 && !made; i++) {
    const name = i === 1 ? "telegram-assistant" : `telegram-assistant-${i}`;
    const r = await gh("/repos/roshilabs-hq/telegram-assistant/generate", t, {
      method: "POST",
      body: JSON.stringify({ owner: me.data.login, name, private: true, description: "העוזר האישי שלי בטלגרם" }),
    });
    if (r.status === 201) made = r.data;
    else if (r.status !== 422) return say(false, `GitHub סירב ליצור את העותק (קוד ${r.status}). הטוקן צריך הרשאות repo ו-workflow.`);
  }
  if (!made) return say(false, "כל השמות telegram-assistant עד telegram-assistant-9 תפוסים בחשבון");
  // הטוקן עובר בסביבת הפקודה בלבד (auth): לא בשורת הפקודה, ולא נשמר ב-.git/config
  run("git", ["remote", "set-url", "origin", made.clone_url], { quiet: true });
  if (!(await pull())) return say(false, `העותק נוצר (${made.html_url}), אבל לא הצלחתי למשוך אותו. מריצים שוב repo: הוא ימשיך מכאן ולא ייצור עותק נוסף.`);
  setIdentity();
  say(true, `העותק שלך: ${made.html_url} (פרטי)`);
}

/** עם VERCEL_TOKEN שואלים את Vercel ישירות מה הכתובות של הפרויקט. זה הכי אמין. */
async function projectDomain() {
  const t = envNow()?.VERCEL_TOKEN;
  const link = linkedProject();
  if (!t || !link) return null;
  const d = await vapi(`/v9/projects/${link.id}/domains?teamId=${link.orgId}`, t);
  const names = (d?.domains || []).map((x) => x.name).filter((n) => n.endsWith(".vercel.app"));
  return names.length ? `https://${names.sort((a, b) => a.length - b.length)[0]}` : null;
}

/**
 * מכל כתובות ה-vercel.app בפלט, הקבועה היא הקצרה ביותר: לכתובת של העלאה בודדת
 * Vercel מוסיף קוד ושם חשבון (project-abc123-team.vercel.app).
 */
export function productionUrl(output) {
  const alias = /Aliased:\s*(https:\/\/\S+)/.exec(output)?.[1];
  if (alias) return alias.replace(/\/+$/, "");
  const all = [...new Set(String(output).match(/https:\/\/[a-z0-9-]+\.vercel\.app/g) || [])];
  return all.sort((a, b) => a.length - b.length)[0] || null;
}

/**
 * פרויקט שמחובר לתיקייה מתאים לה רק אם הוא בצוות שאושר, נקרא כמו העותק (או עם סיומת),
 * ומחובר לאותו עותק ב-GitHub (אם הוא כבר מחובר לאחד). בלי שם ידוע, לא מתאים.
 */
export function sameProject(existing, base, teamId, repo = null) {
  if (!existing) return true;
  if (teamId && existing.orgId !== teamId) return false;
  if (!existing.name || !new RegExp(`^${base}(-\\d+)?$`).test(existing.name)) return false;
  return !existing.repo || !repo || existing.repo.toLowerCase() === repo.toLowerCase();
}

/** הפרטים של הפרויקט המחובר, מ-Vercel עצמו: השם, והעותק ב-GitHub שהוא מחובר אליו. */
async function linkedProjectDetails() {
  const link = linkedProject();
  const t = envNow()?.VERCEL_TOKEN;
  if (!link || !t) return link;
  const p = await vapi(`/v9/projects/${link.id}?teamId=${link.orgId}`, t);
  if (!p) return { ...link, name: null };
  return { ...link, name: p.name, repo: p.link?.org && p.link?.repo ? `${p.link.org}/${p.link.repo}` : null };
}

/** מה יש בפרויקט מפרטי החיבור ל-Supabase: הכול, כלום, או רק חלק (ואז לא מנחשים). */
export function dbState(envNames) {
  const has = (re) => re.test(envNames);
  const parts = [has(/\bSUPABASE_URL\b|NEXT_PUBLIC_SUPABASE_URL/), has(/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/), has(/POSTGRES_URL/)];
  return parts.every(Boolean) ? "full" : parts.some(Boolean) ? "partial" : "none";
}

async function deploy() {
  const e = envNow() || {};
  const missing = REQUIRED.filter((k) => !e[k]);
  if (missing.length) return say(false, `חסר ב-.env.local: ${missing.join(", ")}`);
  if (!vercel(["whoami"], { quiet: true }).ok) return say(false, "Vercel לא מחובר: מריצים node scripts/setup.mjs login");
  if (!(await confirmedFor("vercel"))) return;
  // Vercel CLI "מושך" את משתני הפרויקט לתוך .env.local אחרי link ואחרי חיבור מסד, ודורס את הטוקנים.
  // שומרים את הקובץ ומחזירים אותו אחרי כל שלב כזה. את משתני המסד הבוט קורא מ-Vercel, לא מהמחשב.
  const saved = readFileSync(ENV_FILE, "utf8");
  const keepEnv = () => { if (readFileSync(ENV_FILE, "utf8") !== saved) writeFileSync(ENV_FILE, saved); };

  const origin = run("git", ["remote", "get-url", "origin"], { quiet: true }).out.trim();
  const base = (/\/([^/]+?)(?:\.git)?$/.exec(origin)?.[1] || basename(ROOT)).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90);
  // הרצה חוזרת: ממשיכים עם הפרויקט שמחובר לתיקייה רק אם הוא שלה. תיקייה שהועתקה מבוט אחר
  // מחוברת לפרויקט שלו, וההגדרות שלו היו נדרסות.
  const existing = await linkedProjectDetails();
  const repoName = /github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(origin)?.[1] || null;
  if (!sameProject(existing, base, readState("confirmed")?.teamId, repoName)) return say(false, `התיקייה מחוברת לפרויקט אחר ב-Vercel (${existing.name || existing.id}), או שאי אפשר לוודא שהוא שלה. עוצרים ושואלים את המשתמש.`);
  // בלי אישור מוצלח של מפתח ה-AI לא מעלים: בוט בלי מוח רק ייראה תקין
  const ai = readState("verified");
  if (!ai?.ai) return say(false, ai ? "מפתח ה-AI לא עבר את הבדיקה. מתקנים, ומריצים שוב verify." : "עוד לא נבדק מפתח ה-AI. מריצים קודם verify.");
  let project = existing ? existing.name || "הפרויקט הקיים" : null;
  if (!project) {
    // השם לפי העותק ב-GitHub. project add נכשל כשהשם תפוס, ואז מנסים את הבא, כך שלעולם לא נוגעים בפרויקט קיים.
    for (let i = 1; i <= 9 && !project; i++) {
      const name = i === 1 ? base : `${base}-${i}`;
      if (vercel(["project", "add", name], { quiet: true }).ok) project = name;
    }
    if (!project) return say(false, `לא הצלחתי ליצור פרויקט חדש ב-Vercel (כל השמות ${base} עד ${base}-9 תפוסים?)`);
    const linked = vercel(["link", "--yes", "--project", project]).ok;
    keepEnv();
    if (!linked) return say(false, "הפרויקט נוצר, אבל לא הצלחתי לחבר אליו את התיקייה");
  }
  say(true, `פרויקט ב-Vercel: ${project}`);

  // החיבור ל-GitHub הוא מה שמעלה לבד כל עדכון שמאשרים (תוספת "עדכונים אוטומטיים")
  const git = vercel(["git", "connect", "--yes"], { quiet: true });
  const gitOk = git.ok || /already connected/i.test(git.out);
  say(gitOk, gitOk ? "Vercel מחובר ל-GitHub" : "Vercel לא התחבר לעותק ב-GitHub. הבוט יעלה, אבל עדכונים שמאשרים לא יעלו לבד. מתקנים ב-Vercel ‹ Settings ‹ Git ‹ Connect.");

  const db = dbState(vercel(["env", "ls", "production"], { quiet: true }).out);
  if (db === "partial") return say(false, "יש בפרויקט רק חלק מפרטי החיבור ל-Supabase. לא מחברים מסד נוסף אוטומטית: עוצרים ושואלים את המשתמש.");
  if (db === "none") {
    const add = vercel(["integration", "add", "supabase", "-m", "region=fra1", "--name", `${project}-db`, "--no-env-pull"]);
    keepEnv();
    if (!add.ok) return say(false, "חיבור Supabase לא הושלם. אם נפתח דפדפן, מאשרים שם ומריצים שוב את השלב הזה.");
  }
  say(true, "מסד נתונים (Supabase) מחובר");

  for (const k of REQUIRED) {
    const r = vercel(["env", "add", k, "production", "--force", "--yes"], { input: e[k], quiet: true });
    say(r.ok, `${k} הועבר ל-Vercel`);
    if (!r.ok) return;
  }

  const d = vercel(["deploy", "--prod", "--yes"], { quiet: true });
  if (!d.ok) return say(false, `העלאה נכשלה:\n${d.out.trim().split("\n").slice(-6).join("\n")}`);
  // הכתובת הקבועה של הפרויקט, ולא הכתובת של ההעלאה הזו: Vercel נועל כתובות של העלאה בודדת מאחורי התחברות
  // בלי VERCEL_TOKEN לא מנחשים: רק כתובת ש-Vercel כתב במפורש שהיא הקבועה (Aliased)
  const url = (await projectDomain()) || /Aliased:\s*(https:\/\/\S+)/.exec(d.out)?.[1];
  if (!url) return say(false, "הבוט עלה, אבל לא אימתתי את הכתובת הקבועה שלו. מבקשים מהמשתמש את הכתובת שמופיעה ב-Vercel תחת Domains, וכותבים אותה ל-KIT_URL.");
  writeFileSync(ENV_FILE, setEnvLine(readFileSync(ENV_FILE, "utf8"), "KIT_URL", url.replace(/\/+$/, "")));
  say(true, `הבוט באוויר: ${url}`);
}

/** קריאה לעמוד ההקמה של הבוט. כל תשובה שאינה 2xx היא שגיאה, עם הסבר. */
async function setupApi(body) {
  const e = envNow() || {};
  if (!e.KIT_URL) return { errors: ["אין עדיין KIT_URL. מריצים קודם את deploy."] };
  const headers = { "x-setup-password": e.SETUP_PASSWORD, "content-type": "application/json" };
  const url = `${e.KIT_URL.replace(/\/+$/, "")}/api/setup?format=json`;
  const r = await fetch(url, body ? { method: "POST", headers, body: JSON.stringify(body) } : { headers }).catch((x) => ({ failed: x }));
  if (r.failed) return { errors: [`לא הצלחתי להגיע לבוט: ${r.failed.message}`] };
  if (r.status === 401) return { errors: ["עמוד ההקמה דחה את הסיסמה: SETUP_PASSWORD ב-.env.local שונה מזו שב-Vercel"] };
  if (r.status === 429) return { errors: ["יותר מדי ניסיונות כניסה. מחכים דקה ומנסים שוב."] };
  if (!r.ok) return { errors: [`עמוד ההקמה החזיר שגיאה (קוד ${r.status})`] };
  return r.json().catch(() => ({ errors: ["עמוד ההקמה החזיר תשובה לא תקינה"] }));
}

async function activate() {
  // לפני שמחברים את הבוט לשרת הזה: שזה הבוט שאושר, ושהוא לא מחובר כבר לשרת אחר.
  // בוט קיים של המשתמש היה מפסיק לעבוד בשקט (ככה נדרס לנו פעם בוט, כשהודבק טוקן של בוט ישן).
  const e = envNow() || {};
  const c = readState("confirmed");
  const me = await fetch(`https://api.telegram.org/bot${e.TELEGRAM_TOKEN}/getMe`).then((x) => x.json()).catch(() => null);
  if (c?.botId && me?.result?.id !== c.botId) return say(false, "הטוקן של טלגרם הוחלף אחרי האישור. מריצים שוב verify ו-accounts, ומאשרים מחדש.");
  const hook = await fetch(`https://api.telegram.org/bot${e.TELEGRAM_TOKEN}/getWebhookInfo`).then((x) => x.json()).catch(() => null);
  const mine = e.KIT_URL ? `${e.KIT_URL.replace(/\/+$/, "")}/api/telegram` : null;
  if (hook?.result?.url && hook.result.url !== mine && !process.argv.includes("--take-over")) {
    return say(false, `הבוט @${me?.result?.username} כבר מחובר לשרת אחר (${new URL(hook.result.url).host}). אם זה בוט קיים, עוצרים: יוצרים בוט חדש ב-BotFather. רק אם המשתמש אישר שזה הבוט הנכון: activate --take-over`);
  }
  const a = await setupApi({ action: "activate" });
  for (const err of a.errors || []) say(false, err);
  // התזמון נבדק לפי ריצה אמיתית, והוא רץ פעם בדקה. אז בדקה הראשונה הוא אדום, וזה תקין: מחכים לו.
  let s = await setupApi();
  for (let i = 0; i < 6 && !a.errors?.length && s?.steps?.some((x) => x.kind !== "addon" && x.id === "activate" && !x.ok); i++) {
    if (i === 0) console.log("⏳ מחכה שהתזכורות ירוצו פעם ראשונה (עד דקה וחצי)...");
    await new Promise((ok) => setTimeout(ok, 15000));
    s = await setupApi();
  }
  if (!s?.steps) return (s?.errors || ["לא הצלחתי לקרוא את עמוד ההקמה"]).forEach((x) => say(false, x));
  for (const step of s.steps.filter((x) => x.kind !== "addon")) say(step.ok, step.title);
  if (s.pair_link) console.log(`\nקישור החיבור (פותחים בטלפון ולוחצים Start):\n${s.pair_link}`);
}

/** התחברות ל-Vercel. נפתח דפדפן, ומאשרים שם. גם היא צריכה את העקיפה לשם מחשב בעברית. */
function login() {
  const r = spawnSync(hasVercelNow() ? "vercel login" : `npx --yes ${VERCEL} login`, { cwd: ROOT, shell: true, stdio: "inherit", env: { ...process.env, NODE_OPTIONS: PRELOAD } });
  say(r.status === 0, r.status === 0 ? "מחובר ל-Vercel" : "ההתחברות לא הושלמה. מריצים שוב, ומאשרים בדפדפן שנפתח.");
}

// ---------- תוספות ----------

/** עדכונים אוטומטיים: ההגדרה ב-GitHub (ש-Actions יוכל לפתוח בקשת עדכון), ובדיקה ש-Vercel מחובר לעותק. */
async function updates() {
  const t = envNow()?.GITHUB_TOKEN;
  if (!t) return say(false, "GITHUB_TOKEN חסר ב-.env.local. בלעדיו מפעילים בעמוד: addons/05-updates.md");
  const origin = run("git", ["remote", "get-url", "origin"], { quiet: true }).out.trim();
  const repoName = /github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(origin)?.[1];
  if (!repoName) return say(false, "לא מצאתי את העותק ב-GitHub");
  const r = await gh(`/repos/${repoName}/actions/permissions/workflow`, t, {
    method: "PUT",
    body: JSON.stringify({ default_workflow_permissions: "write", can_approve_pull_request_reviews: true }),
  });
  if (r.status !== 204) return say(false, `GitHub סירב (קוד ${r.status})`);
  const vt = envNow()?.VERCEL_TOKEN;
  const link = linkedProject();
  const p = vt && link ? await vapi(`/v9/projects/${link.id}?teamId=${link.orgId}`, vt) : null;
  if (p && !p.link) return say(false, "ב-GitHub זה מוכן, אבל Vercel לא מחובר לעותק, ולכן עדכון שמאשרים לא יעלה לבד. מתקנים ב-Vercel ‹ Settings ‹ Git ‹ Connect.");
  say(true, "עדכונים אוטומטיים פועלים: פעם בשבוע תגיע בקשת עדכון, ומאשרים בלחיצה");
}

/** תדריך בוקר: node scripts/setup.mjs briefing 07:30 (ובלי שעה: מכבה). */
async function briefing() {
  const time = process.argv[3] || "";
  const r = await setupApi({ action: "save_settings", briefing_time: time });
  if (r.errors?.length) return r.errors.forEach((x) => say(false, x));
  say(true, time ? `תדריך בוקר כל יום ב-${time}` : "תדריך הבוקר כבוי");
}

/** הודעות קוליות: GROQ_API_KEY מ-.env.local עובר ל-Vercel, והבוט עולה מחדש. */
async function voice() {
  const k = envNow()?.GROQ_API_KEY;
  if (!k) return say(false, "GROQ_API_KEY חסר ב-.env.local (הקישור ליצירה נמצא בקובץ)");
  const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { authorization: `Bearer ${k}` } }).catch(() => null);
  if (!r?.ok) return say(false, `Groq דחה את המפתח${r ? ` (קוד ${r.status})` : ""}. מעתיקים אותו שוב, כולו.`);
  say(true, "מפתח Groq תקין");
  if (!vercel(["env", "add", "GROQ_API_KEY", "production", "--force", "--yes"], { input: k, quiet: true }).ok) return say(false, "לא הצלחתי להעביר את המפתח ל-Vercel");
  say(true, "GROQ_API_KEY הועבר ל-Vercel");
  // בונים מחדש את הגרסה שכבר באוויר, ולא מעלים מהמחשב: העלאה מהמחשב מיוחסת לזהות ה-Git המקומית,
  // ו-Vercel בתוכנית החינמית חוסם העלאה של מי שאינו בעל החשבון.
  console.log("⏳ הבוט עולה מחדש עם המפתח החדש. זה לוקח דקה עד שלוש...");
  const d = await redeployProduction();
  say(d.ok, d.ok ? "הבוט עלה מחדש עם הודעות קוליות. שולחים לו הודעה קולית כדי לבדוק" : `${d.error}. אפשר גם בלחיצה: Vercel ‹ הפרויקט ‹ Deployments ‹ ⋯ ‹ Redeploy`);
}

/**
 * בונה מחדש את הגרסה שבאוויר, דרך ה-API של Vercel ולא דרך ה-CLI:
 * ה-CLI מחפש את ההעלאה בצוות שמוגדר במחשב, ולא בצוות של הפרויקט, גם עם --scope.
 * ה-API מקבל את הצוות במפורש, ולא תלוי במה שמוגדר במחשב.
 */
async function redeployProduction() {
  const t = envNow()?.VERCEL_TOKEN;
  const link = linkedProject();
  if (!t || !link) return { ok: false, error: "חסר VERCEL_TOKEN או חיבור לפרויקט" };
  const api = (path, init = {}) =>
    fetch(`https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${link.orgId}`, {
      ...init,
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
    }).then((r) => r.json()).catch(() => ({}));
  const live = (await api(`/v6/deployments?projectId=${link.id}&target=production&state=READY&limit=1`)).deployments?.[0];
  if (!live) return { ok: false, error: "לא מצאתי גרסה פעילה של הבוט" };
  const created = await api("/v13/deployments?forceNew=1", {
    method: "POST",
    body: JSON.stringify({ name: live.name, deploymentId: live.uid, target: "production" }),
  });
  if (!created.id) return { ok: false, error: `Vercel סירב לבנות מחדש${created.error?.message ? `: ${created.error.message}` : ""}` };
  for (let i = 0; i < 48; i++) {
    await new Promise((ok) => setTimeout(ok, 5000));
    const s = (await api(`/v13/deployments/${created.id}`)).readyState;
    if (s === "READY") return { ok: true };
    if (s === "ERROR" || s === "CANCELED") return { ok: false, error: "הבנייה מחדש נכשלה ב-Vercel" };
  }
  return { ok: false, error: "הבנייה מחדש לוקחת יותר מ-4 דקות" };
}

const STEPS = { preflight, login, env, verify, accounts, confirm, repo, deploy, url, activate, updates, briefing, voice };
const step = process.argv[2];
// רץ ישירות (ולא נטען מבדיקה)
if (basename(process.argv[1] || "") === "setup.mjs") {
  if (!STEPS[step]) {
    console.log(`שימוש: node scripts/setup.mjs <${Object.keys(STEPS).join("|")}>`);
    process.exitCode = 1;
  } else await STEPS[step]();
}

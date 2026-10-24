#!/usr/bin/env node
/**
 * הקמה במסלול Claude Code: כל מה שאפשר לעשות מתוך המחשב, בלי לפתוח אתרים.
 * Claude מריץ את השלבים לפי הסדר (.claude/commands/start.md), ובאתרים המשתמש לוחץ בעצמו.
 *
 *   node scripts/setup.mjs preflight   מה מותקן, ומה צריך לפני שמתחילים
 *   node scripts/setup.mjs login       התחברות ל-Vercel (נפתח דפדפן)
 *   node scripts/setup.mjs env         יוצר את .env.local ומייצר סיסמת הקמה
 *   node scripts/setup.mjs accounts    לאיזה חשבון GitHub ו-Vercel שייך כל טוקן
 *   node scripts/setup.mjs repo        יוצר את העותק הפרטי מהתבנית בחשבון של GITHUB_TOKEN
 *   node scripts/setup.mjs verify      בודק את הטוקן ואת מפתח ה-AI מול טלגרם והספק
 *   node scripts/setup.mjs deploy      יוצר פרויקט ב-Vercel, מחבר Supabase ו-GitHub, ומעלה
 *   node scripts/setup.mjs activate    "הפעילו הכול" מרחוק, ומחזיר את קישור החיבור
 *
 * לעולם לא מדפיס ערך של סוד. הסודות עוברים מ-.env.local ל-Vercel דרך stdin.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
# GitHub: נכנסים לקישור, בוחרים Expiration של 30 יום, לוחצים Generate token ומעתיקים (מתחיל ב-ghp_)
# https://github.com/settings/tokens/new?scopes=repo,workflow&description=telegram-assistant-setup
GITHUB_TOKEN=
# Vercel: נכנסים לקישור, Create Token, נותנים שם, Expiration של 30 יום, Create ומעתיקים
# https://vercel.com/account/settings/tokens
VERCEL_TOKEN=

# --- הבוט ---
# הטוקן מ-BotFather, נראה כמו 123456789:AAH...
TELEGRAM_TOKEN=

# מפתח ה-AI מהספק (Gemini, ChatGPT או Claude)
AI_API_KEY=

# סיסמת עמוד ההקמה. Claude כבר יצר אותה, לא צריך לגעת.
SETUP_PASSWORD=
`;

const envNow = () => (existsSync(ENV_FILE) ? readEnv(readFileSync(ENV_FILE, "utf8")) : null);

// NODE_OPTIONS מוחק לוכסנים הפוכים, ולכן הנתיב נכתב עם /
const PRELOAD = `--require "${join(ROOT, "scripts", "ascii-hostname.cjs").replace(/\\/g, "/")}"`;

function run(cmd, args, { input, quiet = false } = {}) {
  // ב-Windows הפקודות הן קובצי .cmd, שרצים רק דרך shell. כל הארגומנטים כאן שלנו, לא של המשתמש.
  const line = [cmd, ...args.map((a) => (/^[\w@.:=/-]+$/.test(a) ? a : JSON.stringify(a)))].join(" ");
  const r = spawnSync(line, {
    cwd: ROOT,
    input,
    encoding: "utf8",
    shell: true,
    stdio: [input === undefined ? "inherit" : "pipe", "pipe", "pipe"],
    env: { ...process.env, NODE_OPTIONS: PRELOAD },
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`.replace(/<claude-code-hint[^>]*>\s*/g, "");
  if (!quiet && r.status !== 0) console.log(out.trim().split("\n").slice(-6).join("\n"));
  return { ok: r.status === 0, out };
}

// Vercel CLI שכבר מותקן חוסך הורדה. אם אין, npx מוריד גרסה קבועה.
let hasVercel;
// עם VERCEL_TOKEN כל פקודה הולכת לחשבון של הטוקן, ולא לחשבון שבמקרה מחובר במחשב
const vercel = (args, opts) => {
  const t = envNow()?.VERCEL_TOKEN;
  const all = t ? [...args, "--token", t] : args;
  return hasVercelNow() ? run("vercel", all, opts) : run("npx", ["--yes", VERCEL, ...all], opts);
};

const gh = async (path, token, init = {}) => {
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", ...init.headers },
  }).catch(() => null);
  return { status: r?.status || 0, data: r ? await r.json().catch(() => ({})) : {} };
};
const vercelUser = async (token) => {
  const r = await fetch("https://api.vercel.com/v2/user", { headers: { authorization: `Bearer ${token}` } }).catch(() => null);
  return r?.ok ? (await r.json()).user?.username : null;
};

// ---------- השלבים ----------

function preflight() {
  const [major] = process.versions.node.split(".").map(Number);
  say(major >= 20, `Node.js ${process.versions.node}${major >= 20 ? "" : " (צריך 20 ומעלה)"}`);
  say(run("git", ["--version"], { quiet: true }).ok, "Git");
  const gh = run("gh", ["auth", "status"], { quiet: true });
  if (gh.ok) say(true, "GitHub CLI מחובר (אפשר ליצור את העותק בפקודה)");
  else say(null, /not logged|auth login/i.test(gh.out) ? "GitHub CLI מותקן אבל לא מחובר: מריצים gh auth login --web" : "אין GitHub CLI: את העותק יוצרים בלחיצה אחת ב-GitHub");
  if (/[^\x20-\x7E]/.test(hostname())) say(null, "שם המחשב בעברית. Vercel CLI נשבר מזה, ואנחנו עוקפים את זה אוטומטית.");
  if (envNow()?.VERCEL_TOKEN) return;
  // החשבון שמחובר במחשב הוא רק גיבוי. בדרך הרגילה החשבון נקבע לפי הטוקן בשלב הבא.
  const who = vercel(["whoami"], { quiet: true });
  say(null, who.ok ? `Vercel מחובר במחשב לחשבון ${who.out.trim().split("\n").pop()}. נשתמש בו רק אם תאשר.` : "Vercel: נחבר עם טוקן בשלב הבא");
}

function env() {
  let text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : TEMPLATE;
  if (!(readEnv(text).SETUP_PASSWORD || "").length) text = setEnvLine(text, "SETUP_PASSWORD", randomBytes(18).toString("base64url"));
  writeFileSync(ENV_FILE, text);
  const e = readEnv(text);
  for (const k of REQUIRED) say(Boolean(e[k]), `${k}: ${e[k] ? "יש" : "חסר"}`);
}

async function verify() {
  const e = envNow() || {};
  const t = e.TELEGRAM_TOKEN || "";
  if (!t) say(false, "TELEGRAM_TOKEN חסר ב-.env.local");
  else {
    const r = await fetch(`https://api.telegram.org/bot${t}/getMe`).then((x) => x.json()).catch(() => null);
    say(Boolean(r?.ok), r?.ok ? `הטוקן תקין: הבוט @${r.result.username}` : "טלגרם לא מכיר את הטוקן. מעתיקים אותו שוב מ-BotFather, רק את הקוד עצמו.");
  }
  const k = e.AI_API_KEY || "";
  const p = k.startsWith("sk-ant-") ? "anthropic" : k.startsWith("AIza") || k.startsWith("AQ.") ? "google" : k.startsWith("sk-") ? "openai" : null;
  if (!p) return say(false, k ? "המפתח לא נראה כמו מפתח של Gemini, ChatGPT או Claude" : "AI_API_KEY חסר ב-.env.local");
  const req = {
    google: [`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k)}`, {}],
    openai: ["https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${k}` } }],
    anthropic: ["https://api.anthropic.com/v1/models", { headers: { "x-api-key": k, "anthropic-version": "2023-06-01" } }],
  }[p];
  const r = await fetch(...req).catch(() => null);
  const name = { google: "Gemini", openai: "ChatGPT", anthropic: "Claude" }[p];
  say(r?.ok, r?.ok ? `מפתח ${name} תקין` : `הספק (${name}) דחה את המפתח${r ? ` (קוד ${r.status})` : ""}. בודקים שהועתק כולו, ושיש אמצעי תשלום בחשבון.`);
}

/** לאיזה חשבון כל טוקן שייך. Claude מראה את זה למשתמש ושואל לפני שיוצרים משהו. */
async function accounts() {
  const e = envNow() || {};
  if (!e.GITHUB_TOKEN) say(false, "GITHUB_TOKEN חסר ב-.env.local");
  else {
    const u = await gh("/user", e.GITHUB_TOKEN);
    say(u.status === 200, u.status === 200 ? `GitHub: ${u.data.login}` : "GitHub לא מכיר את הטוקן. יוצרים חדש בקישור שבקובץ, ומעתיקים את כולו.");
  }
  if (!e.VERCEL_TOKEN) say(null, "אין VERCEL_TOKEN: נעבוד עם החשבון שמחובר במחשב (אחרי אישור)");
  else {
    const name = await vercelUser(e.VERCEL_TOKEN);
    say(Boolean(name), name ? `Vercel: ${name}` : "Vercel לא מכיר את הטוקן. יוצרים חדש בקישור שבקובץ.");
  }
}

/**
 * יוצר את העותק הפרטי מהתבנית בחשבון של GITHUB_TOKEN, ומעביר את התיקייה הזו אליו.
 * הקבצים לא משתנים (אותה תבנית), ו-.env.local נשאר כי הוא ב-.gitignore.
 */
async function repo() {
  const t = envNow()?.GITHUB_TOKEN;
  if (!t) return say(false, "GITHUB_TOKEN חסר ב-.env.local");
  const me = await gh("/user", t);
  if (me.status !== 200) return say(false, "GitHub לא מכיר את הטוקן");
  let name, made;
  for (let i = 1; i <= 9 && !made; i++) {
    name = i === 1 ? "telegram-assistant" : `telegram-assistant-${i}`;
    const r = await gh("/repos/roshilabs-hq/telegram-assistant/generate", t, {
      method: "POST",
      body: JSON.stringify({ owner: me.data.login, name, private: true, description: "העוזר האישי שלי בטלגרם" }),
    });
    if (r.status === 201) made = r.data;
    else if (r.status !== 422) return say(false, `GitHub סירב ליצור את העותק (קוד ${r.status}). הטוקן צריך הרשאות repo ו-workflow.`);
  }
  if (!made) return say(false, "כל השמות telegram-assistant עד telegram-assistant-9 תפוסים בחשבון");
  // הטוקן עובר בכותרת של הפקודה הזו בלבד, ולא נשמר ב-.git/config
  const auth = `http.https://github.com/.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${t}`).toString("base64")}`;
  run("git", ["remote", "set-url", "origin", made.clone_url], { quiet: true });
  let fetched = false;
  for (let i = 0; i < 6 && !fetched; i++) {
    fetched = run("git", ["-c", auth, "fetch", "origin"], { quiet: true }).ok;
    if (!fetched) await new Promise((ok) => setTimeout(ok, 3000)); // GitHub בונה את העותק כמה שניות
  }
  if (!fetched || !run("git", ["reset", "--hard", "origin/main"], { quiet: true }).ok) return say(false, `העותק נוצר (${made.html_url}), אבל לא הצלחתי למשוך אותו`);
  run("git", ["branch", "--set-upstream-to=origin/main", "main"], { quiet: true });
  say(true, `העותק שלך: ${made.html_url} (פרטי)`);
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

function deploy() {
  const e = envNow() || {};
  const missing = REQUIRED.filter((k) => !e[k]);
  if (missing.length) return say(false, `חסר ב-.env.local: ${missing.join(", ")}`);
  if (!vercel(["whoami"], { quiet: true }).ok) return say(false, "Vercel לא מחובר: מריצים npx vercel login ומאשרים בדפדפן");

  // הרצה חוזרת: הפרויקט שהסקריפט כבר יצר רשום ב-.vercel/project.json, וממשיכים איתו
  const linkFile = join(ROOT, ".vercel", "project.json");
  let project = existsSync(linkFile) ? JSON.parse(readFileSync(linkFile, "utf8")).projectName || "הפרויקט הקיים" : null;
  if (!project) {
    // השם לפי העותק ב-GitHub. לעולם לא מתחברים לפרויקט קיים: הוא יכול להיות בוט אחר
    // של המשתמש, וההגדרות שלו היו נדרסות. project add נכשל כשהשם תפוס, ואז מנסים את הבא.
    const origin = run("git", ["remote", "get-url", "origin"], { quiet: true }).out.trim();
    const base = (/\/([^/]+?)(?:\.git)?$/.exec(origin)?.[1] || basename(ROOT)).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90);
    for (let i = 1; i <= 9 && !project; i++) {
      const name = i === 1 ? base : `${base}-${i}`;
      if (vercel(["project", "add", name], { quiet: true }).ok) project = name;
    }
    if (!project) return say(false, `לא הצלחתי ליצור פרויקט חדש ב-Vercel (כל השמות ${base} עד ${base}-9 תפוסים?)`);
    if (!vercel(["link", "--yes", "--project", project]).ok) return say(false, "הפרויקט נוצר, אבל לא הצלחתי לחבר אליו את התיקייה");
  }
  say(true, `פרויקט ב-Vercel: ${project}`);

  // החיבור ל-GitHub הוא מה שמעלה לבד כל עדכון שמאשרים (תוספת "עדכונים אוטומטיים")
  const git = vercel(["git", "connect", "--yes"], { quiet: true });
  say(git.ok || /already connected/i.test(git.out) ? true : null, git.ok || /already connected/i.test(git.out) ? "Vercel מחובר ל-GitHub" : "החיבור ל-GitHub לא הצליח. אפשר בהמשך: Vercel ‹ Settings ‹ Git");

  const names = vercel(["env", "ls", "production"], { quiet: true }).out;
  if (!/POSTGRES_URL|SUPABASE_URL/.test(names)) {
    const db = vercel(["integration", "add", "supabase", "-m", "region=fra1", "--name", `${project}-db`]);
    if (!db.ok) return say(false, "חיבור Supabase לא הושלם. אם נפתח דפדפן, מאשרים שם ומריצים שוב את השלב הזה.");
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
  const url = productionUrl(d.out);
  if (!url) return say(false, "הבוט עלה, אבל לא מצאתי את הכתובת הקבועה שלו. היא מופיעה ב-Vercel תחת Domains.");
  writeFileSync(ENV_FILE, setEnvLine(readFileSync(ENV_FILE, "utf8"), "KIT_URL", url.replace(/\/+$/, "")));
  say(true, `הבוט באוויר: ${url}`);
}

async function activate() {
  const e = envNow() || {};
  if (!e.KIT_URL) return say(false, "אין עדיין KIT_URL. מריצים קודם את deploy.");
  const base = e.KIT_URL.replace(/\/+$/, "");
  const headers = { "x-setup-password": e.SETUP_PASSWORD, "content-type": "application/json" };
  const a = await fetch(`${base}/api/setup?format=json`, { method: "POST", headers, body: JSON.stringify({ action: "activate" }) })
    .then((r) => r.json()).catch((x) => ({ errors: [x.message] }));
  for (const err of a.errors || []) say(false, err);
  const s = await fetch(`${base}/api/setup?format=json`, { headers }).then((r) => r.json()).catch(() => null);
  if (!s?.steps) return say(false, "לא הצלחתי לקרוא את עמוד ההקמה");
  for (const step of s.steps.filter((x) => x.kind !== "addon")) say(step.ok, step.title);
  if (s.pair_link) console.log(`\nקישור החיבור (פותחים בטלפון ולוחצים Start):\n${s.pair_link}`);
}

/** התחברות ל-Vercel. נפתח דפדפן, ומאשרים שם. גם היא צריכה את העקיפה לשם מחשב בעברית. */
function login() {
  const r = spawnSync(hasVercelNow() ? "vercel login" : `npx --yes ${VERCEL} login`, { cwd: ROOT, shell: true, stdio: "inherit", env: { ...process.env, NODE_OPTIONS: PRELOAD } });
  say(r.status === 0, r.status === 0 ? "מחובר ל-Vercel" : "ההתחברות לא הושלמה. מריצים שוב, ומאשרים בדפדפן שנפתח.");
}
const hasVercelNow = () => (hasVercel ??= run("vercel", ["--version"], { quiet: true }).ok);

const STEPS = { preflight, login, env, accounts, repo, verify, deploy, activate };
const step = process.argv[2];
// רץ ישירות (ולא נטען מבדיקה)
if (basename(process.argv[1] || "") === "setup.mjs") {
  if (!STEPS[step]) {
    console.log(`שימוש: node scripts/setup.mjs <${Object.keys(STEPS).join("|")}>`);
    process.exitCode = 1;
  } else await STEPS[step]();
}

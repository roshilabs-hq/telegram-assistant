#!/usr/bin/env node
/**
 * הקמה במסלול Claude Code: כל מה שאפשר לעשות מתוך המחשב, בלי לפתוח אתרים.
 * Claude מריץ את השלבים לפי הסדר (.claude/commands/start.md), ובאתרים המשתמש לוחץ בעצמו.
 *
 *   node scripts/setup.mjs preflight   מה מותקן, ומה צריך לפני שמתחילים
 *   node scripts/setup.mjs login       התחברות ל-Vercel (נפתח דפדפן)
 *   node scripts/setup.mjs env         יוצר את .env.local ומייצר סיסמת הקמה
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
const vercel = (args, opts) => (hasVercelNow() ? run("vercel", args, opts) : run("npx", ["--yes", VERCEL, ...args], opts));

// ---------- השלבים ----------

function preflight() {
  const [major] = process.versions.node.split(".").map(Number);
  say(major >= 20, `Node.js ${process.versions.node}${major >= 20 ? "" : " (צריך 20 ומעלה)"}`);
  say(run("git", ["--version"], { quiet: true }).ok, "Git");
  const gh = run("gh", ["auth", "status"], { quiet: true });
  if (gh.ok) say(true, "GitHub CLI מחובר (אפשר ליצור את העותק בפקודה)");
  else say(null, /not logged|auth login/i.test(gh.out) ? "GitHub CLI מותקן אבל לא מחובר: מריצים gh auth login --web" : "אין GitHub CLI: את העותק יוצרים בלחיצה אחת ב-GitHub");
  if (/[^\x20-\x7E]/.test(hostname())) say(null, "שם המחשב בעברית. Vercel CLI נשבר מזה, ואנחנו עוקפים את זה אוטומטית.");
  const who = vercel(["whoami"], { quiet: true });
  say(who.ok, who.ok ? `Vercel מחובר (${who.out.trim().split("\n").pop()})` : "Vercel לא מחובר: מריצים npx vercel login ומאשרים בדפדפן");
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

function deploy() {
  const e = envNow() || {};
  const missing = REQUIRED.filter((k) => !e[k]);
  if (missing.length) return say(false, `חסר ב-.env.local: ${missing.join(", ")}`);
  const project = basename(ROOT).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90) || "telegram-assistant";

  if (!vercel(["whoami"], { quiet: true }).ok) return say(false, "Vercel לא מחובר: מריצים npx vercel login ומאשרים בדפדפן");
  const linked = vercel(["link", "--yes", "--project", project], { quiet: true }).ok
    || (vercel(["project", "add", project], { quiet: true }), vercel(["link", "--yes", "--project", project]).ok);
  if (!linked) return say(false, "לא הצלחתי ליצור את הפרויקט ב-Vercel");
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
  const url = (/Aliased:\s*(https:\/\/\S+)/.exec(d.out) || /(https:\/\/[\w.-]+\.vercel\.app)/.exec(d.out))?.[1];
  if (!d.ok || !url) return say(false, `העלאה נכשלה:\n${d.out.trim().split("\n").slice(-6).join("\n")}`);
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

const STEPS = { preflight, login, env, verify, deploy, activate };
const step = process.argv[2];
// רץ ישירות (ולא נטען מבדיקה)
if (basename(process.argv[1] || "") === "setup.mjs") {
  if (!STEPS[step]) {
    console.log(`שימוש: node scripts/setup.mjs <${Object.keys(STEPS).join("|")}>`);
    process.exitCode = 1;
  } else await STEPS[step]();
}

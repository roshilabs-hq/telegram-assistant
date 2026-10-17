#!/usr/bin/env node
/**
 * בדיקה למסלול Claude Code: מה כבר מוכן ומה עוד חסר.
 *
 * מדפיס כן/לא בלבד, ולעולם לא ערך של סוד. כך Claude יכול לבדוק בלי לראות את
 * המפתחות.
 *
 * 1. בודק את .env.local: האם השדות קיימים ובפורמט הנכון.
 * 2. אם יש KIT_URL, שואל את הבוט החי (עמוד ההקמה) מה המצב של כל שלב.
 */
import { readFileSync, existsSync } from "node:fs";

const asJson = process.argv.includes("--json");

function readEnv(file) {
  if (!existsSync(file)) return null;
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

const env = readEnv(".env.local");
const local = [];
const add = (id, ok, detail) => local.push({ id, ok, detail });

if (!env) {
  add("env_file", false, "אין קובץ .env.local (יוצרים אותו מ-.env.example)");
} else {
  const t = env.TELEGRAM_TOKEN || "";
  add("telegram_token", /^\d{6,}:[\w-]{30,}$/.test(t), t ? (/^\d{6,}:[\w-]{30,}$/.test(t) ? "בפורמט תקין" : "לא נראה כמו טוקן של BotFather") : "חסר");

  const k = env.AI_API_KEY || "";
  const provider = k.startsWith("sk-ant-") ? "Claude" : k.startsWith("AIza") || k.startsWith("AQ.") ? "Gemini" : k.startsWith("sk-") ? "ChatGPT" : null;
  add("ai_key", Boolean(provider), k ? (provider ? `מפתח של ${provider}` : "לא מזוהה כמפתח של Gemini, Claude או ChatGPT") : "חסר");

  const p = env.SETUP_PASSWORD || "";
  add("setup_password", p.length >= 8, p ? (p.length >= 8 ? "קיימת" : "קצרה מ-8 תווים") : "חסרה");

  add("kit_url", /^https:\/\//.test(env.KIT_URL || ""), env.KIT_URL ? "קיימת" : "עוד אין (ממלאים אחרי הפריסה)");

  add("voice_addon", Boolean(env.GROQ_API_KEY), env.GROQ_API_KEY ? "יש מפתח Groq" : "לא מופעל (לא חובה)");
  const g = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  add("google_addon", g, g ? "יש מפתחות Google" : "לא מופעל (לא חובה)");
}

let live = null;
if (env?.KIT_URL && env?.SETUP_PASSWORD) {
  try {
    const r = await fetch(`${env.KIT_URL.replace(/\/+$/, "")}/api/setup?format=json`, {
      headers: { "x-setup-password": env.SETUP_PASSWORD },
    });
    live = r.ok ? await r.json() : { error: r.status === 401 ? "הסיסמה ב-.env.local שונה מזו שב-Vercel" : `הבוט החזיר ${r.status}` };
  } catch (e) {
    live = { error: `לא הצלחתי להגיע לבוט: ${e.message}` };
  }
}

if (asJson) {
  console.log(JSON.stringify({ local, live }, null, 2));
} else {
  console.log("בדיקה מקומית (.env.local):");
  for (const c of local) console.log(`  ${c.ok ? "✅" : "❌"} ${c.id}: ${c.detail}`);
  if (live?.error) console.log(`\nהבוט החי: ❌ ${live.error}`);
  else if (live) {
    console.log("\nהבוט החי:");
    for (const s of live.steps) {
      console.log(`  ${s.ok ? "✅" : "❌"} ${s.title}`);
      if (!s.ok) for (const p of s.parts) if (!p.ok) console.log(`       ▫️ ${p.detail}`);
    }
  }
}

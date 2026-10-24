import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readEnv, setEnvLine, TEMPLATE } from "../scripts/setup.mjs";

test("קובץ הסודות: קוראים, מחליפים שורה, ומוסיפים שורה בלי לגעת בשאר", () => {
  const text = "# הערה\nTELEGRAM_TOKEN=abc\nAI_API_KEY=\n";
  assert.deepEqual(readEnv(text), { TELEGRAM_TOKEN: "abc", AI_API_KEY: "" });
  const replaced = setEnvLine(text, "AI_API_KEY", "k1");
  assert.match(replaced, /^# הערה$/m);
  assert.equal(readEnv(replaced).AI_API_KEY, "k1");
  assert.equal(readEnv(setEnvLine(text, "KIT_URL", "https://x.vercel.app")).KIT_URL, "https://x.vercel.app");
});

test("התבנית של .env.local כוללת את שלושת השדות, ריקים", () => {
  const e = readEnv(TEMPLATE);
  for (const k of ["TELEGRAM_TOKEN", "AI_API_KEY", "SETUP_PASSWORD"]) assert.equal(e[k], "");
});

test("העקיפה לשם מחשב בעברית: אחריה שם המחשב באנגלית בלבד", () => {
  const out = execFileSync(process.execPath, ["-r", "./scripts/ascii-hostname.cjs", "-e", "import('node:os').then(o=>console.log(o.hostname()))"], { encoding: "utf8" }).trim();
  assert.match(out, /^[\x20-\x7E]+$/);
});

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

test("אחרי העלאה נשמרת הכתובת הקבועה, לא הכתובת הנעולה של ההעלאה", async () => {
  const { productionUrl } = await import("../scripts/setup.mjs");
  const out = "Inspect: https://vercel.com/x\nProduction: https://telegram-assistant-2-j19lbfgah-roshidemobot-bot.vercel.app\nhttps://telegram-assistant-2.vercel.app";
  assert.equal(productionUrl(out), "https://telegram-assistant-2.vercel.app");
  assert.equal(productionUrl("Aliased: https://my-bot.vercel.app [2s]"), "https://my-bot.vercel.app");
});

test("קובץ סודות ישן מקבל שדות חדשים עם ההסבר, והערכים הקיימים לא נוגעים", async () => {
  const { addMissingFields } = await import("../scripts/setup.mjs");
  const old = "TELEGRAM_TOKEN=abc\nAI_API_KEY=k\nSETUP_PASSWORD=p\n";
  const out = addMissingFields(old);
  const e = readEnv(out);
  assert.equal(e.TELEGRAM_TOKEN, "abc");
  assert.equal(e.GROQ_API_KEY, "");
  assert.match(out, /console\.groq\.com\/keys\nGROQ_API_KEY=/);
  assert.equal(addMissingFields(out), out.replace(/\s*$/, "\n"));
});

test("החיבור ל-Vercel נקרא גם מ-repo.json (CLI חדש) וגם מ-project.json (ישן)", async () => {
  const { linkedProject } = await import("../scripts/setup.mjs");
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const a = mkdtempSync(join(tmpdir(), "lk-"));
  mkdirSync(join(a, ".vercel"));
  writeFileSync(join(a, ".vercel", "repo.json"), JSON.stringify({ remoteName: "origin", projects: [{ id: "prj_1", orgId: "team_1", name: "bot-2" }] }));
  assert.deepEqual(linkedProject(a), { id: "prj_1", orgId: "team_1", name: "bot-2" });
  const b = mkdtempSync(join(tmpdir(), "lk-"));
  mkdirSync(join(b, ".vercel"));
  writeFileSync(join(b, ".vercel", "project.json"), JSON.stringify({ projectId: "prj_2", orgId: "team_2" }));
  assert.deepEqual(linkedProject(b), { id: "prj_2", orgId: "team_2", name: null });
  assert.equal(linkedProject(mkdtempSync(join(tmpdir(), "lk-"))), null);
});

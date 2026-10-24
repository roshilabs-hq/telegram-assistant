#!/usr/bin/env node
/**
 * בונה את קבצי ההדרכה מתוך מקור אחד: steps/ (שלבי הבסיס) ו-addons/ (תוספות).
 *
 * הפלט, שאסור לערוך ידנית:
 *   CHECKLIST.md            תיבות סימון לכל שלב, עם קישור להדרכה בשני המסלולים
 *   docs/browser.md         כל השלבים במסלול הדפדפן
 *   docs/claude-code.md     כל השלבים במסלול Claude Code
 *   docs/quick.md           המדריך המקוצר ("יש לי ניסיון"), מתוך "## בקצרה" של כל שלב
 *   lib/steps.generated.js  רשימת השלבים לעמוד /setup
 *
 * שימוש:  node scripts/build-guide.mjs          כותב את הקבצים
 *         node scripts/build-guide.mjs --check  נכשל אם משהו לא מעודכן (ל-CI)
 *
 * הקובץ הזה מועתק מ-shared/ במפעל לכל ערכה. מתקנים אותו במפעל ומעתיקים מחדש.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const CHECK_ONLY = process.argv.includes("--check");

const QUICK = { file: "docs/quick.md", title: "המדריך המקוצר: יש לי ניסיון" };

const PATHS = {
  browser: { label: "בדפדפן", file: "docs/browser.md", title: "מסלול א׳: מהדפדפן" },
  claude: { label: "עם Claude Code", file: "docs/claude-code.md", title: "מסלול ב׳: עם Claude Code" },
};

/** front matter פשוט: key: value בכל שורה. אין צורך ב-YAML מלא. */
function parseFrontMatter(src, file) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
  if (!m) throw new Error(`${file}: חסר front matter בין שורות ---`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
}

/** מפצל לפי כותרות ##, ובתוך "מה עושים" לפי ### של כל מסלול. */
function parseSections(body) {
  const sections = {};
  let current = null;
  for (const line of body.split(/\r?\n/)) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h && !line.startsWith("###")) {
      current = h[1];
      sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  for (const k of Object.keys(sections)) sections[k] = sections[k].join("\n").trim();
  return sections;
}

function splitByPath(text) {
  const parts = { browser: null, claude: null };
  const re = /^###\s+(.+?)\s*$/gm;
  const heads = [...text.matchAll(re)];
  if (!heads.length) return { browser: text, claude: text };
  // מה שלפני ה-### הראשון משותף לשני המסלולים. בלי זה חלקים א׳–ד׳ של Google נעלמו משתי ההדרכות.
  const shared = text.slice(0, heads[0].index).trim();
  const join = (chunk) => (shared ? `${shared}\n\n${chunk}` : chunk);
  heads.forEach((h, i) => {
    const start = h.index + h[0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
    const chunk = text.slice(start, end).trim();
    if (h[1] === PATHS.browser.label) parts.browser = join(chunk);
    else if (h[1] === PATHS.claude.label) parts.claude = join(chunk);
    else throw new Error(`כותרת לא מוכרת "### ${h[1]}". מותר רק "${PATHS.browser.label}" או "${PATHS.claude.label}"`);
  });
  return parts;
}

// "בקצרה" הוא אותו שלב לקורא מנוסה: אותו קובץ, ולכן שתי ההדרכות לא מתרחקות זו מזו.
const REQUIRED = ["בקצרה", "למה", "מה עושים", "איך יודעים שהצליח", "נתקעתי"];

function loadDir(dir, kind) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((f) => /^\d+-.+\.md$/.test(f))
    .sort()
    .map((f) => {
      const file = `${dir}/${f}`;
      const { meta, body } = parseFrontMatter(readFileSync(join(full, f), "utf8"), file);
      for (const k of ["id", "title", "minutes", "check"]) {
        if (!meta[k]) throw new Error(`${file}: חסר "${k}" ב-front matter`);
      }
      const s = parseSections(body);
      for (const k of REQUIRED) {
        if (!s[k]) throw new Error(`${file}: חסר הסעיף "## ${k}"`);
      }
      const how = splitByPath(s["מה עושים"]);
      const only = meta.path || "both";
      return {
        kind,
        file,
        id: meta.id,
        title: meta.title,
        minutes: Number(meta.minutes),
        check: meta.check,
        only,
        quick: splitByPath(s["בקצרה"]),
        why: s["למה"],
        how,
        done: s["איך יודעים שהצליח"],
        stuck: s["נתקעתי"],
      };
    });
}

function anchor(step) {
  return `step-${step.id}`;
}

/**
 * בשלבים, נתיבים כתובים מראש הריפו (`docs/img/x.png`), אבל ההדרכות יושבות בתוך docs/.
 * בלי התיקון GitHub מחפש docs/docs/img, ואף צילום מסך לא מוצג.
 */
const fromDocs = (text) => text.replace(/\]\(docs\//g, "](");

function renderPath(pathKey, steps, addons) {
  const P = PATHS[pathKey];
  const core = steps.filter((s) => s.only === "both" || s.only === pathKey);
  const extra = addons.filter((s) => s.only === "both" || s.only === pathKey);
  const total = core.reduce((n, s) => n + s.minutes, 0);

  const block = (s, i, n, label) => {
    const how = s.how[pathKey];
    if (!how) throw new Error(`${s.file}: אין הוראות למסלול "${P.label}"`);
    return [
      `<a id="${anchor(s)}"></a>`,
      `## ${label} ${i} מתוך ${n} · ${s.title}`,
      `**⏱ כ-${s.minutes} דקות**`,
      "",
      `**למה:** ${s.why}`,
      "",
      "### מה עושים",
      how,
      "",
      "### איך יודעים שהצליח",
      s.done,
      "",
      "<details>",
      "<summary><b>נתקעתי</b></summary>",
      "",
      s.stuck,
      "",
      "</details>",
      "",
      "---",
      "",
    ].join("\n");
  };

  const out = [
    "<!-- נוצר אוטומטית מתוך steps/ ו-addons/ — לא לערוך ידנית. להרצה: npm run guide -->",
    '<div dir="rtl">',
    "",
    `# ${P.title}`,
    "",
    `${core.length} שלבים · בערך ${total} דקות בסך הכול. אפשר לעצור באמצע ולחזור בכל רגע.`,
    "",
    "**לפני שמתחילים:** [מה צריך](choose-path.md#requirements).",
    "",
    "| # | שלב | זמן |",
    "|---|---|---|",
    ...core.map((s, i) => `| ${i + 1} | [${s.title}](#${anchor(s)}) | כ-${s.minutes} דק׳ |`),
    "",
    ...(pathKey === "browser" ? [`יש לך ניסיון עם Vercel ו-GitHub? [המדריך המקוצר](quick.md) הוא עמוד אחד.`, ""] : []),
    // הערכה כותבת את ההודעה המוכנה בעצמה, כי בה הקישור להדרכה שלה
    ...(pathKey === "browser" && existsSync(join(ROOT, "docs/help-from-claude.md"))
      ? ["> 💬 **יש לך Claude באפליקציה או בדפדפן?** אפשר להיעזר בו לאורך הדרך: [ככה](help-from-claude.md).", ""]
      : []),
    "---",
    "",
    ...core.map((s, i) => block(s, i + 1, core.length, "שלב")),
  ];

  if (extra.length) {
    out.push(
      "# תוספות (לא חובה)",
      "",
      "כל תוספת עומדת בפני עצמה. אפשר להוסיף אותה עכשיו או בעוד חודש.",
      "",
      ...extra.map((s, i) => block(s, i + 1, extra.length, "תוספת"))
    );
  }
  out.push("</div>", "");
  return fromDocs(out.join("\n"));
}

/** המדריך המקוצר: מסלול הדפדפן, רק "בקצרה" של כל שלב, וקישור להסבר המלא. */
function renderQuick(steps, addons) {
  const pick = (list) => list.filter((s) => s.only !== "claude");
  const core = pick(steps);
  const extra = pick(addons);
  const block = (s, i) => {
    const quick = s.quick.browser;
    if (!quick) throw new Error(`${s.file}: אין "בקצרה" למסלול "${PATHS.browser.label}"`);
    return [
      `<a id="${anchor(s)}"></a>`,
      `### ${i}. ${s.title} · כ-${s.minutes} דק׳`,
      quick,
      "",
      `[הסבר מלא, צילומי מסך ו"נתקעתי" ←](browser.md#${anchor(s)})`,
      "",
    ].join("\n");
  };
  const page = [
    "<!-- נוצר אוטומטית מתוך steps/ ו-addons/ — לא לערוך ידנית. להרצה: npm run guide -->",
    '<div dir="rtl">',
    "",
    `# ${QUICK.title}`,
    "",
    `אותם שלבים כמו [המדריך המלא](browser.md), בלי ההסברים. נתקעים בשלב? הקישור שבסופו פותח את ההסבר המלא שלו.`,
    "",
    "**צריך:** חשבונות GitHub ו-Vercel, טלגרם, ומפתח AI עם אמצעי תשלום. [הפירוט המלא](choose-path.md#requirements).",
    "",
    ...core.map((s, i) => block(s, i + 1)),
    ...(extra.length ? ["## תוספות (לא חובה)", "", ...extra.map((s, i) => block(s, i + 1))] : []),
    "</div>",
    "",
  ].join("\n");
  return fromDocs(page);
}

function renderChecklist(steps, addons) {
  const line = (s) => {
    const links = [];
    if (s.only !== "claude") links.push(`[בדפדפן](${PATHS.browser.file}#${anchor(s)})`);
    if (s.only !== "browser") links.push(`[עם Claude Code](${PATHS.claude.file}#${anchor(s)})`);
    return `- [ ] **${s.title}** · כ-${s.minutes} דק׳ · ${links.join(" · ")}`;
  };
  return [
    "<!-- נוצר אוטומטית מתוך steps/ ו-addons/ — לא לערוך ידנית. להרצה: npm run guide -->",
    '<div dir="rtl">',
    "",
    "# צ'ק ליסט",
    "",
    "מסמנים כל שלב אחרי שהוא עובד. במסלול הדפדפן עמוד `/setup` מסמן לבד, ובמסלול Claude Code ‏Claude בודק עם `npm run check`.",
    "",
    "**לפני שמתחילים:** [מה צריך](docs/choose-path.md#requirements).",
    "",
    "## שלבי הבסיס",
    "",
    ...steps.map(line),
    "",
    ...(addons.length ? ["## תוספות (לא חובה)", "", ...addons.map(line), ""] : []),
    "</div>",
    "",
  ].join("\n");
}

function renderModule(steps, addons) {
  const pick = (s) => ({
    id: s.id,
    kind: s.kind,
    title: s.title,
    minutes: s.minutes,
    check: s.check,
    only: s.only,
  });
  return [
    "// נוצר אוטומטית מתוך steps/ ו-addons/ — לא לערוך ידנית. להרצה: npm run guide",
    `export const STEPS = ${JSON.stringify(steps.map(pick), null, 2)};`,
    "",
    `export const ADDONS = ${JSON.stringify(addons.map(pick), null, 2)};`,
    "",
  ].join("\n");
}

const steps = loadDir("steps", "step");
const addons = loadDir("addons", "addon");
if (!steps.length) throw new Error("לא נמצאו שלבים ב-steps/");

const seen = new Set();
for (const s of [...steps, ...addons]) {
  if (seen.has(s.id)) throw new Error(`המזהה "${s.id}" מופיע פעמיים`);
  seen.add(s.id);
}

const outputs = {
  [PATHS.browser.file]: renderPath("browser", steps, addons),
  [PATHS.claude.file]: renderPath("claude", steps, addons),
  [QUICK.file]: renderQuick(steps, addons),
  "CHECKLIST.md": renderChecklist(steps, addons),
  "lib/steps.generated.js": renderModule(steps, addons),
};

let stale = [];
for (const [rel, content] of Object.entries(outputs)) {
  const full = join(ROOT, rel);
  const current = existsSync(full) ? readFileSync(full, "utf8") : null;
  if (current === content) continue;
  if (CHECK_ONLY) {
    stale.push(rel);
  } else {
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
    console.log(`עודכן: ${rel}`);
  }
}

if (CHECK_ONLY && stale.length) {
  console.error(`קבצי ההדרכה לא מעודכנים: ${stale.join(", ")}\nמריצים: npm run guide`);
  process.exit(1);
}
if (!CHECK_ONLY) console.log(`${steps.length} שלבים, ${addons.length} תוספות.`);

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
 *   docs/index.html         האשף לטלפון (GitHub Pages): מסך לכל צעד, מאותו מקור
 *   .github/ISSUE_TEMPLATE/stuck.yml  טופס "נתקעתי" עם רשימת השלבים (רק כש-package.json מגדיר repository)
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

// טופס "נתקעתי" יושב בריפו הציבורי של הערכה, גם כשהלקוח קורא את ההדרכה מהעותק שלו.
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const REPO = /github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(PKG.repository?.url || PKG.repository || "")?.[1];
const STUCK_URL = REPO && `https://github.com/${REPO}/issues/new?template=stuck.yml`;
const STUCK_LINE = STUCK_URL
  ? `לא הסתדר? [ספרו לנו איפה נתקעתם](${STUCK_URL}), ונתקן את ההדרכה.` +
    (existsSync(join(ROOT, "docs/support.md")) ? " אין לכם GitHub? [דרכים נוספות](support.md)." : "")
  : null;

// האשף יושב באתר של רועי (kits.roshinovic.co.il), עם המותג וכפתורי "נתקין בשבילך" מתוך docs/support.md.
const SITE = { name: "רושינוביץ · אוטומציה לעסקים", url: "https://roshinovic.co.il" };
const SUPPORT_MD = existsSync(join(ROOT, "docs/support.md")) ? readFileSync(join(ROOT, "docs/support.md"), "utf8") : "";
const CONTACT = [
  ["wa", "וואטסאפ", /https:\/\/wa\.me\/[^)\s]+/],
  ["ig", "אינסטגרם", /https:\/\/ig\.me\/[^)\s]+/],
  ["fb", "מסנג'ר", /https:\/\/m\.me\/[^)\s]+/],
].map(([cls, label, re]) => ({ cls, label, url: re.exec(SUPPORT_MD)?.[0] })).filter((c) => c.url);

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
        wizard: meta.wizard,
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
      ...(STUCK_LINE ? ["", STUCK_LINE] : []),
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
    `${core.length} שלבים · בערך ${total} דקות למי שמכיר את המסכים. בפעם הראשונה כדאי לפנות 45–60 דקות, בלי לחץ. אפשר לעצור בין שלב לשלב ולחזור אחר כך. לא עוצרים באמצע הרשמה, או לפני ששמרת מפתח שמוצג פעם אחת.`,
    ...(pathKey === "browser"
      ? [
          "",
          "> 📱 **הכול מהטלפון.** פותחים את ההדרכה הזו בדפדפן (Safari או Chrome) ומשאירים אותה פתוחה. כל קישור בה נפתח באתר אחר, או בלשונית חדשה. בסוף כל פעולה חוזרים ללשונית של ההדרכה (בכפתור הלשוניות של הדפדפן) וממשיכים לצעד הבא. את הטוקן, המפתח והסיסמה שומרים במקום אחד: במנהל הסיסמאות של הטלפון, או בפתק נעול. לא מצלמים אותם ולא שולחים לאף אחד. נצטרך אותם שוב.",
        ]
      : []),
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

// ---------- האשף: docs/index.html (GitHub Pages) ----------
// אותו מקור כמו ההדרכה, מסך אחד לכל צעד ממוספר ב"מה עושים" של מסלול הדפדפן.
// שלב עם `wizard: one` ב-front matter נשאר מסך אחד (למשל רשימת הודעות לשליחה).

const htmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** קישור מתוך שלב: תמונות יחסית ל-docs/, מסמכים אחרים לריפו ב-GitHub, וכל השאר כמו שהוא. */
function wizardUrl(u) {
  if (/^(https?:|mailto:|#)/.test(u)) return u;
  const p = u.replace(/^\.\//, "");
  if (p.startsWith("docs/img/")) return p.slice("docs/".length);
  // בשלבים הנתיבים מראש הריפו (docs/x.md). שם קובץ בלי תיקייה הוא מתוך docs/, כמו בהדרכה עצמה.
  const inRepo = p.includes("/") ? p : `docs/${p}`;
  return REPO ? `https://github.com/${REPO}/blob/main/${inRepo}` : inRepo;
}

function mdInline(s) {
  let h = htmlEsc(s);
  const a = (href, inner) => `<a href="${wizardUrl(href)}" target="_blank" rel="noopener">${inner}</a>`;
  h = h.replace(/\[!\[([^\]]*)\]\(([^)\s]+)\)\]\(([^)\s]+)\)/g, (_, alt, src, href) => a(href, `<img class="inline" src="${wizardUrl(src)}" alt="${alt}">`));
  h = h.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${wizardUrl(src)}" alt="${alt || "צילום מסך"}" loading="lazy">`);
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => a(href, t));
  h = h.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  h = h.replace(/`([^`]+)`/g, '<code dir="ltr">$1</code>');
  return h;
}

const indentOf = (l) => l.match(/^\s*/)[0].length;
const ITEM = /^\s*(?:[-*]|\d+\.)\s+(.*)$/;

function mdList(lines, i) {
  const ind = indentOf(lines[i]);
  const ordered = /^\s*\d+\./.test(lines[i]);
  const items = [];
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) {
      const next = lines.slice(i + 1).find((x) => x.trim());
      if (!next || indentOf(next) < ind || (indentOf(next) === ind && !ITEM.test(next))) break;
      continue;
    }
    if (indentOf(l) < ind) break;
    if (indentOf(l) === ind) {
      const m = ITEM.exec(l);
      if (!m) break;
      items.push({ text: m[1], sub: [] });
    } else items.at(-1).sub.push(l.slice(ind));
  }
  const tag = ordered ? "ol" : "ul";
  return [`<${tag}>${items.map((it) => `<li>${mdInline(it.text)}${it.sub.length ? mdBlock(it.sub.join("\n")) : ""}</li>`).join("")}</${tag}>`, i];
}

function mdBlock(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; ) {
    const l = lines[i];
    const t = l.trim();
    const widget = /^<!--\s*wizard:([\w-]+)\s*-->$/.exec(t);
    if (!t || (/^<\/?(details|summary|a|div)\b/.test(t) && !widget)) i++;
    else if (widget) (out.push(WIDGETS[widget[1]] || ""), i++);
    else if (/^\s*>/.test(l)) {
      const q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push(`<div class="note">${mdBlock(q.join("\n"))}</div>`);
    } else if (ITEM.test(l)) {
      const [html, next] = mdList(lines, i);
      out.push(html);
      i = next;
    } else {
      const p = [];
      while (i < lines.length && lines[i].trim() && !/^\s*>/.test(lines[i]) && !ITEM.test(lines[i])) p.push(lines[i++].trim());
      out.push(`<p>${mdInline(p.join(" "))}</p>`);
    }
  }
  return out.join("\n");
}

/** כלים קטנים בתוך מסכים מסוימים. רצים בדפדפן של המשתמש, ושום דבר לא נשמר. */
const WIDGETS = {
  "telegram-check": `<div class="tool"><b>בדיקה מהירה:</b> מדביקים כאן את הטוקן ולוחצים "בדיקה". הטלפון שואל את טלגרם ישירות, והטוקן לא נשמר ולא נשלח לשום מקום אחר.
<input id="tg" dir="ltr" autocomplete="off" spellcheck="false" placeholder="123456789:AAH..."><button type="button" onclick="checkTg()">בדיקה</button><div id="tgout" class="out"></div></div>`,
  password: `<div class="tool"><b>סיסמה מוכנה:</b> נוצרה עכשיו בטלפון שלך, ואף אחד אחר לא רואה אותה. מעתיקים אותה לפתק, ואז מדביקים בשדה <code dir="ltr">SETUP_PASSWORD</code>.
<div id="pw" class="pw" dir="ltr"></div><button type="button" onclick="copyPw(this)">העתקה</button> <button type="button" class="ghost" onclick="newPw()">סיסמה אחרת</button></div>`,
};

/** מפצל את "מה עושים" למסכים: כל צעד ממוספר בעמודה הראשונה הוא מסך, ושורות שבין הצעדים הולכות למסך הבא. */
function wizardScreens(how, one) {
  const lines = how.split(/\r?\n/);
  if (one) return [mdBlock(how)];
  const screens = [];
  let pending = [];
  for (const l of lines) {
    if (/^\d+\.\s/.test(l)) {
      screens.push({ lead: pending, item: [l.replace(/^\d+\.\s+/, "")] });
      pending = [];
    } else if (screens.length && (indentOf(l) > 0 || !l.trim()) && !pending.length) screens.at(-1).item.push(l);
    else pending.push(l);
  }
  if (!screens.length) return [mdBlock(how)];
  if (pending.join("").trim()) screens.at(-1).tail = pending;
  return screens.map((s) => {
    const [first, ...rest] = s.item;
    return [mdBlock(s.lead.join("\n")), `<p class="act">${mdInline(first)}</p>`, mdBlock(rest.map((l) => l.replace(/^ {3}/, "")).join("\n")), mdBlock((s.tail || []).join("\n"))].join("\n");
  });
}

function renderWizard(steps, addons) {
  const core = steps.filter((s) => s.only !== "claude");
  const total = core.reduce((n, s) => n + s.minutes, 0);
  const stuck = STUCK_LINE ? mdInline(STUCK_LINE.replace("(support.md)", "(docs/support.md)")) : "";
  const contact = CONTACT.length
    ? `<div class="contact"><b>נתקעת? נתקין בשבילך.</b> ההתקנה בתשלום, לפי אותה הדרכה ובחשבונות שלך. כותבים לנו:<div class="btns">${CONTACT.map((c) => `<a class="${c.cls}" href="${htmlEsc(c.url)}" target="_blank" rel="noopener">${c.label}</a>`).join("")}</div></div>`
    : "";
  const sections = [];
  sections.push(`<section data-step="0"><h1>${htmlEsc(`${String(PKG.description || "").split(" — ")[0]}: הקמה צעד אחרי צעד`)}</h1>
<p>${core.length} שלבים. בפעם הראשונה כדאי לפנות 45–60 דקות, בלי לחץ. מסך אחד לכל פעולה. הטלפון זוכר איפה עצרת.</p>
<div class="note">📱 <b>משאירים את העמוד הזה פתוח.</b> כל קישור נפתח בלשונית חדשה. בסוף כל פעולה חוזרים לכאן (בכפתור הלשוניות של הדפדפן) ולוחצים "הבא". את הטוקן, המפתח והסיסמה שומרים במנהל הסיסמאות של הטלפון, או בפתק נעול.</div>
<p>לא עוצרים באמצע הרשמה, או לפני ששמרת מפתח שמוצג פעם אחת. בין שלב לשלב אפשר לעצור ולחזור.</p>
<p><a href="${wizardUrl("docs/choose-path.md#requirements")}" target="_blank" rel="noopener">מה צריך לפני שמתחילים</a> · <a href="${wizardUrl("docs/browser.md")}" target="_blank" rel="noopener">כל ההדרכה בעמוד אחד</a></p>
${existsSync(join(ROOT, "docs/help-from-claude.md")) ? `<p>💬 יש לך Claude באפליקציה? <a href="${wizardUrl("docs/help-from-claude.md")}" target="_blank" rel="noopener">אפשר להיעזר בו לאורך הדרך</a>.</p>` : ""}${contact}</section>`);
  core.forEach((s, si) => {
    const screens = wizardScreens(s.how.browser, s.wizard === "one");
    screens.forEach((body, k) => {
      const head = `<div class="where">שלב ${si + 1} מתוך ${core.length} · ${htmlEsc(s.title)}${screens.length > 1 ? ` · צעד ${k + 1} מתוך ${screens.length}` : ""}</div>`;
      const why = k === 0 ? `<details><summary>למה צריך את זה?</summary>${mdBlock(s.why)}</details>` : "";
      const done = k === screens.length - 1 ? `<div class="done"><b>✅ איך יודעים שהצליח</b>${mdBlock(s.done)}</div>` : "";
      sections.push(`<section data-step="${si + 1}">${head}${why}${body}${done}<details><summary>נתקעתי</summary>${mdBlock(s.stuck)}${stuck ? `<p>${stuck}</p>` : ""}${contact}</details></section>`);
    });
  });
  const extra = addons.filter((s) => s.only !== "claude");
  sections.push(`<section data-step="${core.length}"><h1>🎉 סיימת!</h1><p>הבוט עובד. מכאן הכול קורה בטלגרם ובעמוד ההקמה של הבוט.</p>
${extra.length ? `<p><b>תוספות (לא חובה):</b></p><ul>${extra.map((a) => `<li><a href="${wizardUrl(`docs/browser.md#${anchor(a)}`)}" target="_blank" rel="noopener">${htmlEsc(a.title)}</a></li>`).join("")}</ul>` : ""}
${existsSync(join(ROOT, "docs/turn-off.md")) ? `<p><a href="${wizardUrl("docs/turn-off.md")}" target="_blank" rel="noopener">איך מכבים הכול</a></p>` : ""}
<p>רוצים עוד כלים כאלה? <a href="${SITE.url}" target="_blank" rel="noopener">${htmlEsc(SITE.name)}</a></p></section>`);

  const words = "apple river table green happy cloud stone light music garden silver window orange forest candle yellow bridge rabbit summer winter pencil yogurt rocket planet tiger lemon cookie dragon island jacket kitten ladder magnet napkin ocean pepper puzzle quiet robot saddle tomato turtle violin wagon zebra anchor banana basket button camera castle cherry circle copper desert doctor engine falcon feather flower ginger hammer helmet honey jungle kettle laptop marble meadow mirror monkey morning noodle orbit palace parrot peanut pillow pirate pocket potato pumpkin rainbow ribbon saturn shadow sketch spider sponge spring sugar sunset tunnel velvet walnut wizard".split(" ");
  return `<!doctype html>
<!-- נוצר אוטומטית מתוך steps/ — לא לערוך ידנית. להרצה: npm run guide -->
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${htmlEsc(`${String(PKG.description || "").split(" — ")[0]}: הקמה צעד אחרי צעד`)}</title>
<style>
:root{--bg:#f7f7f5;--card:#fff;--ink:#1b1b1b;--muted:#6b6b6b;--line:#e5e5e0;--accent:#2563eb;--note:#fff8e1;--done:#e8f5ec}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--card:#1e1e1e;--ink:#f1f1f1;--muted:#a0a0a0;--line:#333;--accent:#60a5fa;--note:#2b2616;--done:#16281d}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
main{max-width:560px;margin:0 auto;padding:12px 16px 110px}
.bar{position:sticky;top:0;background:var(--bg);padding:10px 0 8px;z-index:2}.track{height:6px;background:var(--line);border-radius:3px;overflow:hidden}.fill{height:100%;background:var(--accent);width:0;transition:width .2s}
section{display:none;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}section.on{display:block}
h1{font-size:1.35rem;margin:0 0 8px}.where{color:var(--muted);font-size:.9rem;margin-bottom:8px}.act{font-size:1.1rem;font-weight:600}
img{max-width:100%;height:auto;border:1px solid var(--line);border-radius:10px;margin:8px 0;display:block}img.inline{display:inline-block;border:0;margin:6px 0;height:48px;width:auto}
code{background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:0 4px;font-size:.9em;word-break:break-all}
.note{background:var(--note);border-radius:10px;padding:10px 12px;margin:10px 0}.done{background:var(--done);border-radius:10px;padding:10px 12px;margin:12px 0}
details{border-top:1px solid var(--line);margin-top:12px;padding-top:8px}summary{cursor:pointer;color:var(--accent);font-weight:600}
a{color:var(--accent)}ul,ol{padding-inline-start:22px}
nav{position:fixed;bottom:0;left:0;right:0;background:var(--card);border-top:1px solid var(--line);padding:10px 16px calc(10px + env(safe-area-inset-bottom))}
nav div{max-width:560px;margin:0 auto;display:flex;gap:10px}
button{font:inherit;font-weight:600;border:0;border-radius:10px;padding:12px 16px;background:var(--accent);color:#fff;cursor:pointer}
nav button{flex:1}button.ghost{background:transparent;color:var(--accent);border:1px solid var(--accent)}button:disabled{opacity:.35}
.tool{border:2px dashed var(--accent);border-radius:12px;padding:12px;margin:12px 0}.tool input{width:100%;font:inherit;padding:10px;margin:8px 0;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}
.pw{font:600 1.15rem ui-monospace,monospace;background:var(--bg);border-radius:8px;padding:10px;margin:8px 0;word-break:break-all;text-align:center}.out{margin-top:8px;font-weight:600}
.restart{display:block;text-align:center;color:var(--muted);font-size:.85rem;margin-top:14px}
.brand{display:block;color:var(--muted);font-size:.85rem;font-weight:600;text-decoration:none;padding-top:4px}
.contact{border:1px solid var(--line);border-radius:12px;padding:12px;margin:12px 0}.btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.btns a{flex:1 1 90px;text-align:center;font-weight:600;border-radius:10px;padding:10px;text-decoration:none;color:#fff}.wa{background:#1f9d55}.ig{background:#c13584}.fb{background:#1877f2}
</style></head><body><main>
<a class="brand" href="${SITE.url}" target="_blank" rel="noopener">${htmlEsc(SITE.name)}</a>
<div class="bar"><div class="track"><div class="fill" id="fill"></div></div></div>
${sections.join("\n")}
<a class="restart" href="#" onclick="go(0);return false">חזרה להתחלה</a>
</main>
<nav><div><button type="button" class="ghost" id="prev" onclick="go(i-1)">‹ חזרה</button><button type="button" id="next" onclick="go(i+1)">הבא ›</button></div></nav>
<script>
const S = [...document.querySelectorAll("section")], KEY = "wizard:${REPO || "kit"}";
let i = 0;
try { i = Math.min(Number(localStorage.getItem(KEY)) || 0, S.length - 1); } catch {}
function go(n) {
  i = Math.max(0, Math.min(n, S.length - 1));
  S.forEach((s, k) => s.classList.toggle("on", k === i));
  document.getElementById("prev").disabled = i === 0;
  const next = document.getElementById("next");
  next.disabled = i === S.length - 1;
  next.textContent = i === 0 ? "מתחילים ›" : "הבא ›";
  document.getElementById("fill").style.width = (100 * i / (S.length - 1)) + "%";
  try { localStorage.setItem(KEY, i); } catch {}
  window.scrollTo(0, 0);
}
// קישור ישיר למסך (#s-12), למשל מדף הביקורת
const deep = /^#s-(\d+)$/.exec(location.hash);
if (deep) i = Number(deep[1]);
go(i);
async function checkTg() {
  const t = document.getElementById("tg").value.trim(), out = document.getElementById("tgout");
  if (!/^\\d+:[\\w-]{30,}$/.test(t)) { out.textContent = "❌ זה לא נראה כמו טוקן. הוא מתחיל במספרים, אחריהם נקודתיים, ואחריהם אותיות. מעתיקים שוב."; return; }
  out.textContent = "בודק...";
  try {
    const r = await (await fetch("https://api.telegram.org/bot" + t + "/getMe")).json();
    out.textContent = r.ok ? "✅ הטוקן תקין: הבוט @" + r.result.username + ". אפשר להמשיך." : "❌ טלגרם לא מכיר את הטוקן. מעתיקים אותו שוב מ-BotFather, כולו.";
  } catch { out.textContent = "לא הצלחתי לבדוק עכשיו (אין אינטרנט?). אפשר להמשיך, והבדיקה תקרה שוב בעמוד ההקמה."; }
}
const W = ${JSON.stringify(words)};
function newPw() {
  const r = crypto.getRandomValues(new Uint32Array(6)), cap = (w) => w[0].toUpperCase() + w.slice(1);
  const el = document.getElementById("pw");
  if (el) el.textContent = [0, 1, 2, 3, 4].map((k) => cap(W[r[k] % W.length])).join("") + (r[5] % 900 + 100);
}
function copyPw(b) { navigator.clipboard.writeText(document.getElementById("pw").textContent).then(() => { b.textContent = "הועתק ✓"; }); }
newPw();
</script></body></html>
`;
}

/** טופס Issue ב-GitHub. JSON.stringify נותן מחרוזות שגם YAML קורא. */
function renderStuckForm(steps, addons) {
  const q = JSON.stringify;
  const options = [...steps, ...addons].map((s) => s.title).concat("לפני שהתחלתי / לא בטוח/ה");
  return [
    "# נוצר אוטומטית מתוך steps/ ו-addons/ — לא לערוך ידנית. להרצה: npm run guide",
    `name: ${q("נתקעתי")}`,
    `description: ${q("ספרו לנו איפה נתקעתם. כל היתקעות היא באג בהדרכה, ואנחנו מתקנים אותה.")}`,
    `title: ${q("נתקעתי: ")}`,
    "labels: [\"stuck\"]",
    "body:",
    "  - type: markdown",
    "    attributes:",
    `      value: ${q("⚠️ **הטופס הזה ציבורי. לא מדביקים כאן טוקן, מפתח, סיסמה, או צילום מסך שרואים בו אותם.**")}`,
    "  - type: dropdown",
    "    id: step",
    "    attributes:",
    `      label: ${q("באיזה שלב נתקעתם?")}`,
    "      options:",
    // בלי required: אחרת GitHub בוחר מראש את השלב הראשון, ורוב האנשים לא נתקעו בו
    ...options.map((o) => `        - ${q(o)}`),
    "  - type: dropdown",
    "    id: guide",
    "    attributes:",
    `      label: ${q("באיזו הדרכה השתמשתם?")}`,
    "      options:",
    ...[PATHS.browser.title, QUICK.title, PATHS.claude.title].map((o) => `        - ${q(o)}`),
    "  - type: textarea",
    "    id: what",
    "    attributes:",
    `      label: ${q("מה ראיתם על המסך, ומה ניסיתם?")}`,
    `      description: ${q("אפשר להדביק כאן צילום מסך (Ctrl+V). בלי סודות.")}`,
    "    validations:",
    "      required: true",
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
  ...(STUCK_URL ? { ".github/ISSUE_TEMPLATE/stuck.yml": renderStuckForm(steps, addons) } : {}),
  "docs/index.html": renderWizard(steps, addons),
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

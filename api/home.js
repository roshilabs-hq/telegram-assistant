/**
 * העמוד הראשי ומדיניות הפרטיות. Google דורש קישור למדיניות פרטיות לפני Publish
 * של אפליקציית החיבור (תוספת Google), ולכן כל בוט מגיש אחת משלו ב-/privacy.
 */
const PRIVACY = `<h1 style="font-size:1.4rem">מדיניות פרטיות</h1>
<p>זה עוזר אישי של אדם אחד. הוא רץ בחשבונות של הבעלים (Vercel ו-Supabase), ורק הבעלים יכול לדבר איתו.</p>
<ul style="text-align:right">
<li>מה שנשמר: ההודעות, התזכורות, הפתקים והרשימות של הבעלים, ואם חובר Google גם מפתח הגישה ליומן ול-Gmail. הכול נשמר במסד של הבעלים.</li>
<li>היומן והמיילים נקראים רק כדי לענות לבקשה של הבעלים. שום מידע לא נמכר ולא מועבר לאחרים.</li>
<li>ההודעות נשלחות לספק ה-AI שהבעלים בחר, כדי לנסח תשובה.</li>
<li>ביטול הגישה ל-Google: <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</li>
</ul>
<p lang="en" dir="ltr" style="font-size:.9rem">A single-owner personal assistant. Data stays in the owner's own database, Google data is used only to answer the owner's requests, and nothing is sold or shared.</p>`;

const HOME = `🤖<h1 style="font-size:1.4rem">העוזר האישי פועל</h1>
<p><a href="/setup">לעמוד ההקמה</a> · <a href="/privacy">מדיניות פרטיות</a></p>`;

export default function handler(req, res) {
  const privacy = "privacy" in (req.query || {});
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${privacy ? "מדיניות פרטיות" : "העוזר האישי"}</title>
<style>body{font:18px/1.6 system-ui,Arial,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;background:#f7f7f5;color:#1b1b1b}
@media (prefers-color-scheme:dark){body{background:#141414;color:#f1f1f1}}a{color:#2563eb}</style></head>
<body><div style="text-align:center;padding:16px;max-width:640px">${privacy ? PRIVACY : HOME}</div></body></html>`);
}

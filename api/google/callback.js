import { baseUrl } from "../../lib/config.js";
import { finishConsent } from "../../lib/google.js";

function page(icon, title, text) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{font:17px/1.6 system-ui,Arial,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;background:#f7f7f5;color:#1b1b1b}
@media (prefers-color-scheme:dark){body{background:#141414;color:#f1f1f1}}.c{max-width:420px;text-align:center;padding:16px}a{color:#2563eb}</style></head>
<body><div class="c"><div style="font-size:3rem">${icon}</div><h1 style="font-size:1.3rem">${title}</h1><p>${text}</p>
<p><a href="/setup">חזרה לעמוד ההקמה</a></p></div></body></html>`;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Google מחזיר לכאן אחרי האישור. */
export default async function handler(req, res) {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  const { code, state, error } = req.query || {};

  if (error) {
    const why = error === "access_denied" ? "לא אישרת את הגישה. אפשר לנסות שוב ולסמן את כל התיבות." : esc(error);
    return res.status(400).send(page("⚠️", "החיבור לא הושלם", why));
  }
  if (!code || !state) return res.status(400).send(page("⚠️", "החיבור לא הושלם", "חסרים פרטים בחזרה מ-Google. מתחילים מחדש מעמוד ההקמה."));

  try {
    const r = await finishConsent(baseUrl(req), String(code), String(state));
    if (!r.ok && r.error === "state") {
      return res.status(400).send(page("⚠️", "הקישור כבר שומש", "מתחילים מחדש מהכפתור בעמוד ההקמה."));
    }
    if (!r.ok) {
      return res.status(400).send(page("⚠️", "Google לא נתן גישה קבועה", 'נכנסים ל-<a href="https://myaccount.google.com/permissions">הרשאות החשבון</a>, מסירים את הגישה של הבוט, ומתחברים שוב מעמוד ההקמה.'));
    }
    return res.status(200).send(page("✅", "יומן ו-Gmail מחוברים", `${r.email ? `${esc(r.email)}<br>` : ""}אפשר לחזור לטלגרם ולשאול "מה יש לי מחר?"`));
  } catch (e) {
    console.error("google callback failed", e);
    return res.status(500).send(page("⚠️", "החיבור נכשל", esc(e.message)));
  }
}

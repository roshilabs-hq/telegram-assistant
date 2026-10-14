/** העמוד הראשי: רק אומר שהבוט חי ומפנה לעמוד ההקמה. אין בו שום מידע. */
export default function handler(req, res) {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>העוזר האישי</title>
<style>body{font:18px/1.6 system-ui,Arial,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;background:#f7f7f5;color:#1b1b1b}
@media (prefers-color-scheme:dark){body{background:#141414;color:#f1f1f1}}a{color:#2563eb}</style></head>
<body><div style="text-align:center;padding:16px">🤖<h1 style="font-size:1.4rem">העוזר האישי פועל</h1>
<p><a href="/setup">לעמוד ההקמה</a></p></div></body></html>`);
}

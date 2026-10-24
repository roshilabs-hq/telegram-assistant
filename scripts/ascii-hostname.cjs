// מחשב ששמו בעברית שובר את Vercel CLI: הוא שם את שם המחשב בכותרת HTTP, ושם מותר רק אנגלית.
// נטען לפני ה-CLI (NODE_OPTIONS=--require), ומחליף את השם רק בתוך התהליך הזה. במחשב עצמו לא משתנה כלום.
const os = require("os");
if (/[^\x20-\x7E]/.test(os.hostname())) {
  os.hostname = () => "pc";
  require("module").syncBuiltinESMExports();
}

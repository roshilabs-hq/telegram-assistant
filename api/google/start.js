import { baseUrl } from "../../lib/config.js";
import { authed, tooManyTries } from "../../lib/session.js";
import { googleConfigured, startConsent } from "../../lib/google.js";

/** מתחיל את החיבור ל-Google. רק מתוך עמוד ההקמה (צריך להיות מחובר אליו). */
export default async function handler(req, res) {
  // גם כאן אפשר לשלוח את הסיסמה בכותרת, אז גם כאן סופרים ניסיונות
  if (req.headers["x-setup-password"] && (await tooManyTries(req))) return res.status(429).send("too many tries");
  if (!authed(req)) return res.redirect(303, "/setup");
  if (!googleConfigured()) return res.redirect(303, "/setup");
  return res.redirect(302, await startConsent(baseUrl(req)));
}

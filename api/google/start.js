import { baseUrl } from "../../lib/config.js";
import { authed } from "../../lib/session.js";
import { googleConfigured, startConsent } from "../../lib/google.js";

/** מתחיל את החיבור ל-Google. רק מתוך עמוד ההקמה (צריך להיות מחובר אליו). */
export default async function handler(req, res) {
  if (!authed(req)) return res.redirect(303, "/setup");
  if (!googleConfigured()) return res.redirect(303, "/setup");
  return res.redirect(302, await startConsent(baseUrl(req)));
}

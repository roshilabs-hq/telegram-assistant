import { timingSafeEqual } from "node:crypto";
import { env, secrets } from "./config.js";

/** הכניסה לעמוד ההקמה: עוגייה שנגזרת מהסיסמה (ולא הסיסמה עצמה), או כותרת עם הסיסמה למסלול Claude Code. */
export const COOKIE = "setup_session";

export const same = (a, b) => {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

export function cookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((c) => c.trim().split("="))
      .filter((p) => p.length === 2)
  );
}

export function authed(req) {
  if (!env.setupPassword()) return false;
  return same(cookies(req)[COOKIE], secrets.session()) || same(req.headers["x-setup-password"], env.setupPassword());
}

export function sessionCookie() {
  return `${COOKIE}=${secrets.session()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;
}

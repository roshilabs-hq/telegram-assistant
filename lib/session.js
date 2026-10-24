import { timingSafeEqual } from "node:crypto";
import { env, secrets } from "./config.js";
import * as store from "./db.js";

/** אותו מינימום שעמוד ההקמה מציג. סיסמה קצרה ממנו לא פותחת את העמוד בכלל. */
export const MIN_PASSWORD = 8;
const password = () => (env.setupPassword().length >= MIN_PASSWORD ? env.setupPassword() : "");

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
  if (!password()) return false;
  return same(cookies(req)[COOKIE], secrets.session()) || same(req.headers["x-setup-password"], password());
}

export const passwordOk = (given) => same(given, password());

/**
 * עד 10 ניסיונות כניסה בדקה מכל כתובת, כדי שאי אפשר יהיה לנחש את הסיסמה.
 * כל ניסיון תופס משבצת במסד, ולכן גם ניסיונות במקביל נספרים.
 */
export async function tooManyTries(req, now = Date.now()) {
  const ip = String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "?").split(",")[0].trim();
  const minute = Math.floor(now / 60000);
  for (let i = 1; i <= 10; i++) if (await store.claim(`setup_try:${ip}:${minute}:${i}`)) return false;
  return true;
}

export function sessionCookie() {
  return `${COOKIE}=${secrets.session()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;
}

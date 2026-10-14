/**
 * זמן לפי אזור הזמן של המשתמש (ברירת מחדל: ישראל).
 *
 * הבוט רץ על שרת שהשעון שלו ב-UTC. כל מה שהמשתמש אומר ("מחר ב-9", "כל יום
 * ראשון") הוא שעון קיר אצלו, כולל מעבר לשעון קיץ, ולכן כל החישובים עוברים
 * דרך מסד אזורי הזמן ולא דרך היסט קבוע.
 */

export const RECURRENCE_KINDS = ["daily", "weekly", "monthly", "yearly"];

export function offsetMinutes(tz, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const name = parts.find((p) => p.type === "timeZoneName")?.value || "";
  const m = /GMT([+-])(\d{2}):?(\d{2})/.exec(name);
  if (!m) return 0; // "GMT" לבד = UTC
  const mins = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -mins : mins;
}

/** "+03:00" */
export function offsetString(tz, date = new Date()) {
  const mins = offsetMinutes(tz, date);
  const sign = mins >= 0 ? "+" : "-";
  const abs = Math.abs(mins);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** רכיבי שעון הקיר של רגע מסוים באזור הזמן. */
export function wallParts(tz, date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}

/** שעון קיר ← הרגע האמיתי. חוזר כמה פעמים כי ההיסט תלוי ברגע עצמו. */
export function fromWallParts(tz, { y, mo, d, h, mi }) {
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let guess = new Date(naive);
  for (let i = 0; i < 3; i++) {
    const next = new Date(naive - offsetMinutes(tz, guess) * 60000);
    if (next.getTime() === guess.getTime()) break;
    guess = next;
  }
  return guess;
}

/** "YYYY-MM-DD" של היום (או של רגע אחר) באזור הזמן. */
export function dayKey(tz, date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: tz });
}

/** "HH:MM" של עכשיו באזור הזמן. */
export function hhmm(tz, date = new Date()) {
  return date.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/** הרגע שבו השעה `hour` (ו-`minute`) בעוד `daysAhead` ימים. */
export function atWallTime(tz, daysAhead, hour, minute = 0, now = new Date()) {
  const p = wallParts(tz, now);
  return fromWallParts(tz, { y: p.y, mo: p.mo, d: p.d + daysAhead, h: hour, mi: minute });
}

function daysInMonth(y, mo) {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** צעד אחד קדימה בסדרה, לפי שעון קיר, כך ששעת היום נשמרת גם במעבר שעון. */
export function addStep(tz, date, kind, interval) {
  const p = wallParts(tz, date);
  const n = Math.max(1, Number(interval) || 1);
  if (kind === "daily") return fromWallParts(tz, { ...p, d: p.d + n });
  if (kind === "weekly") return fromWallParts(tz, { ...p, d: p.d + 7 * n });
  if (kind === "monthly" || kind === "yearly") {
    const total = p.mo - 1 + (kind === "yearly" ? 12 * n : n);
    const y = p.y + Math.floor(total / 12);
    const mo = (total % 12) + 1;
    return fromWallParts(tz, { y, mo, d: Math.min(p.d, daysInMonth(y, mo)), h: p.h, mi: p.mi });
  }
  return null;
}

/**
 * המופע הבא אחרי `now`. מדלג על מופעים שהוחמצו (למשל כשהבוט היה למטה)
 * במקום לשלוח אחד על כל מופע שהוחמץ. מחזיר null כשהסדרה נגמרה.
 */
export function nextOccurrence(tz, reminder, now = new Date()) {
  const { recurrence_kind: kind, recurrence_interval: interval } = reminder;
  if (!RECURRENCE_KINDS.includes(kind)) return null;
  let cur = new Date(reminder.due_at);
  if (Number.isNaN(cur.getTime())) return null;
  const until = reminder.recurrence_until ? new Date(reminder.recurrence_until) : null;
  for (let i = 0; i < 1000; i++) {
    const next = addStep(tz, cur, kind, interval);
    if (!next || Number.isNaN(next.getTime()) || next <= cur) return null;
    cur = next;
    if (cur > now) return until && cur > until ? null : cur;
  }
  return null;
}

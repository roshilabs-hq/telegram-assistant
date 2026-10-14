import { test } from "node:test";
import assert from "node:assert/strict";
import { offsetString, nextOccurrence, atWallTime, wallParts, fromWallParts, hhmm } from "../lib/time.js";

const TZ = "Asia/Jerusalem";

test("offset בישראל: חורף +02:00, קיץ +03:00", () => {
  assert.equal(offsetString(TZ, new Date("2026-01-15T12:00:00Z")), "+02:00");
  assert.equal(offsetString(TZ, new Date("2026-07-15T12:00:00Z")), "+03:00");
});

test("תזכורת יומית שומרת על 09:00 גם במעבר לשעון חורף", () => {
  // 25.10.2026 — יום המעבר לשעון חורף בישראל
  const r = { due_at: "2026-10-24T06:00:00Z", recurrence_kind: "daily", recurrence_interval: 1 };
  const next = nextOccurrence(TZ, r, new Date("2026-10-24T07:00:00Z"));
  assert.deepEqual(wallParts(TZ, next), { y: 2026, mo: 10, d: 25, h: 9, mi: 0 });
});

test("מופעים שהוחמצו מדולגים, לא נשלחים אחד-אחד", () => {
  const r = { due_at: "2026-03-01T07:00:00Z", recurrence_kind: "daily", recurrence_interval: 1 };
  const now = new Date("2026-03-10T08:00:00Z");
  const next = nextOccurrence(TZ, r, now);
  assert.ok(next > now);
  assert.ok(next - now < 86400000);
});

test("חודשית ב-31 נופלת על היום האחרון של חודש קצר", () => {
  const due = fromWallParts(TZ, { y: 2026, mo: 1, d: 31, h: 10, mi: 0 });
  const next = nextOccurrence(TZ, { due_at: due.toISOString(), recurrence_kind: "monthly", recurrence_interval: 1 }, due);
  assert.deepEqual(wallParts(TZ, next), { y: 2026, mo: 2, d: 28, h: 10, mi: 0 });
});

test("סדרה עם תאריך סיום נגמרת", () => {
  const r = {
    due_at: "2026-03-01T07:00:00Z",
    recurrence_kind: "weekly",
    recurrence_interval: 1,
    recurrence_until: "2026-03-05T00:00:00Z",
  };
  assert.equal(nextOccurrence(TZ, r, new Date("2026-03-01T08:00:00Z")), null);
});

test("מחר ב-9 לפי שעון קיר", () => {
  const now = new Date("2026-07-15T20:30:00Z"); // 23:30 בישראל
  assert.deepEqual(wallParts(TZ, atWallTime(TZ, 1, 9, 0, now)), { y: 2026, mo: 7, d: 16, h: 9, mi: 0 });
  assert.equal(hhmm(TZ, now), "23:30");
});

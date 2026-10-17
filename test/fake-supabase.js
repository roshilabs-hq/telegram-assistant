/**
 * Supabase מזויף בזיכרון, לבדיקות. מממש רק את מה ש-lib/db.js משתמש בו, אבל
 * מממש אותו באמת: סינון, מיון, עמודות, ומפתח ייחודי שמחזיר 23505 כמו Postgres.
 */
const UNIQUE = { bot_settings: "key", bot_locks: "key" };

// עמודות "not null" מהסכמה (supabase/migrations/0001_init.sql). בלי האכיפה הזו, כתיבת
// null להגדרה עברה בבדיקות ונפלה במסד האמיתי (נמצא בהרצה הראשונה על חשבון נקי).
const NOT_NULL = {
  bot_settings: ["key", "value"],
  bot_messages: ["chat_id", "role", "content"],
  bot_reminders: ["chat_id", "text", "due_at"],
  bot_notes: ["chat_id", "content"],
  bot_lists: ["chat_id", "list_name", "item"],
};
const nullViolation = (t, row, partial) =>
  (NOT_NULL[t] || []).find((c) => (partial ? c in row && row[c] == null : row[c] == null));

export function createFake() {
  const tables = new Map();
  const seq = new Map();
  const rows = (t) => (tables.has(t) ? tables.get(t) : tables.set(t, []).get(t));
  const nextId = (t) => {
    const n = (seq.get(t) || 0) + 1;
    seq.set(t, n);
    return n;
  };

  class Query {
    constructor(table) {
      this.t = table;
      this.filters = [];
      this.op = "select";
    }
    select(cols) {
      if (cols && !cols.includes("*")) this.cols = cols.split(",").map((c) => c.trim());
      this.returning = true;
      return this;
    }
    eq(c, v) {
      this.filters.push((r) => String(r[c]) === String(v) && (v !== null || r[c] === null));
      return this;
    }
    neq(c, v) {
      this.filters.push((r) => r[c] !== v);
      return this;
    }
    lte(c, v) {
      this.filters.push((r) => r[c] <= v);
      return this;
    }
    lt(c, v) {
      this.filters.push((r) => r[c] < v);
      return this;
    }
    gte(c, v) {
      this.filters.push((r) => r[c] >= v);
      return this;
    }
    order(c, { ascending = true } = {}) {
      this.sort = { c, ascending };
      return this;
    }
    limit(n) {
      this.max = n;
      return this;
    }
    insert(data) {
      this.op = "insert";
      this.payload = Array.isArray(data) ? data : [data];
      return this;
    }
    upsert(data, { onConflict } = {}) {
      this.op = "upsert";
      this.payload = Array.isArray(data) ? data : [data];
      this.conflict = onConflict;
      return this;
    }
    update(patch) {
      this.op = "update";
      this.payload = patch;
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    maybeSingle() {
      this.one = "maybe";
      return this;
    }
    single() {
      this.one = "single";
      return this;
    }
    project(list) {
      if (!this.cols) return list.map((r) => ({ ...r }));
      return list.map((r) => Object.fromEntries(this.cols.filter((c) => c in r).map((c) => [c, r[c]])));
    }
    run() {
      const all = rows(this.t);
      const match = (r) => this.filters.every((f) => f(r));
      let out = [];
      if (this.op === "insert" || this.op === "upsert") {
        const key = this.conflict || UNIQUE[this.t];
        for (const p of this.payload) {
          const bad = nullViolation(this.t, p, false);
          if (bad) return { data: null, error: { code: "23502", message: `null value in column "${bad}"` } };
          const existing = key ? all.find((r) => r[key] === p[key]) : null;
          if (existing && this.op === "insert") return { data: null, error: { code: "23505", message: "duplicate key" } };
          if (existing) {
            Object.assign(existing, p);
            out.push(existing);
          } else {
            const row = { created_at: new Date().toISOString(), ...p };
            if (!UNIQUE[this.t]) row.id = nextId(this.t);
            all.push(row);
            out.push(row);
          }
        }
      } else if (this.op === "update") {
        const bad = nullViolation(this.t, this.payload, true);
        if (bad) return { data: null, error: { code: "23502", message: `null value in column "${bad}"` } };
        out = all.filter(match);
        for (const r of out) Object.assign(r, this.payload);
      } else if (this.op === "delete") {
        out = all.filter(match);
        tables.set(this.t, all.filter((r) => !match(r)));
      } else {
        out = all.filter(match);
        if (this.sort) {
          const { c, ascending } = this.sort;
          out = [...out].sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (ascending ? 1 : -1));
        }
        if (this.max) out = out.slice(0, this.max);
      }
      const data = this.project(out);
      if (this.one === "single") return data.length ? { data: data[0], error: null } : { data: null, error: { message: "no rows" } };
      if (this.one === "maybe") return { data: data[0] || null, error: null };
      return { data: this.op === "select" || this.returning ? data : null, error: null };
    }
    then(resolve, reject) {
      try {
        resolve(this.run());
      } catch (e) {
        reject(e);
      }
    }
  }

  return { from: (t) => new Query(t), tables };
}

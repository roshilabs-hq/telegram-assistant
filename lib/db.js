import { createClient } from "@supabase/supabase-js";
import { env } from "./config.js";
import { RECURRENCE_KINDS, atWallTime } from "./time.js";

let client = null;

/** הלקוח של Supabase נוצר בפעם הראשונה שצריך אותו. בבדיקות מחליפים אותו בזיוף. */
export function db() {
  if (!client) {
    const url = env.supabaseUrl();
    const key = env.supabaseKey();
    if (!url || !key) throw new Error("חסרים פרטי החיבור ל-Supabase (SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY)");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export function useClient(fake) {
  client = fake;
}

// ---------- הגדרות ----------

export async function getSetting(key, fallback = null) {
  const { data, error } = await db().from("bot_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`settings: ${error.message}`);
  return data ? data.value : fallback;
}

export async function setSetting(key, value) {
  const { error } = await db()
    .from("bot_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`settings: ${error.message}`);
}

/** כל ההגדרות בבת אחת: נקראות פעם אחת בכל תור שיחה. */
export async function getSettings() {
  const { data, error } = await db().from("bot_settings").select("key, value");
  if (error) throw new Error(`settings: ${error.message}`);
  return Object.fromEntries((data || []).map((r) => [r.key, r.value]));
}

// ---------- היסטוריה ותיעוד ----------

export async function getHistory(chatId, limit = 20) {
  const { data } = await db()
    .from("bot_messages")
    .select("role, content")
    .eq("chat_id", chatId)
    // לפי המספר הרץ ולא לפי הזמן: שתי הודעות באותו רגע לא יתהפכו.
    .order("id", { ascending: false })
    .limit(limit);
  return (data || []).reverse();
}

export async function saveMessage(chatId, role, content) {
  await db().from("bot_messages").insert({ chat_id: chatId, role, content });
}

/** לא זורק אף פעם: תיעוד שמפיל תשובה גרוע מבלי תיעוד. */
export async function logTurn(row) {
  try {
    await db().from("bot_turns").insert(row);
  } catch (e) {
    console.error("logTurn failed", e);
  }
}

// ---------- מנעולים ----------

/**
 * "מי ראשון זוכה": המפתח הראשי במסד מכריע. משמש למניעת כפילויות (טלגרם שולח
 * עדכון שוב כשהתשובה איטית) ולשליחה אחת ביום של התדריך.
 * אם המסד לא זמין ממשיכים בכל זאת, כי כפילות נדירה עדיפה על הודעה שאבדה.
 */
export async function claim(key, payload = null) {
  const { error } = await db().from("bot_locks").insert({ key, payload });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("claim failed, continuing", key, error);
  return true;
}

export async function release(key) {
  await db().from("bot_locks").delete().eq("key", key);
}

export async function heartbeat() {
  const now = new Date().toISOString();
  await db().from("bot_locks").upsert({ key: "cron:heartbeat", created_at: now }, { onConflict: "key" });
}

export async function lastHeartbeat() {
  const { data } = await db().from("bot_locks").select("created_at").eq("key", "cron:heartbeat").maybeSingle();
  return data?.created_at ? new Date(data.created_at) : null;
}

export async function pruneLocks(days = 30) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  await db().from("bot_locks").delete().lt("created_at", cutoff).neq("key", "cron:heartbeat");
}

// ---------- תזכורות ----------

const REMINDER_FIELDS = "id, text, due_at, recurrence_kind, recurrence_interval, recurrence_until";

function recurrencePatch(input) {
  const patch = {};
  if (input.recurrence_kind !== undefined) {
    if (input.recurrence_kind === "none" || input.recurrence_kind === null) {
      Object.assign(patch, { recurrence_kind: null, recurrence_until: null, recurrence_interval: 1 });
    } else if (RECURRENCE_KINDS.includes(input.recurrence_kind)) {
      patch.recurrence_kind = input.recurrence_kind;
    } else {
      throw new Error(`recurrence_kind חייב להיות אחד מ: ${RECURRENCE_KINDS.join(", ")} או none`);
    }
  }
  if (input.recurrence_interval !== undefined) {
    patch.recurrence_interval = Math.max(1, Number(input.recurrence_interval) || 1);
  }
  if (input.recurrence_until !== undefined) patch.recurrence_until = input.recurrence_until || null;
  return patch;
}

export async function createReminder(chatId, input) {
  const row = { chat_id: chatId, text: input.text, due_at: input.due_at, done: false, ...recurrencePatch(input) };
  const { data, error } = await db().from("bot_reminders").insert(row).select(REMINDER_FIELDS).single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, ...data };
}

export async function listReminders(chatId) {
  const { data } = await db()
    .from("bot_reminders")
    .select(REMINDER_FIELDS)
    .eq("chat_id", chatId)
    .eq("done", false)
    .order("due_at", { ascending: true });
  return { reminders: data || [] };
}

export async function updateReminder(chatId, input) {
  let patch;
  try {
    patch = recurrencePatch(input);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  if (input.text !== undefined) patch.text = input.text;
  if (input.due_at !== undefined) patch.due_at = input.due_at;
  if (!Object.keys(patch).length) return { ok: false, error: "אין מה לעדכן" };
  const { data, error } = await db()
    .from("bot_reminders")
    .update(patch)
    .eq("chat_id", chatId)
    .eq("id", input.id)
    .select(REMINDER_FIELDS)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "התזכורת לא נמצאה" };
  return { ok: true, ...data };
}

export async function completeReminder(chatId, id) {
  const { data: before } = await db()
    .from("bot_reminders")
    .select("id, text, recurrence_kind")
    .eq("chat_id", chatId)
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false, error: "התזכורת לא נמצאה" };
  await db()
    .from("bot_reminders")
    .update({ done: true, recurrence_kind: null, recurrence_until: null })
    .eq("chat_id", chatId)
    .eq("id", id);
  return { ok: true, id: before.id, text: before.text, series_ended: Boolean(before.recurrence_kind) };
}

export async function deleteReminder(chatId, id) {
  const { data, error } = await db()
    .from("bot_reminders")
    .delete()
    .eq("chat_id", chatId)
    .eq("id", id)
    .select("id, text")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "התזכורת לא נמצאה" };
  return { ok: true, deleted: true, ...data };
}

/** לחיצה על כפתור מתחת לתזכורת: בוצע, נודניק, או מחר בבוקר. */
export async function reminderAction(tz, chatId, action, id, minutes = 10) {
  const { data: row } = await db()
    .from("bot_reminders")
    .select(REMINDER_FIELDS + ", chat_id, done")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  if (String(row.chat_id) !== String(chatId)) return { ok: false, error: "forbidden" };

  if (action === "done") {
    if (!row.done) await db().from("bot_reminders").update({ done: true }).eq("id", id);
    return { ok: true, action: "done", text: row.text };
  }

  const due = action === "tomorrow" ? atWallTime(tz, 1, 9) : new Date(Date.now() + minutes * 60000);

  // תזכורת חוזרת: הסדרה ממשיכה כרגיל, והנודניק הוא תזכורת חד-פעמית נוספת.
  if (row.recurrence_kind) {
    const { error } = await db()
      .from("bot_reminders")
      .insert({ chat_id: row.chat_id, text: row.text, due_at: due.toISOString(), done: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, action: "snoozed", text: row.text, due_at: due.toISOString(), kept_series: true };
  }

  const { error } = await db()
    .from("bot_reminders")
    .update({ due_at: due.toISOString(), done: false })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, action: "snoozed", text: row.text, due_at: due.toISOString(), kept_series: false };
}

/** תזכורות שהגיע זמנן. התזכורת "נתפסת" (done=true) לפני השליחה, כדי ששתי ריצות לא ישלחו אותה פעמיים. */
export async function dueReminderIds(now = new Date()) {
  const { data } = await db()
    .from("bot_reminders")
    .select("id")
    .eq("done", false)
    .lte("due_at", now.toISOString());
  return (data || []).map((r) => r.id);
}

export async function claimReminder(id) {
  const { data, error } = await db()
    .from("bot_reminders")
    .update({ done: true })
    .eq("id", id)
    .eq("done", false)
    .select(REMINDER_FIELDS + ", chat_id")
    .maybeSingle();
  return error ? null : data;
}

export async function patchReminder(id, patch) {
  const { error } = await db().from("bot_reminders").update(patch).eq("id", id);
  return !error;
}

export async function upcomingReminders(chatId, fromIso, toIso) {
  const { data } = await db()
    .from("bot_reminders")
    .select("text, due_at, recurrence_kind")
    .eq("chat_id", chatId)
    .eq("done", false)
    .gte("due_at", fromIso)
    .lt("due_at", toIso)
    .order("due_at");
  return data || [];
}

// ---------- פתקים ----------

export async function saveNote(chatId, { content, category }) {
  const { data, error } = await db()
    .from("bot_notes")
    .insert({ chat_id: chatId, content, category: category || "כללי" })
    .select("id, category, content")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, ...data };
}

/**
 * כשיש מעט פתקים, מחזירים את כולם והמודל בוחר בעצמו מה רלוונטי. זה עדיף על
 * חיפוש מילים, כי "רופא שיניים" צריך למצוא גם "דנטיסט". רק מעבר לתקציב
 * מדרגים לפי כמה ממילות החיפוש מופיעות בפתק.
 */
export async function searchNotes(chatId, query) {
  const BUDGET_CHARS = 12000;
  const { data } = await db()
    .from("bot_notes")
    .select("id, category, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(300);
  const notes = data || [];
  const total = notes.reduce((n, x) => n + (x.content?.length || 0), 0);
  if (total <= BUDGET_CHARS) {
    return {
      notes,
      complete: true,
      instruction:
        "אלה כל הפתקים השמורים, לא תוצאות חיפוש. בחר/י בעצמך מה רלוונטי, גם אם הניסוח שונה. אם אין תשובה — אמור/י את זה, אל תנחש/י.",
    };
  }
  const strip = (w) => w.replace(/^[הובלמשכ]/, "");
  const tokens = (s) =>
    String(s || "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 1);
  const wanted = [...new Set(tokens(query).map(strip))];
  const ranked = notes
    .map((n) => {
      const hay = tokens(`${n.category} ${n.content}`).map(strip);
      const hits = wanted.filter((w) => hay.some((h) => h === w || h.includes(w) || w.includes(h))).length;
      return { n, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 20)
    .map((x) => x.n);
  return {
    notes: ranked,
    complete: false,
    total_notes: notes.length,
    instruction: "אלה הפתקים הכי קרובים לשאילתה, לא בהכרח כולם. אם לא נמצא — נסה/י מילה אחרת.",
  };
}

export async function updateNote(chatId, { id, content, category }) {
  const patch = {};
  if (content !== undefined) patch.content = content;
  if (category !== undefined) patch.category = category;
  if (!Object.keys(patch).length) return { ok: false, error: "אין מה לעדכן" };
  const { data, error } = await db()
    .from("bot_notes")
    .update(patch)
    .eq("chat_id", chatId)
    .eq("id", id)
    .select("id, category, content")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "הפתק לא נמצא" };
  return { ok: true, ...data };
}

export async function deleteNote(chatId, id) {
  const { data, error } = await db()
    .from("bot_notes")
    .delete()
    .eq("chat_id", chatId)
    .eq("id", id)
    .select("id, content")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "הפתק לא נמצא" };
  return { ok: true, deleted: true, ...data };
}

// ---------- רשימות ----------

const clean = (items) =>
  (Array.isArray(items) ? items : [items]).map((i) => String(i || "").trim()).filter(Boolean);

export async function listsAll(chatId) {
  const { data, error } = await db().from("bot_lists").select("list_name, done").eq("chat_id", chatId);
  if (error) return { ok: false, error: error.message };
  const byName = new Map();
  for (const r of data || []) {
    const cur = byName.get(r.list_name) || { name: r.list_name, open: 0 };
    if (!r.done) cur.open += 1;
    byName.set(r.list_name, cur);
  }
  return { ok: true, lists: [...byName.values()] };
}

export async function listShow(chatId, listName) {
  const name = String(listName || "").trim();
  if (!name) return { ok: false, error: "חסר שם רשימה" };
  const { data, error } = await db()
    .from("bot_lists")
    .select("id, item, done")
    .eq("chat_id", chatId)
    .eq("list_name", name)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };
  const rows = data || [];
  const open = rows.filter((r) => !r.done);
  return {
    ok: true,
    list_name: name,
    text: open.map((r) => r.item).join("\n"),
    instruction: open.length
      ? "שלח/י את text כמו שהוא: כל פריט בשורה משלו, בלי פסיקים, בלי מספור ובלי שורת פתיחה."
      : "הרשימה ריקה — אמור/י זאת במשפט אחד.",
    open: open.map((r) => ({ id: r.id, item: r.item })),
    recently_done: rows.filter((r) => r.done).slice(-10).map((r) => ({ id: r.id, item: r.item })),
  };
}

export async function listAdd(chatId, listName, items) {
  const name = String(listName || "").trim();
  const list = clean(items);
  if (!name) return { ok: false, error: "חסר שם רשימה" };
  if (!list.length) return { ok: false, error: "צריך לפחות פריט אחד" };
  const { data, error } = await db()
    .from("bot_lists")
    .insert(list.map((item) => ({ chat_id: chatId, list_name: name, item, done: false })))
    .select("id, item");
  if (error) return { ok: false, error: error.message };
  return { ok: true, list_name: name, added: data || [] };
}

async function matchItems(chatId, name, wanted, doneFilter) {
  let q = db().from("bot_lists").select("id, item, done").eq("chat_id", chatId).eq("list_name", name);
  if (doneFilter !== undefined) q = q.eq("done", doneFilter);
  const { data } = await q;
  const hits = [];
  const missing = [];
  for (const want of wanted) {
    const hit = (data || []).find((r) => r.item.trim().toLowerCase() === want.toLowerCase());
    if (hit) hits.push(hit);
    else missing.push(want);
  }
  return { hits, missing };
}

export async function listCheck(chatId, listName, items, undo = false) {
  const name = String(listName || "").trim();
  const wanted = clean(items);
  if (!name) return { ok: false, error: "חסר שם רשימה" };
  if (!wanted.length) return { ok: false, error: "צריך לפחות פריט אחד" };
  const { hits, missing } = await matchItems(chatId, name, wanted, undo === true);
  for (const h of hits) {
    await db()
      .from("bot_lists")
      .update({ done: !undo, done_at: undo ? null : new Date().toISOString() })
      .eq("id", h.id);
  }
  return {
    ok: true,
    list_name: name,
    [undo ? "unchecked" : "checked"]: hits.map((h) => h.item),
    ...(missing.length ? { not_found: missing } : {}),
  };
}

export async function listRemove(chatId, listName, items, wholeList = false) {
  const name = String(listName || "").trim();
  if (!name) return { ok: false, error: "חסר שם רשימה" };
  if (wholeList) {
    const { error } = await db().from("bot_lists").delete().eq("chat_id", chatId).eq("list_name", name);
    if (error) return { ok: false, error: error.message };
    return { ok: true, removed_list: name };
  }
  const wanted = clean(items);
  if (!wanted.length) return { ok: false, error: "צריך לפחות פריט אחד" };
  const { hits, missing } = await matchItems(chatId, name, wanted);
  for (const h of hits) await db().from("bot_lists").delete().eq("id", h.id);
  return {
    ok: true,
    list_name: name,
    removed: hits.map((h) => h.item),
    ...(missing.length ? { not_found: missing } : {}),
  };
}

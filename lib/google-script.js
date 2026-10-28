/**
 * הקוד שהמשתמש מדביק ב-script.google.com (תוספת "יומן ו-Gmail").
 * הוא רץ בחשבון ה-Google שלו, ונותן לבוט גישה ליומן ולמייל רק עם הסיסמה שבתוכו.
 * משתמשים בשירותים הפנימיים (CalendarApp, GmailApp), כי אותם לא צריך להפעיל ב-Google Cloud.
 * מזהה אירוע = המזהה של Google + "|" + זמן ההתחלה, כדי שמחיקה של מופע אחד באירוע חוזר לא תמחק את כולו.
 */
export function scriptSource(secret) {
  return `// העוזר שלי: חיבור ליומן ול-Gmail. לא לשתף את הקוד הזה: הסיסמה שבו פותחת את היומן והמייל שלך.
const SECRET = ${JSON.stringify(secret)};

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: "bad request" }); }
  if (!req || req.secret !== SECRET) return out({ ok: false, code: 401, error: "unauthorized" });
  const fn = OPS[req.op];
  if (!fn) return out({ ok: false, error: "unknown op" });
  try { return out(fn(req.args || {})); } catch (err) { return out({ ok: false, error: String((err && err.message) || err) }); }
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function cal() { return CalendarApp.getDefaultCalendar(); }
function day(d) { return Utilities.formatDate(d, cal().getTimeZone(), "yyyy-MM-dd"); }

function event(ev) {
  const all = ev.isAllDayEvent();
  return {
    id: ev.getId() + "|" + ev.getStartTime().getTime(),
    title: ev.getTitle(),
    location: ev.getLocation() || null,
    start: all ? { all_day: true, date: day(ev.getAllDayStartDate()) } : { all_day: false, iso: ev.getStartTime().toISOString() },
    end: all ? { all_day: true, date: day(ev.getAllDayEndDate()) } : { all_day: false, iso: ev.getEndTime().toISOString() },
    guests: ev.getGuestList().map(function (g) { return g.getEmail(); }),
    declined: String(ev.getMyStatus()) === "NO",
  };
}

function find(id) {
  const parts = String(id).split("|");
  const t = Number(parts[1]);
  const hit = cal().getEvents(new Date(t - 1000), new Date(t + 60000)).filter(function (e) {
    return e.getId() === parts[0] && e.getStartTime().getTime() === t;
  })[0];
  if (!hit) throw new Error("האירוע לא נמצא ביומן");
  return hit;
}

function mail(m, n) {
  return {
    id: m.getId(), thread_id: m.getThread().getId(), from: m.getFrom(), to: m.getTo(), reply_to: m.getReplyTo(),
    subject: m.getSubject(), date: m.getDate().toISOString(), unread: m.isUnread(), body: m.getPlainBody().slice(0, n),
  };
}

const OPS = {
  ping: function () { return { ok: true, email: cal().getId() }; },
  list_events: function (a) {
    const from = a.time_min ? new Date(a.time_min) : new Date();
    const to = a.time_max ? new Date(a.time_max) : new Date(from.getTime() + 30 * 86400000);
    return { ok: true, events: cal().getEvents(from, to).slice(0, Math.min(Number(a.max) || 20, 50)).map(event) };
  },
  get_event: function (a) { return { ok: true, event: event(find(a.id)) }; },
  create_event: function (a) {
    const opt = {};
    if (a.location) opt.location = a.location;
    if (a.description) opt.description = a.description;
    if (a.guests && a.guests.length) { opt.guests = a.guests.join(","); opt.sendInvites = true; }
    return { ok: true, event: event(cal().createEvent(a.title || "", new Date(a.start), new Date(a.end), opt)) };
  },
  update_event: function (a) {
    const ev = find(a.id);
    if (a.title !== undefined) ev.setTitle(a.title);
    if (a.location !== undefined) ev.setLocation(a.location);
    if (a.description !== undefined) ev.setDescription(a.description);
    if (a.start) ev.setTime(new Date(a.start), new Date(a.end));
    if (a.guests) {
      ev.getGuestList().forEach(function (g) { if (a.guests.indexOf(g.getEmail()) < 0) ev.removeGuest(g.getEmail()); });
      a.guests.forEach(function (g) { ev.addGuest(g); });
    }
    return { ok: true, event: event(ev) };
  },
  delete_event: function (a) { find(a.id).deleteEvent(); return { ok: true }; },
  search_mail: function (a) {
    const max = Math.min(Math.max(Number(a.max) || 10, 1), 25);
    return { ok: true, messages: GmailApp.search(a.query || "in:inbox newer_than:7d", 0, max).map(function (t) { return mail(t.getMessages().pop(), 200); }) };
  },
  read_mail: function (a) { return { ok: true, message: mail(GmailApp.getMessageById(a.id), 6000) }; },
  draft_reply: function (a) {
    const d = GmailApp.getMessageById(a.id).createDraftReply(a.body);
    const m = d.getMessage();
    return { ok: true, draft_id: d.getId(), to: m.getTo(), subject: m.getSubject() };
  },
  get_draft: function (a) { const m = GmailApp.getDraft(a.id).getMessage(); return { ok: true, to: m.getTo(), subject: m.getSubject(), body: m.getPlainBody() }; },
  send_draft: function (a) { GmailApp.getDraft(a.id).send(); return { ok: true }; },
  send_mail: function (a) {
    const opt = {};
    if (a.cc && a.cc.length) opt.cc = [].concat(a.cc).join(",");
    GmailApp.sendEmail([].concat(a.to).join(","), a.subject || "", a.body || "", opt);
    return { ok: true };
  },
};
`;
}

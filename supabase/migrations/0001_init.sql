-- עוזר אישי בטלגרם — סכמת המסד.
-- בטוח להריץ שוב: כל פקודה בודקת אם הדבר כבר קיים.
-- RLS מופעל על כל הטבלאות ובלי מדיניות, כלומר רק השרת (מפתח ה-service) ניגש אליהן.

create table if not exists bot_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists bot_messages (
  id bigint generated always as identity primary key,
  chat_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists bot_messages_chat_idx on bot_messages (chat_id, created_at desc);

create table if not exists bot_reminders (
  id bigint generated always as identity primary key,
  chat_id text not null,
  text text not null,
  due_at timestamptz not null,
  done boolean not null default false,
  recurrence_kind text check (recurrence_kind in ('daily', 'weekly', 'monthly', 'yearly')),
  recurrence_interval int not null default 1,
  recurrence_until timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists bot_reminders_due_idx on bot_reminders (done, due_at);

create table if not exists bot_notes (
  id bigint generated always as identity primary key,
  chat_id text not null,
  category text not null default 'כללי',
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists bot_notes_chat_idx on bot_notes (chat_id, created_at desc);

create table if not exists bot_lists (
  id bigint generated always as identity primary key,
  chat_id text not null,
  list_name text not null,
  item text not null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists bot_lists_chat_idx on bot_lists (chat_id, list_name);

-- מנעולים: מונעים כפילויות (עדכון שטלגרם שלח פעמיים, תדריך שנשלח פעמיים)
-- ושומרים את "דופק" התזמון.
create table if not exists bot_locks (
  key text primary key,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- שורה לכל תור שיחה: אילו כלים רצו, כמה זמן לקח, והאם נכשל. לאבחון תקלות.
create table if not exists bot_turns (
  id bigint generated always as identity primary key,
  chat_id text,
  input_kind text,
  steps int,
  tools text[],
  in_tokens int,
  out_tokens int,
  finish_reason text,
  ms int,
  ok boolean not null default true,
  error text,
  created_at timestamptz not null default now()
);

alter table bot_settings enable row level security;
alter table bot_messages enable row level security;
alter table bot_reminders enable row level security;
alter table bot_notes enable row level security;
alter table bot_lists enable row level security;
alter table bot_locks enable row level security;
alter table bot_turns enable row level security;

-- ה-API של Supabase שומר רשימת טבלאות בזיכרון. בלי הרענון הזה, הבקשה הראשונה אחרי
-- יצירת הטבלאות נכשלת ב-"Could not find the table ... in the schema cache".
notify pgrst, 'reload schema';

import { createHmac } from "node:crypto";

/**
 * כל משתני הסביבה במקום אחד.
 *
 * כמה ערכים מגיעים בכמה שמות אפשריים: אינטגרציית Supabase של Vercel יוצרת
 * שמות משלה, ומי שמקים ידנית מעתיק שמות מהדשבורד של Supabase. מקבלים את כולם
 * כדי שאף אחד לא ייתקע על שם של משתנה.
 */
const first = (...names) => {
  for (const n of names) {
    const v = process.env[n];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

export const env = {
  telegramToken: () => first("TELEGRAM_TOKEN", "TELEGRAM_BOT_TOKEN"),
  aiKey: () =>
    first("AI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"),
  aiProvider: () => first("AI_PROVIDER").toLowerCase(),
  aiModel: () => first("AI_MODEL"),
  setupPassword: () => first("SETUP_PASSWORD"),
  supabaseUrl: () => first("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  supabaseKey: () =>
    first("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_KEY"),
  databaseUrl: () =>
    first("POSTGRES_URL_NON_POOLING", "SUPABASE_DB_URL", "DATABASE_URL", "POSTGRES_URL"),
  groqKey: () => first("GROQ_API_KEY"),
  googleClientId: () => first("GOOGLE_CLIENT_ID"),
  googleClientSecret: () => first("GOOGLE_CLIENT_SECRET"),
  extraChatIds: () =>
    first("ALLOWED_CHAT_IDS")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  timezone: () => first("TIMEZONE") || "Asia/Jerusalem",
};

/**
 * הסודות של ה-webhook ושל התזמון נגזרים מסיסמת ההקמה, כדי שהמשתמש ימלא
 * בטופס שדה אחד במקום שלושה. החלפת הסיסמה מחייבת ללחוץ שוב על הכפתורים
 * בעמוד /setup, והעמוד מראה את זה כאיקס אדום.
 */
function derive(purpose) {
  const pw = env.setupPassword();
  if (!pw) return "";
  return createHmac("sha256", pw).update(`telegram-assistant:${purpose}`).digest("hex");
}

export const secrets = {
  webhook: () => derive("telegram-webhook"),
  cron: () => derive("cron"),
  session: () => derive("setup-session"),
};

/** הכתובת הקבועה של המוצר, לא כתובת של פריסה אחת. */
export function baseUrl(req) {
  const prod = first("VERCEL_PROJECT_PRODUCTION_URL", "PUBLIC_BASE_URL");
  if (prod) return prod.startsWith("http") ? prod.replace(/\/+$/, "") : `https://${prod}`;
  const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host;
  return host ? `https://${host}` : "";
}

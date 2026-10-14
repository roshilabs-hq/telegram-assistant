import { MockLanguageModelV4 } from "ai/test";
import { createFake } from "./fake-supabase.js";
import { useClient } from "../lib/db.js";
import { useTestModel } from "../lib/ai.js";

const usage = () => ({
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
});

/**
 * מודל מזויף שעונה לפי תסריט: כל פריט הוא תשובה אחת של המודל.
 *   { text: "..." }                       תשובה סופית
 *   { tool: "create_reminder", input: {} } הפעלת כלי
 */
export function scriptedModel(script) {
  let i = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      const s = script[Math.min(i++, script.length - 1)];
      if (s.tool) {
        return {
          content: [{ type: "tool-call", toolCallId: `call-${i}`, toolName: s.tool, input: JSON.stringify(s.input || {}) }],
          finishReason: { unified: "tool-calls", raw: "tool_use" },
          usage: usage(),
          warnings: [],
        };
      }
      return {
        content: [{ type: "text", text: s.text }],
        finishReason: { unified: "stop", raw: "end_turn" },
        usage: usage(),
        warnings: [],
      };
    },
  });
  useTestModel(model);
  return model;
}

/** סביבה נקייה לכל בדיקה: מסד מזויף, משתני סביבה, ו-fetch שנרשם במקום לצאת לרשת. */
export function freshEnv(extra = {}) {
  const fake = createFake();
  useClient(fake);
  useTestModel(null);
  for (const k of ["TELEGRAM_TOKEN", "AI_API_KEY", "SETUP_PASSWORD", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GROQ_API_KEY", "ALLOWED_CHAT_IDS", "TIMEZONE", "VERCEL_PROJECT_PRODUCTION_URL", "POSTGRES_URL_NON_POOLING", "AI_MODEL", "AI_PROVIDER", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
    delete process.env[k];
  }
  Object.assign(process.env, {
    TELEGRAM_TOKEN: "123456789:AAH-test-token-test-token-test-token",
    AI_API_KEY: "AIza-test",
    SETUP_PASSWORD: "correct-horse",
    SUPABASE_URL: "https://abcdefgh.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    VERCEL_PROJECT_PRODUCTION_URL: "bot.example.vercel.app",
    ...extra,
  });
  const sent = [];
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
    sent.push({ url: String(url), body });
    const method = String(url).split("/").pop();
    const result =
      method === "getMe"
        ? { id: 1, username: "test_helper_bot" }
        : method === "getWebhookInfo"
          ? { url: "" }
          : { message_id: 1 };
    return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
  };
  return { fake, sent, tables: fake.tables };
}

/** req/res מינימליים בסגנון Vercel. */
export function mockReq({ method = "POST", headers = {}, body = {}, query = {} } = {}) {
  return { method, headers, body, query };
}

export function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
      return this;
    },
    send(b) {
      this.body = b;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    redirect(c, loc) {
      this.statusCode = c;
      this.headers.location = loc;
      return this;
    },
  };
  return res;
}

export const telegramCalls = (sent, method) => sent.filter((s) => s.url.endsWith(`/${method}`)).map((s) => s.body);

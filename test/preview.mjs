/**
 * תצוגה מקומית של עמוד ההקמה, עם מסד מזויף ובלי לצאת לרשת. לבדיקה בעין.
 *   node test/preview.mjs [state]   state: fresh | half | brain | done
 */
import { createServer } from "node:http";
import { freshEnv } from "./helpers.js";
import * as store from "../lib/db.js";
import setup from "../api/setup.js";

const state = process.argv[2] || "half";
freshEnv({ GOOGLE_CLIENT_ID: state === "done" ? "x" : "" });
const telegram = globalThis.fetch;
globalThis.fetch = async (url, init) =>
  String(url).endsWith("/getWebhookInfo") && state !== "fresh"
    ? new Response(JSON.stringify({ ok: true, result: { url: "https://bot.example.vercel.app/api/telegram" } }))
    : String(url).includes("googleapis")
      ? new Response(JSON.stringify({ access_token: "a", expires_in: 3600 }))
      : telegram(url, init);
if (state !== "fresh") {
  await store.setSetting("ai_model", "gemini-2.5-flash");
  await store.setSetting("ai_provider", "google");
  await store.heartbeat();
}
if (state === "brain") {
  // הכול מוכן חוץ מהמפתח של Claude ("המוח בסוף")
  delete process.env.AI_API_KEY;
  await store.setSetting("owner_chat_id", "42");
}
if (state === "done") {
  await store.setSetting("owner_chat_id", "42");
  await store.setSetting("owner_name", "דנה");
  await store.setSetting("briefing_time", "07:30");
  await store.setSetting("google", { refresh_token: "r", email: "dana@example.com" });
}

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
  const url = new URL(req.url, "http://x");
  req.query = Object.fromEntries(url.searchParams);
  req.body = body;
  req.headers.cookie = `setup_session=${(await import("../lib/config.js")).secrets.session()}`;
  res.status = (c) => ((res.statusCode = c), res);
  res.send = (b) => res.end(b);
  res.json = (b) => res.end(JSON.stringify(b));
  res.redirect = (c, l) => (res.writeHead(c, { location: l }), res.end());
  await setup(req, res);
}).listen(4321, () => console.log(`http://localhost:4321/setup (${state})`));

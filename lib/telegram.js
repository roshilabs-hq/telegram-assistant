import { env } from "./config.js";

const API = () => `https://api.telegram.org/bot${env.telegramToken()}`;

async function call(method, body) {
  const r = await fetch(`${API()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}

export async function sendMessage(chatId, text, options = {}) {
  const payload = { chat_id: chatId, text, disable_web_page_preview: true, ...options };
  // Markdown הופך [טקסט](קישור) לקישור לחיץ. טלגרם דוחה את כל ההודעה אם יש בה
  // * או _ לא מאוזנים, וזה קורה בעברית רגילה מדי פעם. אז מנסים Markdown, ואם
  // נדחה, שולחים את אותו טקסט בלי עיצוב.
  let r = await call("sendMessage", { ...payload, parse_mode: "Markdown" });
  if (r.status === 400) r = await call("sendMessage", payload);
  if (!r.ok) throw new Error(`Telegram sendMessage ${r.status}: ${r.description || ""}`);
  return r.result;
}

export async function sendTyping(chatId) {
  await call("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}

/** טלגרם מסובב את הכפתור עד שעונים, אז עונים תמיד, גם בכישלון. */
export async function answerCallback(callbackId, text) {
  await call("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) }).catch(() => {});
}

/** משכתב את הודעת התזכורת ומוריד את הכפתורים, כדי שבשיחה יישאר מה שהוחלט. */
export async function editMessageText(chatId, messageId, text) {
  await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: { inline_keyboard: [] },
  }).catch(() => {});
}

export async function getMe() {
  return call("getMe");
}

export async function getWebhookInfo() {
  return call("getWebhookInfo");
}

export async function setWebhook(url, secretToken) {
  return call("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
}

/** מוריד קובץ (למשל הודעה קולית). הטוקן נמצא בכתובת, ולכן היא לא יוצאת מהפונקציה. */
export async function downloadFile(fileId) {
  const meta = await call("getFile", { file_id: fileId });
  if (!meta.ok) throw new Error(`Telegram getFile: ${meta.description || meta.status}`);
  const r = await fetch(`https://api.telegram.org/file/bot${env.telegramToken()}/${meta.result.file_path}`);
  if (!r.ok) throw new Error(`Telegram file download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

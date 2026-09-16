const channels = require("../../shared/ipc/channels");
const configService = require("../services/config-service");
const aiService = require("../services/ai-service");

function buildReasoningOptions(level) {
  switch (level) {
    case "None":
      return { effort: "none", exclude: true };
    case "Low":
      return { effort: "low" };
    case "Medium":
      return { effort: "medium" };
    case "High":
      return { effort: "high" };
    case "Ultra High":
      return { max_tokens: 16000 };
    default:
      return { effort: "none", exclude: true };
  }
}

function safeSend(sender, channel, payload) {
  if (!sender || sender.isDestroyed()) return;
  sender.send(channel, payload);
}

function createDeltaBatcher(sender, channel, flushMs = 50) {
  let buffer = "";
  let timer = null;

  const flush = () => {
    timer = null;
    if (!buffer) return;
    const delta = buffer;
    buffer = "";
    safeSend(sender, channel, { delta });
  };

  return {
    push(chunk) {
      if (!chunk) return;
      buffer += chunk;
      if (!timer) timer = setTimeout(flush, flushMs);
    },
    flush,
  };
}

function SendMessage({ messages } = {}, sender) {
  const apiKey = configService.get("apiKey");
  const model = configService.get("model");
  const apiUrl = configService.get("apiUrl") || aiService.DEFAULT_API_URL;
  const reasoningLevel = configService.get("reasoning") || "None";
  const reasoningOptions = buildReasoningOptions(reasoningLevel);

  if (!Array.isArray(messages) || messages.length === 0) {
    safeSend(sender, channels.CHAT_ERROR, { message: "No messages to send." });
    return { ok: false };
  }

  console.log("[chat-middleware] SendMessage → starting stream", {
    apiUrl,
    model,
    reasoningLevel,
    messageCount: messages.length,
    promptChars: messages.reduce(
      (sum, m) => sum + (typeof m?.content === "string" ? m.content.length : 0),
      0
    ),
  });

  const contentBatcher = createDeltaBatcher(sender, channels.CHAT_DELTA, 50);
  const reasoningBatcher =
    reasoningLevel !== "None"
      ? createDeltaBatcher(sender, channels.CHAT_REASONING_DELTA, 50)
      : null;

  aiService.streamChat(
    messages,
    model,
    apiKey,
    apiUrl,
    reasoningOptions,
    (delta) => contentBatcher.push(delta),
    () => {
      reasoningBatcher?.flush();
      contentBatcher.flush();
      safeSend(sender, channels.CHAT_DONE, {});
    },
    (err) => {
      reasoningBatcher?.flush();
      contentBatcher.flush();
      const message = err?.message || String(err);
      console.error("[chat-middleware] SendMessage: API request failed", {
        model,
        reasoningLevel,
        messageCount: messages.length,
        error: message,
      });
      safeSend(sender, channels.CHAT_ERROR, { message });
    },
    (delta) => reasoningBatcher?.push(delta)
  );

  return { ok: true };
}

module.exports = { SendMessage };

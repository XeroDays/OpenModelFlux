const form = document.getElementById("config-form");
const apiUrlInput = document.getElementById("api-url");
const apiKeyInput = document.getElementById("api-key");
const modelInput = document.getElementById("model");
const reasoningSelect = document.getElementById("reasoning");
const errorEl = document.getElementById("form-error");

function isValidApiUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function loadSavedConfig() {
  try {
    const [apiUrl, apiKey, model, reasoning] = await Promise.all([
      window.electronAPI?.getConfig?.("apiUrl"),
      window.electronAPI?.getConfig?.("apiKey"),
      window.electronAPI?.getConfig?.("model"),
      window.electronAPI?.getConfig?.("reasoning"),
    ]);

    if (apiUrl) apiUrlInput.value = apiUrl;
    if (apiKey) apiKeyInput.value = apiKey;
    if (model) modelInput.value = model;
    if (reasoning) reasoningSelect.value = reasoning;
  } catch (err) {
    console.warn("[app] Failed to load saved config:", err);
  }
}

function showError(message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");

  const apiUrl = apiUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim();
  const reasoning = reasoningSelect.value;

  if (!apiUrl) {
    showError("Please enter an API URL.");
    return;
  }
  if (!isValidApiUrl(apiUrl)) {
    showError("Please enter a valid http or https API URL.");
    return;
  }
  if (!apiKey) {
    showError("Please enter your API key.");
    return;
  }
  if (!model) {
    showError("Please enter a model name.");
    return;
  }

  try {
    await window.electronAPI.saveConfig({ apiUrl, apiKey, model, reasoning });
    window.location.href = "screens/chat/index.html";
  } catch (err) {
    showError(err?.message || "Failed to save configuration.");
  }
});

document.addEventListener("DOMContentLoaded", loadSavedConfig);

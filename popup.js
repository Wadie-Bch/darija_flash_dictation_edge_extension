let recording = false;

const statusEl = document.getElementById("status");
const toggleEl = document.getElementById("toggle");
const optionsEl = document.getElementById("options");
const errorEl = document.getElementById("error");

function render() {
  statusEl.textContent = recording ? "🔴 Recording…" : "⚪ Ready";
  toggleEl.textContent = recording ? "Stop recording" : "Start recording";
}

function showError(message) {
  errorEl.textContent = message || "";
}

async function init() {
  // Guard: chrome.storage can be undefined if the service worker crashed.
  // Tell the user to reload the extension if that happens.
  if (!chrome.storage?.local) {
    showError("Extension error — please go to edge://extensions and reload the extension.");
    return;
  }

  const settings = await chrome.storage.local.get({ apiKey: "" });
  if (!settings.apiKey) {
    showError("No API key configured yet.");
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "RECORDING_STATUS") {
      recording = !!message.recording;
      render();
    }
    if (message.type === "TRANSCRIPTION_ERROR") {
      showError(message.error || "Unknown error.");
    }
  });

  chrome.runtime.sendMessage({ type: "GET_STATE" }).catch(() => {});
}

toggleEl.addEventListener("click", async () => {
  showError("");
  const response = await chrome.runtime.sendMessage({ type: "TOGGLE_RECORDING" });
  if (!response?.ok && response?.error) showError(response.error);
  recording = !!response?.recording;
  render();
});

optionsEl.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

init().catch((e) => showError(e.message || String(e)));
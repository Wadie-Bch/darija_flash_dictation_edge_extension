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

// Listen for status updates from the extension at all times.
// This listener is registered unconditionally so it works even
// if init() bails out due to a broken context.
try {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "RECORDING_STATUS") {
      recording = !!message.recording;
      render();
    }
    if (message.type === "TRANSCRIPTION_ERROR") {
      showError(message.error || "Unknown error.");
    }
  });
} catch {}

async function init() {
  // Guard: chrome.storage can be undefined if the service worker crashed
  // or the extension context was invalidated.
  try {
    if (!chrome?.storage?.local) {
      showError("Extension context lost. Close this popup, go to edge://extensions, click Reload (↻), then try again.");
      return;
    }
    const settings = await chrome.storage.local.get({ apiKey: "" });
    if (!settings.apiKey) {
      showError("No API key configured yet. Click 'Open Options' below.");
    }
  } catch (e) {
    showError("Extension context lost. Close this popup, go to edge://extensions, click Reload (↻), then try again.");
    return;
  }

  chrome.runtime.sendMessage({ type: "GET_STATE" }).catch(() => {});
}

toggleEl.addEventListener("click", async () => {
  showError("");
  try {
    const response = await chrome.runtime.sendMessage({ type: "TOGGLE_RECORDING" });
    if (!response?.ok && response?.error) showError(response.error);
    recording = !!response?.recording;
    render();
  } catch (e) {
    showError("Extension context lost. Close this popup, reload the extension, then try again.");
  }
});

optionsEl.addEventListener("click", () => {
  try {
    chrome.runtime.openOptionsPage();
  } catch {
    showError("Cannot open options. Reload the extension first.");
  }
});

init();
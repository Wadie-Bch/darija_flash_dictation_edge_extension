const OFFSCREEN_URL = "offscreen.html";

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({});
  const exists = contexts.some(c => c.contextType === "OFFSCREEN_DOCUMENT");
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["USER_MEDIA"],
      justification: "Record microphone audio for Darija dictation."
    });
  }
}

// Send a message specifically to the offscreen document using a _target flag.
// Offscreen ignores messages without _target:"offscreen", background ignores those with it.
// This prevents the recursive loop where background re-handles its own forwarded messages.
async function forwardToOffscreen(type, extra = {}) {
  await ensureOffscreen();
  return chrome.runtime.sendMessage({ ...extra, type, _target: "offscreen" });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0];
}

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-recording") return;
  await forwardToOffscreen("OFFSCREEN_TOGGLE").catch(() => {});
});

// Single onMessage listener — background only handles messages NOT targeted at offscreen.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message._target === "offscreen") return; // let offscreen handle these

  (async () => {
    try {
      // Messages from offscreen (RECORDING_STATUS, TRANSCRIPTION_ERROR) are already
      // received by popup directly via chrome.runtime.sendMessage broadcast.
      // Background does NOT need to re-broadcast them.
      if (message.type === "RECORDING_STATUS" || message.type === "TRANSCRIPTION_ERROR") {
        sendResponse({ ok: true });
        return;
      }

      // Transcription result → inject into the active tab
      if (message.type === "TRANSCRIPTION_READY") {
        const tab = await getActiveTab();
        if (tab?.id != null) {
          chrome.tabs.sendMessage(tab.id, {
            type: "INJECT_TEXT",
            text: message.text || ""
          }).catch(() => {});
        }
        sendResponse({ ok: true });
        return;
      }

      // Popup requests toggle → forward to offscreen with distinct type
      if (message.type === "TOGGLE_RECORDING") {
        const result = await forwardToOffscreen("OFFSCREEN_TOGGLE");
        sendResponse(result ?? { ok: true });
        return;
      }

      // Popup requests current recording state
      if (message.type === "GET_STATE") {
        const result = await forwardToOffscreen("OFFSCREEN_GET_STATE");
        sendResponse(result ?? { ok: true });
        return;
      }

      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || String(error) });
    }
  })();
  return true; // keep message channel open for async sendResponse
});
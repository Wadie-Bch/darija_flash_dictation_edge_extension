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

async function sendToOffscreen(message) {
  await ensureOffscreen();
  return chrome.runtime.sendMessage(message);
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0];
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-recording") return;
  await sendToOffscreen({ type: "TOGGLE_RECORDING" });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "RECORDING_STATUS") {
        chrome.runtime.sendMessage(message).catch(() => {});
        return;
      }

      if (message.type === "TRANSCRIPTION_READY") {
        const tab = await getActiveTab();
        if (tab?.id != null) {
          chrome.tabs.sendMessage(tab.id, {
            type: "INJECT_TEXT",
            text: message.text || ""
          }).catch(() => {});
        }
        return;
      }

      if (message.type === "TRANSCRIPTION_ERROR") {
        chrome.runtime.sendMessage(message).catch(() => {});
        return;
      }
    } catch (error) {
      chrome.runtime.sendMessage({
        type: "TRANSCRIPTION_ERROR",
        error: error?.message || String(error)
      }).catch(() => {});
    }
  })();
  sendResponse({ ok: true });
  return true;
});

// Keep a small status bridge so popup can query current state.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATE") {
    sendToOffscreen({ type: "GET_STATE" })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});
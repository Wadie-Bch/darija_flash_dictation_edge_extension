let mediaRecorder = null;
let mediaStream = null;
let chunks = [];
let recording = false;

const DEFAULT_MODEL = "gemini-2.0-flash";

async function getSettings() {
  return await chrome.storage.local.get({
    apiKey: "",
    model: DEFAULT_MODEL,
    punctuation: true
  });
}

async function setState(state) {
  await chrome.storage.local.set({ recording: state });
  chrome.runtime.sendMessage({
    type: "RECORDING_STATUS",
    recording: state
  }).catch(() => {});
}

function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus"
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

function getExtension(mimeType) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

async function startRecording() {
  if (recording) return;

  const settings = await getSettings();
  if (!settings.apiKey) {
    chrome.runtime.sendMessage({
      type: "TRANSCRIPTION_ERROR",
      error: "No Gemini API key configured. Open extension Options and add your key."
    }).catch(() => {});
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    mediaRecorder = mimeType
      ? new MediaRecorder(mediaStream, { mimeType })
      : new MediaRecorder(mediaStream);

    chunks = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      try {
        const actualMime = mediaRecorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: actualMime });
        chunks = [];

        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
          mediaStream = null;
        }

        await transcribe(blob, actualMime);
      } catch (error) {
        chrome.runtime.sendMessage({
          type: "TRANSCRIPTION_ERROR",
          error: error?.message || String(error)
        }).catch(() => {});
      } finally {
        mediaRecorder = null;
      }
    };

    mediaRecorder.start(250);
    recording = true;
    await setState(true);
  } catch (error) {
    recording = false;
    await setState(false);
    chrome.runtime.sendMessage({
      type: "TRANSCRIPTION_ERROR",
      error: `Microphone error: ${error?.message || String(error)}`
    }).catch(() => {});
  }
}

async function stopRecording() {
  if (!recording || !mediaRecorder) return;
  recording = false;
  await setState(false);
  mediaRecorder.stop();
}

async function transcribe(blob, mimeType) {
  const settings = await getSettings();
  if (!settings.apiKey) throw new Error("Missing Gemini API key.");

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  const base64Audio = btoa(binary);

  const prompt = `
You are a Moroccan Darija speech transcription engine.

Task:
1. Listen to the provided Moroccan Darija audio.
2. Transcribe exactly what the speaker said.
3. Output Moroccan Darija written in Arabic script.
4. Example: "fin akhoya" -> "فين أخويا"
5. Prefer natural Moroccan spelling and keep common Darija words as Darija, not Modern Standard Arabic.
6. Do NOT translate, summarize, explain, correct, or add words.
7. Return ONLY the transcription text, with no quotation marks and no commentary.
8. If there are clear punctuation boundaries, use natural punctuation.
9. Preserve names and technical/product names when they are spoken; transliterate them sensibly into Arabic when appropriate.
`;

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model || DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;

  const body = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Audio
          }
        }
      ]
    }],
    generationConfig: {
      responseMimeType: "text/plain"
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Gemini returned non-JSON response (${response.status}).`);
  }

  if (!response.ok) {
    const msg =
      data?.error?.message ||
      data?.error?.status ||
      `Gemini API error (${response.status})`;
    throw new Error(msg);
  }

  const text = (data?.candidates || [])
    .flatMap(candidate => candidate?.content?.parts || [])
    .map(part => part?.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty transcription.");
  }

  chrome.runtime.sendMessage({
    type: "TRANSCRIPTION_READY",
    text
  }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "TOGGLE_RECORDING") {
        if (recording) await stopRecording();
        else await startRecording();
        sendResponse({ ok: true, recording });
        return;
      }

      if (message.type === "GET_STATE") {
        chrome.runtime.sendMessage({
          type: "RECORDING_STATUS",
          recording
        }).catch(() => {});
        sendResponse({ ok: true, recording });
      }
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || String(error) });
    }
  })();
  return true;
});

setState(false).catch(() => {});
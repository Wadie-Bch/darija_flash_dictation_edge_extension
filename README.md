# Darija Flash Dictation — Edge Extension

A Manifest V3 Edge extension that lets you:

1. Focus any text field.
2. Press `Ctrl+Shift+Space`.
3. Speak Moroccan Darija.
4. Press `Ctrl+Shift+Space` again.
5. The extension sends the recorded audio to Gemini and injects the returned Darija Arabic text at the cursor.

Example:

`fin akhoya` → `فين أخويا`

## Model

Default: `gemini-3.6-flash`

Fallbacks available in Options:
- `gemini-3.6-flash`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`

## Install in Microsoft Edge

1. Open `edge://extensions/`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this extracted folder.
5. Open the extension's Options page.
6. Paste your Gemini API key and save.
7. Click a text box anywhere on a web page.
8. Press `Ctrl+Shift+Space`.

## Important

- The API key is stored in `chrome.storage.local`.
- Audio is recorded locally in the browser until recording stops.
- Audio is then sent directly to the Gemini API.
- This is a personal/local extension. Do not distribute an API key inside the extension package.
- Some protected browser pages (`edge://...`, extension stores, etc.) do not allow content scripts.

## Notes

The extension uses the Chrome/Chromium `commands`, `offscreen`, `storage`, and `activeTab` APIs, which are supported by modern Edge because Edge is Chromium-based.

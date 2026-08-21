(() => {
  let lastFocusedElement = null;

  function rememberFocus(event) {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable
    ) {
      lastFocusedElement = target;
    }
  }

  document.addEventListener("focusin", rememberFocus, true);
  document.addEventListener("click", rememberFocus, true);
  document.addEventListener("input", rememberFocus, true);

  function insertIntoInput(el, text) {
    const value = el.value ?? "";
    const start = typeof el.selectionStart === "number" ? el.selectionStart : value.length;
    const end = typeof el.selectionEnd === "number" ? el.selectionEnd : value.length;

    const nextValue = value.slice(0, start) + text + value.slice(end);

    const setter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value"
    )?.set;

    if (setter) setter.call(el, nextValue);
    else el.value = nextValue;

    const cursor = start + text.length;
    try {
      el.setSelectionRange(cursor, cursor);
    } catch {}

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function insertIntoContentEditable(el, text) {
    el.focus();
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      el.appendChild(document.createTextNode(text));
      return;
    }

    const range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) {
      el.appendChild(document.createTextNode(text));
      return;
    }

    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    el.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text
    }));
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "INJECT_TEXT") return;

    const text = String(message.text || "").trim();
    if (!text) return;

    const el = lastFocusedElement || document.activeElement;

    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      insertIntoInput(el, text);
      el.focus();
    } else if (el?.isContentEditable) {
      insertIntoContentEditable(el, text);
      el.focus();
    } else {
      // Best-effort fallback: put the text on the clipboard, then paste.
      navigator.clipboard?.writeText(text).catch(() => {});
    }
  });
})();
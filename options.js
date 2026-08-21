const apiKey = document.getElementById("apiKey");
const model = document.getElementById("model");
const save = document.getElementById("save");
const saved = document.getElementById("saved");

async function load() {
  const settings = await chrome.storage.local.get({
    apiKey: "",
    model: "gemini-3.6-flash"
  });
  apiKey.value = settings.apiKey;
  model.value = settings.model;
}

save.addEventListener("click", async () => {
  await chrome.storage.local.set({
    apiKey: apiKey.value.trim(),
    model: model.value
  });
  saved.textContent = "Saved.";
  setTimeout(() => saved.textContent = "", 1600);
});

load();
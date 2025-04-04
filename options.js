const apiKeyInput = document.getElementById("groqApiKeyInput"); // HTML'deki ID ile eşleşmeli
const saveBtn = document.getElementById("saveBtn");
const statusDiv = document.getElementById("status");

// Sayfa yüklendiğinde kayıtlı anahtarı göster (varsa)
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["groqApiKey"], (result) => {
    // Groq anahtarını oku
    if (result.groqApiKey) {
      apiKeyInput.value = result.groqApiKey;
    }
  });
});

saveBtn.addEventListener("click", () => {
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) {
    chrome.storage.sync.set({ groqApiKey: apiKey }, () => {
      // Groq anahtarını kaydet
      statusDiv.textContent = "Groq API Anahtarı kaydedildi!";
      statusDiv.style.color = "green";
      setTimeout(() => {
        statusDiv.textContent = "";
      }, 3000);
    });
  } else {
    statusDiv.textContent = "Lütfen geçerli bir Groq API anahtarı girin.";
    statusDiv.style.color = "red";
  }
});

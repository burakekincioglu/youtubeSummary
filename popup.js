// popup.js (Sıralı Özetleme ve Ham Transkript Gösterimi - Tek Alan)

document.addEventListener("DOMContentLoaded", () => {
  const getSummaryBtn = document.getElementById("getSummaryBtn");
  const showTranscriptBtn = document.getElementById("showTranscriptBtn");
  const summaryDiv = document.getElementById("summary-content");
  const statusDiv = document.getElementById("status");
  const loadingDiv = document.getElementById("loading");

  // --- Özet Getirme Butonu ---
  getSummaryBtn.addEventListener("click", () => {
    startProcess("Tam özet getiriliyor...", "getSummary");
  });

  // --- Sadece Transkript Gösterme Butonu ---
  showTranscriptBtn.addEventListener("click", () => {
    startProcess("Transkript getiriliyor...", "getRawTranscript");
  });

  // --- İşlemi Başlatan Fonksiyon ---
  function startProcess(loadingText, actionName) {
    statusDiv.textContent = loadingText;
    summaryDiv.innerHTML = ""; // İçeriği temizle (HTML ekleyebiliriz)
    summaryDiv.scrollTop = 0;
    loadingDiv.style.display = "block";
    getSummaryBtn.disabled = true;
    showTranscriptBtn.disabled = true;
    getSummaryBtn.textContent = "İşleniyor...";
    showTranscriptBtn.textContent = "İşleniyor...";

    chrome.runtime.sendMessage({ action: actionName }, (response) => {
      // Sadece ilk veya doğrudan hatayı ele al
      if (chrome.runtime.lastError) {
        handleFinalUpdate({
          error: `İlk iletişim hatası: ${chrome.runtime.lastError.message}`,
          finished: true,
        });
      } else if (response && response.error) {
        handleFinalUpdate(response); // Eğer background hemen hata döndürdüyse
      }
      // Diğer yanıtlar onMessage ile gelecek
    });
  }

  // --- Background'dan Gelen Yanıtları Dinle ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Artık tek bir action adı kullanıyoruz: updatePopup
    if (message.action === "updatePopup") {
      handleUpdate(message);
    }
  });

  // --- Gelen Güncellemeleri İşleyen Fonksiyon ---
  function handleUpdate(response) {
    const isFinished = response.finished;

    // Durum mesajını güncelle
    if (response.status) {
      statusDiv.textContent = response.status;
    }

    // Eğer birleştirilmiş/tam özet veya ham transkript geldiyse göster
    if (response.summary) {
      // Birleştirilmiş özet
      summaryDiv.innerHTML = ""; // Önce temizle
      // Parçaları ayırmak için HTML'i ayrıştırıp formatlayabiliriz
      const parts = response.summary.split(/--- Bölüm \d+ ---/);
      parts.forEach((part, index) => {
        const trimmedPart = part.trim();
        if (trimmedPart) {
          if (index > 0) {
            // İlk parçadan önce ayraç koyma
            const separator = document.createElement("div");
            separator.className = "summary-part-separator";
            separator.textContent = `--- Bölüm ${index} ---`; // Bölüm numarasını index'ten al
            summaryDiv.appendChild(separator);
          }
          const partNode = document.createTextNode(trimmedPart + "\n\n");
          // Hata mesajlarını farklı renkte göster
          if (
            trimmedPart.includes("Özetlenemedi:") ||
            trimmedPart.includes("(HATA)")
          ) {
            const errorSpan = document.createElement("span");
            errorSpan.style.color = "red";
            errorSpan.style.fontWeight = "bold";
            errorSpan.appendChild(partNode);
            summaryDiv.appendChild(errorSpan);
          } else {
            summaryDiv.appendChild(partNode);
          }
        }
      });
      summaryDiv.scrollTop = summaryDiv.scrollHeight; // En sona kaydır
    } else if (response.transcript) {
      // Ham transkript
      summaryDiv.textContent = response.transcript;
      summaryDiv.scrollTop = 0;
    }

    // Hata mesajı (genel hata)
    if (response.error && !response.summary && !response.transcript) {
      // Eğer özet veya transkript yoksa bu genel hatadır
      summaryDiv.innerHTML = `<div class="error-text">[Hata]: ${response.error}</div>`;
      statusDiv.textContent = "Bir hata oluştu.";
    }

    // İşlem bittiyse UI'ı sonlandır
    if (isFinished) {
      handleFinalUpdate(response);
    }
  }

  // --- İşlemi Bitiren UI Fonksiyonu ---
  function handleFinalUpdate(response) {
    loadingDiv.style.display = "none";
    getSummaryBtn.disabled = false;
    showTranscriptBtn.disabled = false;
    getSummaryBtn.textContent = "Tam Özeti Getir";
    showTranscriptBtn.textContent = "Sadece Transkripti Göster";

    // Durum mesajını son hale getir
    if (response.status) {
      statusDiv.textContent = response.status;
    } else if (response.error) {
      statusDiv.textContent = "İşlem hatayla tamamlandı.";
    } else if (response.transcript) {
      statusDiv.textContent = "Transkript başarıyla alındı.";
    } else {
      statusDiv.textContent = "İşlem tamamlandı.";
    }
    console.log("İşlem bitti. Son yanıt:", response);
  }

  // Popup ilk açıldığında
  statusDiv.textContent = "";
  summaryDiv.textContent = "Bir işlem seçin (Özet veya Transkript).";
  loadingDiv.style.display = "none";
});

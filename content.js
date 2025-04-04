// content.js (Paylaşılan HTML yapısına göre güncellendi)
console.log("YT Özetleyici: Content Script Aktif.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTranscript") {
    getTranscriptText()
      .then((transcript) => {
        sendResponse({ transcript: transcript });
      })
      .catch((error) => {
        console.error(
          "Transkript alma hatası (content script):",
          error.message
        );
        // Hata mesajını daha spesifik hale getir
        sendResponse({
          transcript: null,
          error: `Content Script Hatası: ${error.message}`,
        });
      });
    return true; // Asenkron yanıt için gerekli
  }
});

async function getTranscriptText() {
  console.log("Transkript alma işlemi başlatıldı (HTML Bilgisiyle)...");
  try {
    // 1. ADIM: "...daha fazla" butonunu bul ve tıkla (açıklamayı genişletmek için)
    const expandButton = document.querySelector(
      "tp-yt-paper-button#expand.ytd-text-inline-expander"
    );
    if (expandButton && expandButton.offsetParent !== null) {
      console.log("'...daha fazla' butonu bulundu, tıklanıyor...");
      expandButton.click();
      await sleep(750);
    } else {
      console.log("'...daha fazla' butonu bulunamadı veya zaten açık.");
    }

    // 2. ADIM: "Transkripti göster" butonunu bul ve tıkla
    const transcriptShowButtonSelector =
      "button[aria-label='Transkripti göster']";
    let transcriptShowButton = await waitForElement(
      transcriptShowButtonSelector,
      7000
    );

    if (!transcriptShowButton) {
      console.warn(
        "Aria-label ile 'Transkripti göster' butonu bulunamadı. Metin içeriği ile deneniyor..."
      );
      const buttons = document.querySelectorAll(
        "button .yt-core-attributed-string"
      );
      for (let btnSpan of buttons) {
        if (
          btnSpan.textContent.trim() === "Transkripti göster" ||
          btnSpan.textContent.trim() === "Show transcript"
        ) {
          transcriptShowButton = btnSpan.closest("button");
          if (transcriptShowButton) {
            console.log(
              "Metin içeriği ile 'Transkripti göster' butonu bulundu."
            );
            break;
          }
        }
      }
    }

    if (!transcriptShowButton || transcriptShowButton.offsetParent === null) {
      console.log(
        "'Transkripti göster' butonu tıklanabilir durumda değil veya bulunamadı. Panel açık mı kontrol ediliyor..."
      );
      const existingTranscript = await extractTranscriptFromPanel(true);
      if (existingTranscript) {
        console.log(
          "Panel zaten açıkmış veya transkript doğrudan bulunabildi."
        );
        return existingTranscript;
      }
      throw new Error(
        `'Transkripti göster' butonu bulunamadı veya görünür değil. (Denenen Seçici: ${transcriptShowButtonSelector})`
      );
    }

    console.log("'Transkripti göster' butonu bulundu, tıklanıyor...");
    transcriptShowButton.click();
    await sleep(1500);

    // 3. ADIM: Transkript metnini çıkar
    const fullTranscript = await extractTranscriptFromPanel(false);
    if (!fullTranscript) {
      console.warn(
        "İlk denemede transkript metni bulunamadı, 2 saniye daha bekleniyor..."
      );
      await sleep(2000);
      const retryTranscript = await extractTranscriptFromPanel(false);
      if (!retryTranscript) {
        throw new Error(
          "Transkript metinleri panel açıldıktan sonra bulunamadı (Tekrar denendi)."
        );
      }
      console.log("Transkript ikinci denemede başarıyla alındı.");
      return retryTranscript;
    }

    console.log("Transkript başarıyla alındı.");
    return fullTranscript;
  } catch (error) {
    console.error("Transkript alma sırasında genel hata:", error);
    try {
      const existingTranscript = await extractTranscriptFromPanel(true);
      if (existingTranscript) {
        console.warn(
          "Hata sonrası kontrolde açık panel bulundu ve transkript alındı."
        );
        return existingTranscript;
      }
    } catch (finalError) {
      console.error("Hata sonrası panel kontrolünde de hata:", finalError);
    }
    throw error;
  }
}

async function extractTranscriptFromPanel(panelMayBeOpen) {
  console.log(
    `Panelden metin çıkarılıyor... Panel açık olabilir mi: ${panelMayBeOpen}`
  );
  await sleep(500);

  const transcriptPanelSelector =
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]';
  const panel = document.querySelector(transcriptPanelSelector);

  if (!panel || panel.offsetParent === null) {
    if (!panelMayBeOpen) {
      console.error(
        "Transkript paneli bulunamadı veya görünür değil.",
        `Seçici: ${transcriptPanelSelector}`
      );
      const altPanelSelector = "ytd-transcript-renderer[active]";
      const altPanel = document.querySelector(altPanelSelector);
      if (!altPanel || altPanel.offsetParent === null) {
        throw new Error(
          `Transkript paneli bulunamadı. (Denenenler: ${transcriptPanelSelector}, ${altPanelSelector})`
        );
      }
      console.log(`Alternatif panel bulundu: ${altPanelSelector}`);
      return extractSegmentsFromSpecificPanel(altPanel);
    }
    console.warn(
      "Transkript paneli (muhtemelen zaten açıkken) bulunamadı veya görünür değil."
    );
    return null;
  }

  console.log(`Transkript paneli bulundu: ${transcriptPanelSelector}`);
  return extractSegmentsFromSpecificPanel(panel);
}

async function extractSegmentsFromSpecificPanel(panelElement) {
  const segmentsContainerSelector = "#segments-container";
  const segmentsContainer = panelElement.querySelector(
    segmentsContainerSelector
  );

  if (!segmentsContainer) {
    console.error(
      "Segment kapsayıcısı bulunamadı.",
      `Panel: ${panelElement.tagName}`,
      `Seçici: ${segmentsContainerSelector}`
    );
    const altSegmentSelector = ".segment-text.ytd-transcript-segment-renderer";
    const altSegmentsDirect = panelElement.querySelectorAll(altSegmentSelector);
    if (altSegmentsDirect && altSegmentsDirect.length > 0) {
      console.log(
        `Alternatif segment yapısı doğrudan panel altında bulundu (${altSegmentsDirect.length} adet): ${altSegmentSelector}`
      );
      return Array.from(altSegmentsDirect)
        .map((seg) => seg.textContent.trim().replace(/\s+/g, " "))
        .filter((text) => text.length > 0)
        .join("\n");
    }
    throw new Error(
      `Segment kapsayıcısı bulunamadı. Panel: ${panelElement.tagName}, Seçici: ${segmentsContainerSelector}`
    );
  }
  console.log(`Segment kapsayıcısı bulundu: ${segmentsContainerSelector}`);

  await sleep(500);

  const segmentSelectors = [
    "ytd-transcript-segment-renderer yt-formatted-string.segment-text",
    ".segment-text.ytd-transcript-segment-renderer",
    ".segment .yt-formatted-string",
  ];

  let segments = null;
  for (let selector of segmentSelectors) {
    segments = segmentsContainer.querySelectorAll(selector);
    if (segments && segments.length > 0) {
      console.log(`Segmentler bulundu (${segments.length} adet): ${selector}`);
      break;
    }
  }

  if (!segments || segments.length === 0) {
    console.error(
      "Transkript segmentleri bulunamadı.",
      `Kapsayıcı: ${segmentsContainer.tagName}`,
      `Seçiciler: ${segmentSelectors.join(", ")}`
    );
    throw new Error("Transkript segmentleri bulunamadı.");
  }

  const transcriptText = Array.from(segments)
    .map((seg) => seg.textContent.trim().replace(/\s+/g, " "))
    .filter((text) => text.length > 0)
    .join("\n");

  console.log(
    "Çıkarılan transkript (ilk 100 karakter):",
    transcriptText.substring(0, 100)
  );
  return transcriptText;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForElement(selector, timeout = 5000) {
  console.log(`Element bekleniyor: ${selector} (Timeout: ${timeout}ms)`);
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) {
        console.log(`Element bulundu: ${selector}`);
        return element;
      }
    } catch (e) {
      console.warn(`waitForElement seçici hatası (${selector}): ${e.message}`);
      return null;
    }
    await sleep(250);
  }
  console.warn(`Element bulunamadı (Timeout): ${selector}`);
  return null;
}

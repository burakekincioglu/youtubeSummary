// background.js (Groq API, Llama3, Sıralı 40 Bölümlü Özetleme, Boyut Kontrolü ve Birleştirme)

async function getApiKey() {
  const result = await chrome.storage.sync.get(["groqApiKey"]);
  return result.groqApiKey;
}

// Transkripti bölen fonksiyon (Daha dikkatli bölmeye çalışır)
function splitTranscript(text, numParts) {
  if (!text) return [];
  const totalLength = text.length;
  // Güvenli karakter limiti (Token limitine yakınsamak için - 1 token ~ 4 char varsayımıyla)
  const safeCharLimitPerPart = Math.floor((8192 * 3.5) / numParts); // Biraz pay bırakarak
  const minPartLength = 100; // Çok kısa parçalar oluşturmamak için minimum uzunluk

  console.log(`Hedeflenen bölüm başına karakter: ~${safeCharLimitPerPart}`);

  // Çok kısa metinler için tek parça
  if (totalLength < minPartLength * numParts) {
    console.log("Transkript çok kısa, tek parça olarak döndürülüyor.");
    return totalLength > minPartLength ? [text] : []; // Min uzunluktan kısaysa boş döndür
  }

  const parts = [];
  let currentPartStart = 0;
  const sentenceEndingsRegex =
    /([.?!।…](?=\s+[A-ZÜÖÇĞİŞI]|\s*$)|[.?!।…]\s*\n|\n\n)/g; // Cümle sonu veya paragraf boşluğu

  while (currentPartStart < totalLength) {
    let potentialEndPoint = currentPartStart + safeCharLimitPerPart;
    let bestSplitPoint = -1;

    // Hedeflenen bitiş noktasına kadar olan metni al
    let currentSearchText = text.substring(
      currentPartStart,
      Math.min(potentialEndPoint + 500, totalLength)
    ); // Biraz ötesine bak

    // Hedeflenen noktaya en yakın *önceki* anlamlı ayıracı bul
    let lastMatchIndex = -1;
    let match;
    while ((match = sentenceEndingsRegex.exec(currentSearchText)) !== null) {
      if (match.index + currentPartStart > currentPartStart + minPartLength) {
        // Min. uzunluktan sonraki ayraçlar
        lastMatchIndex = match.index + currentPartStart + match[0].length; // Ayıracın sonrasından başla
        if (lastMatchIndex >= potentialEndPoint) break; // Hedefi geçince durma, en yakın önceki lazım
      } else {
        sentenceEndingsRegex.lastIndex = match.index + 1; // Çok kısaysa ilerle
      }
    }

    if (lastMatchIndex !== -1 && lastMatchIndex < potentialEndPoint) {
      // Hedefin *öncesinde* uygun bir nokta bulunduysa
      bestSplitPoint = lastMatchIndex;
    } else {
      // Uygun cümle sonu bulunamadıysa veya hedefi aştıysa, karakter limitine göre kes
      bestSplitPoint = Math.min(potentialEndPoint, totalLength);
      // Kelime ortasında kesmemek için boşluk ara (isteğe bağlı iyileştirme)
      let lastSpace = text.lastIndexOf(" ", bestSplitPoint);
      if (
        lastSpace > currentPartStart + minPartLength &&
        bestSplitPoint !== totalLength
      ) {
        bestSplitPoint = lastSpace + 1; // Boşluktan sonra başla
      }
      console.warn(
        `Bölüm ${
          parts.length + 1
        } için uygun cümle sonu bulunamadı/aşıldı, karakter limitine göre bölünüyor: ${currentPartStart} -> ${bestSplitPoint}`
      );
    }

    // Son parçanın tamamını aldığından emin ol
    if (bestSplitPoint >= totalLength || parts.length === numParts - 1) {
      bestSplitPoint = totalLength;
    }

    const partText = text.substring(currentPartStart, bestSplitPoint).trim();

    if (partText.length >= minPartLength) {
      // Sadece yeterince uzun parçaları ekle
      parts.push(partText);
    } else if (currentPartStart < totalLength) {
      console.warn(
        `Oluşturulan parça çok kısa (${partText.length} char), atlanıyor.`
      );
    }

    currentPartStart = bestSplitPoint;
    // Eğer hedeflenen parça sayısına ulaşıldıysa ve hala metin varsa, son parçayı ekle
    if (parts.length === numParts && currentPartStart < totalLength) {
      const lastPartText = text.substring(currentPartStart).trim();
      if (lastPartText.length >= minPartLength) {
        parts[numParts - 1] += "\n" + lastPartText; // Son parçaya ekle veya yeni parça oluştur? Şimdilik ekleyelim.
        console.log("Kalan metin son parçaya eklendi.");
      }
      break; // Döngüyü bitir
    }
  }

  console.log(
    `${parts.length} adet anlamlı parça oluşturuldu (Hedef: ${numParts}).`
  );
  return parts.filter((p) => p && p.length > 0); // Son filtre
}

// Groq API'sini çağıran fonksiyon (İçeriği Değişmedi)
async function summarizeTextWithGroq(text, partNum, totalParts) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("Groq API anahtarı ayarlanmamış.");
  if (!text || text.trim().length === 0)
    throw new Error("Özetlenecek metin boş.");

  // Bu fonksiyon çağrılmadan önce boyut kontrolü yapıldığı için buradaki limit kontrolü kaldırılabilir veya daha yüksek tutulabilir.
  // const MAX_PART_LENGTH = 35000;
  // if (text.length > MAX_PART_LENGTH) { ... }

  const API_URL = "https://api.groq.com/openai/v1/chat/completions";
  const MODEL = "llama3-8b-8192";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: `Bir ekonomi dergisi editörü rolündesin. 
                      Ekonomi alanında sana verilen konuşma metnini maddeli şekilde özetle.
                      Özetlerken senden beklenen şey şu, sadece ekonomi ile ilgili gördüğün maddeleri aktar.`,
          },
          {
            role: "user",
            content: `Özetlenecek Bölüm ${partNum}:\n\n---\n${text}\n---\n\nBölüm ${partNum} Özeti:`,
          },
        ],
        temperature: 0.6,
        max_tokens: 130,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: {
          message: `API yanıtı JSON değil veya parse edilemedi (Status: ${response.status})`,
        },
      }));
      console.error(`Groq API Hata Detayı (Bölüm ${partNum}):`, errorData);
      if (
        response.status === 413 ||
        (errorData.error?.message &&
          errorData.error.message.includes("too large"))
      ) {
        throw new Error(`Metin bölümü ${partNum} model için çok uzun.`); // Spesifik hata
      }
      throw new Error(
        `Groq API Hatası (${response.status}): ${
          errorData.error?.message || "Bilinmeyen API hatası"
        }`
      );
    }
    const data = await response.json();
    if (
      data.choices &&
      data.choices.length > 0 &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      return data.choices[0].message.content.trim();
    } else {
      console.error(
        `Geçersiz Groq API yanıt formatı (Bölüm ${partNum}):`,
        data
      );
      throw new Error(
        `API'den bölüm ${partNum} için beklenen formatta özet alınamadı.`
      );
    }
  } catch (error) {
    console.error(`Fetch API çağrısı hatası (Groq - Bölüm ${partNum}):`, error);
    if (error.message.includes("401"))
      throw new Error("Geçersiz Groq API anahtarı.");
    if (error.message.includes("429"))
      throw new Error("Groq API hız limitine takıldınız. Biraz bekleyin.");
    // "Çok uzun" hatasını burada tekrar yakalamaya gerek yok, summarizeTextWithGroq çağrılmadan önce kontrol ediliyor.
    throw error;
  }
}

// Ana mesaj dinleyici (Sıralı özetleme için güncellendi)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSummary") {
    console.log(`Tam özet isteği alındı.`);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        console.error("Aktif sekme bulunamadı.");
        chrome.runtime.sendMessage({
          action: "updatePopup",
          error: "Aktif YouTube sekmesi bulunamadı.",
          finished: true,
        });
        return;
      }
      const tabId = tabs[0].id;
      if (!tabs[0].url || !tabs[0].url.includes("youtube.com/watch")) {
        chrome.runtime.sendMessage({
          action: "updatePopup",
          error: "Bu sayfa bir YouTube video sayfası değil.",
          finished: true,
        });
        return;
      }
      console.log(
        "Content script'e transkript isteği gönderiliyor (Özet için)..."
      );
      chrome.tabs.sendMessage(
        tabId,
        { action: "getTranscript" },
        async (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Content script yanıt vermedi:",
              chrome.runtime.lastError.message
            );
            chrome.runtime.sendMessage({
              action: "updatePopup",
              error: "Sayfayla iletişim kurulamadı.",
              finished: true,
            });
            return;
          }
          if (response && response.transcript) {
            console.log("Tam transkript alındı. Bölümler özetleniyor...");
            // ***** DEĞİŞİKLİK BURADA *****
            const NUM_PARTS_TARGET = 40; // Bölüm sayısını 40'a çıkardık
            const SAFE_CHAR_LIMIT_PER_PART = 28000; // Güvenli karakter limiti (8192 token için yaklaşık)
            // ****************************
            const transcriptParts = splitTranscript(
              response.transcript,
              NUM_PARTS_TARGET
            );
            const totalPartsActual = transcriptParts.length;

            if (totalPartsActual === 0) {
              chrome.runtime.sendMessage({
                action: "updatePopup",
                error:
                  "Transkript bulundu ancak içeriği anlamlı bölümlere ayrılamadı.",
                finished: true,
              });
              return;
            }
            console.log(`Transkript ${totalPartsActual} bölüme ayrıldı.`);
            chrome.runtime.sendMessage({
              action: "updatePopup",
              status: `Transkript ${totalPartsActual} bölüme ayrıldı. Özetleniyor...`,
              finished: false,
            });

            let combinedSummary = "";
            let errorsOccurred = false;

            for (let i = 0; i < totalPartsActual; i++) {
              const currentPartNum = i + 1;
              const partText = transcriptParts[i];

              chrome.runtime.sendMessage({
                action: "updatePopup",
                status: `Bölüm ${currentPartNum}/${totalPartsActual} işleniyor...`,
                finished: false,
              });

              // --- YENİ: API'ye göndermeden önce boyut kontrolü ---
              if (partText.length > SAFE_CHAR_LIMIT_PER_PART) {
                const errorMsg = `Bölüm ${currentPartNum} (${partText.length} karakter) model limitini (${SAFE_CHAR_LIMIT_PER_PART} karakter) aştığı için özetlenemedi.`;
                console.warn(errorMsg);
                combinedSummary += `--- Bölüm ${currentPartNum} (ÇOK UZUN) ---\n${errorMsg}\n\n`;
                errorsOccurred = true;
                chrome.runtime.sendMessage({
                  action: "updatePopup",
                  error: errorMsg,
                  part: currentPartNum,
                  totalParts: totalPartsActual,
                  finished: false,
                });
                await new Promise((resolve) => setTimeout(resolve, 100)); // Kısa bekleme
                continue; // Bu bölümü atla, sonraki bölüme geç
              }
              // --- Boyut Kontrolü Sonu ---

              try {
                console.log(
                  `Bölüm ${currentPartNum} özetleniyor (Uzunluk: ${partText.length})...`
                );
                const summary = await summarizeTextWithGroq(
                  partText,
                  currentPartNum,
                  totalPartsActual
                );
                combinedSummary += `--- Bölüm ${currentPartNum} ---\n${summary}\n\n`;
                console.log(`Bölüm ${currentPartNum} özeti alındı.`);
                // Başarı durumunu da bildirebiliriz (opsiyonel)
                // chrome.runtime.sendMessage({ action: "updatePopup", status: `Bölüm ${currentPartNum}/${totalPartsActual} özetlendi.`, finished: false });
                await new Promise((resolve) => setTimeout(resolve, 700)); // Rate limit için bekleme (biraz artırıldı)
              } catch (error) {
                errorsOccurred = true;
                const errorMsgForPopup = `Bölüm ${currentPartNum} özetlenemedi: ${error.message}`;
                console.error(errorMsgForPopup);
                combinedSummary += `--- Bölüm ${currentPartNum} (HATA) ---\n${errorMsgForPopup}\n\n`;
                chrome.runtime.sendMessage({
                  action: "updatePopup",
                  error: errorMsgForPopup,
                  part: currentPartNum,
                  totalParts: totalPartsActual,
                  finished: false,
                });
                await new Promise((resolve) => setTimeout(resolve, 300)); // Hata sonrası bekleme
              }
            }

            console.log("Tüm bölümlerin özetlenmesi tamamlandı.");
            const finalStatus = errorsOccurred
              ? "Özetleme hatalarla tamamlandı."
              : "Özetleme başarıyla tamamlandı.";
            chrome.runtime.sendMessage({
              action: "updatePopup",
              summary: combinedSummary.trim(),
              status: finalStatus,
              finished: true,
            });
          } else {
            console.error(
              "Transkript alınamadı:",
              response ? response.error : "Yanıt yok"
            );
            chrome.runtime.sendMessage({
              action: "updatePopup",
              error:
                "Transkript alınamadı: " +
                (response?.error || "Bilinmeyen hata"),
              finished: true,
            });
          }
        }
      );
    });
  }
  // --- HAM TRANSKRİPT İSTEĞİ (Aynı) ---
  else if (request.action === "getRawTranscript") {
    console.log("Ham transkript isteği alındı.");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        console.error("Aktif sekme bulunamadı.");
        chrome.runtime.sendMessage({
          action: "updatePopup",
          error: "Aktif YouTube sekmesi bulunamadı.",
          finished: true,
        });
        return;
      }
      const tabId = tabs[0].id;
      if (!tabs[0].url || !tabs[0].url.includes("youtube.com/watch")) {
        chrome.runtime.sendMessage({
          action: "updatePopup",
          error: "Bu sayfa bir YouTube video sayfası değil.",
          finished: true,
        });
        return;
      }
      console.log("Content script'e transkript isteği gönderiliyor (Ham)...");
      chrome.tabs.sendMessage(
        tabId,
        { action: "getTranscript" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Content script yanıt vermedi:",
              chrome.runtime.lastError.message
            );
            chrome.runtime.sendMessage({
              action: "updatePopup",
              error: "Sayfayla iletişim kurulamadı.",
              finished: true,
            });
          } else if (response && response.transcript) {
            console.log("Ham transkript başarıyla alındı.");
            chrome.runtime.sendMessage({
              action: "updatePopup",
              transcript: response.transcript,
              status: "Transkript başarıyla alındı.",
              finished: true,
            });
          } else {
            console.error(
              "Ham transkript alınamadı:",
              response ? response.error : "Yanıt yok"
            );
            chrome.runtime.sendMessage({
              action: "updatePopup",
              error:
                "Transkript alınamadı: " +
                (response?.error || "Bilinmeyen hata"),
              finished: true,
            });
          }
        }
      );
    });
  }
  // --- API ANAHTARI KAYDETME (Aynı) ---
  else if (request.action === "saveApiKey") {
    const apiKey = request.apiKey;
    chrome.storage.sync.set({ groqApiKey: apiKey }, () => {
      console.log("Groq API Anahtarı kaydedildi (background).");
      sendResponse({ success: true });
    });
    return true;
  }
});

// Eklenti kurulduğunda (Aynı)
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});

# YouTube Video Metin Özetleyici Chrome Eklentisi 📈

Bu Chrome eklentisi, web sayfalarındaki veya seçtiğiniz metinlerdeki ekonomik bilgileri hızlıca özetlemenize yardımcı olur. Uzun metinleri okumak yerine, sadece ekonomiyle ilgili önemli noktaları anında görün! ✨

## 🚀 Özellikler

* Seçilen metinleri veya sayfaları ekonomi perspektifinden özetler.
* Arka planda [Groq API](https://groq.com/)'nin yüksek hızını kullanır. ⚡
* Özelleştirilebilir özetleme talimatları (prompt) ile esneklik sunar.
* Okuma verimliliğinizi artırır. ⏱️

## ⚙️ Kurulum

Eklentiyi kullanmaya başlamak için aşağıdaki adımları takip edebilirsiniz (Eğer Chrome Web Mağazası'nda değilse):

1.  Bu repoyu bilgisayarınıza klonlayın veya ZIP olarak indirin ve bir klasöre çıkartın.
2.  Chrome tarayıcınızı açın ve adres çubuğuna `chrome://extensions` yazıp Enter'a basın.
3.  Sağ üst köşedeki **Geliştirici modu** (Developer mode) anahtarını aktif hale getirin.
4.  Sol üstte beliren **Paketlenmemiş öğe yükle** (Load unpacked) butonuna tıklayın.
5.  Açılan pencerede, 1. adımda indirdiğiniz/çıkarttığınız eklenti klasörünü seçin.
6.  Eklenti listeye eklenecek ve kullanıma hazır olacaktır! 🎉

## 🔑 Groq API Anahtarı

Bu eklentinin çalışması için bir Groq API anahtarına ihtiyacınız vardır. Groq API, metin özetleme işlemini gerçekleştiren yapay zeka modeline son derece hızlı erişim sağlar.

1.  API anahtarınızı ücretsiz olarak almak için [Groq Console](https://console.groq.com/docs/overview) adresini ziyaret edin ve kayıt olun.
2.  API anahtarınızı oluşturun ve kopyalayın.
3.  **ÖNEMLİ:** Aldığınız API anahtarını eklentinin kodları içerisindeki ilgili yere (muhtemelen `background.js` dosyasında API isteği yapılan bölüm veya özel bir ayar değişkeni) eklemeniz gerekmektedir. Bu adım olmadan eklenti çalışmayacaktır.

## ✍️ Prompt Özelleştirme

Eklentinin metinleri nasıl özetleyeceğini belirleyen talimatları (prompt) `background.js` dosyası içinden kendi ihtiyaçlarınıza göre değiştirebilir ve optimize edebilirsiniz. Özellikle özetleme stilini veya odaklanılacak noktaları değiştirmek isterseniz, aşağıdaki kod bloğundaki `content` kısımlarını düzenleyebilirsiniz:

```javascript
// background.js dosyasındaki örnek prompt yapısı
const messages = [
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
  // ... (varsa diğer mesajlar)
];

// Bu 'messages' dizisi Groq API'ye gönderilir.
// 'system' rolündeki içerik, yapay zekanın genel davranışını belirler.
// 'user' rolündeki içerik, özetlenecek metni ve spesifik talimatları içerir.


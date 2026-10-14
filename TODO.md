# Yapılacaklar

## İmza anahtarı (Secret ile APK)

- [ ] Size özel bir imza anahtarı (keystore) oluştur.
- [ ] Anahtarı GitHub Secrets'a ekle: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
- [ ] APK'lar bundan sonra Secret'taki bu anahtarla imzalanarak oluşturulacak
      (workflow ve `android/app/build.gradle` buna hazır, Secret eklenince otomatik devreye girer).

Not: Secret eklenene kadar her APK, GitHub Actions'ın o derleme için ürettiği geçici
debug anahtarıyla imzalanır. İmza her derlemede değiştiği için yeni APK eskisinin
üzerine kurulmaz: önce **Dışa aktar** ile yedek alın, uygulamayı silip yenisini kurun,
sonra **İçe aktar** ile yedeği geri yükleyin.

## Mail

- [ ] `MAIL_TO` (Variable), `MAIL_USERNAME` ve `MAIL_PASSWORD` (Secret) değerlerini ekle.

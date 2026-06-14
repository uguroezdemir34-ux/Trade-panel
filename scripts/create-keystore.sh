#!/usr/bin/env bash
# =============================================================================
# QUANTIX OS — Release Keystore Oluşturma Scripti
# =============================================================================
#
# KULLANIM:
#   chmod +x scripts/create-keystore.sh
#   ./scripts/create-keystore.sh
#
# Bu script:
#   1. release.jks dosyasını üretir (Play Store imzalama için)
#   2. base64 kodlu versiyonunu ekrana basar → GitHub Secret olarak ekle
#   3. .jks dosyası .gitignore'da — ASLA commit'leme
#
# GITHUB SECRETS (Settings → Secrets and variables → Actions → New secret):
#   ANDROID_KEYSTORE_BASE64   → aşağıdaki base64 çıktısı
#   ANDROID_KEY_ALIAS         → quantixos-key  (veya özelleştir)
#   ANDROID_KEY_PASSWORD      → girdiğin key password
#   ANDROID_STORE_PASSWORD    → girdiğin store password
# =============================================================================

set -euo pipefail

KEYSTORE_FILE="release.jks"
KEY_ALIAS="quantixos-key"
VALIDITY_DAYS=10950  # ~30 yıl — Play Store minimum 2033'e kadar geçerli olmasını ister

echo "================================================"
echo "  QUANTIX OS Release Keystore Oluşturucu"
echo "================================================"
echo ""
echo "Keystore dosyası: $KEYSTORE_FILE"
echo "Key alias:        $KEY_ALIAS"
echo "Geçerlilik:       $VALIDITY_DAYS gün (~30 yıl)"
echo ""
echo "⚠️  UYARI: Bu işlemi bir kez yap ve keystore'u güvenli sakla."
echo "   Kaybedersen Play Store'a güncelleme gönderemezsin!"
echo ""

# keytool Java ile gelir — Java 21 kurulu olmalı
if ! command -v keytool &> /dev/null; then
    echo "HATA: keytool bulunamadı. Java 21 yüklü mü?"
    echo "  macOS: brew install openjdk@21"
    echo "  Ubuntu: sudo apt install openjdk-21-jdk"
    exit 1
fi

# Mevcut keystore'u koruma
if [ -f "$KEYSTORE_FILE" ]; then
    echo "⚠️  $KEYSTORE_FILE zaten mevcut. Üzerine yazmak istiyor musun? (y/N)"
    read -r CONFIRM
    if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        echo "İptal edildi."
        exit 0
    fi
fi

echo "📝 Keystore bilgileri (Common Name için gerçek bilgi girmek zorunda değilsin):"
echo ""

keytool -genkey -v \
    -keystore "$KEYSTORE_FILE" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity "$VALIDITY_DAYS" \
    -storetype PKCS12

echo ""
echo "✅ Keystore oluşturuldu: $KEYSTORE_FILE"
echo ""
echo "================================================"
echo "  GitHub Secrets İçin Base64 Kodlama"
echo "================================================"
echo ""
echo "Aşağıdaki değeri ANDROID_KEYSTORE_BASE64 secret'ına yapıştır:"
echo ""
base64 -i "$KEYSTORE_FILE"
echo ""
echo "================================================"
echo "  Diğer Secret'lar"
echo "================================================"
echo ""
echo "ANDROID_KEY_ALIAS     = $KEY_ALIAS"
echo "ANDROID_KEY_PASSWORD  = (keytool'da girdiğin key password)"
echo "ANDROID_STORE_PASSWORD= (keytool'da girdiğin store password)"
echo ""
echo "⚠️  release.jks dosyasını güvenli bir yere (1Password, Bitwarden vb.) kaydet."
echo "   .gitignore'da olduğu için commit'lenmeyecek — ama yerel kopyasını koru."

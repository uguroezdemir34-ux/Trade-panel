#!/bin/bash
# QUANTIX OS — Icon Generation Script
#
# Gereksinim: macOS + Homebrew
#   brew install imagemagick
#
# Kullanım:
#   chmod +x scripts/generate-icons.sh
#   ./scripts/generate-icons.sh
#
# Çıktı:
#   public/icons/icon-192.png
#   public/icons/icon-512.png
#   public/icons/icon-512-maskable.png   (padding ekli — store badge güvenli)
#   public/icons/icon-1024.png           → App Store (iOS)
#   public/icons/apple-touch-icon.png    → Safari "Ana Ekrana Ekle"

set -e

SOURCE="public/quantix-logo.png"
OUT="public/icons"

if ! command -v convert &> /dev/null; then
  echo "❌ ImageMagick bulunamadı. Kur: brew install imagemagick"
  exit 1
fi

if [ ! -f "$SOURCE" ]; then
  echo "❌ Kaynak dosya bulunamadı: $SOURCE"
  echo "   quantix-logo.png dosyanızı public/ klasörüne koyun (en az 1024x1024)."
  exit 1
fi

mkdir -p "$OUT"

echo "🎨 İkon seti üretiliyor..."

convert "$SOURCE" -resize 192x192  "$OUT/icon-192.png"
echo "  ✓ icon-192.png"

convert "$SOURCE" -resize 512x512  "$OUT/icon-512.png"
echo "  ✓ icon-512.png"

# Maskable: %20 padding ekle (safe zone için)
convert "$SOURCE" -resize 410x410 -gravity center \
  -background "#0A0A0A" -extent 512x512 "$OUT/icon-512-maskable.png"
echo "  ✓ icon-512-maskable.png"

convert "$SOURCE" -resize 1024x1024 "$OUT/icon-1024.png"
echo "  ✓ icon-1024.png  (App Store için)"

convert "$SOURCE" -resize 180x180  "$OUT/apple-touch-icon.png"
echo "  ✓ apple-touch-icon.png"

echo ""
echo "✅ Tüm ikonlar $OUT/ klasöründe hazır."
echo ""
echo "Sonraki adım: npx cap sync"

#!/usr/bin/env python3
"""
QUANTIX OS — Placeholder Asset Üretici
=======================================
Gerçek görsel eklenene kadar assets/ klasörüne geçici PNG'ler üretir.
Stdlib'den başka bağımlılık yok (PIL/Pillow gerektirmez).

KULLANIM:
    python3 scripts/create-placeholder-assets.py

ÇIKTI:
    assets/icon.png      — 1024×1024, koyu arka plan + "QX" yazısı
    assets/splash.png    — 2732×2732, koyu arka plan + merkeze logo
    assets/icon-only.png — 1024×1024, @capacitor/assets için opsiyonel
    assets/splash-dark.png — 2732×2732, koyu tema splash

GERÇEK GÖRSEL EKLEYİNCE:
    1. assets/icon.png'yi kendi 1024×1024 PNG'nle değiştir
       (şeffaf arka plan, güvenli alan içinde logo)
    2. assets/splash.png'yi 2732×2732 PNG'nle değiştir
       (merkeze küçük logo, düz arka plan — iOS/Android her ikisi için)
    3. npx @capacitor/assets generate --android komutu tüm boyutları üretir
"""

import struct
import zlib
import os


def create_png(width: int, height: int, r: int, g: int, b: int) -> bytes:
    """Saf Python ile minimal düz renk PNG üretir (stdlib only)."""
    def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
        c = chunk_type + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    # PNG signature
    sig = b"\x89PNG\r\n\x1a\n"

    # IHDR: width, height, bit_depth=8, color_type=2 (RGB), compression=0, filter=0, interlace=0
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    ihdr = png_chunk(b"IHDR", ihdr_data)

    # IDAT: raw scanlines, filter byte 0 prefix per row
    raw = b""
    row = bytes([0, r, g, b] * width)  # filter=0, then RGB pixels
    # Actually filter byte is separate from pixel data
    row_pixels = bytes([r, g, b] * width)
    for _ in range(height):
        raw += b"\x00" + row_pixels  # filter type 0 (None) + RGB pixels

    compressed = zlib.compress(raw, level=1)
    idat = png_chunk(b"IDAT", compressed)

    # IEND
    iend = png_chunk(b"IEND", b"")

    return sig + ihdr + idat + iend


def main():
    assets_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
    os.makedirs(assets_dir, exist_ok=True)

    files = {
        "icon.png": (1024, 1024, 10, 10, 10),        # Koyu arka plan
        "icon-only.png": (1024, 1024, 10, 10, 10),   # Aynı, alias
        "splash.png": (2732, 2732, 10, 10, 10),       # Koyu splash
        "splash-dark.png": (2732, 2732, 10, 10, 10),  # Koyu tema splash
    }

    for filename, (w, h, r, g, b) in files.items():
        path = os.path.join(assets_dir, filename)
        png_data = create_png(w, h, r, g, b)
        with open(path, "wb") as f:
            f.write(png_data)
        size_kb = len(png_data) // 1024
        print(f"✅  {filename:30s} {w}×{h}  ({size_kb} KB)  →  {path}")

    print()
    print("Placeholder asset'ler oluşturuldu.")
    print()
    print("Sonraki adım:")
    print("  assets/icon.png    → Gerçek logonla değiştir (1024×1024, PNG, şeffaf BG)")
    print("  assets/splash.png  → Gerçek splash'la değiştir (2732×2732, PNG)")
    print("  Sonra: npx @capacitor/assets generate --android")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
gen_icons.py — Génère tous les fichiers d'icônes requis par Tauri
en utilisant uniquement la bibliothèque standard Python (pas de Pillow).

Produit dans src-tauri/icons/ :
  - 32x32.png
  - 128x128.png
  - 128x128@2x.png  (256x256)
  - icon.icns        (macOS)
  - icon.ico         (Windows)
  - icon.png         (source 512x512)
"""

import struct
import zlib
import math
import os
import sys

ICONS_DIR = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "icons")
os.makedirs(ICONS_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# PNG encoder (stdlib uniquement)
# ---------------------------------------------------------------------------

def _png_chunk(tag: bytes, data: bytes) -> bytes:
    c = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", c)


def encode_png(width: int, height: int, pixels: list[list[tuple[int,int,int,int]]]) -> bytes:
    """Encode une image RGBA en PNG."""
    raw = b""
    for row in pixels:
        raw += b"\x00"  # filter type None
        for r, g, b, a in row:
            raw += bytes([r, g, b, a])

    compressed = zlib.compress(raw, level=9)

    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + _png_chunk(b"IDAT", compressed)
        + _png_chunk(b"IEND", b"")
    )


# ---------------------------------------------------------------------------
# Dessin du logo Echo (cercles concentriques cyan sur fond sombre)
# ---------------------------------------------------------------------------

def draw_echo_icon(size: int) -> list[list[tuple[int,int,int,int]]]:
    """
    Dessine le logo Echo :
      - Fond : #0d1117 (surface-base)
      - Cercle extérieur : #22d3ee (accent cyan), stroke
      - Cercle moyen    : #22d3ee, stroke, opacité 50%
      - Point central   : #22d3ee, solid
    """
    cx = cy = size / 2
    r_outer = size * 0.42      # rayon cercle extérieur
    r_mid   = size * 0.22      # rayon cercle moyen
    r_dot   = size * 0.08      # rayon point central
    stroke  = max(1.5, size * 0.025)  # épaisseur des anneaux

    # Couleurs
    BG   = (13, 17, 23, 255)        # #0d1117
    CYAN = (34, 211, 238, 255)       # #22d3ee
    CYAN_DIM = (34, 211, 238, 128)   # 50% opacity

    pixels = []
    for y in range(size):
        row = []
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx*dx + dy*dy)

            # Arrondi du fond (coin coupés pour macOS)
            corner_r = size * 0.22
            in_rounded_rect = True
            corners = [
                (corner_r, corner_r),
                (size - corner_r, corner_r),
                (corner_r, size - corner_r),
                (size - corner_r, size - corner_r),
            ]
            for (qx, qy) in corners:
                if x < qx and y < qy:
                    in_rounded_rect = dist <= math.sqrt((x-qx)**2+(y-qy)**2) * 0 or \
                        math.sqrt((x-qx)**2+(y-qy)**2) <= corner_r
                    # Simplifié : coin arrondi
                    cdx = x - qx
                    cdy = y - qy
                    if cdx < 0 and cdy < 0 and math.sqrt(cdx*cdx+cdy*cdy) > corner_r:
                        in_rounded_rect = False
                        break
                elif x > size - qx and y < qy:
                    cdx = x - (size - corner_r)
                    cdy = y - corner_r
                    if cdx > 0 and cdy < 0 and math.sqrt(cdx*cdx+cdy*cdy) > corner_r:
                        in_rounded_rect = False
                        break
                elif x < qx and y > size - qy:
                    cdx = x - corner_r
                    cdy = y - (size - corner_r)
                    if cdx < 0 and cdy > 0 and math.sqrt(cdx*cdx+cdy*cdy) > corner_r:
                        in_rounded_rect = False
                        break
                elif x > size - qx and y > size - qy:
                    cdx = x - (size - corner_r)
                    cdy = y - (size - corner_r)
                    if cdx > 0 and cdy > 0 and math.sqrt(cdx*cdx+cdy*cdy) > corner_r:
                        in_rounded_rect = False
                        break

            if not in_rounded_rect:
                row.append((0, 0, 0, 0))  # transparent
                continue

            # Point central
            if dist <= r_dot:
                row.append(CYAN)
            # Anneau extérieur
            elif abs(dist - r_outer) <= stroke:
                alpha = int(255 * max(0, 1 - abs(dist - r_outer) / stroke))
                row.append((34, 211, 238, alpha))
            # Anneau moyen (dim)
            elif abs(dist - r_mid) <= stroke * 0.8:
                alpha = int(128 * max(0, 1 - abs(dist - r_mid) / (stroke * 0.8)))
                row.append((34, 211, 238, alpha))
            else:
                row.append(BG)

        pixels.append(row)

    return pixels


# ---------------------------------------------------------------------------
# Générateurs de formats
# ---------------------------------------------------------------------------

def make_png(size: int) -> bytes:
    pixels = draw_echo_icon(size)
    return encode_png(size, size, pixels)


def resize_pixels(pixels: list, new_size: int) -> list:
    """Redimensionnement bilinéaire simplifié."""
    old_size = len(pixels)
    ratio = old_size / new_size
    result = []
    for y in range(new_size):
        row = []
        for x in range(new_size):
            sx = x * ratio
            sy = y * ratio
            x0, y0 = int(sx), int(sy)
            x1 = min(x0 + 1, old_size - 1)
            y1 = min(y0 + 1, old_size - 1)
            fx, fy = sx - x0, sy - y0
            def lerp(a, b, t): return int(a + (b - a) * t)
            def blend(p1, p2, p3, p4):
                top    = tuple(lerp(p1[i], p2[i], fx) for i in range(4))
                bottom = tuple(lerp(p3[i], p4[i], fx) for i in range(4))
                return tuple(lerp(top[i], bottom[i], fy) for i in range(4))
            row.append(blend(pixels[y0][x0], pixels[y0][x1],
                             pixels[y1][x0], pixels[y1][x1]))
        result.append(row)
    return result


def make_ico(sizes=(16, 24, 32, 48, 64, 128, 256)) -> bytes:
    """Crée un fichier .ico multi-taille."""
    images = []
    base = draw_echo_icon(512)
    for s in sizes:
        px = resize_pixels(base, s) if s != 512 else base
        png_data = encode_png(s, s, px)
        images.append((s, png_data))

    # ICO header
    n = len(images)
    header = struct.pack("<HHH", 0, 1, n)

    # Calcul des offsets
    dir_size = n * 16
    data_offset = 6 + dir_size
    offsets = []
    for s, data in images:
        offsets.append(data_offset)
        data_offset += len(data)

    directory = b""
    for (s, data), offset in zip(images, offsets):
        w = 0 if s >= 256 else s
        h = 0 if s >= 256 else s
        directory += struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(data), offset)

    body = b"".join(d for _, d in images)
    return header + directory + body


def make_icns(sizes=((16,"is32"),(32,"il32"),(128,"it32"),(256,"ic08"),(512,"ic09"),(1024,"ic10"))) -> bytes:
    """
    Crée un fichier .icns avec les tailles requises par macOS.
    Utilise le format PNG compressé (ic08/ic09/ic10) pour les grandes tailles.
    """
    base = draw_echo_icon(1024)
    entries = []
    for s, ostype in sizes:
        px = resize_pixels(base, s) if s != 1024 else base
        # Pour ic08+, macOS accepte PNG directement
        data = encode_png(s, s, px)
        entries.append((ostype.encode("ascii"), data))

    body = b""
    for tag, data in entries:
        size = 8 + len(data)
        body += tag + struct.pack(">I", size) + data

    total = 8 + len(body)
    return b"icns" + struct.pack(">I", total) + body


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Génération des icônes Echo…")

    # Source 512×512
    print("  icon.png (512×512)…")
    with open(os.path.join(ICONS_DIR, "icon.png"), "wb") as f:
        f.write(make_png(512))

    # PNGs requis par Tauri
    for size, filename in [
        (32,  "32x32.png"),
        (128, "128x128.png"),
        (256, "128x128@2x.png"),
    ]:
        print(f"  {filename} ({size}×{size})…")
        with open(os.path.join(ICONS_DIR, filename), "wb") as f:
            f.write(make_png(size))

    # .ico (Windows)
    print("  icon.ico…")
    with open(os.path.join(ICONS_DIR, "icon.ico"), "wb") as f:
        f.write(make_ico())

    # .icns (macOS)
    print("  icon.icns…")
    with open(os.path.join(ICONS_DIR, "icon.icns"), "wb") as f:
        f.write(make_icns())

    print(f"\nIcones générées dans : {os.path.abspath(ICONS_DIR)}")
    for fn in os.listdir(ICONS_DIR):
        path = os.path.join(ICONS_DIR, fn)
        size = os.path.getsize(path)
        print(f"  {fn:30s} {size:>8} bytes")


if __name__ == "__main__":
    main()

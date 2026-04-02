#!/usr/bin/env bash
# =============================================================================
# build.sh — Script de build de production pour Echo (Tauri)
#
# Usage :
#   ./scripts/build.sh              # build pour la plateforme courante
#   ./scripts/build.sh --target win # cross-compile Windows (depuis macOS/Linux)
#
# Prérequis :
#   - Rust + Cargo  (https://rustup.rs)
#   - Node.js >= 18 (https://nodejs.org)
#   - @tauri-apps/cli  (installé via npm)
#   - Pour Windows cross-compile : cargo install xwin  (voir doc Tauri)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "============================================================"
echo "  Echo — Build de production"
echo "============================================================"

# 1. Vérification des dépendances
echo ""
echo "→ Vérification de l'environnement…"
command -v node  >/dev/null 2>&1 || { echo "✗ Node.js introuvable. Installez-le depuis https://nodejs.org"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "✗ Rust/Cargo introuvable. Installez-le depuis https://rustup.rs"; exit 1; }

NODE_VER=$(node --version | tr -d 'v' | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "✗ Node.js >= 18 requis (version actuelle : $(node --version))"
  exit 1
fi

echo "  ✓ Node.js $(node --version)"
echo "  ✓ Cargo $(cargo --version)"

# 2. Installation des dépendances npm
echo ""
echo "→ Installation des dépendances npm…"
npm ci --prefer-offline 2>/dev/null || npm install

# 3. Icônes — vérification
echo ""
echo "→ Vérification des icônes…"
ICONS_DIR="$ROOT_DIR/src-tauri/icons"
REQUIRED_ICONS=("32x32.png" "128x128.png" "128x128@2x.png" "icon.icns" "icon.ico")
MISSING=0
for icon in "${REQUIRED_ICONS[@]}"; do
  if [ ! -f "$ICONS_DIR/$icon" ]; then
    echo "  ⚠ Icône manquante : icons/$icon"
    MISSING=1
  fi
done
if [ "$MISSING" -eq 1 ]; then
  echo ""
  echo "  → Génération des icônes depuis src-tauri/icons/icon.png (si présent)…"
  if [ -f "$ICONS_DIR/icon.png" ]; then
    npx @tauri-apps/cli icon "$ICONS_DIR/icon.png" 2>/dev/null || true
  else
    echo "  ⚠ Placez une image src-tauri/icons/icon.png (≥ 1024×1024px)"
    echo "    puis relancez ce script. Le build continue avec les icônes par défaut."
  fi
fi

# 4. Build Tauri
echo ""
echo "→ Build Tauri (profil release)…"
echo "  (première fois : Rust compile toutes les dépendances — ~10 min)"
echo ""

TAURI_SKIP_DEVSERVER_CHECK=true npm run tauri build

# 5. Résultat
echo ""
echo "============================================================"
echo "  Build terminé avec succès !"
echo "============================================================"
echo ""

BUNDLE_DIR="$ROOT_DIR/src-tauri/target/release/bundle"
if [ -d "$BUNDLE_DIR" ]; then
  echo "Installateurs générés dans :"
  find "$BUNDLE_DIR" -name "*.msi" -o -name "*.dmg" -o -name "*.AppImage" \
    -o -name "*.deb" -o -name "*.rpm" 2>/dev/null | while read -r f; do
      SIZE=$(du -sh "$f" 2>/dev/null | cut -f1)
      echo "  [$SIZE]  $f"
  done
else
  echo "  Binaire :  $ROOT_DIR/src-tauri/target/release/echo"
fi

echo ""
echo "Distribution :"
echo "  Windows  →  .msi  (bundle/msi/)  ou  .exe  NSIS  (bundle/nsis/)"
echo "  macOS    →  .dmg  (bundle/dmg/)"
echo "  Linux    →  .AppImage  (bundle/appimage/)  ou  .deb  (bundle/deb/)"
echo ""

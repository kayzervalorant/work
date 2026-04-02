#!/usr/bin/env bash
# =============================================================================
# build-mac.sh — Build complet Echo pour macOS → génère un .dmg clé-en-main
#
# Ce script fait TOUT en une seule commande :
#   1. Vérifie les prérequis (Rust, Node, Python, PyInstaller)
#   2. Bundle le backend Python → binaire natif via PyInstaller
#   3. Place le binaire dans src-tauri/binaries/ avec le bon nom (target triple)
#   4. Compile Tauri + génère le .dmg final
#
# Usage :
#   cd /chemin/vers/echo
#   ./scripts/build-mac.sh
#
# Résultat :
#   src-tauri/target/release/bundle/dmg/Echo_0.1.0_x64.dmg  (Intel)
#   src-tauri/target/release/bundle/dmg/Echo_0.1.0_aarch64.dmg  (Apple Silicon)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BINARIES_DIR="$ROOT_DIR/src-tauri/binaries"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()    { echo -e "${CYAN}→${NC} $*"; }
ok()     { echo -e "${GREEN}✓${NC} $*"; }
warn()   { echo -e "${YELLOW}⚠${NC} $*"; }
error()  { echo -e "${RED}✗${NC} $*"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       Echo — Build macOS (.dmg)              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

cd "$ROOT_DIR"

# =============================================================================
# ÉTAPE 1 — Vérification des prérequis
# =============================================================================

log "Vérification des prérequis…"

command -v node  >/dev/null 2>&1 || error "Node.js introuvable → brew install node"
command -v cargo >/dev/null 2>&1 || error "Rust/Cargo introuvable → curl https://sh.rustup.rs | sh"
command -v python3 >/dev/null 2>&1 || error "Python 3 introuvable → brew install python@3.11"

NODE_VER=$(node --version | tr -d 'v' | cut -d'.' -f1)
[ "$NODE_VER" -ge 18 ] || error "Node.js >= 18 requis (actuel: $(node --version)) → brew install node"

PY_VER=$(python3 -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || echo "0")
[ "$PY_VER" -ge 10 ] || error "Python 3.10+ requis"

# PyInstaller
if ! python3 -c "import PyInstaller" 2>/dev/null; then
    warn "PyInstaller absent — installation…"
    pip3 install pyinstaller || error "Impossible d'installer PyInstaller"
fi

ok "Node.js $(node --version)"
ok "Cargo $(cargo --version | cut -d' ' -f2)"
ok "Python $(python3 --version)"
ok "PyInstaller $(python3 -m PyInstaller --version 2>/dev/null)"

# =============================================================================
# ÉTAPE 2 — Détection du target triple macOS
# =============================================================================

log "Détection de l'architecture Mac…"
TARGET=$(rustc -Vv 2>/dev/null | grep '^host' | awk '{print $2}')
[ -n "$TARGET" ] || TARGET=$(uname -m)-apple-darwin

ok "Target: $TARGET"

# =============================================================================
# ÉTAPE 3 — Installation des dépendances Python
# =============================================================================

log "Installation des dépendances Python…"
pip3 install -r "$BACKEND_DIR/requirements.txt" -q || error "pip install a échoué"
ok "Dépendances Python installées"

# =============================================================================
# ÉTAPE 4 — Build du backend Python avec PyInstaller
# =============================================================================

log "Build du backend Python (PyInstaller)…"
log "  (première fois : ~3-5 minutes)"

DIST_DIR="$BACKEND_DIR/dist"
mkdir -p "$BINARIES_DIR"

cd "$BACKEND_DIR"
python3 -m PyInstaller echo-backend.spec \
    --clean \
    --noconfirm \
    --distpath "$DIST_DIR" \
    --workpath "$BACKEND_DIR/build" \
    2>&1 | tail -20   # Affiche seulement les 20 dernières lignes (moins verbeux)

BUILT_BINARY="$DIST_DIR/echo-backend"
[ -f "$BUILT_BINARY" ] || error "PyInstaller n'a pas produit le binaire attendu dans $DIST_DIR"

# Renomme avec le target triple pour Tauri
TARGET_BINARY="$BINARIES_DIR/echo-backend-$TARGET"
cp "$BUILT_BINARY" "$TARGET_BINARY"
chmod +x "$TARGET_BINARY"

ok "Backend bundlé → $(du -sh "$TARGET_BINARY" | cut -f1)  ($TARGET_BINARY)"

# Nettoyage
rm -rf "$BACKEND_DIR/build" "$DIST_DIR"

cd "$ROOT_DIR"

# =============================================================================
# ÉTAPE 5 — Icônes
# =============================================================================

log "Vérification des icônes…"
ICONS_DIR="$ROOT_DIR/src-tauri/icons"
MISSING_ICONS=0
for icon in 32x32.png 128x128.png "128x128@2x.png" icon.icns icon.ico; do
    [ -f "$ICONS_DIR/$icon" ] || { warn "Icône manquante : $icon"; MISSING_ICONS=1; }
done

if [ "$MISSING_ICONS" -eq 1 ]; then
    if [ -f "$ICONS_DIR/icon.png" ]; then
        log "Génération des icônes depuis icon.png…"
        npx @tauri-apps/cli icon "$ICONS_DIR/icon.png" 2>/dev/null || warn "Génération des icônes a échoué (le build continuera avec les icônes par défaut)"
    else
        warn "Placez un fichier src-tauri/icons/icon.png (≥ 1024×1024 px) pour des icônes personnalisées."
    fi
fi

# =============================================================================
# ÉTAPE 6 — Installation des dépendances npm
# =============================================================================

log "Installation des dépendances npm…"
npm ci --prefer-offline 2>/dev/null || npm install
ok "npm install"

# =============================================================================
# ÉTAPE 7 — Build Tauri (compile Rust + bundle .dmg)
# =============================================================================

log "Build Tauri release…"
log "  (première fois : compilation Rust ~10-15 min)"
echo ""

TAURI_SKIP_DEVSERVER_CHECK=true npm run tauri build 2>&1

# =============================================================================
# RÉSULTAT
# =============================================================================

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       Build terminé avec succès !            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

BUNDLE_DIR="$ROOT_DIR/src-tauri/target/release/bundle"
if [ -d "$BUNDLE_DIR" ]; then
    DMG=$(find "$BUNDLE_DIR/dmg" -name "*.dmg" 2>/dev/null | head -1)
    if [ -n "$DMG" ]; then
        SIZE=$(du -sh "$DMG" | cut -f1)
        echo -e "${GREEN}  .dmg généré [${SIZE}]:${NC}"
        echo "  $DMG"
        echo ""
        echo "  → Double-cliquez pour installer Echo sur votre Mac."
        echo "  → Ollama doit être installé séparément (l'app vous guidera au premier lancement)."
    fi

    echo ""
    echo "  Tous les installateurs :"
    find "$BUNDLE_DIR" \( -name "*.dmg" -o -name "*.app" \) 2>/dev/null | while read -r f; do
        SIZE=$(du -sh "$f" | cut -f1)
        echo "  [$SIZE]  $f"
    done
fi

echo ""

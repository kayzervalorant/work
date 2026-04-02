#!/usr/bin/env bash
# =============================================================================
# build-mac.sh — Build complet Echo pour macOS → génère un .dmg clé-en-main
#
# Ce script fait TOUT en une seule commande :
#   1. Crée un venv Python isolé (compatible macOS Homebrew PEP 668)
#   2. Installe les dépendances + PyInstaller dans le venv
#   3. Bundle le backend Python → binaire natif via PyInstaller
#   4. Place le binaire dans src-tauri/binaries/ avec le bon nom (target triple)
#   5. Compile Tauri + génère le .dmg final
#
# Usage :
#   cd /chemin/vers/echo
#   ./scripts/build-mac.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BINARIES_DIR="$ROOT_DIR/src-tauri/binaries"
VENV_DIR="$ROOT_DIR/.venv-build"   # venv dédié au build, jamais commité

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${CYAN}→${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       Echo — Build macOS (.dmg)              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

cd "$ROOT_DIR"

# =============================================================================
# ÉTAPE 1 — Vérification des prérequis système
# =============================================================================

log "Vérification des prérequis…"

command -v node   >/dev/null 2>&1 || error "Node.js introuvable → brew install node"
command -v cargo  >/dev/null 2>&1 || error "Rust/Cargo introuvable → curl https://sh.rustup.rs | sh && source ~/.cargo/env"
command -v python3 >/dev/null 2>&1 || error "Python 3 introuvable → brew install python@3.11"

NODE_VER=$(node --version | tr -d 'v' | cut -d'.' -f1)
[ "$NODE_VER" -ge 18 ] || error "Node.js >= 18 requis (actuel: $(node --version)) → brew install node"

PY_MAJOR=$(python3 -c 'import sys; print(sys.version_info.major)')
PY_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)')
[ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 10 ] || error "Python 3.10+ requis (actuel: $(python3 --version))"

ok "Node.js $(node --version)"
ok "Cargo $(cargo --version | cut -d' ' -f2)"
ok "Python $(python3 --version)"

# =============================================================================
# ÉTAPE 2 — Venv Python isolé (contourne PEP 668 / Homebrew)
# =============================================================================

log "Préparation du venv Python de build…"

# Crée le venv si absent ou si --clean passé en argument
if [ ! -d "$VENV_DIR" ] || [ "${1:-}" = "--clean" ]; then
    [ -d "$VENV_DIR" ] && rm -rf "$VENV_DIR"
    python3 -m venv "$VENV_DIR"
    ok "Venv créé → $VENV_DIR"
else
    ok "Venv existant réutilisé"
fi

# Active le venv pour le reste du script
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

# Mise à jour pip dans le venv (silencieuse)
pip install --upgrade pip --quiet

# =============================================================================
# ÉTAPE 3 — Installation des dépendances dans le venv
# =============================================================================

log "Installation des dépendances Python dans le venv…"
pip install -r "$BACKEND_DIR/requirements.txt" --quiet
pip install pyinstaller --quiet
ok "Dépendances + PyInstaller installés"
ok "PyInstaller $(pyinstaller --version)"

# =============================================================================
# ÉTAPE 4 — Détection du target triple macOS
# =============================================================================

log "Détection de l'architecture Mac…"
TARGET=$(rustc -Vv 2>/dev/null | grep '^host' | awk '{print $2}')
[ -n "$TARGET" ] || TARGET="$(uname -m)-apple-darwin"
ok "Target: $TARGET"

# =============================================================================
# ÉTAPE 5 — Build du backend Python avec PyInstaller
# =============================================================================

log "Build du backend Python (PyInstaller)…"
log "  (première fois : ~3-5 minutes)"

DIST_DIR="$BACKEND_DIR/dist"
mkdir -p "$BINARIES_DIR"

cd "$BACKEND_DIR"
pyinstaller echo-backend.spec \
    --clean \
    --noconfirm \
    --distpath "$DIST_DIR" \
    --workpath "$BACKEND_DIR/build" \
    2>&1 | tail -25

BUILT_BINARY="$DIST_DIR/echo-backend"
[ -f "$BUILT_BINARY" ] || error "PyInstaller n'a pas produit de binaire dans $DIST_DIR"

# Renomme avec le target triple pour Tauri sidecar
TARGET_BINARY="$BINARIES_DIR/echo-backend-$TARGET"
cp "$BUILT_BINARY" "$TARGET_BINARY"
chmod +x "$TARGET_BINARY"

ok "Backend bundlé → $(du -sh "$TARGET_BINARY" | cut -f1)  [$TARGET_BINARY]"

# Nettoyage des artefacts intermédiaires
rm -rf "$BACKEND_DIR/build" "$DIST_DIR"

cd "$ROOT_DIR"

# Désactive le venv (on n'en a plus besoin)
deactivate 2>/dev/null || true

# =============================================================================
# ÉTAPE 6 — Icônes
# =============================================================================

log "Vérification des icônes…"
ICONS_DIR="$ROOT_DIR/src-tauri/icons"
MISSING_ICONS=0
for icon in 32x32.png 128x128.png "128x128@2x.png" icon.icns icon.ico; do
    [ -f "$ICONS_DIR/$icon" ] || { warn "Icône manquante : icons/$icon"; MISSING_ICONS=1; }
done

if [ "$MISSING_ICONS" -eq 1 ]; then
    if [ -f "$ICONS_DIR/icon.png" ]; then
        log "Génération des icônes depuis icon.png…"
        npx @tauri-apps/cli icon "$ICONS_DIR/icon.png" 2>/dev/null \
            || warn "Génération icônes échouée (le build continue avec les icônes par défaut)"
    else
        warn "Pas d'icône personnalisée. Créez src-tauri/icons/icon.png (≥ 1024×1024 px) pour changer l'icône."
    fi
else
    ok "Toutes les icônes présentes"
fi

# =============================================================================
# ÉTAPE 7 — npm install
# =============================================================================

log "Installation des dépendances npm…"
npm ci --prefer-offline 2>/dev/null || npm install --silent
ok "npm install"

# =============================================================================
# ÉTAPE 8 — Build Tauri → .dmg
# =============================================================================

log "Build Tauri release (compile Rust + bundle .dmg)…"
log "  (première fois : ~10-15 min — les suivants ~2-3 min grâce au cache Rust)"
echo ""

TAURI_SKIP_DEVSERVER_CHECK=true npm run tauri build

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
    DMG=$(find "$BUNDLE_DIR/dmg" -name "*.dmg" 2>/dev/null | head -1 || true)
    if [ -n "$DMG" ]; then
        SIZE=$(du -sh "$DMG" | cut -f1)
        echo -e "${GREEN}  .dmg prêt [${SIZE}] :${NC}"
        echo "  $DMG"
        echo ""
        echo "  → Double-cliquez le .dmg et glissez Echo dans Applications."
        echo "  → Ollama doit être installé (brew install ollama)."
        echo "  → L'app guide l'utilisateur au premier lancement si Ollama est absent."
    fi

    echo ""
    echo "  Tous les artefacts :"
    find "$BUNDLE_DIR" \( -name "*.dmg" -o -name "*.app" \) 2>/dev/null | while read -r f; do
        SIZE=$(du -sh "$f" | cut -f1)
        echo "  [$SIZE]  $f"
    done
fi

echo ""

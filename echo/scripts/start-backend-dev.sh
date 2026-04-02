#!/usr/bin/env bash
# =============================================================================
# start-backend-dev.sh — Lance le backend Python automatiquement en mode dev.
#
# Appelé par "npm run tauri dev" via package.json / concurrently.
# Gère lui-même le venv Python → aucune commande manuelle requise.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
VENV_DIR="$BACKEND_DIR/.venv-dev"

cd "$BACKEND_DIR"

# Crée le venv si absent (première fois ~30 secondes)
if [ ! -d "$VENV_DIR" ]; then
  echo "[echo-backend] Création du venv Python (première fois)…"
  python3 -m venv "$VENV_DIR"
fi

# Active le venv
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

# Installe/met à jour les dépendances silencieusement
pip install -r requirements.txt --quiet

echo "[echo-backend] Démarrage sur http://localhost:8000"

# Lance uvicorn
exec uvicorn main:app --host 127.0.0.1 --port 8000 --reload --log-level warning

#!/usr/bin/env bash
# =============================================================================
# start-backend-dev.sh — Lance le backend Python automatiquement en mode dev.
# Gère lui-même le venv Python → aucune commande manuelle requise.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
VENV_DIR="$BACKEND_DIR/.venv-dev"
PORT=8000

# Libère le port si un ancien processus tourne encore
if lsof -ti :"$PORT" &>/dev/null; then
  echo "[echo-backend] Port $PORT occupé — arrêt du processus existant…"
  lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

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

echo "[echo-backend] Démarrage sur http://localhost:$PORT"

# Lance uvicorn
exec uvicorn main:app --host 127.0.0.1 --port "$PORT" --reload --log-level warning

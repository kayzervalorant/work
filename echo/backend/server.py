"""
server.py — Point d'entrée autonome pour le bundle PyInstaller.

En mode développement, utilise uvicorn directement :
    uvicorn main:app --port 8000 --reload

En production (bundle Tauri sidecar), ce fichier est l'entrypoint :
    PyInstaller bundle -> echo-backend binaire -> Tauri le démarre automatiquement
"""

import sys
import os

# PyInstaller : les ressources sont dans sys._MEIPASS
# On doit ajouter ce chemin pour que les imports relatifs fonctionnent
if getattr(sys, "frozen", False):
    base_dir = sys._MEIPASS  # type: ignore[attr-defined]
    os.chdir(base_dir)
    # Le dossier chroma_db sera à côté de l'app, dans ~/Library/Application Support/ai.echo.app/
    app_support = os.path.join(
        os.path.expanduser("~"),
        "Library", "Application Support", "ai.echo.app"
    )
    os.makedirs(app_support, exist_ok=True)
    os.environ.setdefault("ECHO_CHROMA_DIR", os.path.join(app_support, "chroma_db"))
    os.environ.setdefault("ECHO_DOCS_DIR",   os.path.join(app_support, "docs"))

import uvicorn
from main import app  # noqa: E402

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="warning",   # silencieux en prod
        access_log=False,
    )

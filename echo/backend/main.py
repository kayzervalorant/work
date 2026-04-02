"""
main.py — Serveur FastAPI exposant l'API à Tauri via HTTP local.
"""

import logging
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

import config
from ingest import get_collection, ingest_file, EXTRACTORS
from query import answer

log = logging.getLogger(__name__)

app = FastAPI(title="Echo Backend", version="1.0.0")

# ---------------------------------------------------------------------------
# CORS — autorise le frontend Tauri (:1420) et Vite dev (:5173)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    allow_credentials=False,
)


# ---------------------------------------------------------------------------
# Suivi des jobs d'ingestion (in-memory, suffisant pour usage local mono-user)
# ---------------------------------------------------------------------------

# Structure d'un job :
# {
#   "id": str, "status": "pending"|"reading"|"embedding"|"finalizing"|"done"|"error",
#   "current_file": str, "files_done": int, "files_total": int,
#   "chunks_total": int, "error": str
# }
_jobs: dict[str, dict] = {}


def _run_ingest(job_id: str, docs_dir: str) -> None:
    """
    Exécuté en arrière-plan par BackgroundTasks (thread séparé via starlette).
    Met à jour _jobs[job_id] au fil de l'ingestion pour que le frontend puisse
    interroger /ingest/status/{job_id} et afficher la progression.
    """
    job = _jobs[job_id]
    try:
        docs_path = Path(docs_dir)
        if not docs_path.exists():
            raise FileNotFoundError(f"Dossier introuvable : {docs_dir}")

        files = [p for p in docs_path.rglob("*") if p.suffix.lower() in EXTRACTORS]
        if not files:
            raise ValueError(f"Aucun fichier Markdown/PDF trouvé dans {docs_dir}")

        job["files_total"] = len(files)
        job["status"] = "reading"

        collection = get_collection()
        total_chunks = 0

        for i, file in enumerate(files):
            job["current_file"] = file.name
            # Après le premier fichier, on est en phase d'embedding
            if i > 0:
                job["status"] = "embedding"
            try:
                n = ingest_file(file, collection)
                total_chunks += n
            except Exception as file_err:
                # Fichier corrompu ou illisible → on log et on continue
                log.warning("Fichier ignoré (%s) : %s", file.name, file_err)
                n = 0

            job["files_done"] = i + 1
            job["chunks_total"] = total_chunks

        job["status"] = "finalizing"
        job["current_file"] = ""
        job["status"] = "done"

    except Exception as exc:
        log.exception("Erreur d'ingestion job=%s", job_id)
        job["status"] = "error"
        job["error"] = str(exc)


# ---------------------------------------------------------------------------
# Schémas Pydantic
# ---------------------------------------------------------------------------

class QuestionRequest(BaseModel):
    question: str
    stream: bool = False
    # Historique de la conversation — [{role: "user"|"assistant", content: str}]
    # Le frontend envoie les 10 derniers messages pour le contexte de suivi.
    history: list[dict] = []


class IngestRequest(BaseModel):
    docs_dir: str = config.DOCS_DIR


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/ingest")
async def ingest(req: IngestRequest, background_tasks: BackgroundTasks):
    """
    Lance l'ingestion en arrière-plan et retourne immédiatement un job_id.
    Le frontend interroge /ingest/status/{job_id} pour suivre la progression.
    """
    job_id = uuid.uuid4().hex[:8]
    _jobs[job_id] = {
        "id": job_id,
        "status": "pending",
        "current_file": "",
        "files_done": 0,
        "files_total": 0,
        "chunks_total": 0,
        "error": "",
    }
    background_tasks.add_task(_run_ingest, job_id, req.docs_dir)
    return {"job_id": job_id, "status": "pending", "docs_dir": req.docs_dir}


@app.get("/ingest/status/{job_id}")
def ingest_status(job_id: str):
    """Retourne l'état courant d'un job d'ingestion."""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' introuvable.")
    return _jobs[job_id]


@app.post("/ask")
def ask(req: QuestionRequest):
    """
    Répond à une question en mode streaming (SSE) ou non.

    Format SSE (stream=true) :
      data: {"source_docs": [{"filename": str, "score": float}, ...]}
      data: {"token": str}   ← répété N fois
      data: [DONE]

    Format JSON (stream=false) :
      {"response": str, "source_docs": [...]}
    """
    if req.stream:
        response_gen, source_docs = answer(
            req.question, stream=True, history=req.history or None
        )

        def event_stream():
            yield f"data: {json.dumps({'source_docs': source_docs})}\n\n"
            for token in response_gen:
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    response, source_docs = answer(
        req.question, stream=False, history=req.history or None
    )
    return {"response": response, "source_docs": source_docs}


@app.get("/health")
def health():
    return {"status": "ok", "model": config.OLLAMA_MODEL}

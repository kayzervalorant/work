"""
main.py — Serveur FastAPI exposant l'API à Tauri via HTTP local.
"""

import json
import logging
import shutil
import uuid
from pathlib import Path

import requests as _requests
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

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
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
    allow_credentials=False,
)


# ---------------------------------------------------------------------------
# Suivi des jobs d'ingestion (in-memory, suffisant pour usage local mono-user)
# ---------------------------------------------------------------------------
_jobs: dict[str, dict] = {}


def _get_fresh_collection():
    """
    Retourne la collection ChromaDB.
    Si la DB est corrompue (zlib, SQLite WAL, HNSW index), elle est
    automatiquement supprimée et recrée — aucune intervention manuelle requise.
    """
    try:
        return get_collection()
    except Exception as exc:
        log.warning(
            "ChromaDB corrompue (%s) — réinitialisation automatique et reprise…", exc
        )
        chroma_path = Path(config.CHROMA_DIR)
        if chroma_path.exists():
            shutil.rmtree(chroma_path)
        return get_collection()  # Si ça échoue encore, l'exception remonte normalement


def _run_ingest(job_id: str, docs_dir: str) -> None:
    """
    Exécuté en arrière-plan par BackgroundTasks (thread séparé via starlette).
    Met à jour _jobs[job_id] au fil de l'ingestion.
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

        collection = _get_fresh_collection()
        total_chunks = 0

        for i, file in enumerate(files):
            job["current_file"] = file.name
            if i > 0:
                job["status"] = "embedding"
            try:
                n = ingest_file(file, collection)
                total_chunks += n
            except Exception as file_err:
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
    history: list[dict] = []


class IngestRequest(BaseModel):
    docs_dir: str = config.DOCS_DIR


# ---------------------------------------------------------------------------
# Endpoints — Ingestion
# ---------------------------------------------------------------------------

@app.post("/ingest")
async def ingest(req: IngestRequest, background_tasks: BackgroundTasks):
    """Lance l'ingestion en arrière-plan et retourne immédiatement un job_id."""
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


# ---------------------------------------------------------------------------
# Endpoints — Ask (RAG)
# ---------------------------------------------------------------------------

@app.post("/ask")
def ask(req: QuestionRequest):
    """
    Répond à une question en mode streaming (SSE) ou non.

    Format SSE (stream=true) :
      data: {"source_docs": [{"filename": str, "score": float}, ...]}
      data: {"token": str}   ← répété N fois
      data: {"error": str}   ← en cas d'erreur (ChromaDB corrompu, Ollama KO…)
      data: [DONE]
    """
    if req.stream:
        try:
            response_gen, source_docs = answer(
                req.question, stream=True, history=req.history or None
            )
        except Exception as exc:
            # Erreur avant même de commencer le stream (ChromaDB, etc.)
            def error_stream():
                yield f"data: {json.dumps({'error': str(exc)})}\n\n"
                yield "data: [DONE]\n\n"

            return StreamingResponse(
                error_stream(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
            )

        def event_stream():
            try:
                yield f"data: {json.dumps({'source_docs': source_docs})}\n\n"
                for token in response_gen:
                    yield f"data: {json.dumps({'token': token})}\n\n"
            except Exception as stream_exc:
                log.error("Erreur dans le stream de réponse : %s", stream_exc)
                yield f"data: {json.dumps({'error': str(stream_exc)})}\n\n"
            finally:
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

    try:
        response, source_docs = answer(
            req.question, stream=False, history=req.history or None
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"response": response, "source_docs": source_docs}


# ---------------------------------------------------------------------------
# Endpoints — Health & Ollama
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "model": config.OLLAMA_MODEL}


@app.get("/ollama/status")
def ollama_status():
    """
    Vérifie si Ollama est en ligne et si le modèle configuré est disponible.

    Retourne :
      { ollama_running: bool, model: str, model_available: bool,
        available_models: list[str], error?: str }
    """
    try:
        r = _requests.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=3)
        r.raise_for_status()
        tags = r.json()
        models: list[str] = [m["name"] for m in tags.get("models", [])]
        # Accepte "mistral" ou "mistral:latest" comme équivalents
        model_available = any(
            m == config.OLLAMA_MODEL or m.startswith(config.OLLAMA_MODEL + ":")
            for m in models
        )
        return {
            "ollama_running": True,
            "model": config.OLLAMA_MODEL,
            "model_available": model_available,
            "available_models": models,
        }
    except Exception as exc:
        return {
            "ollama_running": False,
            "model": config.OLLAMA_MODEL,
            "model_available": False,
            "available_models": [],
            "error": str(exc),
        }


@app.post("/ollama/pull")
def pull_model():
    """
    Télécharge le modèle configuré via l'API Ollama /api/pull avec progression SSE.

    Format SSE :
      data: {"status": str, "digest"?: str, "total"?: int, "completed"?: int}
      data: [DONE]
    """
    def stream_pull():
        try:
            url = f"{config.OLLAMA_BASE_URL}/api/pull"
            payload = {"name": config.OLLAMA_MODEL, "stream": True}
            with _requests.post(url, json=payload, stream=True, timeout=3600) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        yield f"data: {json.dumps(data)}\n\n"
                        if data.get("status") == "success":
                            break
                    except Exception:
                        continue
        except Exception as exc:
            log.exception("Erreur lors du pull modèle")
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream_pull(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Endpoints — Settings / Privacy
# ---------------------------------------------------------------------------

@app.delete("/settings/reset")
def reset_database():
    """
    Supprime proprement la base vectorielle ChromaDB et vide les jobs en mémoire.
    Garantie de confidentialité : aucune donnée indexée ne subsiste après l'appel.
    """
    global _jobs
    try:
        chroma_path = Path(config.CHROMA_DIR)
        if chroma_path.exists():
            shutil.rmtree(chroma_path)
            log.info("Base vectorielle supprimée : %s", config.CHROMA_DIR)
        # Vide le registre des jobs en mémoire
        _jobs = {}
        return {"status": "ok", "message": "Base de données réinitialisée avec succès."}
    except Exception as exc:
        log.exception("Erreur lors du reset de la base")
        raise HTTPException(status_code=500, detail=str(exc))

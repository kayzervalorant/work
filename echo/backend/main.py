"""
main.py — Serveur FastAPI exposant l'API à Tauri via HTTP local.
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

import config
from ingest import ingest_directory
from query import answer

app = FastAPI(title="Echo Backend", version="1.0.0")


class QuestionRequest(BaseModel):
    question: str
    stream: bool = False


class IngestRequest(BaseModel):
    docs_dir: str = config.DOCS_DIR


@app.post("/ingest")
def ingest(req: IngestRequest):
    try:
        ingest_directory(req.docs_dir)
        return {"status": "ok", "docs_dir": req.docs_dir}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ask")
def ask(req: QuestionRequest):
    if req.stream:
        response_gen, sources = answer(req.question, stream=True)

        def event_stream():
            yield f"data: {json.dumps({'sources': sources})}\n\n"
            for token in response_gen:
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    response, sources = answer(req.question, stream=False)
    return {"response": response, "sources": sources}


@app.get("/health")
def health():
    return {"status": "ok", "model": config.OLLAMA_MODEL}

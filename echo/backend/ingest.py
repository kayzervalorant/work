"""
ingest.py — Lit les fichiers Markdown (et PDF) d'un dossier,
les découpe en chunks, les vectorise via Ollama et les stocke dans ChromaDB.
"""

import os
import hashlib
import logging
from pathlib import Path
from typing import Generator

import chromadb
import requests

import config

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# ChromaDB client
# ---------------------------------------------------------------------------

def get_collection() -> chromadb.Collection:
    client = chromadb.PersistentClient(path=config.CHROMA_DIR)
    return client.get_or_create_collection(
        name=config.COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_markdown(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def extract_pdf(path: Path) -> str:
    try:
        import pypdf
    except ImportError:
        log.warning("pypdf not installed — skipping %s", path.name)
        return ""
    text = []
    try:
        reader = pypdf.PdfReader(str(path))
        for page in reader.pages:
            try:
                text.append(page.extract_text() or "")
            except Exception as page_err:
                # Ignore les pages avec compression corrompue (zlib -3, etc.)
                log.warning("Page ignorée dans %s : %s", path.name, page_err)
                continue
    except Exception as pdf_err:
        log.warning("PDF illisible, ignoré (%s) : %s", path.name, pdf_err)
        return ""
    return "\n".join(text)


EXTRACTORS = {
    ".md": extract_markdown,
    ".markdown": extract_markdown,
    ".pdf": extract_pdf,
}


def extract_text(path: Path) -> str:
    extractor = EXTRACTORS.get(path.suffix.lower())
    if extractor is None:
        return ""
    return extractor(path)


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def chunk_text(text: str, size: int = config.CHUNK_SIZE, overlap: int = config.CHUNK_OVERLAP) -> Generator[str, None, None]:
    """Sliding-window character chunker."""
    text = text.strip()
    if not text:
        return
    start = 0
    while start < len(text):
        end = start + size
        yield text[start:end]
        start += size - overlap


# ---------------------------------------------------------------------------
# Embedding via Ollama
# ---------------------------------------------------------------------------

def embed(texts: list[str]) -> list[list[float]]:
    """Call Ollama /api/embed for a batch of texts."""
    url = f"{config.OLLAMA_BASE_URL}/api/embed"
    response = requests.post(
        url,
        json={"model": config.OLLAMA_EMBED_MODEL, "input": texts},
        timeout=120,
    )
    response.raise_for_status()
    return response.json()["embeddings"]


# ---------------------------------------------------------------------------
# Ingestion pipeline
# ---------------------------------------------------------------------------

def doc_id(file_path: Path, chunk_index: int) -> str:
    base = hashlib.md5(str(file_path.resolve()).encode()).hexdigest()[:8]
    return f"{base}_{chunk_index}"


def ingest_file(path: Path, collection: chromadb.Collection) -> int:
    text = extract_text(path)
    if not text.strip():
        log.warning("Empty or unsupported file: %s", path.name)
        return 0

    chunks = list(chunk_text(text))
    if not chunks:
        return 0

    embeddings = embed(chunks)

    ids = [doc_id(path, i) for i in range(len(chunks))]
    mtime = path.stat().st_mtime
    metadatas = [
        {"source": str(path), "filename": path.name, "chunk": i, "mtime": mtime}
        for i in range(len(chunks))
    ]

    # Upsert so re-ingesting a file updates existing chunks
    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadatas,
    )
    log.info("  ✓ %s — %d chunks ingérés", path.name, len(chunks))
    return len(chunks)


def ingest_directory(docs_dir: str = config.DOCS_DIR) -> None:
    docs_path = Path(docs_dir)
    if not docs_path.exists():
        log.error("Dossier introuvable : %s", docs_dir)
        return

    collection = get_collection()
    total = 0

    files = [p for p in docs_path.rglob("*") if p.suffix.lower() in EXTRACTORS]
    if not files:
        log.warning("Aucun fichier Markdown/PDF trouvé dans %s", docs_dir)
        return

    log.info("Ingestion de %d fichier(s) depuis %s", len(files), docs_dir)
    for file in files:
        total += ingest_file(file, collection)

    log.info("Ingestion terminée — %d chunks au total dans ChromaDB", total)


if __name__ == "__main__":
    ingest_directory()

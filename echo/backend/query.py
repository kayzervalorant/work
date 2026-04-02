"""
query.py — Prend une question, récupère le contexte pertinent dans ChromaDB,
et envoie le tout à Ollama pour générer une réponse.
"""

import logging
from typing import Generator

import requests

import config
from ingest import get_collection, embed

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """Tu es Echo, un assistant personnel local et confidentiel.
Tu réponds uniquement en te basant sur les documents fournis dans le contexte.
Si la réponse ne se trouve pas dans les documents, dis-le clairement.
Sois précis, concis et cite la source quand c'est pertinent."""


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

def retrieve(question: str, top_k: int = config.TOP_K) -> list[dict]:
    """Cherche les chunks les plus proches de la question dans ChromaDB."""
    collection = get_collection()

    if collection.count() == 0:
        log.warning("ChromaDB est vide — lancez ingest.py d'abord.")
        return []

    [question_embedding] = embed([question])

    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        chunks.append({"text": doc, "source": meta.get("filename", "?"), "score": 1 - dist})

    return chunks


def build_prompt(question: str, chunks: list[dict]) -> str:
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        context_parts.append(f"[{i}] Source : {chunk['source']}\n{chunk['text']}")
    context = "\n\n---\n\n".join(context_parts)

    return f"""Contexte extrait des documents :

{context}

---

Question : {question}"""


# ---------------------------------------------------------------------------
# Génération via Ollama (streaming)
# ---------------------------------------------------------------------------

def ask_ollama_stream(prompt: str) -> Generator[str, None, None]:
    """Envoie le prompt à Ollama et yield les tokens au fur et à mesure."""
    url = f"{config.OLLAMA_BASE_URL}/api/chat"
    payload = {
        "model": config.OLLAMA_MODEL,
        "stream": True,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    }

    with requests.post(url, json=payload, stream=True, timeout=120) as resp:
        resp.raise_for_status()
        for line in resp.iter_lines():
            if not line:
                continue
            import json
            data = json.loads(line)
            token = data.get("message", {}).get("content", "")
            if token:
                yield token
            if data.get("done"):
                break


def ask_ollama(prompt: str) -> str:
    """Version non-streaming — retourne la réponse complète."""
    return "".join(ask_ollama_stream(prompt))


# ---------------------------------------------------------------------------
# Fonction principale
# ---------------------------------------------------------------------------

def answer(question: str, stream: bool = False):
    """
    Point d'entrée principal.
    - stream=False : retourne (str_réponse, list[sources])
    - stream=True  : retourne (Generator[str], list[sources])
    """
    chunks = retrieve(question)

    if not chunks:
        msg = "Aucun document pertinent trouvé. Veuillez d'abord ingérer des fichiers."
        return (msg, [])

    prompt = build_prompt(question, chunks)
    sources = list({c["source"] for c in chunks})

    if stream:
        return (ask_ollama_stream(prompt), sources)
    else:
        return (ask_ollama(prompt), sources)


if __name__ == "__main__":
    import sys
    question = " ".join(sys.argv[1:]) or "Que contiennent mes documents ?"
    response, sources = answer(question)
    print(f"\nSources : {', '.join(sources)}\n")
    print(response)

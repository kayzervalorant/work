"""
query.py — Prend une question, récupère le contexte pertinent dans ChromaDB,
et envoie le tout à Ollama pour générer une réponse.
"""

import json
import logging
from typing import Generator

import requests

import config
from ingest import get_collection, embed

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """Tu es Echo, un assistant de contexte ultra-local conçu pour garantir la confidentialité absolue des données de l'utilisateur.
Ta mission est d'aider l'utilisateur en synthétisant et en analysant ses documents personnels et professionnels.

Règles strictes :
- Tu dois baser tes réponses uniquement sur le contexte fourni, issu des documents locaux de l'utilisateur.
- Si la réponse ne se trouve pas dans le contexte fourni, dis simplement : "Je ne trouve pas cette information dans vos documents locaux." N'invente jamais de faits (zéro hallucination).
- Sois direct, concis et professionnel.
- Cite toujours le nom du fichier source lorsque tu donnes une information."""

PROMPT_TEMPLATE = """Contexte extrait des documents :
{context}

Question de l'utilisateur :
{question}"""


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


def build_source_docs(chunks: list[dict]) -> list[dict]:
    """
    Déduplique les chunks par fichier source en gardant le score maximum.
    Retourne une liste triée par pertinence décroissante.
    """
    best: dict[str, float] = {}
    for c in chunks:
        src = c["source"]
        if src not in best or c["score"] > best[src]:
            best[src] = c["score"]
    return sorted(
        [{"filename": src, "score": round(score, 3)} for src, score in best.items()],
        key=lambda x: -x["score"],
    )


def build_prompt(question: str, chunks: list[dict]) -> str:
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        context_parts.append(f"[{i}] Source : {chunk['source']}\n{chunk['text']}")
    context = "\n\n---\n\n".join(context_parts)
    return PROMPT_TEMPLATE.format(context=context, question=question)


# ---------------------------------------------------------------------------
# Génération via Ollama (streaming)
# ---------------------------------------------------------------------------

def ask_ollama_stream(
    prompt: str,
    history: list[dict] | None = None,
) -> Generator[str, None, None]:
    """
    Envoie le prompt à Ollama et yield les tokens au fur et à mesure.

    history : liste de messages précédents au format Ollama
              [{"role": "user"|"assistant", "content": str}, ...]
              Limités aux 10 derniers messages pour éviter un context trop long.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(history[-10:])
    messages.append({"role": "user", "content": prompt})

    url = f"{config.OLLAMA_BASE_URL}/api/chat"
    payload = {
        "model": config.OLLAMA_MODEL,
        "stream": True,
        "messages": messages,
    }

    with requests.post(url, json=payload, stream=True, timeout=120) as resp:
        resp.raise_for_status()
        for line in resp.iter_lines():
            if not line:
                continue
            data = json.loads(line)
            token = data.get("message", {}).get("content", "")
            if token:
                yield token
            if data.get("done"):
                break


def ask_ollama(prompt: str, history: list[dict] | None = None) -> str:
    """Version non-streaming — retourne la réponse complète."""
    return "".join(ask_ollama_stream(prompt, history=history))


# ---------------------------------------------------------------------------
# Fonction principale
# ---------------------------------------------------------------------------

def answer(
    question: str,
    stream: bool = False,
    history: list[dict] | None = None,
) -> tuple:
    """
    Point d'entrée principal.

    Retourne :
      - stream=False : (str_réponse, list[source_docs])
      - stream=True  : (Generator[str], list[source_docs])

    source_docs : [{"filename": str, "score": float}, ...]
    """
    chunks = retrieve(question)

    if not chunks:
        msg = "Aucun document pertinent trouvé. Veuillez d'abord ingérer des fichiers."
        return (msg, [])

    prompt = build_prompt(question, chunks)
    source_docs = build_source_docs(chunks)

    if stream:
        return (ask_ollama_stream(prompt, history=history), source_docs)
    else:
        return (ask_ollama(prompt, history=history), source_docs)


if __name__ == "__main__":
    import sys
    question = " ".join(sys.argv[1:]) or "Que contiennent mes documents ?"
    response, source_docs = answer(question)
    print(f"\nSources : {', '.join(d['filename'] for d in source_docs)}\n")
    print(response)

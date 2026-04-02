"""
query.py — Prend une question, récupère le contexte pertinent dans ChromaDB
(Hybrid RAG : similarité cosinus + bonus récence + bonus nom de fichier),
et envoie le tout à Ollama pour générer une réponse.
"""

import json
import logging
import time
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
# Hybrid RAG — fonctions de scoring secondaires
# ---------------------------------------------------------------------------

def _recency_bonus(mtime: float | None, max_age_days: int = 365) -> float:
    """
    Retourne un bonus [0.0, 0.10] basé sur la fraîcheur du document.
    Un document modifié aujourd'hui obtient +0.10, un document vieux d'un an ou plus : 0.
    """
    if mtime is None:
        return 0.0
    age_secs = time.time() - mtime
    age_days = age_secs / 86_400
    if age_days <= 0:
        return 0.10
    if age_days >= max_age_days:
        return 0.0
    return round(0.10 * (1.0 - age_days / max_age_days), 4)


def _filename_bonus(filename: str, question: str) -> float:
    """
    Retourne un bonus [0.0, 0.10] si des mots significatifs de la question
    apparaissent dans le nom de fichier (insensible à la casse, sans extension).
    """
    stem = filename.rsplit(".", 1)[0].lower().replace("_", " ").replace("-", " ")
    tokens = [t.lower() for t in question.split() if len(t) > 3]
    if not tokens:
        return 0.0
    matches = sum(1 for t in tokens if t in stem)
    return round(0.10 * min(matches / len(tokens), 1.0), 4)


# ---------------------------------------------------------------------------
# Retrieval (Hybrid)
# ---------------------------------------------------------------------------

def retrieve(question: str, top_k: int = config.TOP_K) -> list[dict]:
    """
    Cherche les chunks les plus proches de la question dans ChromaDB,
    puis re-classe selon un score hybride :
      hybrid = cosine × 0.80 + recency_bonus + filename_bonus

    Cela priorise les documents récents et ceux dont le nom correspond à la requête,
    sans sacrifier la pertinence sémantique.
    """
    collection = get_collection()

    if collection.count() == 0:
        log.warning("ChromaDB est vide — lancez l'ingestion d'abord.")
        return []

    [question_embedding] = embed([question])

    # On récupère top_k × 2 candidats pour laisser de la marge au re-ranking
    n_candidates = min(top_k * 2, collection.count())
    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=n_candidates,
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        cosine_score = 1.0 - dist
        mtime: float | None = meta.get("mtime")
        recency = _recency_bonus(mtime)
        fname_match = _filename_bonus(meta.get("filename", ""), question)

        hybrid_score = round(cosine_score * 0.80 + recency + fname_match, 4)

        chunks.append({
            "text": doc,
            "source": meta.get("filename", "?"),
            "score": hybrid_score,   # score exposé au frontend = hybrid
            "cosine": round(cosine_score, 4),
        })

    # Re-tri par score hybride décroissant, on garde les top_k meilleurs
    chunks.sort(key=lambda c: -c["score"])
    return chunks[:top_k]


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
    history : liste de messages précédents [{role, content}], limités aux 10 derniers.
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

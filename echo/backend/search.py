"""
search.py — Recherche web via DuckDuckGo (sans clé API, privacy-first).
Utilisé par query.py pour enrichir le contexte avec des résultats web
tout en gardant les fichiers locaux sécurisés sur la machine.
"""

import logging
from typing import Optional

log = logging.getLogger(__name__)


def web_search(query: str, max_results: int = 4) -> list[dict]:
    """
    Effectue une recherche DuckDuckGo et retourne une liste de résultats.

    Chaque résultat est un dict :
      { "title": str, "url": str, "body": str }

    Retourne [] si duckduckgo_search n'est pas installé ou en cas d'erreur réseau.
    """
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        log.warning(
            "duckduckgo-search non installé — recherche web désactivée. "
            "Installez avec : pip install duckduckgo-search"
        )
        return []

    try:
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "body": r.get("body", ""),
                })
        return results
    except Exception as exc:
        log.warning("Recherche web échouée : %s", exc)
        return []

"""Research orchestration: topic -> queries -> web search -> distilled briefing.

Phase 1 of docs/PRD-web-research-clarify-outline.md.

Degrades gracefully without an LLM: when ``ai_service`` is None (or an LLM call
fails) it uses the topic as the query and concatenates top snippets as the
briefing, so the pipeline is usable — and live-testable — with only a search
key (e.g. Tavily) configured.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional

from .search import SearchProvider, get_search_provider

logger = logging.getLogger(__name__)


def _heuristic_summary(topic: str, results: List, max_chars: int = 1400) -> str:
    """Cheap, LLM-free briefing: numbered title + trimmed snippet + source."""
    lines = [f"关于「{topic}」的联网检索要点："]
    for i, r in enumerate(results, 1):
        snippet = (getattr(r, "content", "") or "").strip().replace("\n", " ")
        if len(snippet) > 240:
            snippet = snippet[:240] + "…"
        lines.append(f"{i}. {getattr(r, 'title', '')}：{snippet}（来源：{getattr(r, 'url', '')}）")
    return "\n".join(lines)[:max_chars]


def run_research(
    topic: str,
    ai_service=None,
    provider: Optional[SearchProvider] = None,
    max_queries: int = 4,
    max_results_per_query: int = 5,
    max_total_results: int = 8,
    language: str = None,
) -> dict:
    """Run the full research pipeline for a topic.

    Returns ``{"research_context": str, "sources": [{"title","url"}], "queries": [str]}``.
    """
    topic = (topic or "").strip()
    if not topic:
        return {"research_context": "", "sources": [], "queries": []}

    provider = provider or get_search_provider()

    # 1) Queries — LLM if available, else the topic itself.
    queries: List[str] = []
    if ai_service is not None:
        try:
            queries = ai_service.generate_search_queries(
                topic, max_queries=max_queries, language=language
            )
        except Exception as e:  # noqa: BLE001 - degrade, never block outline generation
            logger.warning("query generation failed, falling back to topic: %s", e)
    if not queries:
        queries = [topic]

    # 2) Search each query concurrently; dedupe hits by URL.
    results_by_url = {}

    def _search_one(q: str):
        try:
            return provider.search(q, max_results=max_results_per_query).results
        except Exception as e:  # noqa: BLE001
            logger.warning("search failed for %r: %s", q, e)
            return []

    with ThreadPoolExecutor(max_workers=min(4, len(queries))) as executor:
        futures = [executor.submit(_search_one, q) for q in queries]
        for fut in as_completed(futures):
            for r in fut.result():
                url = getattr(r, "url", "")
                if url and url not in results_by_url:
                    results_by_url[url] = r

    results = sorted(
        results_by_url.values(), key=lambda r: getattr(r, "score", 0.0), reverse=True
    )[:max_total_results]

    if not results:
        return {"research_context": "", "sources": [], "queries": queries}

    # 3) Summarize — LLM if available, else heuristic concatenation.
    research_context = ""
    if ai_service is not None:
        try:
            research_context = ai_service.summarize_research(topic, results, language=language)
        except Exception as e:  # noqa: BLE001
            logger.warning("research summary failed, using heuristic: %s", e)
    if not research_context:
        research_context = _heuristic_summary(topic, results)

    sources = [
        {"title": getattr(r, "title", ""), "url": getattr(r, "url", "")} for r in results
    ]
    return {"research_context": research_context, "sources": sources, "queries": queries}

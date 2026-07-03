"""Unit tests for the research orchestration pipeline (search mocked).

`test_run_research_live_fallback` is marked `slow` and hits real Tavily with no
LLM (the fallback path); it auto-skips unless TAVILY_API_KEY is set.
"""
import os
from pathlib import Path

import pytest

from services import research_service
from services.search.base import SearchResponse, SearchResult


class FakeProvider:
    """Returns canned results per query and records calls."""

    def __init__(self, mapping):
        self.mapping = mapping
        self.calls = []

    def search(self, query, max_results=5, search_depth=None):
        self.calls.append(query)
        return SearchResponse(query=query, answer=None, results=self.mapping.get(query, []))


class FakeAI:
    def __init__(self, queries, summary):
        self._queries = queries
        self._summary = summary

    def generate_search_queries(self, topic, max_queries=4, language=None):
        return self._queries

    def summarize_research(self, topic, results, language=None):
        return self._summary


@pytest.mark.unit
def test_run_research_with_llm_dedupes_and_summarizes():
    r1 = SearchResult("A", "https://a", "content a", 0.9)
    r2 = SearchResult("B", "https://b", "content b", 0.5)
    r1_dup = SearchResult("A", "https://a", "content a", 0.9)
    provider = FakeProvider({"q1": [r1, r2], "q2": [r1_dup]})
    ai = FakeAI(["q1", "q2"], "BRIEFING")

    out = research_service.run_research("话题", ai_service=ai, provider=provider)

    assert out["research_context"] == "BRIEFING"
    assert set(provider.calls) == {"q1", "q2"}
    assert out["queries"] == ["q1", "q2"]
    # dedupe by URL -> 2 unique sources, ranked by score (a before b)
    assert [s["url"] for s in out["sources"]] == ["https://a", "https://b"]


@pytest.mark.unit
def test_run_research_fallback_without_llm():
    r1 = SearchResult("标题1", "https://x", "内容片段", 0.8)
    provider = FakeProvider({"话题": [r1]})

    out = research_service.run_research("话题", ai_service=None, provider=provider)

    assert out["queries"] == ["话题"]  # topic-as-query fallback
    assert "标题1" in out["research_context"]  # heuristic summary used
    assert out["sources"][0]["url"] == "https://x"


@pytest.mark.unit
def test_run_research_empty_topic():
    out = research_service.run_research("   ", provider=FakeProvider({}))
    assert out == {"research_context": "", "sources": [], "queries": []}


@pytest.mark.unit
def test_run_research_no_results():
    out = research_service.run_research("话题", ai_service=None, provider=FakeProvider({}))
    assert out["research_context"] == ""
    assert out["sources"] == []


@pytest.mark.slow
def test_run_research_live_fallback():
    """Real Tavily, no LLM (fallback path). Skips without TAVILY_API_KEY."""
    try:
        from dotenv import load_dotenv

        load_dotenv(Path(__file__).resolve().parents[3] / ".env")
    except Exception:
        pass

    key = os.getenv("TAVILY_API_KEY", "").strip()
    if not key or key == "your-api-key-here":
        pytest.skip("TAVILY_API_KEY not set; skipping live research call")

    # Build provider with the explicit key: the test harness loads .env after
    # config import, so Config.TAVILY_API_KEY is frozen empty (prod loads .env first).
    from services.search.tavily_provider import TavilyProvider

    provider = TavilyProvider(api_key=key)
    out = research_service.run_research(
        "2026 年生成式 AI 演示工具 市场", ai_service=None, provider=provider
    )
    assert out["research_context"], "expected a non-empty briefing"
    assert out["sources"], "expected sources"

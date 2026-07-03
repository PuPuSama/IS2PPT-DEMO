"""Unit tests for the Tavily search provider (HTTP mocked, no real key needed).

The mocked tests run anywhere. `test_tavily_live` is marked `slow` and hits the
real Tavily API; it auto-skips unless TAVILY_API_KEY is set (in env or repo .env).
Run the live check with:  uv run pytest tests/unit/test_search_tavily.py -m slow
"""
import os
from pathlib import Path

import pytest
from unittest.mock import MagicMock, patch

from services.search import SearchResponse, get_search_provider
from services.search.tavily_provider import TavilyProvider


FAKE_TAVILY_RESPONSE = {
    "answer": "生成式 AI 演示工具在 2026 年快速增长。",
    "results": [
        {"title": "Result A", "url": "https://a.example.com", "content": "内容 A", "score": 0.91},
        {"title": "Result B", "url": "https://b.example.com", "content": "内容 B", "score": 0.78},
    ],
}


def _mock_response(json_data, status=200):
    m = MagicMock()
    m.json.return_value = json_data
    m.raise_for_status.return_value = None
    m.status_code = status
    return m


@pytest.mark.unit
def test_tavily_parses_results():
    provider = TavilyProvider(api_key="tvly-test-key")
    with patch(
        "services.search.tavily_provider.httpx.post",
        return_value=_mock_response(FAKE_TAVILY_RESPONSE),
    ) as mock_post:
        resp = provider.search("生成式 AI 演示工具 2026 市场", max_results=2)

    assert isinstance(resp, SearchResponse)
    assert resp.answer and "2026" in resp.answer
    assert len(resp.results) == 2
    assert resp.results[0].title == "Result A"
    assert resp.results[0].url == "https://a.example.com"
    assert resp.results[0].score == pytest.approx(0.91)

    # Verify request payload/headers
    _, kwargs = mock_post.call_args
    assert kwargs["json"]["query"].startswith("生成式")
    assert kwargs["json"]["max_results"] == 2
    assert kwargs["json"]["include_answer"] is True
    assert kwargs["headers"]["Authorization"] == "Bearer tvly-test-key"


@pytest.mark.unit
def test_tavily_requires_key():
    provider = TavilyProvider(api_key="")
    assert provider.is_configured() is False
    with pytest.raises(RuntimeError):
        provider.search("anything")


@pytest.mark.unit
def test_factory_returns_tavily():
    provider = get_search_provider("tavily")
    assert isinstance(provider, TavilyProvider)
    assert provider.name == "tavily"


@pytest.mark.slow
def test_tavily_live():
    """Real Tavily call. Skips unless TAVILY_API_KEY is set (env or repo .env)."""
    try:
        from dotenv import load_dotenv

        load_dotenv(Path(__file__).resolve().parents[3] / ".env")
    except Exception:
        pass

    key = os.getenv("TAVILY_API_KEY", "").strip()
    if not key or key == "your-api-key-here":
        pytest.skip("TAVILY_API_KEY not set; skipping live Tavily call")

    provider = TavilyProvider(api_key=key)
    resp = provider.search("OpenAI 最新发布的模型 2026", max_results=3)
    assert resp.results, "live Tavily returned no results"
    assert all(r.url.startswith("http") for r in resp.results)

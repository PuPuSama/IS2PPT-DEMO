"""Tavily web-search provider.

API: POST https://api.tavily.com/search  (docs: https://docs.tavily.com/)
Key resolution: Flask ``app.config`` (settings override at runtime) first, then
``Config``/``.env``. Both ``Authorization: Bearer`` header and the legacy
``api_key`` body field are sent for maximum compatibility across Tavily versions.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config import get_config

from .base import SearchProvider, SearchResponse, SearchResult

logger = logging.getLogger(__name__)


def _cfg(key: str, default=None):
    """Resolve a config value: Flask app.config (runtime/settings) first, then Config/.env."""
    try:
        from flask import current_app, has_app_context

        if has_app_context():
            val = current_app.config.get(key)
            if val not in (None, ""):
                return val
    except Exception:
        pass
    return getattr(get_config(), key, default)


class TavilyProvider(SearchProvider):
    """Web search via the Tavily API."""

    name = "tavily"

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        self.api_key = api_key if api_key is not None else _cfg("TAVILY_API_KEY", "")
        self.base_url = base_url or _cfg("TAVILY_API_BASE", "https://api.tavily.com/search")
        self.timeout = float(timeout or _cfg("TAVILY_TIMEOUT", 30.0))

    def is_configured(self) -> bool:
        return bool(self.api_key)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type((httpx.TransportError, httpx.TimeoutException)),
        reraise=True,
    )
    def search(self, query, max_results=None, search_depth=None) -> SearchResponse:
        if not self.api_key:
            raise RuntimeError(
                "TAVILY_API_KEY 未配置：请在 .env 设置 TAVILY_API_KEY，或在设置中填写。"
            )

        payload = {
            "query": query,
            "api_key": self.api_key,  # legacy body auth; Bearer header also sent below
            "search_depth": search_depth or _cfg("TAVILY_SEARCH_DEPTH", "advanced"),
            "max_results": int(max_results or _cfg("TAVILY_MAX_RESULTS", 5)),
            "include_answer": True,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        logger.info(
            "[tavily] search: %r (depth=%s, max=%s)",
            query,
            payload["search_depth"],
            payload["max_results"],
        )
        resp = httpx.post(self.base_url, json=payload, headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        data = resp.json()

        results = [
            SearchResult(
                title=item.get("title", ""),
                url=item.get("url", ""),
                content=item.get("content", ""),
                score=float(item.get("score", 0.0) or 0.0),
            )
            for item in data.get("results", [])
        ]
        logger.info("[tavily] got %d results for %r", len(results), query)
        return SearchResponse(query=query, answer=data.get("answer"), results=results)

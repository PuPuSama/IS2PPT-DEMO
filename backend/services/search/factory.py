"""Factory for selecting a configured search provider."""
from __future__ import annotations

from typing import Optional

from .base import SearchProvider
from .tavily_provider import TavilyProvider


def _cfg(key: str, default=None):
    try:
        from flask import current_app, has_app_context

        if has_app_context():
            val = current_app.config.get(key)
            if val not in (None, ""):
                return val
    except Exception:
        pass
    from config import get_config

    return getattr(get_config(), key, default)


# Registry of available providers. Add SearXNG/Bocha here later.
_PROVIDERS = {
    "tavily": TavilyProvider,
}


def get_search_provider(name: Optional[str] = None) -> SearchProvider:
    """Return a search provider instance (default from SEARCH_PROVIDER config)."""
    name = (name or _cfg("SEARCH_PROVIDER", "tavily") or "tavily").lower()
    provider_cls = _PROVIDERS.get(name)
    if provider_cls is None:
        raise ValueError(
            f"未知的搜索 provider: {name}（可选: {', '.join(_PROVIDERS)}）"
        )
    return provider_cls()

"""Web search providers (Tavily, ...) for research-augmented outline generation.

Phase 0 of docs/PRD-web-research-clarify-outline.md: a pluggable provider layer
so the rest of the app depends on `SearchProvider` rather than a specific vendor.
"""
from .base import SearchProvider, SearchResponse, SearchResult
from .factory import get_search_provider

__all__ = [
    "SearchProvider",
    "SearchResponse",
    "SearchResult",
    "get_search_provider",
]

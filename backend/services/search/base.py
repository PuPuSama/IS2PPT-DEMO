"""Search provider abstraction for web research.

Defines the `SearchProvider` interface and the result data structures shared by
all concrete providers (Tavily now; SearXNG/Bocha later). Keeping this stable
lets the outline/research pipeline depend on the interface, not the vendor.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class SearchResult:
    """A single search hit."""

    title: str
    url: str
    content: str = ""
    score: float = 0.0

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "url": self.url,
            "content": self.content,
            "score": self.score,
        }


@dataclass
class SearchResponse:
    """Structured result set for a single query."""

    query: str
    answer: Optional[str] = None
    results: List[SearchResult] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "query": self.query,
            "answer": self.answer,
            "results": [r.to_dict() for r in self.results],
        }


class SearchProvider(ABC):
    """Base class for pluggable web-search providers."""

    name: str = "base"

    @abstractmethod
    def search(
        self,
        query: str,
        max_results: Optional[int] = None,
        search_depth: Optional[str] = None,
    ) -> SearchResponse:
        """Run a single search query and return structured results."""
        raise NotImplementedError

    def is_configured(self) -> bool:
        """Whether the provider has the credentials it needs to run."""
        return True

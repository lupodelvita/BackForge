"""Base class for all framework analysis plugins."""
from __future__ import annotations

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from src.models import AnalysisResult


@dataclass
class FrameworkPlugin(ABC):
    """Extend static analysis results with framework-specific knowledge."""

    name: str
    description: str
    #: List of regex patterns; if ANY matches the source code the plugin fires.
    detect_patterns: list[str] = field(default_factory=list)

    # ── detection ──────────────────────────────────────────────────────────────

    def detect(self, code: str) -> tuple[bool, list[str]]:
        """Return (matched, list-of-matched-patterns)."""
        matched: list[str] = []
        for pattern in self.detect_patterns:
            if re.search(pattern, code):
                matched.append(pattern)
        return bool(matched), matched

    # ── enhancement ───────────────────────────────────────────────────────────

    @abstractmethod
    def enhance(self, result: AnalysisResult, code: str) -> AnalysisResult:
        """Add framework-specific tables / endpoints to *result* and return it."""
        ...

    # ── metadata ──────────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "patterns": self.detect_patterns,
        }

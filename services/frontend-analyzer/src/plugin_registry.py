"""Central registry for all framework plugins."""
from __future__ import annotations

from src.models import AnalysisResult
from src.plugins.base import FrameworkPlugin
from src.plugins.flutter import FlutterPlugin
from src.plugins.phaser import PhaserPlugin
from src.plugins.react_native import ReactNativePlugin
from src.plugins.unity import UnityPlugin


class PluginRegistry:
    """Holds all registered plugins and provides detection + enhancement."""

    def __init__(self) -> None:
        self._plugins: list[FrameworkPlugin] = [
            PhaserPlugin(),
            UnityPlugin(),
            FlutterPlugin(),
            ReactNativePlugin(),
        ]

    # ── public API ─────────────────────────────────────────────────────────────

    def list_plugins(self) -> list[dict]:
        return [p.to_dict() for p in self._plugins]

    def detect_framework(self, code: str) -> dict:
        """Return the best-matching framework, confidence score, and matched patterns."""
        best_plugin: FrameworkPlugin | None = None
        best_count = 0
        best_patterns: list[str] = []

        for plugin in self._plugins:
            matched, patterns = plugin.detect(code)
            if matched and len(patterns) > best_count:
                best_plugin = plugin
                best_count = len(patterns)
                best_patterns = patterns

        total_patterns = sum(len(p.detect_patterns) for p in self._plugins)
        confidence = best_count / max(total_patterns, 1) if best_plugin else 0.0

        return {
            "framework": best_plugin.name if best_plugin else None,
            "confidence": round(min(confidence * 4, 1.0), 3),  # normalise to [0,1]
            "matched_patterns": best_patterns,
        }

    def enhance(self, code: str, result: AnalysisResult) -> tuple[AnalysisResult, str | None]:
        """Apply the first matching plugin to *result*.  Returns (result, framework_name)."""
        for plugin in self._plugins:
            matched, _ = plugin.detect(code)
            if matched:
                result = plugin.enhance(result, code)
                return result, plugin.name
        return result, None


# Module-level singleton so FastAPI startup doesn't re-create it on every request.
registry = PluginRegistry()

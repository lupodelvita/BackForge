"""Tests for the Phase 14 plugin system."""
import pytest
from src.models import AnalysisResult
from src.plugins.phaser import PhaserPlugin
from src.plugins.unity import UnityPlugin
from src.plugins.flutter import FlutterPlugin
from src.plugins.react_native import ReactNativePlugin
from src.plugin_registry import PluginRegistry


# ── PhaserPlugin ──────────────────────────────────────────────────────────────

class TestPhaserPlugin:
    def setup_method(self):
        self.plugin = PhaserPlugin()

    def test_detects_phaser_game(self):
        code = "const game = new Phaser.Game(config);"
        matched, patterns = self.plugin.detect(code)
        assert matched
        assert len(patterns) >= 1

    def test_detects_phaser_scene(self):
        code = "class GameScene extends new Phaser.Scene('game') {}"
        matched, _ = self.plugin.detect(code)
        assert matched

    def test_does_not_detect_unrelated(self):
        code = "import React from 'react';"
        matched, _ = self.plugin.detect(code)
        assert not matched

    def test_enhance_adds_tables(self):
        result = AnalysisResult()
        result = self.plugin.enhance(result, "new Phaser.Game(config)")
        names = {t.name for t in result.tables}
        assert "players" in names
        assert "game_sessions" in names
        assert "leaderboard" in names

    def test_enhance_idempotent(self):
        result = AnalysisResult()
        result = self.plugin.enhance(result, "")
        count_before = len(result.tables)
        result = self.plugin.enhance(result, "")  # second call must not duplicate
        assert len(result.tables) == count_before


# ── UnityPlugin ───────────────────────────────────────────────────────────────

class TestUnityPlugin:
    def setup_method(self):
        self.plugin = UnityPlugin()

    def test_detects_monobehaviour(self):
        code = "public class PlayerController : MonoBehaviour {"
        matched, _ = self.plugin.detect(code)
        assert matched

    def test_detects_serialize_field(self):
        code = "[SerializeField] private int health;"
        matched, _ = self.plugin.detect(code)
        assert matched

    def test_enhance_adds_tables(self):
        result = AnalysisResult()
        result = self.plugin.enhance(result, "")
        names = {t.name for t in result.tables}
        assert "game_objects" in names
        assert "player_state" in names
        assert "achievements" in names


# ── FlutterPlugin ─────────────────────────────────────────────────────────────

class TestFlutterPlugin:
    def setup_method(self):
        self.plugin = FlutterPlugin()

    def test_detects_flutter_import(self):
        code = "import 'package:flutter/material.dart';"
        matched, _ = self.plugin.detect(code)
        assert matched

    def test_detects_stateful_widget(self):
        code = "class MyWidget extends StatefulWidget {"
        matched, _ = self.plugin.detect(code)
        assert matched

    def test_enhance_adds_tables(self):
        result = AnalysisResult()
        result = self.plugin.enhance(result, "")
        names = {t.name for t in result.tables}
        assert "user_profiles" in names
        assert "app_settings" in names
        assert "sync_queue" in names


# ── ReactNativePlugin ─────────────────────────────────────────────────────────

class TestReactNativePlugin:
    def setup_method(self):
        self.plugin = ReactNativePlugin()

    def test_detects_react_native_import(self):
        code = "import { View } from 'react-native';"
        matched, _ = self.plugin.detect(code)
        assert matched

    def test_detects_stylesheet(self):
        code = "const styles = StyleSheet.create({ ... });"
        matched, _ = self.plugin.detect(code)
        assert matched

    def test_enhance_adds_tables(self):
        result = AnalysisResult()
        result = self.plugin.enhance(result, "")
        names = {t.name for t in result.tables}
        assert "mobile_users" in names
        assert "push_tokens" in names
        assert "offline_queue" in names


# ── PluginRegistry ────────────────────────────────────────────────────────────

class TestPluginRegistry:
    def setup_method(self):
        self.reg = PluginRegistry()

    def test_list_plugins_returns_all_four(self):
        plugins = self.reg.list_plugins()
        assert len(plugins) == 4
        names = {p["name"] for p in plugins}
        assert names == {"phaser", "unity", "flutter", "react_native"}

    def test_detect_phaser(self):
        code = "const game = new Phaser.Game(config);"
        result = self.reg.detect_framework(code)
        assert result["framework"] == "phaser"
        assert result["confidence"] > 0

    def test_detect_flutter(self):
        code = "import 'package:flutter/material.dart'; class W extends StatefulWidget {}"
        result = self.reg.detect_framework(code)
        assert result["framework"] == "flutter"

    def test_detect_unknown(self):
        code = "const x = 1;"
        result = self.reg.detect_framework(code)
        assert result["framework"] is None
        assert result["confidence"] == 0.0

    def test_enhance_applies_plugin(self):
        code = "StyleSheet.create({}); import { View } from 'react-native';"
        result = AnalysisResult()
        enhanced, fw = self.reg.enhance(code, result)
        assert fw == "react_native"
        names = {t.name for t in enhanced.tables}
        assert "push_tokens" in names

    def test_enhance_noop_on_unknown(self):
        code = "const x = 42;"
        result = AnalysisResult()
        enhanced, fw = self.reg.enhance(code, result)
        assert fw is None
        assert enhanced.tables == []

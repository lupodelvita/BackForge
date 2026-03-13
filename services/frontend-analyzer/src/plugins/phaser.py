"""Phaser.js framework plugin — adds game-centric data model suggestions."""
from __future__ import annotations

from src.models import AnalysisResult, FieldType, SuggestedField, SuggestedTable
from src.plugins.base import FrameworkPlugin


class PhaserPlugin(FrameworkPlugin):
    def __init__(self) -> None:
        super().__init__(
            name="phaser",
            description="Phaser.js 2-D game engine — adds players, sessions, leaderboards",
            detect_patterns=[
                r"Phaser\.Game",
                r"new Phaser\.Scene",
                r"this\.physics",
                r"Phaser\.AUTO",
                r"preload\s*\(\s*\)",
            ],
        )

    def enhance(self, result: AnalysisResult, code: str) -> AnalysisResult:
        existing = {t.name for t in result.tables}

        extra_tables = [
            SuggestedTable(
                name="players",
                reason="Phaser game detected — player identity and scoring",
                fields=[
                    SuggestedField(name="id", field_type=FieldType.UUID, primary_key=True, nullable=False),
                    SuggestedField(name="username", field_type=FieldType.TEXT, unique=True, nullable=False),
                    SuggestedField(name="score", field_type=FieldType.INTEGER),
                    SuggestedField(name="level", field_type=FieldType.INTEGER),
                    SuggestedField(name="created_at", field_type=FieldType.TIMESTAMP),
                ],
            ),
            SuggestedTable(
                name="game_sessions",
                reason="Track individual play sessions for analytics",
                fields=[
                    SuggestedField(name="id", field_type=FieldType.UUID, primary_key=True, nullable=False),
                    SuggestedField(name="player_id", field_type=FieldType.UUID, nullable=False),
                    SuggestedField(name="started_at", field_type=FieldType.TIMESTAMP),
                    SuggestedField(name="ended_at", field_type=FieldType.TIMESTAMP),
                    SuggestedField(name="score", field_type=FieldType.INTEGER),
                    SuggestedField(name="duration_seconds", field_type=FieldType.INTEGER),
                ],
            ),
            SuggestedTable(
                name="leaderboard",
                reason="Global high-score ranking for competitive play",
                fields=[
                    SuggestedField(name="id", field_type=FieldType.UUID, primary_key=True, nullable=False),
                    SuggestedField(name="player_id", field_type=FieldType.UUID, nullable=False),
                    SuggestedField(name="score", field_type=FieldType.INTEGER, nullable=False),
                    SuggestedField(name="rank", field_type=FieldType.INTEGER),
                    SuggestedField(name="recorded_at", field_type=FieldType.TIMESTAMP),
                ],
            ),
        ]

        for table in extra_tables:
            if table.name not in existing:
                result.tables.append(table)

        result.raw_findings.append("Phaser.js plugin: added players, game_sessions, leaderboard tables")
        return result

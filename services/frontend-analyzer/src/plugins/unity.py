"""Unity WebGL / C# plugin — adds game-object persistence tables."""
from __future__ import annotations

from src.models import AnalysisResult, FieldType, SuggestedField, SuggestedTable
from src.plugins.base import FrameworkPlugin


class UnityPlugin(FrameworkPlugin):
    def __init__(self) -> None:
        super().__init__(
            name="unity",
            description="Unity Engine — adds game_objects, player_state, achievements",
            detect_patterns=[
                r"UnityEngine",
                r"MonoBehaviour",
                r"\[SerializeField\]",
                r"UnityEditor",
                r"using Unity",
            ],
        )

    def enhance(self, result: AnalysisResult, code: str) -> AnalysisResult:
        existing = {t.name for t in result.tables}

        extra_tables = [
            SuggestedTable(
                name="game_objects",
                reason="Persist Unity GameObject state across sessions",
                fields=[
                    SuggestedField(name="id", field_type=FieldType.UUID, primary_key=True, nullable=False),
                    SuggestedField(name="player_id", field_type=FieldType.UUID, nullable=False),
                    SuggestedField(name="object_type", field_type=FieldType.TEXT, nullable=False),
                    SuggestedField(name="state_json", field_type=FieldType.JSON),
                    SuggestedField(name="position_x", field_type=FieldType.FLOAT),
                    SuggestedField(name="position_y", field_type=FieldType.FLOAT),
                    SuggestedField(name="position_z", field_type=FieldType.FLOAT),
                    SuggestedField(name="updated_at", field_type=FieldType.TIMESTAMP),
                ],
            ),
            SuggestedTable(
                name="player_state",
                reason="Persistent Unity player progress and inventory",
                fields=[
                    SuggestedField(name="id", field_type=FieldType.UUID, primary_key=True, nullable=False),
                    SuggestedField(name="player_id", field_type=FieldType.UUID, unique=True, nullable=False),
                    SuggestedField(name="level", field_type=FieldType.INTEGER),
                    SuggestedField(name="experience", field_type=FieldType.INTEGER),
                    SuggestedField(name="inventory_json", field_type=FieldType.JSON),
                    SuggestedField(name="last_checkpoint", field_type=FieldType.TEXT),
                    SuggestedField(name="saved_at", field_type=FieldType.TIMESTAMP),
                ],
            ),
            SuggestedTable(
                name="achievements",
                reason="Trophy / badge system for player milestones",
                fields=[
                    SuggestedField(name="id", field_type=FieldType.UUID, primary_key=True, nullable=False),
                    SuggestedField(name="player_id", field_type=FieldType.UUID, nullable=False),
                    SuggestedField(name="achievement_key", field_type=FieldType.TEXT, nullable=False),
                    SuggestedField(name="unlocked_at", field_type=FieldType.TIMESTAMP),
                ],
            ),
        ]

        for table in extra_tables:
            if table.name not in existing:
                result.tables.append(table)

        result.raw_findings.append("Unity plugin: added game_objects, player_state, achievements tables")
        return result

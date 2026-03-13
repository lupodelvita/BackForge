"""Flutter plugin — adds mobile-first user profile and sync tables."""
from __future__ import annotations

from src.models import AnalysisResult, FieldType, SuggestedField, SuggestedTable
from src.plugins.base import FrameworkPlugin


class FlutterPlugin(FrameworkPlugin):
    def __init__(self) -> None:
        super().__init__(
            name="flutter",
            description="Flutter / Dart mobile — adds user_profiles, app_settings, sync_queue",
            detect_patterns=[
                r"package:flutter/",
                r"StatefulWidget",
                r"StreamBuilder",
                r"BuildContext",
                r"flutter_bloc",
                r"provider\.dart",
            ],
        )

    def enhance(self, result: AnalysisResult, code: str) -> AnalysisResult:
        existing = {t.name for t in result.tables}

        extra_tables = [
            SuggestedTable(
                name="user_profiles",
                reason="Flutter app user identity and preferences",
                fields=[
                    SuggestedField(name="id", field_type=FieldType.UUID, primary_key=True, nullable=False),
                    SuggestedField(name="display_name", field_type=FieldType.TEXT),
                    SuggestedField(name="avatar_url", field_type=FieldType.TEXT),
                    SuggestedField(name="locale", field_type=FieldType.TEXT),
                    SuggestedField(name="theme", field_type=FieldType.TEXT),
                    SuggestedField(name="created_at", field_type=FieldType.TIMESTAMP),
                    SuggestedField(name="updated_at", field_type=FieldType.TIMESTAMP),
                ],
            ),
            SuggestedTable(
                name="app_settings",
                reason="Per-user app configuration persisted server-side",
                fields=[
                    SuggestedField(name="id", field_type=FieldType.UUID, primary_key=True, nullable=False),
                    SuggestedField(name="user_id", field_type=FieldType.UUID, unique=True, nullable=False),
                    SuggestedField(name="settings_json", field_type=FieldType.JSON),
                    SuggestedField(name="updated_at", field_type=FieldType.TIMESTAMP),
                ],
            ),
            SuggestedTable(
                name="sync_queue",
                reason="Offline-first operation queue for Flutter sync",
                fields=[
                    SuggestedField(name="id", field_type=FieldType.UUID, primary_key=True, nullable=False),
                    SuggestedField(name="user_id", field_type=FieldType.UUID, nullable=False),
                    SuggestedField(name="operation", field_type=FieldType.TEXT, nullable=False),
                    SuggestedField(name="payload_json", field_type=FieldType.JSON),
                    SuggestedField(name="status", field_type=FieldType.TEXT),
                    SuggestedField(name="created_at", field_type=FieldType.TIMESTAMP),
                    SuggestedField(name="synced_at", field_type=FieldType.TIMESTAMP),
                ],
            ),
        ]

        for table in extra_tables:
            if table.name not in existing:
                result.tables.append(table)

        result.raw_findings.append("Flutter plugin: added user_profiles, app_settings, sync_queue tables")
        return result

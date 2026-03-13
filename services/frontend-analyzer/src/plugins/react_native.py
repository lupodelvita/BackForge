"""React Native plugin — adds mobile user, push token, and offline queue tables."""
from __future__ import annotations

from src.models import AnalysisResult, FieldType, SuggestedField, SuggestedTable
from src.plugins.base import FrameworkPlugin


class ReactNativePlugin(FrameworkPlugin):
    def __init__(self) -> None:
        super().__init__(
            name="react_native",
            description="React Native — adds mobile_users, push_tokens, offline_queue",
            detect_patterns=[
                r"react-native",
                r"StyleSheet\.create",
                r"AsyncStorage",
                r"from '@react-native",
                r"from 'react-native'",
                r"NativeModules",
            ],
        )

    def enhance(self, result: AnalysisResult, code: str) -> AnalysisResult:
        existing = {t.name for t in result.tables}

        extra_tables = [
            SuggestedTable(
                name="mobile_users",
                reason="React Native user identity with device info",
                fields=[
                    SuggestedField(name="id", field_type=FieldType.UUID, primary_key=True, nullable=False),
                    SuggestedField(name="email", field_type=FieldType.TEXT, unique=True),
                    SuggestedField(name="display_name", field_type=FieldType.TEXT),
                    SuggestedField(name="platform", field_type=FieldType.TEXT),
                    SuggestedField(name="app_version", field_type=FieldType.TEXT),
                    SuggestedField(name="created_at", field_type=FieldType.TIMESTAMP),
                ],
            ),
            SuggestedTable(
                name="push_tokens",
                reason="Store FCM/APNs push notification tokens per device",
                fields=[
                    SuggestedField(name="id", field_type=FieldType.UUID, primary_key=True, nullable=False),
                    SuggestedField(name="user_id", field_type=FieldType.UUID, nullable=False),
                    SuggestedField(name="token", field_type=FieldType.TEXT, unique=True, nullable=False),
                    SuggestedField(name="platform", field_type=FieldType.TEXT),
                    SuggestedField(name="registered_at", field_type=FieldType.TIMESTAMP),
                    SuggestedField(name="active", field_type=FieldType.BOOLEAN),
                ],
            ),
            SuggestedTable(
                name="offline_queue",
                reason="Persist operations made while offline for later sync",
                fields=[
                    SuggestedField(name="id", field_type=FieldType.UUID, primary_key=True, nullable=False),
                    SuggestedField(name="user_id", field_type=FieldType.UUID, nullable=False),
                    SuggestedField(name="action_type", field_type=FieldType.TEXT, nullable=False),
                    SuggestedField(name="payload_json", field_type=FieldType.JSON),
                    SuggestedField(name="retry_count", field_type=FieldType.INTEGER),
                    SuggestedField(name="queued_at", field_type=FieldType.TIMESTAMP),
                    SuggestedField(name="processed_at", field_type=FieldType.TIMESTAMP),
                ],
            ),
        ]

        for table in extra_tables:
            if table.name not in existing:
                result.tables.append(table)

        result.raw_findings.append("ReactNative plugin: added mobile_users, push_tokens, offline_queue tables")
        return result

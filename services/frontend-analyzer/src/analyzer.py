import uuid
from datetime import datetime, timezone
from src.models import (
    AnalysisResult, AnalyzeRequest, SuggestedTable,
    SuggestedEndpoint, SuggestedField, FieldType,
)
from src.static_analyzer import StaticAnalyzer, infer_table_name
from src.ollama_client import OllamaClient
from src.config import settings
import logging

logger = logging.getLogger(__name__)


def _build_project_state_json(project_name: str, result: AnalysisResult) -> dict:
    """Конвертировать AnalysisResult в project_state.json формат BackForge"""
    tables = []
    for t in result.tables:
        fields = [
            {
                "id": str(uuid.uuid4()),
                "name": f.name,
                "field_type": f.field_type.value,
                "nullable": f.nullable,
                "unique": f.unique,
                "primary_key": f.primary_key,
                "default_value": None,
            }
            for f in t.fields
        ]
        tables.append({
            "id": str(uuid.uuid4()),
            "name": t.name,
            "fields": fields,
            "indexes": [],
        })

    now = datetime.now(timezone.utc).isoformat()
    return {
        "meta": {
            "id": str(uuid.uuid4()),
            "name": project_name,
            "description": "Auto-generated from frontend code analysis",
            "created_at": now,
            "updated_at": now,
            "version": 1,
        },
        "schema": {"tables": tables},
    }


class FrontendAnalyzer:
    def __init__(self) -> None:
        self.static = StaticAnalyzer()
        self.ollama = OllamaClient(
            base_url=settings.ollama_url,
            model=settings.ollama_model,
            timeout_secs=settings.ollama_timeout_secs,
        )

    async def analyze(self, request: AnalyzeRequest) -> AnalysisResult:
        # --- Этап 1: Статический анализ ---
        api_calls = self.static.extract_api_calls(request.code, request.language)
        interfaces = self.static.extract_interfaces(request.code, request.language)

        raw_findings = [f"{c.method} {c.path}" for c in api_calls]
        raw_findings += [f"Interface: {i.name}" for i in interfaces]

        tables_map: dict[str, SuggestedTable] = {}
        for call in api_calls:
            table_name = infer_table_name(call.path)
            if table_name not in tables_map:
                tables_map[table_name] = SuggestedTable(
                    name=table_name,
                    fields=[
                        SuggestedField(name="id", field_type=FieldType.UUID, nullable=False, primary_key=True, reason="Primary key"),
                        SuggestedField(name="created_at", field_type=FieldType.TIMESTAMP, nullable=True, reason="Audit field"),
                    ],
                    reason=f"Found from API call: {call.method} {call.path}",
                )

        for interface in interfaces:
            table_name = interface.name.lower() + "s"
            if table_name in tables_map:
                existing_names = {f.name for f in tables_map[table_name].fields}
                for f in interface.fields:
                    if f.name not in existing_names and f.name != "id":
                        tables_map[table_name].fields.append(f)
            else:
                tables_map[table_name] = SuggestedTable(
                    name=table_name,
                    fields=interface.fields,
                    reason=f"Created from interface: {interface.name}",
                )

        endpoints = [
            SuggestedEndpoint(
                path=c.path,
                method=c.method,
                table_name=infer_table_name(c.path),
                found_in_code=c.found_in_code,
            )
            for c in api_calls
        ]

        result = AnalysisResult(
            tables=list(tables_map.values()),
            endpoints=endpoints,
            confidence=0.6 if tables_map else 0.0,
            raw_findings=raw_findings,
            ai_enhanced=False,
        )

        # --- Этап 2: AI Enhancement ---
        if request.use_ai and api_calls:
            ai_result = await self.ollama.enhance_schema(
                api_calls=[f"{c.method} {c.path}" for c in api_calls],
                interfaces=[
                    f"{i.name} {{ {', '.join(f.name + ': ' + f.field_type.value for f in i.fields)} }}"
                    for i in interfaces
                ],
                project_name=request.project_name,
            )
            if ai_result:
                result = self._merge_ai_result(result, ai_result)
                result.ai_enhanced = True
                result.confidence = min(0.95, result.confidence + 0.3)

        return result

    def _merge_ai_result(self, base: AnalysisResult, ai: dict) -> AnalysisResult:
        ai_tables = [
            SuggestedTable(
                name=t["name"],
                fields=[
                    SuggestedField(
                        name=f["name"],
                        field_type=FieldType(f.get("field_type", "text")),
                        nullable=f.get("nullable", True),
                        primary_key=f.get("primary_key", False),
                        unique=f.get("unique", False),
                        reason=f.get("reason", ""),
                    )
                    for f in t.get("fields", [])
                ],
                reason=t.get("reason", "AI suggestion"),
            )
            for t in ai.get("tables", [])
        ]
        ai_endpoints = [
            SuggestedEndpoint(
                path=e["path"],
                method=e["method"],
                table_name=e.get("table_name"),
                description=e.get("description", ""),
            )
            for e in ai.get("endpoints", [])
        ]
        return AnalysisResult(
            tables=ai_tables if ai_tables else base.tables,
            endpoints=ai_endpoints if ai_endpoints else base.endpoints,
            confidence=base.confidence,
            raw_findings=base.raw_findings,
            ai_enhanced=base.ai_enhanced,
        )

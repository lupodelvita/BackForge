from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class FieldType(str, Enum):
    TEXT = "text"
    INTEGER = "integer"
    BIG_INT = "big_int"
    FLOAT = "float"
    BOOLEAN = "boolean"
    UUID = "uuid"
    TIMESTAMP = "timestamp"
    JSON = "json"
    BYTES = "bytes"


class SuggestedField(BaseModel):
    name: str
    field_type: FieldType
    nullable: bool = True
    primary_key: bool = False
    unique: bool = False
    reason: str = ""


class SuggestedTable(BaseModel):
    name: str
    fields: list[SuggestedField]
    reason: str = ""


class SuggestedEndpoint(BaseModel):
    path: str
    method: str
    table_name: str | None = None
    description: str = ""
    found_in_code: str = ""


class AnalysisResult(BaseModel):
    tables: list[SuggestedTable] = []
    endpoints: list[SuggestedEndpoint] = []
    confidence: float = 0.0
    raw_findings: list[str] = []
    ai_enhanced: bool = False


class AnalyzeRequest(BaseModel):
    code: str = Field(..., description="Frontend код для анализа")
    language: str = Field(default="typescript", description="javascript | typescript | python | dart | swift | kotlin")
    project_name: str = Field(default="analyzed-project")
    use_ai: bool = Field(default=True, description="Использовать Ollama для улучшения результатов")


class AnalyzeResponse(BaseModel):
    project_name: str
    language: str
    result: AnalysisResult
    project_state_json: dict[str, Any]

import re
from dataclasses import dataclass, field
from src.models import FieldType, SuggestedField


@dataclass
class ApiCallFinding:
    path: str
    method: str
    found_in_code: str = ""


@dataclass
class InterfaceFinding:
    name: str
    fields: list[SuggestedField] = field(default_factory=list)


def infer_table_name(path: str) -> str:
    """Из пути /api/v1/user-profiles → user_profiles"""
    parts = [p for p in path.split("/") if p]
    if parts and parts[0] == "api":
        parts = parts[1:]
    if parts and re.match(r"^v\d+$", parts[0]):
        parts = parts[1:]
    # Убрать динамические сегменты :id, {id}, [id], <id>, числа
    parts = [p for p in parts if not re.match(r"^[:{[<]|^\d+$", p)]
    if not parts:
        return "unknown"
    name = parts[-1]
    return name.replace("-", "_").replace(".", "_").lower()


def _ts_type_to_field_type(ts_type: str) -> FieldType:
    mapping: dict[str, FieldType] = {
        "string": FieldType.TEXT,
        "String": FieldType.TEXT,
        "number": FieldType.FLOAT,
        "int": FieldType.INTEGER,
        "integer": FieldType.INTEGER,
        "boolean": FieldType.BOOLEAN,
        "bool": FieldType.BOOLEAN,
        "date": FieldType.TIMESTAMP,
        "Date": FieldType.TIMESTAMP,
        "uuid": FieldType.UUID,
        "Uuid": FieldType.UUID,
        "UUID": FieldType.UUID,
        "any": FieldType.JSON,
        "object": FieldType.JSON,
        "Buffer": FieldType.BYTES,
        "Uint8Array": FieldType.BYTES,
        "bigint": FieldType.BIG_INT,
        "BigInt": FieldType.BIG_INT,
    }
    return mapping.get(ts_type, FieldType.TEXT)


class StaticAnalyzer:
    """
    Статический анализатор frontend кода.
    Этап 1: без AI — только regex.
    """

    FETCH_PATTERNS = [
        (r"fetch\(['\"]([^'\"]+)['\"],\s*\{[^}]*method:\s*['\"](\w+)['\"]", None),
        (r"fetch\(['\"]([^'\"]+)['\"]", "GET"),
    ]

    AXIOS_PATTERNS = [
        (r"axios\.get\(['\"]([^'\"]+)['\"]", "GET"),
        (r"axios\.post\(['\"]([^'\"]+)['\"]", "POST"),
        (r"axios\.put\(['\"]([^'\"]+)['\"]", "PUT"),
        (r"axios\.patch\(['\"]([^'\"]+)['\"]", "PATCH"),
        (r"axios\.delete\(['\"]([^'\"]+)['\"]", "DELETE"),
    ]

    HTTP_PATTERNS = [
        (r'requests\.get\(["\']([^"\']+)["\']', "GET"),
        (r'requests\.post\(["\']([^"\']+)["\']', "POST"),
        (r'requests\.put\(["\']([^"\']+)["\']', "PUT"),
        (r'requests\.delete\(["\']([^"\']+)["\']', "DELETE"),
        (r'dio\.get\(["\']([^"\']+)["\']', "GET"),
        (r'dio\.post\(["\']([^"\']+)["\']', "POST"),
    ]

    INTERFACE_PATTERN = re.compile(
        r"(?:interface|type)\s+(\w+)\s*(?:=\s*)?\{([^}]+)\}",
        re.DOTALL,
    )
    FIELD_PATTERN = re.compile(r"(\w+)\??\s*:\s*([\w<>\[\]|.]+)")

    def extract_api_calls(self, code: str, language: str) -> list[ApiCallFinding]:
        if not code.strip():
            return []
        findings: list[ApiCallFinding] = []
        seen: set[tuple[str, str]] = set()

        for pattern, default_method in self.FETCH_PATTERNS:
            for match in re.finditer(pattern, code):
                path = match.group(1)
                if not (path.startswith("/") or path.startswith("http")):
                    continue
                if default_method is None and match.lastindex >= 2:
                    method = match.group(2).upper()
                else:
                    method = default_method or "GET"
                key = (path, method)
                if key not in seen:
                    seen.add(key)
                    findings.append(ApiCallFinding(path=path, method=method, found_in_code=match.group(0)[:80]))

        for pattern, method in self.AXIOS_PATTERNS + self.HTTP_PATTERNS:
            for match in re.finditer(pattern, code):
                path = match.group(1)
                key = (path, method)
                if key not in seen:
                    seen.add(key)
                    findings.append(ApiCallFinding(path=path, method=method, found_in_code=match.group(0)[:80]))

        return findings

    def extract_interfaces(self, code: str, language: str) -> list[InterfaceFinding]:
        findings = []
        for match in self.INTERFACE_PATTERN.finditer(code):
            name = match.group(1)
            body = match.group(2)
            fields: list[SuggestedField] = []
            for field_match in self.FIELD_PATTERN.finditer(body):
                field_name = field_match.group(1)
                ts_type = field_match.group(2).split("|")[0].strip().replace("[]", "").strip()
                nullable = "?" in field_match.group(0) or "|" in field_match.group(2)
                fields.append(SuggestedField(
                    name=field_name,
                    field_type=_ts_type_to_field_type(ts_type),
                    nullable=nullable,
                    primary_key=(field_name.lower() in ("id", "uuid")),
                ))
            if fields:
                findings.append(InterfaceFinding(name=name, fields=fields))
        return findings

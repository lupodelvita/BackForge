import json
import httpx
from typing import Any
import logging

logger = logging.getLogger(__name__)

SCHEMA_PROMPT_TEMPLATE = """You are a backend schema designer. Analyze these frontend code findings and suggest a database schema.

Frontend API calls found:
{api_calls}

TypeScript/JavaScript interfaces found:
{interfaces}

Project name: {project_name}

Respond with ONLY valid JSON matching this structure (no markdown, no explanation):
{{
  "tables": [
    {{
      "name": "table_name",
      "fields": [
        {{
          "name": "field_name",
          "field_type": "uuid|text|integer|big_int|float|boolean|timestamp|json|bytes",
          "nullable": true,
          "primary_key": false,
          "unique": false,
          "reason": "why this field"
        }}
      ],
      "reason": "why this table"
    }}
  ],
  "endpoints": [
    {{
      "path": "/api/path",
      "method": "GET",
      "table_name": "related_table",
      "description": "what this endpoint does"
    }}
  ]
}}

Rules:
- Every table MUST have an 'id' field of type 'uuid' as primary key
- Add 'created_at' timestamp to every table
- Infer table names from API paths (e.g., /api/users → users table)
- Use interfaces to define accurate field types
"""


class OllamaClient:
    def __init__(self, base_url: str, model: str, timeout_secs: int = 60):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._http = httpx.AsyncClient(timeout=timeout_secs)

    async def enhance_schema(
        self,
        api_calls: list[str],
        interfaces: list[str],
        project_name: str,
    ) -> dict[str, Any] | None:
        """Отправить контекст в Ollama. Возвращает None если недоступна."""
        prompt = SCHEMA_PROMPT_TEMPLATE.format(
            api_calls="\n".join(f"  - {c}" for c in api_calls) or "  (none found)",
            interfaces="\n".join(f"  - {i}" for i in interfaces) or "  (none found)",
            project_name=project_name,
        )
        try:
            response = await self._http.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
            )
            response.raise_for_status()
            content = response.json()["message"]["content"].strip()
            # Убрать markdown code blocks если есть
            if "```" in content:
                parts = content.split("```")
                content = parts[1] if len(parts) > 1 else content
                if content.startswith("json"):
                    content = content[4:]
            return json.loads(content)
        except httpx.ConnectError:
            logger.warning("Ollama not available at %s — skipping AI enhancement", self.base_url)
            return None
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning("Failed to parse Ollama response: %s", e)
            return None
        except Exception as e:
            logger.error("Ollama error: %s", e)
            return None

    async def aclose(self) -> None:
        await self._http.aclose()

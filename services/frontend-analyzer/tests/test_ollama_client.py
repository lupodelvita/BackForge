import pytest
import httpx
from unittest.mock import AsyncMock, patch
from src.ollama_client import OllamaClient


@pytest.mark.asyncio
async def test_ollama_client_enhance_schema():
    mock_response = {
        "message": {
            "content": '{"tables": [{"name": "users", "fields": [{"name": "id", "field_type": "uuid", "nullable": false, "primary_key": true, "unique": false, "reason": "Primary key"}], "reason": "Found GET /api/users"}], "endpoints": []}'
        }
    }
    client = OllamaClient(base_url="http://localhost:11434", model="mistral")
    with patch.object(client._http, "post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = httpx.Response(
            200,
            json=mock_response,
            request=httpx.Request("POST", "http://localhost:11434/api/chat"),
        )
        result = await client.enhance_schema(
            api_calls=["/api/users GET"],
            interfaces=["User { id: string; email: string; }"],
            project_name="shop",
        )
    assert result is not None
    assert "tables" in result
    await client.aclose()


@pytest.mark.asyncio
async def test_ollama_client_returns_none_on_error():
    client = OllamaClient(base_url="http://localhost:11434", model="mistral")
    with patch.object(client._http, "post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = httpx.ConnectError("Connection refused")
        result = await client.enhance_schema(
            api_calls=["/api/test GET"],
            interfaces=[],
            project_name="test",
        )
    assert result is None
    await client.aclose()

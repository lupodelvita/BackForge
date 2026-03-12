import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock


def test_health():
    from src.main import app
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_analyze_typescript_no_ai():
    from src.main import app
    code = """
    const users = await fetch('/api/users');
    const product = await axios.get('/api/products');

    interface User {
        id: string;
        email: string;
        name: string;
    }
    """
    with patch("src.analyzer.OllamaClient.enhance_schema", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = None  # Ollama недоступна
        with TestClient(app) as client:
            response = client.post("/analyze", json={
                "code": code,
                "language": "typescript",
                "project_name": "shop",
                "use_ai": False,
            })

    assert response.status_code == 200
    data = response.json()
    assert data["project_name"] == "shop"
    assert len(data["result"]["tables"]) > 0
    assert len(data["result"]["endpoints"]) > 0
    assert data["result"]["ai_enhanced"] is False
    assert "meta" in data["project_state_json"]
    assert "schema" in data["project_state_json"]


def test_analyze_returns_endpoints():
    from src.main import app
    code = """
    await axios.post('/api/orders', payload);
    await axios.get('/api/orders');
    await axios.delete('/api/orders/1');
    """
    with TestClient(app) as client:
        response = client.post("/analyze", json={
            "code": code,
            "language": "typescript",
            "project_name": "orders-app",
            "use_ai": False,
        })

    assert response.status_code == 200
    endpoints = response.json()["result"]["endpoints"]
    methods = {(e["path"], e["method"]) for e in endpoints}
    assert ("/api/orders", "POST") in methods
    assert ("/api/orders", "GET") in methods

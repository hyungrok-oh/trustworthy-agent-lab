import pytest
from httpx import ASGITransport, AsyncClient

from eval.main import create_app


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app) -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient) -> None:
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "eval"


@pytest.mark.asyncio
async def test_receive_trace_and_flush(client: AsyncClient) -> None:
    # Send a step trace
    step_data = {
        "trace_id": "integration-001",
        "step_id": 0,
        "step_type": "llm_call",
        "is_first": True,
        "is_last": True,
        "input": {"prompt": "hello"},
        "output": {"response": "hi"},
        "confidence": 0.85,
        "reasoning": "test",
        "dynamics": {"confidence_delta": 0.0, "trend": "stable"},
        "stability": {"output_consistency": 1.0},
        "started_at": "2026-04-15T10:00:00Z",
        "duration_ms": 100.0,
    }
    response = await client.post("/api/traces", json=step_data)
    assert response.status_code == 200

    # Flush and get metrics
    response = await client.post("/api/traces/integration-001/flush")
    assert response.status_code == 200
    data = response.json()
    assert data["trace_id"] == "integration-001"
    assert len(data["metrics"]) == 1
    assert data["metrics"][0]["success"] is True
    assert data["metrics"][0]["confidence_level"] == "confident"

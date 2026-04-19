import pytest
from httpx import ASGITransport, AsyncClient

from agent.config import Settings
from agent.main import create_app


@pytest.fixture
def app():
    settings = Settings(mongodb_enabled=False)
    return create_app(settings)


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
    assert data["service"] == "agent"

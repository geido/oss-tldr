import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient

from api import people, prs
from middleware.auth import get_current_user


@pytest.fixture
def test_app() -> FastAPI:
    app = FastAPI(title="oss-tldr-test")

    # Health for smoke checks
    @app.get("/health")
    async def health():
        return {"status": "ok"}

    app.include_router(prs.router, prefix="/api/v1", tags=["prs"])
    app.include_router(people.router, prefix="/api/v1", tags=["people"])

    class FakeAuth:
        def __init__(self) -> None:
            self.github = object()
            self.user = {"login": "tester"}

    def fake_current_user(request: Request):
        return FakeAuth()

    app.dependency_overrides[get_current_user] = fake_current_user
    return app


@pytest.fixture
async def client(test_app: FastAPI):
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"

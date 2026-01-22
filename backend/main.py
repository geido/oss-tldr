from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import create_api_router
from database.connection import init_db, close_db


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore
    """Manage application lifecycle (database connection)."""
    # Startup: Initialize database connection
    await init_db()
    yield
    # Shutdown: Close database connection
    await close_db()


app = FastAPI(title="OSS TL;DR Backend", lifespan=lifespan)

# Configure CORS
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "message": "OSS TL;DR is alive!"}


# Include API router with all routes
app.include_router(create_api_router(), prefix="/api/v1")

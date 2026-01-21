from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from api import (
    auth,
    deepdive,
    diff,
    issues,
    people,
    prs,
    repos,
    tldr,
    reports,
    user_repos,
)
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


# Include routers
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(tldr.router, prefix="/api/v1", tags=["tldr"])
app.include_router(issues.router, prefix="/api/v1", tags=["issues"])
app.include_router(prs.router, prefix="/api/v1", tags=["prs"])
app.include_router(people.router, prefix="/api/v1", tags=["people"])
app.include_router(diff.router, prefix="/api/v1", tags=["diff"])
app.include_router(deepdive.router, prefix="/api/v1", tags=["deepdive"])
app.include_router(repos.router, prefix="/api/v1", tags=["repos"])
app.include_router(reports.router, prefix="/api/v1", tags=["reports"])
app.include_router(user_repos.router, prefix="/api/v1", tags=["user_repos"])

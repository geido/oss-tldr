from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from api import auth, deepdive, diff, issues, people, prs, repos, tldr

app = FastAPI(title="OSS TL;DR Backend")

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


app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(tldr.router, prefix="/api/v1", tags=["tldr"])
app.include_router(issues.router, prefix="/api/v1", tags=["issues"])
app.include_router(prs.router, prefix="/api/v1", tags=["prs"])
app.include_router(people.router, prefix="/api/v1", tags=["people"])
app.include_router(diff.router, prefix="/api/v1", tags=["diff"])
app.include_router(deepdive.router, prefix="/api/v1", tags=["deepdive"])
app.include_router(repos.router, prefix="/api/v1", tags=["repos"])

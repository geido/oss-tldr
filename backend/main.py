from fastapi import FastAPI

from api import deepdive, diff, issues, people, prs, tldr

app = FastAPI(title="OSS TL;DR Backend")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "message": "OSS TL;DR is alive!"}


app.include_router(tldr.router, prefix="/api/v1", tags=["tldr"])
app.include_router(issues.router, prefix="/api/v1", tags=["issues"])
app.include_router(prs.router, prefix="/api/v1", tags=["prs"])
app.include_router(people.router, prefix="/api/v1", tags=["people"])
app.include_router(diff.router, prefix="/api/v1", tags=["diff"])
app.include_router(deepdive.router, prefix="/api/v1", tags=["deepdive"])

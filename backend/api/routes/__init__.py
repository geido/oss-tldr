"""API routes package."""
from fastapi import APIRouter

from . import auth, deepdive, diff, groups, reports, repos, users


def create_api_router() -> APIRouter:
    """Create and configure the main API router with all sub-routers."""
    api_router = APIRouter()

    # Include all route modules
    api_router.include_router(auth.router, tags=["auth"])
    api_router.include_router(diff.router, tags=["diff"])
    api_router.include_router(deepdive.router, tags=["deepdive"])
    api_router.include_router(repos.router, tags=["repos"])
    api_router.include_router(groups.router, tags=["groups"])
    api_router.include_router(reports.router, tags=["reports"])
    api_router.include_router(users.router, tags=["users"])

    return api_router


__all__ = [
    "create_api_router",
    "auth",
    "deepdive",
    "diff",
    "groups",
    "reports",
    "repos",
    "users",
]

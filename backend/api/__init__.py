"""
API package for OSS TL;DR backend.

This package provides a clean separation of concerns:
- schemas/: Request and response Pydantic models
- routes/: FastAPI route handlers
- helpers/: Utility functions for route handling

Usage:
    from api.routes import create_api_router
    api_router = create_api_router()
    app.include_router(api_router, prefix="/api/v1")
"""
from api.routes import create_api_router

__all__ = ["create_api_router"]

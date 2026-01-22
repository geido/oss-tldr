"""Authentication-related request/response schemas."""
from typing import Optional

from pydantic import BaseModel
from typing_extensions import TypedDict


class UserPayload(TypedDict):
    """User data payload structure."""

    id: int
    login: str
    name: Optional[str]
    avatar_url: Optional[str]
    email: Optional[str]


class AuthUrlResponse(BaseModel):
    """Response containing GitHub OAuth authorization URL."""

    auth_url: str
    state: str


class CallbackRequest(BaseModel):
    """Request containing OAuth callback data."""

    code: str
    state: str


class CallbackResponse(BaseModel):
    """Response after successful OAuth callback."""

    access_token: str
    user: UserPayload
    expires_at: str


class ValidateResponse(BaseModel):
    """Response for token validation."""

    valid: bool
    user: Optional[UserPayload] = None
    expires_at: Optional[str] = None

import secrets
from datetime import datetime, timedelta
from typing import Any, Dict
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from config import (
    FRONTEND_URL,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    JWT_ALGORITHM,
    JWT_EXPIRE_HOURS,
    JWT_SECRET,
)

router = APIRouter()


class AuthUrlResponse(BaseModel):
    auth_url: str
    state: str


class CallbackRequest(BaseModel):
    code: str
    state: str


class CallbackResponse(BaseModel):
    access_token: str
    user: Dict[str, Any]
    expires_at: str


class ValidateResponse(BaseModel):
    valid: bool
    user: Dict[str, Any] | None = None
    expires_at: str | None = None


@router.get("/auth/github/login")
async def github_login() -> AuthUrlResponse:
    """
    Generate GitHub OAuth authorization URL.

    Scopes requested:
    - repo: Access to public and private repositories (GitHub doesn't offer read-only private repo access)
    - read:user: Basic user profile information

    Note: OSS TL;DR only performs READ operations - we never write, modify, or delete repository data.
    """
    if not GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth not configured",
        )

    # Generate random state for CSRF protection
    state = secrets.token_urlsafe(32)

    # GitHub OAuth parameters - repo scope needed for private repo access
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": f"{FRONTEND_URL}/auth/callback",
        "scope": "repo read:user",
        "state": state,
        "allow_signup": "true",
    }

    auth_url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"

    return AuthUrlResponse(auth_url=auth_url, state=state)


@router.post("/auth/github/callback")
async def github_callback(payload: CallbackRequest) -> CallbackResponse:
    """Exchange GitHub OAuth code for access token"""
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth not configured",
        )

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": payload.code,
                "redirect_uri": f"{FRONTEND_URL}/auth/callback",
            },
            headers={"Accept": "application/json"},
        )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange code for token",
            )

        token_data = token_response.json()

        if "error" in token_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"GitHub OAuth error: {token_data.get('error_description', 'Unknown error')}",
            )

        github_token = token_data.get("access_token")
        if not github_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No access token received from GitHub",
            )

        # Get user info from GitHub
        user_response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {github_token}"},
        )

        if user_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info from GitHub",
            )

        user_data = user_response.json()

        # Create JWT token
        expires_at = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
        jwt_payload = {
            "github_token": github_token,
            "user": {
                "id": user_data["id"],
                "login": user_data["login"],
                "name": user_data.get("name"),
                "avatar_url": user_data.get("avatar_url"),
                "email": user_data.get("email"),
            },
            "exp": expires_at,
            "iat": datetime.utcnow(),
        }

        access_token = jwt.encode(jwt_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        return CallbackResponse(
            access_token=access_token,
            user=jwt_payload["user"],
            expires_at=expires_at.isoformat(),
        )


@router.post("/auth/validate")
async def validate_token(request: Request) -> ValidateResponse:
    """Validate JWT token and check GitHub token is still valid"""
    authorization = request.headers.get("Authorization")

    if not authorization or not authorization.startswith("Bearer "):
        return ValidateResponse(valid=False)

    token = authorization.replace("Bearer ", "")

    try:
        # Decode JWT
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        github_token = payload.get("github_token")
        user = payload.get("user")

        if not github_token or not user:
            return ValidateResponse(valid=False)

        # Verify GitHub token is still valid
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {github_token}"},
            )

            if response.status_code != 200:
                return ValidateResponse(valid=False)

        expires_at = datetime.fromtimestamp(payload["exp"]).isoformat()

        return ValidateResponse(valid=True, user=user, expires_at=expires_at)

    except jwt.ExpiredSignatureError:
        return ValidateResponse(valid=False)
    except jwt.InvalidTokenError:
        return ValidateResponse(valid=False)
    except Exception:
        return ValidateResponse(valid=False)

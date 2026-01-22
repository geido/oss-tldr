import jwt
from typing import Any
from fastapi import HTTPException, Request, status
from github import Github

from config import JWT_ALGORITHM, JWT_SECRET


class AuthenticatedRequest:
    """Enhanced request object with authentication data"""

    def __init__(self, request: Request, github_token: str, user: dict[str, str | int | None]):
        """
        Initialize authenticated request.
        """
        self.request = request
        self.github_token = github_token
        self.user = user
        self._github_client: Github | None = None

    @property
    def github(self) -> Github:
        """Get authenticated GitHub client for this user"""
        if self._github_client is None:
            self._github_client = Github(self.github_token)
        return self._github_client

    def __getattr__(self, name: str) -> Any:
        """Delegate other attributes to the original request"""
        return getattr(self.request, name)


def get_current_user(request: Request) -> AuthenticatedRequest:
    """Extract and validate JWT token from request headers"""
    authorization = request.headers.get("Authorization")

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.replace("Bearer ", "")

    try:
        # Decode JWT
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        github_token = payload.get("github_token")
        user = payload.get("user")

        if not github_token or not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return AuthenticatedRequest(request, github_token, user)

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token validation failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

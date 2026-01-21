"""User repository with CRUD operations."""
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import User
from repositories.base import BaseRepository


class UsersRepository(BaseRepository[User]):
    """Repository for User model operations."""

    def __init__(self, session: AsyncSession):
        """Initialize users repository."""
        super().__init__(User, session)

    async def get_by_login(self, login: str) -> Optional[User]:
        """Get user by GitHub login."""
        result = await self.session.execute(select(User).where(User.login == login))
        return result.scalar_one_or_none()

    async def get_or_create_user(self, github_user: dict) -> User:  # type: ignore
        """
        Get or create user from GitHub OAuth data.

        Args:
            github_user: Dictionary with GitHub user data
                - id: GitHub user ID (required)
                - login: GitHub username (required)
                - name: Display name (optional)
                - email: Email (optional)
                - avatar_url: Avatar URL (optional)

        Returns:
            User: The existing or newly created user
        """
        # Try to get existing user by GitHub ID
        existing_user = await self.get_by_id(github_user["id"])

        if existing_user:
            # Update user data in case anything changed
            existing_user.login = github_user["login"]
            existing_user.name = github_user.get("name")
            existing_user.email = github_user.get("email")
            existing_user.avatar_url = github_user.get("avatar_url")
            await self.session.flush()
            await self.session.refresh(existing_user)
            return existing_user

        # Create new user
        new_user = User(
            id=github_user["id"],
            login=github_user["login"],
            name=github_user.get("name"),
            email=github_user.get("email"),
            avatar_url=github_user.get("avatar_url"),
        )
        self.session.add(new_user)
        await self.session.flush()
        await self.session.refresh(new_user)
        return new_user

"""User-Repository tracking repository."""
from typing import List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from database.models import UserRepository, Repository
from repositories.base import BaseRepository


class UserRepositoriesRepository(BaseRepository[UserRepository]):
    """Repository for UserRepository model operations."""

    def __init__(self, session: AsyncSession):
        """Initialize user repositories repository."""
        super().__init__(UserRepository, session)

    async def track_repository(
        self, user_id: int, repository_id: int
    ) -> UserRepository:
        """
        Track a repository for a user.

        Args:
            user_id: User ID
            repository_id: Repository ID

        Returns:
            UserRepository: The tracking record
        """
        # Check if already tracking
        existing = await self.get_tracking(user_id, repository_id)
        if existing:
            return existing

        # Create new tracking record
        tracking = UserRepository(user_id=user_id, repository_id=repository_id)
        self.session.add(tracking)
        await self.session.flush()
        await self.session.refresh(tracking)
        return tracking

    async def untrack_repository(self, user_id: int, repository_id: int) -> bool:
        """
        Untrack a repository for a user.

        Args:
            user_id: User ID
            repository_id: Repository ID

        Returns:
            bool: True if untracked, False if not found
        """
        tracking = await self.get_tracking(user_id, repository_id)
        if tracking:
            await self.session.delete(tracking)
            await self.session.flush()
            return True
        return False

    async def get_tracking(
        self, user_id: int, repository_id: int
    ) -> Optional[UserRepository]:
        """Get tracking record for user and repository."""
        result = await self.session.execute(
            select(UserRepository).where(
                and_(
                    UserRepository.user_id == user_id,
                    UserRepository.repository_id == repository_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_user_repositories(self, user_id: int) -> List[Repository]:
        """
        Get all repositories tracked by a user.

        Args:
            user_id: User ID

        Returns:
            List[Repository]: List of tracked repositories
        """
        result = await self.session.execute(
            select(UserRepository)
            .options(joinedload(UserRepository.repository))
            .where(UserRepository.user_id == user_id)
            .order_by(UserRepository.added_at.desc())
        )
        trackings = result.scalars().all()
        return [tracking.repository for tracking in trackings]

    async def is_tracking(self, user_id: int, repository_id: int) -> bool:
        """Check if user is tracking a repository."""
        tracking = await self.get_tracking(user_id, repository_id)
        return tracking is not None

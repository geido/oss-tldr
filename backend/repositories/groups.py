"""Groups repository for database operations."""
from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database.models import Group, GroupRepository
from repositories.base import BaseRepository


class GroupsRepository(BaseRepository[Group]):
    """Repository for Group model with related operations."""

    def __init__(self, session: AsyncSession):
        """Initialize groups repository."""
        super().__init__(Group, session)

    async def get_by_slug(self, slug: str) -> Optional[Group]:
        """Get a group by its slug."""
        query = (
            select(Group)
            .options(selectinload(Group.repositories))
            .where(Group.slug == slug)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_system_groups(self) -> Sequence[Group]:
        """Get all system-defined groups."""
        query = (
            select(Group)
            .options(selectinload(Group.repositories))
            .where(Group.is_system == True)  # noqa: E712
            .order_by(Group.name)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_user_groups(self, user_id: int) -> Sequence[Group]:
        """Get all groups created by a specific user."""
        query = (
            select(Group)
            .options(selectinload(Group.repositories))
            .where(Group.created_by_id == user_id)
            .order_by(Group.created_at.desc())
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_all_groups_for_user(self, user_id: int) -> Sequence[Group]:
        """Get all groups accessible to a user (system groups + user's own groups)."""
        query = (
            select(Group)
            .options(selectinload(Group.repositories))
            .where(Group.is_system.is_(True) | (Group.created_by_id == user_id))
            .order_by(Group.is_system.desc(), Group.name)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def create_group(
        self,
        name: str,
        slug: str,
        repos: list[str],
        description: Optional[str] = None,
        is_system: bool = False,
        created_by_id: Optional[int] = None,
    ) -> Group:
        """Create a new group with repositories.

        Args:
            name: Display name for the group
            slug: URL-friendly unique identifier
            repos: List of repository identifiers (owner/repo format)
            description: Optional description
            is_system: True for predefined system groups
            created_by_id: User ID who created this group (None for system groups)

        Returns:
            Created Group instance
        """
        group = Group(
            name=name,
            slug=slug,
            description=description,
            is_system=is_system,
            created_by_id=created_by_id,
        )
        self.session.add(group)
        await self.session.flush()

        # Add repositories
        for position, repo_id in enumerate(repos):
            group_repo = GroupRepository(
                group_id=group.id,
                repository_identifier=repo_id,
                position=position,
            )
            self.session.add(group_repo)

        await self.session.flush()
        await self.session.refresh(group)

        # Load the repositories relationship
        query = (
            select(Group)
            .options(selectinload(Group.repositories))
            .where(Group.id == group.id)
        )
        result = await self.session.execute(query)
        return result.scalar_one()

    async def update_group(
        self,
        group: Group,
        name: Optional[str] = None,
        description: Optional[str] = None,
        repos: Optional[list[str]] = None,
    ) -> Group:
        """Update an existing group.

        Args:
            group: Group to update
            name: New name (optional)
            description: New description (optional)
            repos: New list of repositories (optional, replaces existing)

        Returns:
            Updated Group instance
        """
        if name is not None:
            group.name = name
        if description is not None:
            group.description = description

        if repos is not None:
            # Delete existing repositories
            for repo in list(group.repositories):
                await self.session.delete(repo)

            # Add new repositories
            for position, repo_id in enumerate(repos):
                group_repo = GroupRepository(
                    group_id=group.id,
                    repository_identifier=repo_id,
                    position=position,
                )
                self.session.add(group_repo)

        await self.session.flush()
        await self.session.refresh(group)

        # Reload with repositories
        query = (
            select(Group)
            .options(selectinload(Group.repositories))
            .where(Group.id == group.id)
        )
        result = await self.session.execute(query)
        return result.scalar_one()

    async def delete_group(self, group: Group) -> None:
        """Delete a group and its repository associations."""
        await self.session.delete(group)
        await self.session.flush()

    async def upsert_system_group(
        self,
        slug: str,
        name: str,
        repos: list[str],
        description: Optional[str] = None,
    ) -> Group:
        """Insert or update a system group (for seeding from YAML).

        Args:
            slug: Unique identifier for the group
            name: Display name
            repos: List of repository identifiers
            description: Optional description

        Returns:
            Created or updated Group instance
        """
        existing = await self.get_by_slug(slug)

        if existing:
            # Update existing system group
            return await self.update_group(
                existing,
                name=name,
                description=description,
                repos=repos,
            )
        else:
            # Create new system group
            return await self.create_group(
                name=name,
                slug=slug,
                repos=repos,
                description=description,
                is_system=True,
                created_by_id=None,
            )

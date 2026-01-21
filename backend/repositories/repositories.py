"""Repository repository with CRUD operations."""
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Repository
from repositories.base import BaseRepository


class RepositoriesRepository(BaseRepository[Repository]):
    """Repository for Repository model operations."""

    def __init__(self, session: AsyncSession):
        """Initialize repositories repository."""
        super().__init__(Repository, session)

    async def get_by_full_name(self, full_name: str) -> Optional[Repository]:
        """Get repository by full name (owner/repo)."""
        result = await self.session.execute(
            select(Repository).where(Repository.full_name == full_name)
        )
        return result.scalar_one_or_none()

    async def get_or_create_repository(self, repo_data: dict) -> Repository:  # type: ignore
        """
        Get or create repository from GitHub data.

        Args:
            repo_data: Dictionary with GitHub repository data
                - full_name: "owner/repo" (required)
                - owner: Repository owner (required)
                - name: Repository name (required)
                - description: Repository description (optional)
                - html_url: GitHub URL (required)
                - is_private: Private status (optional)
                - is_fork: Fork status (optional)
                - is_archived: Archive status (optional)
                - language: Programming language (optional)
                - stargazers_count: Star count (optional)
                - updated_at: GitHub updated timestamp (optional)

        Returns:
            Repository: The existing or newly created repository
        """
        # Try to get existing repository by full_name
        existing_repo = await self.get_by_full_name(repo_data["full_name"])

        if existing_repo:
            # Update repository metadata
            existing_repo.owner = repo_data["owner"]
            existing_repo.name = repo_data["name"]
            existing_repo.description = repo_data.get("description")
            existing_repo.html_url = repo_data["html_url"]
            existing_repo.is_private = repo_data.get("is_private", False)
            existing_repo.is_fork = repo_data.get("is_fork", False)
            existing_repo.is_archived = repo_data.get("is_archived", False)
            existing_repo.language = repo_data.get("language")
            existing_repo.stargazers_count = repo_data.get("stargazers_count", 0)

            if "updated_at" in repo_data:
                existing_repo.github_updated_at = repo_data["updated_at"]

            await self.session.flush()
            await self.session.refresh(existing_repo)
            return existing_repo

        # Create new repository
        new_repo = Repository(
            full_name=repo_data["full_name"],
            owner=repo_data["owner"],
            name=repo_data["name"],
            description=repo_data.get("description"),
            html_url=repo_data["html_url"],
            is_private=repo_data.get("is_private", False),
            is_fork=repo_data.get("is_fork", False),
            is_archived=repo_data.get("is_archived", False),
            language=repo_data.get("language"),
            stargazers_count=repo_data.get("stargazers_count", 0),
            github_updated_at=repo_data.get("updated_at"),
        )
        self.session.add(new_repo)
        await self.session.flush()
        await self.session.refresh(new_repo)
        return new_repo

    async def update_repository_metadata(
        self, repo_id: int, metadata: dict  # type: ignore
    ) -> Optional[Repository]:
        """Update repository cached metadata."""
        repo = await self.get_by_id(repo_id)
        if repo:
            for key, value in metadata.items():
                if hasattr(repo, key):
                    setattr(repo, key, value)
            await self.session.flush()
            await self.session.refresh(repo)
        return repo

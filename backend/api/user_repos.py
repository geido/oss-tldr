"""User repository tracking API endpoints."""
from typing import List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from middleware.auth import AuthenticatedRequest, get_current_user
from repositories.repositories import RepositoriesRepository
from repositories.user_repositories import UserRepositoriesRepository
from services.github_client import get_repo
from utils.url import parse_repo_url

router = APIRouter()


class TrackRepoRequest(BaseModel):
    """Request to track a repository."""

    repo_url: str


class RepositorySummary(BaseModel):
    """Summary of repository data."""

    id: int
    full_name: str
    owner: str
    name: str
    description: str | None
    html_url: str
    is_private: bool
    language: str | None
    stargazers_count: int


class TrackRepoResponse(BaseModel):
    """Response after tracking a repository."""

    success: bool
    message: str
    repository: RepositorySummary


class UntrackRepoRequest(BaseModel):
    """Request to untrack a repository."""

    repo_url: str


class UntrackRepoResponse(BaseModel):
    """Response after untracking a repository."""

    success: bool
    message: str


class UserReposResponse(BaseModel):
    """Response with user's tracked repositories."""

    repositories: List[RepositorySummary]


@router.get("/users/me/repositories")
async def get_user_repositories(
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserReposResponse:
    """
    Get all repositories tracked by the current user.

    Returns:
        UserReposResponse: List of tracked repositories
    """
    try:
        user_repos_repo = UserRepositoriesRepository(db)
        repositories = await user_repos_repo.get_user_repositories(auth.user["id"])

        return UserReposResponse(
            repositories=[
                RepositorySummary(
                    id=repo.id,
                    full_name=repo.full_name,
                    owner=repo.owner,
                    name=repo.name,
                    description=repo.description,
                    html_url=repo.html_url,
                    is_private=repo.is_private,
                    language=repo.language,
                    stargazers_count=repo.stargazers_count,
                )
                for repo in repositories
            ]
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch tracked repositories: {str(e)}",
        )


@router.post("/users/me/repositories")
async def track_repository(
    payload: TrackRepoRequest,
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TrackRepoResponse:
    """
    Track a repository for the current user.

    Args:
        payload: Repository URL to track

    Returns:
        TrackRepoResponse: Success status and repository info
    """
    try:
        # Parse repository URL
        owner, repo_name = parse_repo_url(payload.repo_url)
        full_name = f"{owner}/{repo_name}"

        # Get repository from GitHub to validate it exists
        github_repo = get_repo(auth.github, owner, repo_name)

        # Initialize repositories
        repos_repo = RepositoriesRepository(db)
        user_repos_repo = UserRepositoriesRepository(db)

        # Get or create repository record
        repo_record = await repos_repo.get_or_create_repository(
            {
                "full_name": full_name,
                "owner": owner,
                "name": repo_name,
                "description": github_repo.description,
                "html_url": github_repo.html_url,
                "is_private": github_repo.private,
                "is_fork": github_repo.fork,
                "is_archived": github_repo.archived,
                "language": github_repo.language,
                "stargazers_count": github_repo.stargazers_count,
                "updated_at": github_repo.updated_at,
            }
        )

        # Track repository for user
        await user_repos_repo.track_repository(auth.user["id"], repo_record.id)

        return TrackRepoResponse(
            success=True,
            message=f"Successfully tracking {full_name}",
            repository=RepositorySummary(
                id=repo_record.id,
                full_name=repo_record.full_name,
                owner=repo_record.owner,
                name=repo_record.name,
                description=repo_record.description,
                html_url=repo_record.html_url,
                is_private=repo_record.is_private,
                language=repo_record.language,
                stargazers_count=repo_record.stargazers_count,
            ),
        )

    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to track repository: {str(e)}"
        )


@router.delete("/users/me/repositories")
async def untrack_repository(
    payload: UntrackRepoRequest,
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UntrackRepoResponse:
    """
    Untrack a repository for the current user.

    Args:
        payload: Repository URL to untrack

    Returns:
        UntrackRepoResponse: Success status
    """
    try:
        # Parse repository URL
        owner, repo_name = parse_repo_url(payload.repo_url)
        full_name = f"{owner}/{repo_name}"

        # Initialize repositories
        repos_repo = RepositoriesRepository(db)
        user_repos_repo = UserRepositoriesRepository(db)

        # Get repository record
        repo_record = await repos_repo.get_by_full_name(full_name)

        if not repo_record:
            raise HTTPException(
                status_code=404, detail=f"Repository {full_name} not found"
            )

        # Untrack repository for user
        success = await user_repos_repo.untrack_repository(
            auth.user["id"], repo_record.id
        )

        if not success:
            return UntrackRepoResponse(
                success=False,
                message=f"Repository {full_name} was not being tracked",
            )

        return UntrackRepoResponse(
            success=True, message=f"Successfully untracked {full_name}"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to untrack repository: {str(e)}"
        )

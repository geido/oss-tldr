"""User repository tracking routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import (
    RepositorySummary,
    TrackRepoRequest,
    TrackRepoResponse,
    UntrackRepoRequest,
    UntrackRepoResponse,
    UserTrackedReposResponse,
)
from database.connection import get_db
from middleware.auth import AuthenticatedRequest, get_current_user
from repositories.repositories import RepositoriesRepository
from repositories.user_repositories import UserRepositoriesRepository
from services.github_client import get_repo
from utils.url import parse_repo_url

router = APIRouter()


@router.get("/users/me/repositories", response_model=UserTrackedReposResponse)
async def get_user_repositories(
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserTrackedReposResponse:
    """Get all repositories tracked by the current user."""
    try:
        user_repos_repo = UserRepositoriesRepository(db)
        repositories = await user_repos_repo.get_user_repositories(auth.user["id"])

        return UserTrackedReposResponse(
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


@router.post("/users/me/repositories", response_model=TrackRepoResponse)
async def track_repository(
    payload: TrackRepoRequest,
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TrackRepoResponse:
    """Track a repository for the current user."""
    try:
        owner, repo_name = parse_repo_url(payload.repo_url)
        full_name = f"{owner}/{repo_name}"

        github_repo = get_repo(auth.github, owner, repo_name)

        repos_repo = RepositoriesRepository(db)
        user_repos_repo = UserRepositoriesRepository(db)

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


@router.delete("/users/me/repositories", response_model=UntrackRepoResponse)
async def untrack_repository(
    payload: UntrackRepoRequest,
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UntrackRepoResponse:
    """Untrack a repository for the current user."""
    try:
        owner, repo_name = parse_repo_url(payload.repo_url)
        full_name = f"{owner}/{repo_name}"

        repos_repo = RepositoriesRepository(db)
        user_repos_repo = UserRepositoriesRepository(db)

        repo_record = await repos_repo.get_by_full_name(full_name)

        if not repo_record:
            raise HTTPException(
                status_code=404, detail=f"Repository {full_name} not found"
            )

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

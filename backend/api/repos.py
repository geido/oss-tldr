from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional

from middleware.auth import AuthenticatedRequest, get_current_user

router = APIRouter()


class RepoSummary(BaseModel):
    name: str
    full_name: str
    description: Optional[str]
    html_url: str
    private: bool
    fork: bool
    archived: bool
    language: Optional[str]
    stargazers_count: int
    updated_at: str


class UserReposResponse(BaseModel):
    repositories: List[RepoSummary]


class SearchReposResponse(BaseModel):
    repositories: List[RepoSummary]
    total_count: int


@router.get("/repos/user", response_model=UserReposResponse)
async def get_user_repos(
    auth: AuthenticatedRequest = Depends(get_current_user),
    per_page: int = Query(default=50, le=100),
    page: int = Query(default=1, ge=1),
) -> UserReposResponse:
    """Get user's accessible repositories (owned + collaborator access)"""
    try:
        user = auth.github.get_user()

        # Get owned repositories - PyGithub uses different parameter names
        owned_repos = user.get_repos(type="owner", sort="updated")

        repositories: List[RepoSummary] = []
        count = 0
        start_index = (page - 1) * per_page

        for repo in owned_repos:
            # Skip to the right page
            if count < start_index:
                count += 1
                continue

            # Stop when we have enough results
            if len(repositories) >= per_page:
                break

            # Only include non-archived repos that we can access
            if not repo.archived:
                repo_summary = RepoSummary(
                    name=repo.name,
                    full_name=repo.full_name,
                    description=repo.description,
                    html_url=repo.html_url,
                    private=repo.private,
                    fork=repo.fork,
                    archived=repo.archived,
                    language=repo.language,
                    stargazers_count=repo.stargazers_count,
                    updated_at=repo.updated_at.isoformat() if repo.updated_at else "",
                )
                repositories.append(repo_summary)

            count += 1

        return UserReposResponse(repositories=repositories)

    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to fetch user repositories: {str(e)}"
        )


@router.get("/repos/search", response_model=SearchReposResponse)
async def search_public_repos(
    q: str = Query(..., min_length=1, description="Search query"),
    auth: AuthenticatedRequest = Depends(get_current_user),
    per_page: int = Query(default=20, le=50),
    page: int = Query(default=1, ge=1),
) -> SearchReposResponse:
    """Search public repositories on GitHub"""
    try:
        # Search public repositories - PyGithub search_repositories method
        search_result = auth.github.search_repositories(
            query=f"{q} is:public", sort="updated", order="desc"
        )

        repositories: List[RepoSummary] = []
        count = 0
        start_index = (page - 1) * per_page

        for repo in search_result:
            # Skip to the right page
            if count < start_index:
                count += 1
                continue

            # Stop when we have enough results
            if len(repositories) >= per_page:
                break

            # Only include non-archived, non-fork repos
            if not repo.archived and not repo.fork:
                repo_summary = RepoSummary(
                    name=repo.name,
                    full_name=repo.full_name,
                    description=repo.description,
                    html_url=repo.html_url,
                    private=repo.private,
                    fork=repo.fork,
                    archived=repo.archived,
                    language=repo.language,
                    stargazers_count=repo.stargazers_count,
                    updated_at=repo.updated_at.isoformat() if repo.updated_at else "",
                )
                repositories.append(repo_summary)

            count += 1

        return SearchReposResponse(
            repositories=repositories, total_count=search_result.totalCount
        )

    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to search repositories: {str(e)}"
        )

"""Repository search/discovery request/response schemas."""
from typing import List, Optional

from pydantic import BaseModel


class RepoSummary(BaseModel):
    """Summary of a GitHub repository for search/discovery."""

    name: str
    full_name: str
    description: Optional[str] = None
    html_url: str
    private: bool
    fork: bool
    archived: bool
    language: Optional[str] = None
    stargazers_count: int
    updated_at: str


class UserReposResponse(BaseModel):
    """Response containing user's accessible repositories."""

    repositories: List[RepoSummary]


class SearchReposResponse(BaseModel):
    """Response containing search results for repositories."""

    repositories: List[RepoSummary]
    total_count: int

"""User repository tracking request/response schemas."""
from typing import List

from pydantic import BaseModel

from .common import RepositorySummary


class TrackRepoRequest(BaseModel):
    """Request to track a repository."""

    repo_url: str


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


class UserTrackedReposResponse(BaseModel):
    """Response with user's tracked repositories."""

    repositories: List[RepositorySummary]

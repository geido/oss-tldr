from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class GithubUser(BaseModel):
    login: str
    id: int
    avatar_url: str
    html_url: str


class GitHubItem(BaseModel):
    id: int
    number: int
    title: str
    body: str
    summary: Optional[str] = None
    user: GithubUser
    html_url: str
    state: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    comments: int
    reactions: int
    labels: list[str]
    is_pull_request: bool
    merged: Optional[bool] = False
    assignees: Optional[list[GithubUser]] = None
    author_association: Optional[str] = None


class ContributorActivity(BaseModel):
    username: str
    avatar_url: Optional[str]
    profile_url: Optional[str]
    tldr: Optional[str]
    prs: list[GitHubItem]
    issues: list[GitHubItem]


class PatchItem(BaseModel):
    file: str
    patch: str

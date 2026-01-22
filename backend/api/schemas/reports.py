"""Report-related request/response schemas."""
from pydantic import BaseModel

from models.github import ContributorActivity, GitHubItem


class PRsSectionResponse(BaseModel):
    """Response for PRs section."""

    prs: list[GitHubItem]
    cached: bool


class IssuesSectionResponse(BaseModel):
    """Response for Issues section."""

    issues: list[GitHubItem]
    cached: bool


class PeopleSectionResponse(BaseModel):
    """Response for People section."""

    people: list[ContributorActivity]
    cached: bool

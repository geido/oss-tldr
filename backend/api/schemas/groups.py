"""Group-related request/response schemas."""
from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel, Field

from models.github import GitHubItem

from .common import Timeframe

if TYPE_CHECKING:
    from database.models import Group


class GroupSummary(BaseModel):
    """Summary representation of a group."""

    id: str  # slug
    name: str
    description: Optional[str] = None
    repos: list[str]
    is_system: bool = False

    @classmethod
    def from_db_model(cls, group: "Group") -> "GroupSummary":
        """Create a GroupSummary from a database Group model."""
        return cls(
            id=group.slug,
            name=group.name,
            description=group.description,
            repos=group.repo_identifiers,
            is_system=group.is_system,
        )


class GroupListResponse(BaseModel):
    """Response containing lists of groups."""

    system_groups: list[GroupSummary]
    user_groups: list[GroupSummary]


class CreateGroupRequest(BaseModel):
    """Request to create a new user group."""

    name: str = Field(..., min_length=1, max_length=255)
    repos: list[str] = Field(..., min_length=1)
    description: Optional[str] = Field(None, max_length=500)


class UpdateGroupRequest(BaseModel):
    """Request to update an existing group."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    repos: Optional[list[str]] = Field(None, min_length=1)
    description: Optional[str] = Field(None, max_length=500)


class GroupResponse(BaseModel):
    """Response containing a single group."""

    group: GroupSummary


class GroupRepoReport(BaseModel):
    """Report data for a single repository within a group report."""

    full_name: str
    html_url: str
    prs: list[GitHubItem] = Field(default_factory=list)
    issues: list[GitHubItem] = Field(default_factory=list)
    tldr: Optional[str] = None


class GroupReportRequest(BaseModel):
    """Request to generate a group report."""

    timeframe: Timeframe
    group_id: Optional[str] = None  # slug of existing group
    name: Optional[str] = None  # for ad-hoc groups
    repos: Optional[list[str]] = None  # for ad-hoc groups


class GroupReportResponse(BaseModel):
    """Response containing a group report."""

    group_id: Optional[str] = None
    name: str
    timeframe: str
    tldr: Optional[str] = None
    repos: list[GroupRepoReport]

"""API schemas (request/response models) package."""
from .common import (
    Timeframe,
    RepositorySummary,
)
from .auth import (
    AuthUrlResponse,
    CallbackRequest,
    CallbackResponse,
    UserPayload,
    ValidateResponse,
)
from .groups import (
    GroupSummary,
    GroupListResponse,
    CreateGroupRequest,
    UpdateGroupRequest,
    GroupResponse,
    GroupRepoReport,
    GroupReportRequest,
    GroupReportResponse,
)
from .reports import (
    PRsSectionResponse,
    IssuesSectionResponse,
    PeopleSectionResponse,
)
from .repos import (
    RepoSummary,
    UserReposResponse,
    SearchReposResponse,
)
from .users import (
    TrackRepoRequest,
    TrackRepoResponse,
    UntrackRepoRequest,
    UntrackRepoResponse,
    UserTrackedReposResponse,
)

__all__ = [
    # Common
    "Timeframe",
    "RepositorySummary",
    # Auth
    "AuthUrlResponse",
    "CallbackRequest",
    "CallbackResponse",
    "UserPayload",
    "ValidateResponse",
    # Groups
    "GroupSummary",
    "GroupListResponse",
    "CreateGroupRequest",
    "UpdateGroupRequest",
    "GroupResponse",
    "GroupRepoReport",
    "GroupReportRequest",
    "GroupReportResponse",
    # Reports
    "PRsSectionResponse",
    "IssuesSectionResponse",
    "PeopleSectionResponse",
    # Repos
    "RepoSummary",
    "UserReposResponse",
    "SearchReposResponse",
    # Users
    "TrackRepoRequest",
    "TrackRepoResponse",
    "UntrackRepoRequest",
    "UntrackRepoResponse",
    "UserTrackedReposResponse",
]

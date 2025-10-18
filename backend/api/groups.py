from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from middleware.auth import AuthenticatedRequest, get_current_user
from models.github import GitHubItem
from services.group_report import generate_group_report
from utils.group_config import GroupDefinition, get_group_definition, get_group_definitions

router = APIRouter()


class GroupSummary(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    repos: list[str]


class GroupListResponse(BaseModel):
    groups: list[GroupSummary]


class GroupRepoReport(BaseModel):
    full_name: str
    html_url: str
    prs: list[GitHubItem] = Field(default_factory=list)
    issues: list[GitHubItem] = Field(default_factory=list)
    tldr: Optional[str] = None


class GroupReportRequest(BaseModel):
    timeframe: Literal["last_day", "last_week", "last_month", "last_year"]
    group_id: Optional[str] = None
    name: Optional[str] = None
    repos: Optional[list[str]] = None


class GroupReportResponse(BaseModel):
    group_id: Optional[str] = None
    name: str
    timeframe: str
    tldr: Optional[str] = None
    repos: list[GroupRepoReport]


@router.get("/groups", response_model=GroupListResponse)
async def list_groups() -> GroupListResponse:
    groups = [
        GroupSummary.model_validate(group.model_dump())
        for group in get_group_definitions().values()
    ]
    return GroupListResponse(groups=groups)


@router.post("/groups/report", response_model=GroupReportResponse)
async def generate_group_digest(
    payload: GroupReportRequest,
    auth: AuthenticatedRequest = Depends(get_current_user),
) -> GroupReportResponse:
    group_definition: Optional[GroupDefinition] = None

    if payload.group_id:
        group_definition = get_group_definition(payload.group_id)
        if not group_definition:
            raise HTTPException(status_code=404, detail="Group not found")

    group_name = payload.name or (
        group_definition.name if group_definition else None
    )
    repos = payload.repos or (
        group_definition.repos if group_definition else None
    )

    if not group_name:
        raise HTTPException(status_code=400, detail="Group name is required")

    if not repos:
        raise HTTPException(status_code=400, detail="At least one repository is required")

    try:
        repo_reports, group_tldr = await generate_group_report(
            auth.github, repos, payload.timeframe
        )
    except Exception as exc:  # pragma: no cover - handled via HTTP response
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GroupReportResponse(
        group_id=group_definition.id if group_definition else payload.group_id,
        name=group_name,
        timeframe=payload.timeframe,
        tldr=group_tldr,
        repos=[GroupRepoReport(**report) for report in repo_reports],
    )

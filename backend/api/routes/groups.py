"""Group management routes."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.helpers import generate_slug, ensure_unique_slug, normalize_repos
from api.schemas import (
    GroupSummary,
    GroupListResponse,
    CreateGroupRequest,
    UpdateGroupRequest,
    GroupResponse,
    GroupRepoReport,
    GroupReportRequest,
    GroupReportResponse,
)
from database.connection import get_db
from database.models import Group
from middleware.auth import AuthenticatedRequest, get_current_user
from repositories.groups import GroupsRepository
from services.group_report import generate_group_report

router = APIRouter()


@router.get("/groups", response_model=GroupListResponse)
async def list_groups(
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupListResponse:
    """List all groups accessible to the current user.

    Returns both system-defined groups (shared across all users)
    and groups created by the current user.
    """
    groups_repo = GroupsRepository(db)

    system_groups = await groups_repo.get_system_groups()
    user_groups = await groups_repo.get_user_groups(auth.user["id"])

    return GroupListResponse(
        system_groups=[GroupSummary.from_db_model(g) for g in system_groups],
        user_groups=[GroupSummary.from_db_model(g) for g in user_groups],
    )


@router.post("/groups", response_model=GroupResponse, status_code=201)
async def create_group(
    payload: CreateGroupRequest,
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    """Create a new user-defined group."""
    groups_repo = GroupsRepository(db)

    base_slug = generate_slug(payload.name)
    slug = await ensure_unique_slug(groups_repo, base_slug)

    normalized_repos = normalize_repos(payload.repos)

    group = await groups_repo.create_group(
        name=payload.name.strip(),
        slug=slug,
        repos=normalized_repos,
        description=payload.description.strip() if payload.description else None,
        is_system=False,
        created_by_id=auth.user["id"],
    )

    await db.commit()

    return GroupResponse(group=GroupSummary.from_db_model(group))


@router.get("/groups/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: str,
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    """Get a specific group by its ID (slug)."""
    groups_repo = GroupsRepository(db)
    group = await groups_repo.get_by_slug(group_id)

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if not group.is_system and group.created_by_id != auth.user["id"]:
        raise HTTPException(status_code=404, detail="Group not found")

    return GroupResponse(group=GroupSummary.from_db_model(group))


@router.put("/groups/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: str,
    payload: UpdateGroupRequest,
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    """Update an existing user-defined group.

    System groups cannot be modified.
    """
    groups_repo = GroupsRepository(db)
    group = await groups_repo.get_by_slug(group_id)

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.is_system:
        raise HTTPException(status_code=403, detail="Cannot modify system groups")

    if group.created_by_id != auth.user["id"]:
        raise HTTPException(status_code=404, detail="Group not found")

    normalized_repos = None
    if payload.repos is not None:
        normalized_repos = normalize_repos(payload.repos)

    updated_group = await groups_repo.update_group(
        group,
        name=payload.name.strip() if payload.name else None,
        description=payload.description.strip() if payload.description else None,
        repos=normalized_repos,
    )

    await db.commit()

    return GroupResponse(group=GroupSummary.from_db_model(updated_group))


@router.delete("/groups/{group_id}", status_code=204)
async def delete_group(
    group_id: str,
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a user-defined group.

    System groups cannot be deleted.
    """
    groups_repo = GroupsRepository(db)
    group = await groups_repo.get_by_slug(group_id)

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.is_system:
        raise HTTPException(status_code=403, detail="Cannot delete system groups")

    if group.created_by_id != auth.user["id"]:
        raise HTTPException(status_code=404, detail="Group not found")

    await groups_repo.delete_group(group)
    await db.commit()


@router.post("/groups/report", response_model=GroupReportResponse)
async def generate_group_digest(
    payload: GroupReportRequest,
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupReportResponse:
    """Generate a TL;DR report for a group of repositories.

    Can be used with:
    1. An existing group (provide group_id)
    2. Ad-hoc repositories (provide name and repos)
    """
    groups_repo = GroupsRepository(db)
    group: Optional[Group] = None
    group_name: Optional[str] = None
    repos: Optional[list[str]] = None

    if payload.group_id:
        group = await groups_repo.get_by_slug(payload.group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")

        if not group.is_system and group.created_by_id != auth.user["id"]:
            raise HTTPException(status_code=404, detail="Group not found")

        group_name = group.name
        repos = group.repo_identifiers

    if payload.name:
        group_name = payload.name
    if payload.repos:
        repos = normalize_repos(payload.repos)

    if not group_name:
        raise HTTPException(status_code=400, detail="Group name is required")

    if not repos:
        raise HTTPException(
            status_code=400, detail="At least one repository is required"
        )

    try:
        repo_reports, group_tldr = await generate_group_report(
            auth.github, repos, payload.timeframe
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GroupReportResponse(
        group_id=group.slug if group else payload.group_id,
        name=group_name,
        timeframe=payload.timeframe,
        tldr=group_tldr,
        repos=[GroupRepoReport(**report) for report in repo_reports],
    )

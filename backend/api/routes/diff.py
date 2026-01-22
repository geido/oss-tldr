"""Diff explanation routes."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from middleware.auth import AuthenticatedRequest, get_current_user
from models.github import PatchItem
from services.diff_explainer import explain_diff
from services.github_client import get_pr_diff, get_repo
from utils.url import parse_repo_url

router = APIRouter()


class PatchesRequest(BaseModel):
    """Request for getting PR patches."""

    repo_url: str
    pull_request: str


class PatchesResponse(BaseModel):
    """Response containing PR patches."""

    patches: list[PatchItem]


class DiffRequest(BaseModel):
    """Request for explaining a diff."""

    file: str
    patch: str


class DiffResponse(BaseModel):
    """Response containing diff explanation."""

    explanation: str


@router.post("/patches", response_model=PatchesResponse)
async def get_patches(
    payload: PatchesRequest, auth: AuthenticatedRequest = Depends(get_current_user)
) -> PatchesResponse:
    """Get patches for a pull request."""
    try:
        owner, repo = parse_repo_url(payload.repo_url)
        github_repo = get_repo(auth.github, owner, repo)

        patch_list: list[PatchItem] = await get_pr_diff(
            github_repo, payload.pull_request
        )

        return PatchesResponse(patches=patch_list)

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get patches: {str(e)}")


@router.post("/diff", response_model=DiffResponse)
async def get_diff(
    payload: DiffRequest, auth: AuthenticatedRequest = Depends(get_current_user)
) -> DiffResponse:
    """Get AI explanation for a diff."""
    try:
        explanation: str = await explain_diff(payload.file, payload.patch)

        return DiffResponse(explanation=explanation)

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to explain diff: {str(e)}")

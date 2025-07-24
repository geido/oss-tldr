from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.github import GitHubItem
from services.github_client import get_repo, get_repo_activity, score_sort_items
from services.issue_summary import summarize_items
from utils.dates import resolve_timeframe
from utils.serializers import serialize_github_item
from utils.url import parse_repo_url

router = APIRouter()


class PRsRequest(BaseModel):
    repo_url: str
    timeframe: Literal["last_day", "last_week", "last_month", "last_year"]


class PRsResponse(BaseModel):
    prs: list[GitHubItem]


@router.post("/prs", response_model=PRsResponse)
async def get_prs(payload: PRsRequest) -> PRsResponse:
    try:
        owner, repo = parse_repo_url(payload.repo_url)
        github_repo = get_repo(owner, repo)

        start_date, end_date = resolve_timeframe(payload.timeframe)
        prs = await get_repo_activity(github_repo, "pr", start_date, end_date)
        scored_prs = score_sort_items(github_repo, prs)

        github_prs = [serialize_github_item(pr) for _, pr in scored_prs]
        summarized_prs = await summarize_items(github_prs)

        return PRsResponse(prs=summarized_prs)

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch PRs: {e}")

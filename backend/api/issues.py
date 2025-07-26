from typing import Literal

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from middleware.auth import AuthenticatedRequest, get_current_user
from models.github import GitHubItem
from services.github_client import get_repo, get_repo_activity, score_sort_items
from services.issue_summary import summarize_items
from utils.dates import resolve_timeframe
from utils.serializers import serialize_github_item
from utils.url import parse_repo_url

router = APIRouter()


class IssuesRequest(BaseModel):
    repo_url: str
    timeframe: Literal["last_day", "last_week", "last_month", "last_year"]


class IssuesResponse(BaseModel):
    issues: list[GitHubItem]


@router.post("/issues", response_model=IssuesResponse)
async def get_issues(
    payload: IssuesRequest, auth: AuthenticatedRequest = Depends(get_current_user)
) -> IssuesResponse:
    try:
        owner, repo = parse_repo_url(payload.repo_url)
        github_repo = get_repo(auth.github, owner, repo)

        start_date, end_date = resolve_timeframe(payload.timeframe)

        issues = await get_repo_activity(
            auth.github, github_repo, "issue", start_date, end_date
        )
        scored_issues = score_sort_items(github_repo, issues)

        github_issues = [serialize_github_item(issue) for _, issue in scored_issues]
        summarized_issues = await summarize_items(github_issues)

        return IssuesResponse(issues=summarized_issues)

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch issues: {e}")

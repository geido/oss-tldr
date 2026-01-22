"""Deep dive analysis routes."""
import asyncio
from typing import cast

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from github.PaginatedList import PaginatedList
from github.PullRequestReview import PullRequestReview
from pydantic import BaseModel

from middleware.auth import AuthenticatedRequest, get_current_user
from services.deepdive_generator import generate_deep_dive
from services.github_client import get_pr_reviews, get_repo
from utils.url import parse_repo_url

router = APIRouter()


class DeepDiveRequest(BaseModel):
    """Request for deep dive analysis."""

    repo_url: str
    issue: str


@router.post("/deepdive")
async def get_deepdive(
    payload: DeepDiveRequest, auth: AuthenticatedRequest = Depends(get_current_user)
) -> StreamingResponse:
    """Generate deep dive analysis for an issue or PR."""
    try:
        owner, repo_name = parse_repo_url(payload.repo_url)
        github_repo = get_repo(auth.github, owner, repo_name)

        issue = await asyncio.to_thread(github_repo.get_issue, int(payload.issue))

        comments_task = asyncio.to_thread(issue.get_comments)
        reviews_task = (
            asyncio.to_thread(get_pr_reviews, github_repo, payload.issue)
            if issue.pull_request
            else asyncio.sleep(0, result=cast(PaginatedList[PullRequestReview], []))
        )

        comments, reviews = await asyncio.gather(comments_task, reviews_task)

        stream = generate_deep_dive(
            title=issue.title,
            body=issue.body or "",
            reviews=list(reviews),
            comments=comments,
        )

        return StreamingResponse(stream, media_type="text/plain")

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

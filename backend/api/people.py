import asyncio
from typing import Literal, cast

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from config import MAX_ITEMS_PER_SECTION
from middleware.auth import AuthenticatedRequest, get_current_user
from models.github import ContributorActivity
from services.github_client import get_active_contributors, get_repo, get_repo_activity
from services.issue_summary import summarize_items
from services.tldr_generator import tldr
from utils.dates import resolve_timeframe
from utils.serializers import serialize_github_item
from utils.url import parse_repo_url

router = APIRouter()


class PeopleRequest(BaseModel):
    repo_url: str
    timeframe: Literal["last_day", "last_week", "last_month", "last_year"]


class PeopleResponse(BaseModel):
    people: list[ContributorActivity]


@router.post("/people", response_model=PeopleResponse)
async def get_people(
    payload: PeopleRequest, auth: AuthenticatedRequest = Depends(get_current_user)
) -> PeopleResponse:
    try:
        owner, repo = parse_repo_url(payload.repo_url)
        github_repo = get_repo(auth.github, owner, repo)

        start_date, end_date = resolve_timeframe(payload.timeframe)
        contributors = get_active_contributors(
            auth.github, github_repo, start_date, end_date
        )

        async def enrich_contributor(
            contributor: dict[str, str]
        ) -> ContributorActivity:
            items = await get_repo_activity(
                auth.github,
                github_repo,
                item_type="all",
                start_date=start_date,
                end_date=end_date,
                author=contributor["username"],
            )

            github_items = [serialize_github_item(item) for item in items]
            summarized = await summarize_items(github_items[:MAX_ITEMS_PER_SECTION])

            summary = await tldr(
                "\n".join(item.summary for item in summarized if item.summary),
                stream=False,
            )

            return ContributorActivity(
                username=contributor["username"],
                avatar_url=contributor["avatar_url"],
                profile_url=contributor["profile_url"],
                tldr=cast(str, summary),
                prs=[
                    item
                    for item in summarized
                    if getattr(item, "is_pull_request", False)
                ],
                issues=[
                    item
                    for item in summarized
                    if not getattr(item, "is_pull_request", False)
                ],
            )

        enriched_people = await asyncio.gather(
            *(enrich_contributor(person) for person in contributors)
        )

        active_people = [
            person for person in enriched_people if person.prs or person.issues
        ]

        return PeopleResponse(people=active_people)

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get people: {e}")

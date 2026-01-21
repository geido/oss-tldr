import asyncio
from typing import Literal

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from middleware.auth import AuthenticatedRequest, get_current_user
from models.github import ContributorActivity, GitHubItem
from services.github_client import get_active_contributors, get_repo
from services.people_summary import enrich_contributor_with_github_activity
from utils.dates import resolve_timeframe
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
            """Fetch and enrich a single contributor's activity."""
            enriched = await enrich_contributor_with_github_activity(
                auth.github,
                github_repo,
                contributor,
                start_date,
                end_date,
            )

            # Convert dict to ContributorActivity model
            return ContributorActivity(
                username=enriched["username"],
                avatar_url=enriched["avatar_url"],
                profile_url=enriched["profile_url"],
                tldr=enriched["tldr"],
                prs=[
                    GitHubItem(**pr) if isinstance(pr, dict) else pr
                    for pr in enriched["prs"]
                ],
                issues=[
                    GitHubItem(**issue) if isinstance(issue, dict) else issue
                    for issue in enriched["issues"]
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

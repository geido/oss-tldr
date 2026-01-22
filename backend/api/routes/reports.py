"""Report section routes with database caching."""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import (
    Timeframe,
    PRsSectionResponse,
    IssuesSectionResponse,
    PeopleSectionResponse,
)
from database.connection import get_db
from middleware.auth import AuthenticatedRequest, get_current_user
from models.github import GitHubItem
from repositories.repositories import RepositoriesRepository
from repositories.reports import ReportsRepository
from repositories.user_repositories import UserRepositoriesRepository
from services.github_client import get_repo, get_repo_activity, score_sort_items
from services.issue_summary import summarize_items
from services.people_summary import generate_people_summaries
from utils.dates import resolve_timeframe
from utils.serializers import serialize_github_item

router = APIRouter()


@router.get("/reports/{owner}/{repo}/prs")
async def get_prs_section(
    owner: str,
    repo: str,
    timeframe: Timeframe = Query(...),
    force: bool = Query(False, description="Force fresh data, bypass cache"),
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PRsSectionResponse:
    """Get PRs section with database caching."""
    try:
        full_name = f"{owner}/{repo}"
        github_repo = get_repo(auth.github, owner, repo)
        start_date, end_date = resolve_timeframe(timeframe)

        repos_repo = RepositoriesRepository(db)
        reports_repo = ReportsRepository(db)
        user_repos_repo = UserRepositoriesRepository(db)

        repo_record = await repos_repo.get_or_create_repository(
            {
                "full_name": full_name,
                "owner": owner,
                "name": repo,
                "description": github_repo.description,
                "html_url": github_repo.html_url,
                "is_private": github_repo.private,
                "is_fork": github_repo.fork,
                "is_archived": github_repo.archived,
                "language": github_repo.language,
                "stargazers_count": github_repo.stargazers_count,
                "updated_at": github_repo.updated_at,
            }
        )

        await user_repos_repo.track_repository(auth.user["id"], repo_record.id)

        cached_prs = None
        if not force:
            cached_prs = await reports_repo.get_cached_section(
                repo_record.id, timeframe, "prs"
            )

        if cached_prs:
            print(f"✓ Cache HIT for {full_name} PRs ({timeframe})")
            prs_items = [
                GitHubItem(**pr) if isinstance(pr, dict) else pr for pr in cached_prs
            ]
            return PRsSectionResponse(prs=prs_items, cached=True)

        if force:
            print(f"🔄 Force refresh for {full_name} PRs ({timeframe})")

        print(f"✗ Cache MISS for {full_name} PRs ({timeframe}) - generating")
        prs = await get_repo_activity(
            auth.github, github_repo, "pr", start_date, end_date
        )
        scored_prs = score_sort_items(github_repo, prs)
        github_prs = [serialize_github_item(pr) for _, pr in scored_prs]
        summarized_prs = await summarize_items(github_prs)

        report = await reports_repo.get_or_create_report_record(
            repo_record.id, timeframe, start_date, end_date
        )
        await reports_repo.update_section(
            report.id,
            "prs",
            [pr.model_dump(mode="json") for pr in summarized_prs],
        )
        await db.commit()

        return PRsSectionResponse(prs=summarized_prs, cached=False)

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch PRs: {str(e)}")


@router.get("/reports/{owner}/{repo}/issues")
async def get_issues_section(
    owner: str,
    repo: str,
    timeframe: Timeframe = Query(...),
    force: bool = Query(False, description="Force fresh data, bypass cache"),
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IssuesSectionResponse:
    """Get Issues section with database caching."""
    try:
        full_name = f"{owner}/{repo}"
        github_repo = get_repo(auth.github, owner, repo)
        start_date, end_date = resolve_timeframe(timeframe)

        repos_repo = RepositoriesRepository(db)
        reports_repo = ReportsRepository(db)
        user_repos_repo = UserRepositoriesRepository(db)

        repo_record = await repos_repo.get_or_create_repository(
            {
                "full_name": full_name,
                "owner": owner,
                "name": repo,
                "description": github_repo.description,
                "html_url": github_repo.html_url,
                "is_private": github_repo.private,
                "is_fork": github_repo.fork,
                "is_archived": github_repo.archived,
                "language": github_repo.language,
                "stargazers_count": github_repo.stargazers_count,
                "updated_at": github_repo.updated_at,
            }
        )

        await user_repos_repo.track_repository(auth.user["id"], repo_record.id)

        cached_issues = None
        if not force:
            cached_issues = await reports_repo.get_cached_section(
                repo_record.id, timeframe, "issues"
            )

        if cached_issues:
            print(f"✓ Cache HIT for {full_name} Issues ({timeframe})")
            issues_items = [
                GitHubItem(**issue) if isinstance(issue, dict) else issue
                for issue in cached_issues
            ]
            return IssuesSectionResponse(issues=issues_items, cached=True)

        if force:
            print(f"🔄 Force refresh for {full_name} Issues ({timeframe})")

        print(f"✗ Cache MISS for {full_name} Issues ({timeframe}) - generating")
        issues = await get_repo_activity(
            auth.github, github_repo, "issue", start_date, end_date
        )
        scored_issues = score_sort_items(github_repo, issues)
        github_issues = [serialize_github_item(issue) for _, issue in scored_issues]
        summarized_issues = await summarize_items(github_issues)

        report = await reports_repo.get_or_create_report_record(
            repo_record.id, timeframe, start_date, end_date
        )
        await reports_repo.update_section(
            report.id,
            "issues",
            [issue.model_dump(mode="json") for issue in summarized_issues],
        )
        await db.commit()

        return IssuesSectionResponse(issues=summarized_issues, cached=False)

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch Issues: {str(e)}")


@router.get("/reports/{owner}/{repo}/people")
async def get_people_section(
    owner: str,
    repo: str,
    timeframe: Timeframe = Query(...),
    force: bool = Query(False, description="Force fresh data, bypass cache"),
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PeopleSectionResponse:
    """Get People (contributors) section with database caching."""
    try:
        full_name = f"{owner}/{repo}"
        github_repo = get_repo(auth.github, owner, repo)
        start_date, end_date = resolve_timeframe(timeframe)

        repos_repo = RepositoriesRepository(db)
        reports_repo = ReportsRepository(db)
        user_repos_repo = UserRepositoriesRepository(db)

        repo_record = await repos_repo.get_or_create_repository(
            {
                "full_name": full_name,
                "owner": owner,
                "name": repo,
                "description": github_repo.description,
                "html_url": github_repo.html_url,
                "is_private": github_repo.private,
                "is_fork": github_repo.fork,
                "is_archived": github_repo.archived,
                "language": github_repo.language,
                "stargazers_count": github_repo.stargazers_count,
                "updated_at": github_repo.updated_at,
            }
        )

        await user_repos_repo.track_repository(auth.user["id"], repo_record.id)

        cached_people = None
        if not force:
            cached_people = await reports_repo.get_cached_section(
                repo_record.id, timeframe, "people"
            )

        if cached_people:
            print(f"✓ Cache HIT for {full_name} People ({timeframe})")
            return PeopleSectionResponse(people=cached_people, cached=True)

        if force:
            print(f"🔄 Force refresh for {full_name} People ({timeframe})")

        print(f"✗ Cache MISS for {full_name} People ({timeframe}) - generating")

        cached_prs_data = await reports_repo.get_cached_section(
            repo_record.id, timeframe, "prs", skip_expiration_check=True
        )
        cached_issues_data = await reports_repo.get_cached_section(
            repo_record.id, timeframe, "issues", skip_expiration_check=True
        )

        if cached_prs_data and cached_issues_data:
            prs_list = [
                GitHubItem(**pr) if isinstance(pr, dict) else pr
                for pr in cached_prs_data
            ]
            issues_list = [
                GitHubItem(**issue) if isinstance(issue, dict) else issue
                for issue in cached_issues_data
            ]
        else:
            prs = await get_repo_activity(
                auth.github, github_repo, "pr", start_date, end_date
            )
            scored_prs = score_sort_items(github_repo, prs)
            github_prs = [serialize_github_item(pr) for _, pr in scored_prs]
            prs_list = await summarize_items(github_prs)

            issues = await get_repo_activity(
                auth.github, github_repo, "issue", start_date, end_date
            )
            scored_issues = score_sort_items(github_repo, issues)
            github_issues = [serialize_github_item(issue) for _, issue in scored_issues]
            issues_list = await summarize_items(github_issues)

        people_summaries = await generate_people_summaries(prs_list, issues_list)

        report = await reports_repo.get_or_create_report_record(
            repo_record.id, timeframe, start_date, end_date
        )
        await reports_repo.update_section(report.id, "people", people_summaries)
        await db.commit()

        return PeopleSectionResponse(people=people_summaries, cached=False)

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch People: {str(e)}")


@router.get("/reports/{owner}/{repo}/tldr")
async def get_tldr_section(
    owner: str,
    repo: str,
    timeframe: Timeframe = Query(...),
    force: bool = Query(False, description="Force fresh data, bypass cache"),
    auth: AuthenticatedRequest = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Get TL;DR section with database caching and streaming response."""

    async def generate_stream():
        try:
            full_name = f"{owner}/{repo}"
            github_repo = get_repo(auth.github, owner, repo)
            start_date, end_date = resolve_timeframe(timeframe)

            repos_repo = RepositoriesRepository(db)
            reports_repo = ReportsRepository(db)
            user_repos_repo = UserRepositoriesRepository(db)

            repo_record = await repos_repo.get_or_create_repository(
                {
                    "full_name": full_name,
                    "owner": owner,
                    "name": repo,
                    "description": github_repo.description,
                    "html_url": github_repo.html_url,
                    "is_private": github_repo.private,
                    "is_fork": github_repo.fork,
                    "is_archived": github_repo.archived,
                    "language": github_repo.language,
                    "stargazers_count": github_repo.stargazers_count,
                    "updated_at": github_repo.updated_at,
                }
            )

            await user_repos_repo.track_repository(auth.user["id"], repo_record.id)

            cached_tldr = None
            if not force:
                cached_tldr = await reports_repo.get_cached_section(
                    repo_record.id, timeframe, "tldr"
                )

            if cached_tldr:
                print(f"✓ Cache HIT for {full_name} TL;DR ({timeframe})")
                chunk_size = 50
                for i in range(0, len(cached_tldr), chunk_size):
                    yield cached_tldr[i : i + chunk_size]
                return

            if force:
                print(f"🔄 Force refresh for {full_name} TL;DR ({timeframe})")

            print(f"✗ Cache MISS for {full_name} TL;DR ({timeframe}) - generating")

            cached_prs_data = await reports_repo.get_cached_section(
                repo_record.id, timeframe, "prs", skip_expiration_check=True
            )
            cached_issues_data = await reports_repo.get_cached_section(
                repo_record.id, timeframe, "issues", skip_expiration_check=True
            )

            if cached_prs_data is None or cached_issues_data is None:
                yield "⚠️ Error: PRs and Issues must be loaded before generating TL;DR"
                return

            prs_list = [
                GitHubItem(**pr) if isinstance(pr, dict) else pr
                for pr in cached_prs_data
            ]
            issues_list = [
                GitHubItem(**issue) if isinstance(issue, dict) else issue
                for issue in cached_issues_data
            ]

            summaries = [
                *[pr.summary for pr in prs_list if pr.summary],
                *[issue.summary for issue in issues_list if issue.summary],
            ]

            if not summaries:
                return

            from services.tldr_generator import tldr as generate_tldr

            generator = await generate_tldr("\n".join(summaries), stream=True)

            accumulated_text = ""
            async for chunk in generator:
                accumulated_text += chunk
                yield chunk

            report = await reports_repo.get_or_create_report_record(
                repo_record.id, timeframe, start_date, end_date
            )
            await reports_repo.update_section(report.id, "tldr", accumulated_text)
            await db.commit()

        except Exception as e:
            yield f"⚠️ Error generating TL;DR: {str(e)}"

    return StreamingResponse(generate_stream(), media_type="text/plain")

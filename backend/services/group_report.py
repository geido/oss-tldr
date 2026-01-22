from __future__ import annotations

import asyncio
from typing import Any, Iterable, Sequence

from github import Github

from config import MAX_ITEMS_PER_SECTION
from models.github import GitHubItem
from services.github_client import get_repo, get_repo_activity
from services.issue_summary import summarize_items
from services.tldr_generator import tldr
from utils.dates import resolve_timeframe
from utils.serializers import serialize_github_item
from utils.url import normalize_repo_reference


async def _summarize_repository(
    github: Github,
    repo_identifier: str,
    timeframe: str,
) -> dict[str, Any]:
    owner, name = normalize_repo_reference(repo_identifier)
    github_repo = get_repo(github, owner, name)

    start_date, end_date = resolve_timeframe(timeframe)

    prs_task = asyncio.create_task(
        get_repo_activity(github, github_repo, "pr", start_date, end_date)
    )
    issues_task = asyncio.create_task(
        get_repo_activity(github, github_repo, "issue", start_date, end_date)
    )

    prs_raw, issues_raw = await asyncio.gather(prs_task, issues_task)

    serialized_prs = [
        serialize_github_item(item) for item in prs_raw[:MAX_ITEMS_PER_SECTION]
    ]
    serialized_issues = [
        serialize_github_item(item) for item in issues_raw[:MAX_ITEMS_PER_SECTION]
    ]

    summarized_prs: Sequence[GitHubItem]
    summarized_issues: Sequence[GitHubItem]

    if serialized_prs:
        summarized_prs = await summarize_items(serialized_prs)
    else:
        summarized_prs = []

    if serialized_issues:
        summarized_issues = await summarize_items(serialized_issues)
    else:
        summarized_issues = []

    repo_summaries = _collect_item_summaries(
        summarized_prs, summarized_issues, github_repo.full_name
    )

    repo_tldr = None
    if repo_summaries:
        repo_tldr = await tldr("\n".join(repo_summaries), stream=False)

    return {
        "full_name": github_repo.full_name,
        "html_url": github_repo.html_url,
        "prs": summarized_prs,
        "issues": summarized_issues,
        "tldr": repo_tldr if isinstance(repo_tldr, str) else None,
    }


def _collect_item_summaries(
    prs: Iterable[GitHubItem],
    issues: Iterable[GitHubItem],
    repo_name: str,
) -> list[str]:
    summaries: list[str] = []
    for item in (*prs, *issues):
        if item.summary:
            summaries.append(f"[{repo_name}] {item.summary}")
    return summaries


async def generate_group_report(
    github: Github,
    repos: Sequence[str],
    timeframe: str,
) -> tuple[list[dict[str, Any]], str | None]:
    if not repos:
        return [], None

    normalized_repos = list(dict.fromkeys(repos))

    repo_results = await asyncio.gather(
        *(_summarize_repository(github, repo, timeframe) for repo in normalized_repos)
    )

    aggregate_summaries: list[str] = []
    for repo_data in repo_results:
        aggregate_summaries.extend(
            _collect_item_summaries(
                repo_data["prs"], repo_data["issues"], repo_data["full_name"]
            )
        )

    group_tldr = None
    if aggregate_summaries:
        group_tldr = await tldr("\n".join(aggregate_summaries), stream=False)

    return repo_results, group_tldr if isinstance(group_tldr, str) else None

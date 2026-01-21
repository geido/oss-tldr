"""Service for generating people/contributor summaries from items."""
from collections import defaultdict
from typing import Any, Dict, List, cast

from config import MAX_ITEMS_PER_SECTION
from models.github import GitHubItem
from services.tldr_generator import tldr


async def generate_people_summaries(
    prs: List[GitHubItem],
    issues: List[GitHubItem],
) -> List[Dict[str, Any]]:
    """
    Generate contributor summaries from already-fetched and summarized PRs and issues.

    This function groups items by author and generates a TL;DR for each contributor.
    It's more efficient than fetching contributor data separately since we already
    have the items and their summaries.

    Args:
        prs: List of summarized pull requests
        issues: List of summarized issues

    Returns:
        List of dictionaries with contributor information:
        - username: GitHub login
        - avatar_url: User's avatar URL
        - profile_url: User's GitHub profile URL
        - tldr: AI-generated summary of their contributions
        - prs: List of their PRs
        - issues: List of their issues
        - total_items: Total number of contributions
    """
    # Group items by author
    contributors: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {
            "username": "",
            "avatar_url": "",
            "profile_url": "",
            "prs": [],
            "issues": [],
        }
    )

    # Add PRs
    for pr in prs:
        username = pr.user.login
        if not contributors[username]["username"]:
            contributors[username]["username"] = username
            contributors[username]["avatar_url"] = pr.user.avatar_url
            contributors[username]["profile_url"] = pr.user.html_url
        contributors[username]["prs"].append(pr)

    # Add issues
    for issue in issues:
        username = issue.user.login
        if not contributors[username]["username"]:
            contributors[username]["username"] = username
            contributors[username]["avatar_url"] = issue.user.avatar_url
            contributors[username]["profile_url"] = issue.user.html_url
        contributors[username]["issues"].append(issue)

    # Generate TL;DR for each contributor
    people_summaries = []

    for contributor_data in contributors.values():
        # Combine all their contributions (limit to avoid token limits)
        all_items = (
            contributor_data["prs"][:MAX_ITEMS_PER_SECTION]
            + contributor_data["issues"][:MAX_ITEMS_PER_SECTION]
        )

        # Generate TL;DR from their item summaries
        tldr_text = None
        if all_items:
            summaries = [item.summary for item in all_items if item.summary]
            if summaries:
                try:
                    tldr_text = await tldr("\n".join(summaries), stream=False)
                except Exception as e:
                    print(
                        f"Failed to generate TL;DR for {contributor_data['username']}: {e}"
                    )
                    tldr_text = None

        people_summaries.append(
            {
                "username": contributor_data["username"],
                "avatar_url": contributor_data["avatar_url"],
                "profile_url": contributor_data["profile_url"],
                "tldr": cast(str, tldr_text) if tldr_text else "",
                "prs": [pr.model_dump(mode="json") for pr in contributor_data["prs"]],
                "issues": [
                    issue.model_dump(mode="json")
                    for issue in contributor_data["issues"]
                ],
                "total_items": len(contributor_data["prs"])
                + len(contributor_data["issues"]),
            }
        )

    # Sort by total contributions (most active first) and limit to top 5
    people_summaries.sort(key=lambda x: x["total_items"], reverse=True)

    # Return only the top 5 most active contributors
    return people_summaries[:5]


async def enrich_contributor_with_github_activity(
    github_client: Any,
    github_repo: Any,
    contributor: Dict[str, str],
    start_date: Any,
    end_date: Any,
) -> Dict[str, Any]:
    """
    Enrich a contributor with their GitHub activity.

    This function is for use cases where you have a contributor dict from
    GitHub's contributors API and want to fetch their full activity.

    This is used by the /people endpoint which fetches contributors separately
    from the items.

    Args:
        github_client: GitHub API client
        github_repo: GitHub repository object
        contributor: Dict with 'username', 'avatar_url', 'profile_url'
        start_date: Start of date range
        end_date: End of date range

    Returns:
        Dict with contributor info and their enriched activity
    """
    from services.github_client import get_repo_activity
    from services.issue_summary import summarize_items
    from utils.serializers import serialize_github_item

    # Fetch all activity for this contributor
    items = await get_repo_activity(
        github_client,
        github_repo,
        item_type="all",
        start_date=start_date,
        end_date=end_date,
        author=contributor["username"],
    )

    github_items = [serialize_github_item(item) for item in items]
    summarized = await summarize_items(github_items[:MAX_ITEMS_PER_SECTION])

    # Generate TL;DR
    summaries = [item.summary for item in summarized if item.summary]
    tldr_text = None
    if summaries:
        try:
            tldr_text = await tldr("\n".join(summaries), stream=False)
        except Exception as e:
            print(f"Failed to generate TL;DR for {contributor['username']}: {e}")

    return {
        "username": contributor["username"],
        "avatar_url": contributor["avatar_url"],
        "profile_url": contributor["profile_url"],
        "tldr": cast(str, tldr_text) if tldr_text else "",
        "prs": [item for item in summarized if getattr(item, "is_pull_request", False)],
        "issues": [
            item for item in summarized if not getattr(item, "is_pull_request", False)
        ],
    }

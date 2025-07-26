import asyncio
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Literal, Optional, Union

from github import Github
from github.File import File as PullRequestFile
from github.Issue import Issue
from github.PaginatedList import PaginatedList
from github.PullRequest import PullRequest
from github.PullRequestReview import PullRequestReview
from github.Repository import Repository

from config import COMMON_GITHUB_BOTS, MAX_ITEMS_PER_SECTION
from models.github import PatchItem


def is_bot(user_login: str) -> bool:
    user_login = user_login.lower()
    return user_login in COMMON_GITHUB_BOTS


def is_near_rate_limit(github: Github, threshold: int = 100) -> bool:
    core_limit = github.get_rate_limit().core
    return core_limit.remaining < threshold


def get_top_contributors(repo: Repository, top_n: int = 10) -> list[str]:
    """Return the top N non-bot contributor usernames, sorted by total commits."""

    stats = repo.get_stats_contributors()

    if not stats:
        return []

    sorted_contributors = sorted(stats, key=lambda s: s.total, reverse=True)

    top_contributors = [
        s.author.login
        for s in sorted_contributors
        if getattr(s.author, "login", None) and not is_bot(s.author.login)
    ]

    return top_contributors[:top_n]


def build_github_search_query(
    owner: str,
    repo: str,
    item_type: Optional[Literal["pr", "issue", "all"]] = None,
    author: Optional[str] = None,
    labels: Optional[list[str]] = None,
    created_range: Optional[tuple[datetime, datetime]] = None,
    state: Optional[Literal["open", "closed", "all"]] = "all",
    min_comments: Optional[int] = None,
    extra_terms: Optional[list[str]] = None,
) -> str:
    """Builds a GitHub search query string based on the provided parameters."""

    query_parts = [f"repo:{owner}/{repo}"]

    # Type filter
    if item_type == "pr":
        query_parts.append("is:pr")
    elif item_type == "issue":
        query_parts.append("is:issue")
    # If "all" or None: do not add is:*

    # State filter
    if state in {"open", "closed"}:
        query_parts.append(f"is:{state}")

    # Author filter
    if author:
        query_parts.append(f"author:{author}")

    # Label filter
    if labels:
        query_parts.extend(f'label:"{label}"' for label in labels)

    # Date range filter
    if created_range:
        start, end = created_range
        query_parts.append(f"created:{start.date()}..{end.date()}")

    # Minimum comments filter
    if min_comments is not None:
        query_parts.append(f"comments:>={min_comments}")

    # Additional terms
    if extra_terms:
        query_parts.extend(extra_terms)

    return " ".join(query_parts)


async def get_pr_diff(repo: Repository, pull_number: str) -> list[PatchItem]:
    pr = await asyncio.to_thread(repo.get_pull, int(pull_number))
    if not pr:
        raise ValueError(f"Pull request {pull_number} not found")

    files: list[PullRequestFile] = await asyncio.to_thread(lambda: list(pr.get_files()))

    async def get_patch(file: PullRequestFile) -> Optional[PatchItem]:
        return (
            await asyncio.to_thread(
                lambda: PatchItem(file=file.filename, patch=file.patch)
            )
            if file.patch
            else None
        )

    patches = await asyncio.gather(*(get_patch(f) for f in files))

    return [p for p in patches if p]


def get_pr_reviews(
    repo: Repository, pull_number: str
) -> PaginatedList[PullRequestReview]:
    """
    Fetch reviews for a pull request.
    """
    pr = repo.get_pull(int(pull_number))
    if not pr:
        raise ValueError(f"Pull request {pull_number} not found")

    reviews = pr.get_reviews()

    return reviews


def get_repo(github: Github, owner: str, repo: str) -> Repository:
    """
    Fetch a GitHub repository object with enhanced error handling.
    """
    from github.GithubException import GithubException

    try:
        return github.get_repo(f"{owner}/{repo}")
    except GithubException as e:
        # Enhanced error messages for common access issues
        if e.status == 404:
            raise ValueError(f"Repository '{owner}/{repo}' not found or not accessible")
        elif e.status == 403:
            if "rate limit" in str(e).lower():
                raise ValueError(
                    "GitHub API rate limit exceeded. Please try again later."
                )
            elif "third-party" in str(e).lower() or "oauth" in str(e).lower():
                raise ValueError(
                    f"Repository '{owner}/{repo}' has restricted third-party access. Please check the organization's OAuth settings or contact the repository owner."
                )
            elif "private" in str(e).lower():
                raise ValueError(
                    f"Repository '{owner}/{repo}' is private and you don't have access"
                )
            else:
                raise ValueError(
                    f"Access denied to repository '{owner}/{repo}'. This may be due to organization policies or insufficient permissions."
                )
        elif e.status == 401:
            raise ValueError("GitHub authentication failed. Please re-authenticate.")
        else:
            raise ValueError(f"GitHub API error: {e.data.get('message', str(e))}")


async def fetch_item(
    repo: Repository, raw: dict[str, Any]
) -> Optional[Union[Issue, PullRequest]]:
    try:
        item = await asyncio.to_thread(repo.get_issue, int(raw["number"]))

        # Default merged to None
        merged = None

        # Check if it's a pull request
        if hasattr(item, "pull_request") and item.pull_request is not None:
            try:
                pr = await asyncio.to_thread(repo.get_pull, item.number)
                merged = await asyncio.to_thread(pr.is_merged)
            except Exception as e:
                print(f"⚠️ Failed to determine merged state for PR #{item.number}: {e}")

        setattr(item, "merged", merged)

        return item

    except Exception as e:
        print(f"⚠️ Failed to fetch full issue #{raw.get('number')}: {e}")
        return None


async def search_github_items(
    github: Github,
    repo: Repository,
    item_type: Optional[Literal["pr", "issue", "all"]] = None,
    created_range: Optional[tuple[datetime, datetime]] = None,
    state: Optional[Literal["open", "closed", "all"]] = "all",
    extra_terms: Optional[list[str]] = None,
    author: Optional[str] = None,
    rate_limit_buffer: int = 100,
) -> list[Union[Issue, PullRequest]]:
    """
    Search GitHub issues and pull requests via the search API.

    Args:
        repo: GitHub repository instance.
        item_type: 'pr', 'issue', or 'all'.
        created_range: Tuple of (start_date, end_date) for filtering.
        state: State of the items ('open', 'closed', or 'all').
        extra_terms: Additional search terms like 'sort:comments-desc'.
        author: Filter items by author.
        rate_limit_buffer: Minimum remaining requests before skipping.

    Returns:
        A deduplicated list of GitHub Issue or PullRequest objects.
    """

    if is_near_rate_limit(github, rate_limit_buffer):
        print("⚠️  Rate limit too low, skipping search.")
        return []

    query = build_github_search_query(
        owner=repo.owner.login,
        repo=repo.name,
        item_type=item_type,
        created_range=created_range,
        state=state,
        extra_terms=extra_terms,
        author=author,
    )

    print(f"🔍 GitHub search query: {query}")

    try:
        _, data = await asyncio.to_thread(
            repo._requester.requestJsonAndCheck, "GET", f"/search/issues?q={query}"
        )
        items = data.get("items", [])
    except Exception as e:
        from github.GithubException import GithubException

        if isinstance(e, GithubException):
            if e.status == 403:
                if "third-party" in str(e).lower() or "oauth" in str(e).lower():
                    raise ValueError(
                        f"Repository '{repo.full_name}' has restricted third-party access. Please check the organization's OAuth settings."
                    )
                elif "rate limit" in str(e).lower():
                    raise ValueError(
                        "GitHub API rate limit exceeded. Please try again later."
                    )
                else:
                    raise ValueError(
                        f"Access denied to repository '{repo.full_name}'. This may be due to organization policies."
                    )
            elif e.status == 404:
                raise ValueError(
                    f"Repository '{repo.full_name}' not found or not accessible"
                )
            elif e.status == 401:
                raise ValueError(
                    "GitHub authentication failed. Please re-authenticate."
                )

        print(f"❌ GitHub search failed: {e}")
        raise ValueError(f"Failed to search repository '{repo.full_name}': {str(e)}")

    raw_tasks = [fetch_item(repo, raw) for raw in items]
    fetched_items = await asyncio.gather(*raw_tasks)

    seen_ids = set()
    unique_items: list[Union[Issue, PullRequest]] = []
    for item in fetched_items:
        if item and item.id not in seen_ids:
            seen_ids.add(item.id)
            unique_items.append(item)

    return unique_items


def get_active_contributors(
    github: Github,
    repo: Repository,
    since: datetime,
    until: datetime,
    max_contributors: int = 5,
) -> list[dict[str, Any]]:
    """
    Returns the top contributors by number of commits in the given timeframe.
    Uses GitHub API pagination efficiently.
    """

    commit_counts: defaultdict[str, int] = defaultdict(int)

    # GitHub API includes `until` date as exclusive, so we extend it by 1 day
    commits = repo.get_commits(since=since, until=until + timedelta(days=1))

    for commit in commits:
        author = commit.author
        if author and author.login:
            commit_counts[author.login] += 1

    top_usernames = sorted(commit_counts.items(), key=lambda x: x[1], reverse=True)[
        :max_contributors
    ]

    contributors: list[dict[str, Any]] = []

    for username, count in top_usernames:
        try:
            user = github.get_user(username)
            contributors.append(
                {
                    "username": user.login,
                    "avatar_url": user.avatar_url,
                    "profile_url": user.html_url,
                    "commit_count": count,
                }
            )
        except Exception as e:
            print(f"⚠️ Could not fetch user info for {username}: {e}")

    return contributors


def score_sort_items(
    repo: Repository,
    items: list[Union[Issue, PullRequest]],
    max_items: int = MAX_ITEMS_PER_SECTION,
) -> list[tuple[int, Union[Issue, PullRequest]]]:
    """
    Scores and sorts GitHub issues/PRs based on engagement and author relevance.

    Scoring Heuristics:
    - Base engagement = comments + reactions
    - Bonus for author association (OWNER > MEMBER > COLLABORATOR > CONTRIBUTOR)
    - Bonus for top contributor authors or assignees
    """

    top_contributors = set(get_top_contributors(repo))

    def base_engagement(item: Union[Issue, PullRequest]) -> int:
        reactions = item.raw_data.get("reactions", {}).get("total_count", 0)
        return int(item.comments) + int(reactions)

    # Pre-filter top N by engagement to reduce scoring load
    items_by_engagement = sorted(items, key=base_engagement, reverse=True)[:max_items]

    def compute_score(item: Union[Issue, PullRequest]) -> int:
        score = base_engagement(item)

        author = item.user.login if item.user else None
        assoc = item.author_association or ""

        if author in top_contributors or assoc in {"OWNER", "MEMBER"}:
            score += 10
        elif assoc == "COLLABORATOR":
            score += 5
        elif assoc == "CONTRIBUTOR":
            score += 3

        if hasattr(item, "assignees"):
            for assignee in item.assignees:
                if assignee.login in top_contributors:
                    score += 3

        return score

    scored_items = [(compute_score(item), item) for item in items_by_engagement]

    return sorted(scored_items, key=lambda x: x[0], reverse=True)


async def get_repo_activity(
    github: Github,
    repo: Repository,
    item_type: Literal["pr", "issue", "all"],
    start_date: datetime,
    end_date: datetime,
    **kwargs: Any,
) -> list[Union[Issue, PullRequest]]:
    """
    Fetch GitHub pull requests or issues for a given repo and date range,
    prioritizing those with the most engagement.
    """

    query_args: dict[str, Any] = {
        "github": github,
        "repo": repo,
        "created_range": (start_date, end_date),
        "state": "all",
        "extra_terms": ["sort:comments-desc"],
        "item_type": item_type,
    }

    if author := kwargs.get("author"):
        query_args["author"] = author

    return await search_github_items(**query_args)

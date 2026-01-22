import asyncio
import types
from datetime import datetime, timezone

import pytest

from services import github_client


class DummyUser:
    def __init__(self, login: str) -> None:
        self.login = login
        self.avatar_url = f"https://github.com/{login}.png"
        self.html_url = f"https://github.com/{login}"


class DummyStat:
    def __init__(self, login: str, total: int) -> None:
        self.total = total
        self.author = DummyUser(login)


class DummyCore:
    def __init__(self, remaining: int) -> None:
        self.remaining = remaining


class DummyRateLimit:
    def __init__(self, remaining: int) -> None:
        self.core = DummyCore(remaining)


class DummyRepo:
    def __init__(self, owner_login: str = "owner", name: str = "repo") -> None:
        self.owner = types.SimpleNamespace(login=owner_login)
        self.name = name
        self.full_name = f"{owner_login}/{name}"
        self._stats: list[DummyStat] = []
        self._commits: list["DummyCommit"] = []
        self._requester = None

    def get_stats_contributors(self) -> list[DummyStat]:
        return self._stats

    def get_commits(self, since: datetime, until: datetime):
        return self._commits


class DummyCommit:
    def __init__(self, login: str | None) -> None:
        self.author = DummyUser(login) if login else None


class DummyItem:
    def __init__(
        self,
        item_id: int,
        login: str,
        comments: int = 0,
        reactions: int = 0,
        association: str = "",
    ) -> None:
        self.id = item_id
        self.number = item_id
        self.user = DummyUser(login)
        self.comments = comments
        self.raw_data = {"reactions": {"total_count": reactions}}
        self.assignees = []
        self.author_association = association


def test_is_bot() -> None:
    assert github_client.is_bot("dependabot[bot]") is True
    assert github_client.is_bot("DePeNdAbOt[BoT]") is True
    assert github_client.is_bot("octocat") is False


def test_build_github_search_query_variants() -> None:
    query = github_client.build_github_search_query(
        owner="octocat",
        repo="hello-world",
        item_type="pr",
        author="alice",
        labels=["bug", "help wanted"],
        created_range=(datetime(2024, 1, 1), datetime(2024, 1, 7)),
        state="open",
        min_comments=2,
        extra_terms=["sort:comments-desc"],
    )
    assert "repo:octocat/hello-world" in query
    assert "is:pr" in query
    assert "author:alice" in query
    assert 'label:"bug"' in query and 'label:"help wanted"' in query
    assert "created:2024-01-01..2024-01-07" in query
    assert "comments:>=2" in query
    assert "sort:comments-desc" in query


def test_is_near_rate_limit() -> None:
    class DummyGithub:
        def __init__(self, remaining: int) -> None:
            self._remaining = remaining

        def get_rate_limit(self) -> DummyRateLimit:
            return DummyRateLimit(self._remaining)

    assert github_client.is_near_rate_limit(DummyGithub(99), threshold=100) is True
    assert github_client.is_near_rate_limit(DummyGithub(150), threshold=100) is False


def test_get_top_contributors_skips_bots() -> None:
    repo = DummyRepo()
    repo._stats = [DummyStat("dependabot[bot]", 5), DummyStat("alice", 3)]

    result = github_client.get_top_contributors(repo, top_n=10)

    assert result == ["alice"]


def test_get_active_contributors_skips_bot_commits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repo = DummyRepo()
    repo._commits = [
        DummyCommit("dependabot[bot]"),
        DummyCommit("carol"),
        DummyCommit("carol"),
    ]

    class DummyGithub:
        def get_user(self, username: str) -> DummyUser:
            return DummyUser(username)

    contributors = github_client.get_active_contributors(
        DummyGithub(),
        repo,
        since=datetime.now(timezone.utc),
        until=datetime.now(timezone.utc),
    )

    assert [c["username"] for c in contributors] == ["carol"]
    assert contributors[0]["commit_count"] == 2


def test_score_sort_items_prefers_top_contributors_and_owner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repo = DummyRepo()
    repo._stats = [DummyStat("alice", 5)]

    item_top = DummyItem(
        item_id=1, login="alice", comments=1, reactions=0, association="CONTRIBUTOR"
    )
    item_owner = DummyItem(
        item_id=2, login="bob", comments=0, reactions=0, association="OWNER"
    )

    scored = github_client.score_sort_items(repo, [item_owner, item_top])

    assert [item.user.login for _, item in scored] == ["alice", "bob"]


def test_search_github_items_filters_bots(monkeypatch: pytest.MonkeyPatch) -> None:
    repo = DummyRepo(owner_login="octo", name="repo")

    class DummyRequester:
        def requestJsonAndCheck(self, method: str, url: str):
            return None, {
                "items": [
                    {"number": 1, "id": 10, "user_login": "dependabot[bot]"},
                    {"number": 2, "id": 11, "user_login": "alice"},
                ]
            }

    repo._requester = DummyRequester()

    monkeypatch.setattr(
        github_client, "is_near_rate_limit", lambda github, threshold=100: False
    )

    async def fake_fetch_item(repo_arg, raw):
        item = DummyItem(item_id=raw["id"], login=raw["user_login"])
        return item

    monkeypatch.setattr(github_client, "fetch_item", fake_fetch_item)

    results = asyncio.run(
        github_client.search_github_items(
            github=types.SimpleNamespace(get_rate_limit=lambda: DummyRateLimit(200)),
            repo=repo,
            item_type="pr",
            created_range=(datetime(2024, 1, 1), datetime(2024, 1, 2)),
        )
    )

    assert len(results) == 1
    assert results[0].user.login == "alice"


def test_search_github_items_rate_limit_skip(monkeypatch: pytest.MonkeyPatch) -> None:
    repo = DummyRepo()
    monkeypatch.setattr(
        github_client, "is_near_rate_limit", lambda github, threshold=100: True
    )

    results = asyncio.run(
        github_client.search_github_items(
            github=types.SimpleNamespace(),
            repo=repo,
            item_type="pr",
            created_range=(datetime(2024, 1, 1), datetime(2024, 1, 2)),
        )
    )

    assert results == []


def test_get_repo_activity_passes_arguments(monkeypatch: pytest.MonkeyPatch) -> None:
    repo = DummyRepo(owner_login="octo", name="repo")

    captured = {}

    async def fake_search_github_items(**kwargs):
        captured.update(kwargs)
        return ["ok"]

    monkeypatch.setattr(github_client, "search_github_items", fake_search_github_items)

    result = asyncio.run(
        github_client.get_repo_activity(
            github=types.SimpleNamespace(),
            repo=repo,
            item_type="pr",
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 2),
            author="alice",
        )
    )

    assert result == ["ok"]
    assert captured["author"] == "alice"
    assert captured["item_type"] == "pr"
    assert captured["created_range"] == (datetime(2024, 1, 1), datetime(2024, 1, 2))

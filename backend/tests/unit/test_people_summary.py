import asyncio
from datetime import datetime

import pytest

from models.github import GitHubItem, GithubUser
from services import people_summary


def make_item(login: str, summary: str, is_pr: bool, number: int) -> GitHubItem:
    return GitHubItem(
        id=number,
        number=number,
        title=f"title-{number}",
        body="body",
        summary=summary,
        user=GithubUser(
            login=login,
            id=number,
            avatar_url=f"https://example.com/{login}.png",
            html_url=f"https://github.com/{login}",
        ),
        html_url="https://github.com/octo/repo",
        state="open",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        comments=0,
        reactions=0,
        labels=[],
        is_pull_request=is_pr,
        merged=False,
    )


def test_generate_people_summaries_groups_and_sorts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_tldr(text: str, stream: bool = True) -> str:
        return "TLDR"

    monkeypatch.setattr(people_summary, "tldr", fake_tldr)

    prs = [make_item("alice", "PR summary", True, 1)]
    issues = [
        make_item("alice", "Issue summary", False, 2),
        make_item("bob", "Issue 2", False, 3),
    ]

    result = asyncio.run(people_summary.generate_people_summaries(prs, issues))

    assert len(result) == 2
    # Alice has 2 items, should come first
    assert result[0]["username"] == "alice"
    assert result[0]["tldr"] == "TLDR"
    assert len(result[0]["prs"]) == 1
    assert len(result[0]["issues"]) == 1
    assert result[1]["username"] == "bob"


def test_enrich_contributor_with_github_activity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from services import github_client as github_client_module
    from services import issue_summary as issue_summary_module
    from utils import serializers

    class FakeGHItem:
        def __init__(self, item_id: int, login: str, is_pr: bool) -> None:
            self.id = item_id
            self.number = item_id
            self.title = f"title-{item_id}"
            self.body = "body"
            self.html_url = "https://github.com/octo/repo"
            self.state = "open"
            self.created_at = datetime.utcnow()
            self.updated_at = datetime.utcnow()
            self.comments = 0
            self.labels = []
            self.user = type(
                "User",
                (),
                {"login": login, "id": item_id, "avatar_url": "", "html_url": ""},
            )
            self.raw_data = {"reactions": {"total_count": 0}}
            self.pull_request = object() if is_pr else None
            self.merged = False
            self.author_association = ""

    async def fake_get_repo_activity(*args, **kwargs):
        return [FakeGHItem(1, "alice", True), FakeGHItem(2, "alice", False)]

    async def fake_summarize_items(items):
        return [
            item.model_copy(update={"summary": f"summary-{item.number}"})
            for item in items
        ]

    async def fake_tldr(text: str, stream: bool = True) -> str:
        return "TLDR TEXT"

    monkeypatch.setattr(
        github_client_module, "get_repo_activity", fake_get_repo_activity
    )
    monkeypatch.setattr(issue_summary_module, "summarize_items", fake_summarize_items)
    monkeypatch.setattr(people_summary, "tldr", fake_tldr)
    monkeypatch.setattr(
        serializers, "serialize_github_item", serializers.serialize_github_item
    )

    contributor = {"username": "alice", "avatar_url": "", "profile_url": ""}

    result = asyncio.run(
        people_summary.enrich_contributor_with_github_activity(
            github_client=object(),
            github_repo=object(),
            contributor=contributor,
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow(),
        )
    )

    assert result["username"] == "alice"
    assert result["tldr"] == "TLDR TEXT"
    assert len(result["prs"]) == 1
    assert len(result["issues"]) == 1
    assert result["prs"][0].is_pull_request is True
    assert result["issues"][0].is_pull_request is False

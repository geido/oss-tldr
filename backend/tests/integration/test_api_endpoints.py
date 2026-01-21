from datetime import datetime, timezone

import pytest
from models.github import GitHubItem, GithubUser


def make_item(
    number: int,
    login: str,
    is_pr: bool,
    summary: str = "",
) -> GitHubItem:
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
        html_url=f"https://github.com/octo/repo/{number}",
        state="open",
        created_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        updated_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        comments=0,
        reactions=0,
        labels=[],
        is_pull_request=is_pr,
        merged=False,
    )


@pytest.mark.anyio("asyncio")
async def test_health_endpoint(client) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.anyio("asyncio")
async def test_prs_endpoint_returns_summarized_items(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    from api import prs

    class FakeIssue:
        def __init__(self) -> None:
            self.id = 1
            self.number = 1
            self.title = "Fix bug"
            self.body = "details"
            self.html_url = "https://github.com/octo/repo/pull/1"
            self.state = "open"
            self.created_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
            self.updated_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
            self.comments = 2
            self.labels = []
            self.user = type(
                "User",
                (),
                {"login": "alice", "id": 1, "avatar_url": "", "html_url": ""},
            )
            self.raw_data = {"reactions": {"total_count": 1}}
            self.pull_request = object()
            self.merged = False
            self.author_association = "MEMBER"

    fake_item = FakeIssue()

    monkeypatch.setattr(prs, "parse_repo_url", lambda url: ("octo", "repo"))
    monkeypatch.setattr(prs, "get_repo", lambda gh, owner, repo: object())

    async def fake_get_repo_activity(gh, repo, item_type, start_date, end_date):
        return [fake_item]

    monkeypatch.setattr(prs, "get_repo_activity", fake_get_repo_activity)
    monkeypatch.setattr(
        prs,
        "score_sort_items",
        lambda repo, items: [(10, item) for item in items],
    )

    def fake_serialize(pr):
        return make_item(1, "alice", is_pr=True, summary="")

    async def fake_summarize_items(items):
        return [item.model_copy(update={"summary": "summary-text"}) for item in items]

    monkeypatch.setattr(prs, "serialize_github_item", fake_serialize)
    monkeypatch.setattr(prs, "summarize_items", fake_summarize_items)

    resp = await client.post(
        "/api/v1/prs",
        json={"repo_url": "octo/repo", "timeframe": "last_day"},
        headers={"Authorization": "Bearer test"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["prs"]) == 1
    assert data["prs"][0]["summary"] == "summary-text"
    assert data["prs"][0]["is_pull_request"] is True


@pytest.mark.anyio("asyncio")
async def test_people_endpoint_returns_enriched_contributors(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    from api import people

    monkeypatch.setattr(people, "parse_repo_url", lambda url: ("octo", "repo"))
    monkeypatch.setattr(people, "get_repo", lambda gh, owner, repo: object())
    monkeypatch.setattr(
        people,
        "get_active_contributors",
        lambda gh, repo, since, until: [
            {
                "username": "alice",
                "avatar_url": "",
                "profile_url": "",
                "commit_count": 2,
            }
        ],
    )

    async def fake_enrich(
        github_client, github_repo, contributor, start_date, end_date
    ):
        return {
            "username": contributor["username"],
            "avatar_url": "",
            "profile_url": "",
            "tldr": "TLDR",
            "prs": [make_item(1, "alice", True, "p")],
            "issues": [make_item(2, "alice", False, "i")],
        }

    monkeypatch.setattr(people, "enrich_contributor_with_github_activity", fake_enrich)

    resp = await client.post(
        "/api/v1/people",
        json={"repo_url": "octo/repo", "timeframe": "last_week"},
        headers={"Authorization": "Bearer test"},
    )

    assert resp.status_code == 200
    payload = resp.json()
    assert len(payload["people"]) == 1
    person = payload["people"][0]
    assert person["username"] == "alice"
    assert person["tldr"] == "TLDR"
    assert len(person["prs"]) == 1
    assert len(person["issues"]) == 1

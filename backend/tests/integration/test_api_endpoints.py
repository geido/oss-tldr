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

from datetime import datetime, timezone

from utils.serializers import serialize_github_item


class DummyLabel:
    def __init__(self, name: str) -> None:
        self.name = name


class DummyUser:
    def __init__(self, login: str, user_id: int = 1) -> None:
        self.login = login
        self.id = user_id
        self.avatar_url = "https://example.com/avatar.png"
        self.html_url = f"https://github.com/{login}"


class DummyItem:
    def __init__(self, is_pr: bool, merged: bool | None = None) -> None:
        self.id = 123
        self.number = 42
        self.title = "Fix bug"
        self.body = "Details"
        self.html_url = "https://github.com/octocat/hello-world/issues/42"
        self.state = "open"
        self.created_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
        self.updated_at = datetime(2024, 1, 2, tzinfo=timezone.utc)
        self.comments = 5
        self.labels = [DummyLabel("bug"), DummyLabel("help wanted")]
        self.user = DummyUser("octocat", 99)
        self.raw_data = {"reactions": {"total_count": 3}}
        self.pull_request = object() if is_pr else None
        self.merged = merged
        self.author_association = "CONTRIBUTOR"


def test_serialize_pull_request() -> None:
    item = DummyItem(is_pr=True, merged=True)

    serialized = serialize_github_item(item)

    assert serialized.is_pull_request is True
    assert serialized.merged is True
    assert serialized.labels == ["bug", "help wanted"]
    assert serialized.reactions == 3
    assert serialized.user.login == "octocat"
    assert serialized.author_association == "CONTRIBUTOR"


def test_serialize_issue_defaults() -> None:
    item = DummyItem(is_pr=False)

    serialized = serialize_github_item(item)

    assert serialized.is_pull_request is False
    assert serialized.merged is None
    assert serialized.comments == 5

import pytest

from utils.url import parse_repo_url


def test_parse_repo_url_basic() -> None:
    owner, repo = parse_repo_url("octocat/hello-world")
    assert owner == "octocat"
    assert repo == "hello-world"


def test_parse_repo_url_https() -> None:
    owner, repo = parse_repo_url("https://github.com/octocat/hello-world")
    assert (owner, repo) == ("octocat", "hello-world")


def test_parse_repo_url_invalid() -> None:
    with pytest.raises(ValueError):
        parse_repo_url("not-a-repo")

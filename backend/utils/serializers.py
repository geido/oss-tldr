from typing import Union

from github.Issue import Issue
from github.NamedUser import NamedUser
from github.PullRequest import PullRequest

from models.github import GitHubItem, GithubUser


def serialize_user(user: NamedUser) -> GithubUser:
    if user is None:
        return {}

    return GithubUser(
        login=user.login,
        id=user.id,
        avatar_url=user.avatar_url,
        html_url=user.html_url,
    )


def serialize_github_item(item: Union[Issue, PullRequest]) -> GitHubItem:
    return GitHubItem(
        id=item.id,
        number=item.number,
        title=item.title,
        body=item.body or "",
        html_url=item.html_url,
        state=item.state,
        created_at=item.created_at,
        updated_at=item.updated_at,
        comments=item.comments,
        labels=[label.name for label in item.labels],
        user=serialize_user(item.user),
        reactions=item.raw_data.get("reactions", {}).get("total_count", 0),
        is_pull_request=hasattr(item, "pull_request") and item.pull_request is not None,
        merged=getattr(item, "merged", False),
        author_association=getattr(item, "author_association", None),
    )

"""Helper functions for group operations."""
import re
from typing import Optional

from fastapi import HTTPException

from repositories.groups import GroupsRepository
from utils.url import normalize_repo_reference


def generate_slug(name: str) -> str:
    """Generate a URL-friendly slug from a group name.

    Args:
        name: The group name to convert

    Returns:
        A URL-friendly slug (lowercase, alphanumeric with hyphens)
    """
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"^-+|-+$", "", slug)
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:64] or "group"


async def ensure_unique_slug(
    groups_repo: GroupsRepository,
    base_slug: str,
    exclude_id: Optional[int] = None,
) -> str:
    """Generate a unique slug, appending numbers if necessary.

    Args:
        groups_repo: The groups repository instance
        base_slug: The base slug to make unique
        exclude_id: Optional group ID to exclude from uniqueness check

    Returns:
        A unique slug
    """
    slug = base_slug
    suffix = 1

    while True:
        existing = await groups_repo.get_by_slug(slug)
        if existing is None or (exclude_id and existing.id == exclude_id):
            return slug
        slug = f"{base_slug}-{suffix}"
        suffix += 1


def normalize_repos(repos: list[str]) -> list[str]:
    """Normalize repository identifiers to owner/repo format.

    Args:
        repos: List of repository identifiers (URLs or owner/repo format)

    Returns:
        List of normalized repository identifiers

    Raises:
        HTTPException: If any repository identifier is invalid
    """
    normalized = []
    for repo in repos:
        try:
            owner, name = normalize_repo_reference(repo)
            normalized.append(f"{owner}/{name}")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid repository identifier: {repo}",
            )
    # Remove duplicates while preserving order
    return list(dict.fromkeys(normalized))

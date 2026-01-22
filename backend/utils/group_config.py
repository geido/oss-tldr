from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional

import yaml
from pydantic import BaseModel, ValidationError


class GroupDefinition(BaseModel):
    """Schema for group definitions loaded from YAML files."""

    id: str
    name: str
    description: Optional[str] = None
    repos: list[str]


_GROUPS_PATH = Path(__file__).resolve().parent.parent / "groups"


def load_group_definitions_from_yaml() -> Dict[str, GroupDefinition]:
    """Load group definitions from YAML files in the groups directory.

    This is used primarily for seeding system groups into the database
    on application startup.

    Returns:
        Dictionary mapping group IDs to GroupDefinition objects
    """
    groups: Dict[str, GroupDefinition] = {}

    if not _GROUPS_PATH.exists():
        return groups

    for path in sorted(_GROUPS_PATH.glob("*.yml")) + sorted(
        _GROUPS_PATH.glob("*.yaml")
    ):
        try:
            with path.open("r", encoding="utf-8") as handle:
                raw = yaml.safe_load(handle) or {}
            group = GroupDefinition(**raw)
        except (OSError, ValidationError, yaml.YAMLError) as exc:
            # Log-friendly representation while keeping backend resilient.
            print(f"⚠️ Failed to load group config '{path.name}': {exc}")
            continue

        groups[group.id] = group

    return groups


async def seed_system_groups(session) -> None:
    """Seed system groups from YAML files into the database.

    This function is called on application startup to ensure all
    predefined groups exist in the database. It will:
    - Create new system groups that don't exist
    - Update existing system groups if their definition changed

    Args:
        session: Async database session
    """
    from repositories.groups import GroupsRepository

    groups_repo = GroupsRepository(session)
    yaml_groups = load_group_definitions_from_yaml()

    for group_def in yaml_groups.values():
        await groups_repo.upsert_system_group(
            slug=group_def.id,
            name=group_def.name,
            repos=group_def.repos,
            description=group_def.description,
        )
        print(f"✓ Seeded system group: {group_def.name} ({group_def.id})")

    await session.commit()

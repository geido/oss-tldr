from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Dict, Optional

import yaml
from pydantic import BaseModel, ValidationError


class GroupDefinition(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    repos: list[str]


_GROUPS_PATH = Path(__file__).resolve().parent.parent / "groups"


def _load_group_files() -> Dict[str, GroupDefinition]:
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


@lru_cache()
def get_group_definitions() -> Dict[str, GroupDefinition]:
    return _load_group_files()


def get_group_definition(group_id: str) -> Optional[GroupDefinition]:
    return get_group_definitions().get(group_id)


def refresh_groups_cache() -> None:
    get_group_definitions.cache_clear()

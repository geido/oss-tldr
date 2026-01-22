"""Common shared schemas used across multiple endpoints."""
from typing import Literal, Optional

from pydantic import BaseModel


# Type alias for timeframe parameter
Timeframe = Literal["last_day", "last_week", "last_month", "last_year"]


class RepositorySummary(BaseModel):
    """Common repository summary used across endpoints."""

    id: int
    full_name: str
    owner: str
    name: str
    description: Optional[str] = None
    html_url: str
    is_private: bool = False
    language: Optional[str] = None
    stargazers_count: int = 0

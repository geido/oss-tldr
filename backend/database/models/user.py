"""User model."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from database.connection import Base

if TYPE_CHECKING:
    from database.models.group import Group
    from database.models.user_report_access import UserReportAccess
    from database.models.user_repository import UserRepository


class User(Base):
    """User model (synchronized with GitHub OAuth)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)  # GitHub user ID
    login: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    # Relationships
    tracked_repos: Mapped[list["UserRepository"]] = relationship(
        "UserRepository", back_populates="user", cascade="all, delete-orphan"
    )
    accessed_reports: Mapped[list["UserReportAccess"]] = relationship(
        "UserReportAccess", back_populates="user", cascade="all, delete-orphan"
    )
    created_groups: Mapped[list["Group"]] = relationship(
        "Group",
        back_populates="created_by",
        cascade="all, delete-orphan",
        foreign_keys="Group.created_by_id",
    )

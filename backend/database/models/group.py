"""Group model for repository collections."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from database.connection import Base

if TYPE_CHECKING:
    from database.models.user import User


class Group(Base):
    """Group model for organizing repository collections.

    Groups can be either system-defined (predefined, shared across all users)
    or user-created (private to the creating user).

    System groups are seeded from YAML configurations on startup and
    can be identified by is_system=True and created_by_id=None.
    """

    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    slug: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )

    # System groups are predefined and shared across all users
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # User who created this group (NULL for system groups)
    created_by_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    # Relationships
    created_by: Mapped["User | None"] = relationship(
        "User", back_populates="created_groups", foreign_keys=[created_by_id]
    )
    repositories: Mapped[list["GroupRepository"]] = relationship(
        "GroupRepository",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="GroupRepository.position",
    )

    @property
    def repo_identifiers(self) -> list[str]:
        """Get list of repository identifiers in order."""
        return [gr.repository_identifier for gr in self.repositories]


class GroupRepository(Base):
    """Junction table linking groups to repository identifiers.

    Stores repository references as strings (owner/repo format) rather than
    foreign keys to the repositories table, since groups can reference repos
    that haven't been fully tracked yet.
    """

    __tablename__ = "group_repositories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    repository_identifier: Mapped[str] = mapped_column(
        String(255), nullable=False
    )  # "owner/repo" format
    position: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )  # For ordering

    # Relationships
    group: Mapped["Group"] = relationship("Group", back_populates="repositories")

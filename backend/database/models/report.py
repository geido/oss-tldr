"""Report model."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from database.connection import Base


class Report(Base):
    """TL;DR Report model with section-level data (shared across users).

    Reports are cached permanently based on deterministic timeframes.
    Once generated for a specific timeframe (e.g., "last_week" = Oct 14-20),
    the data never changes because the date range is fixed.

    The unique constraint ensures we never duplicate reports for the same
    repository + timeframe combination.
    """

    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint(
            "repository_id", "timeframe", "timeframe_start", "timeframe_end"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False
    )
    timeframe: Mapped[str] = mapped_column(String(20), nullable=False)
    timeframe_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timeframe_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Section data (no expiration - data is permanent for the given timeframe)
    prs: Mapped[Any | None] = mapped_column(JSONB)
    prs_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    issues: Mapped[Any | None] = mapped_column(JSONB)
    issues_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    people: Mapped[Any | None] = mapped_column(JSONB)
    people_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # TL;DR summary (cached with 1-hour expiration like other sections)
    tldr_text: Mapped[str | None] = mapped_column(Text)
    tldr_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Overall record metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    version: Mapped[int] = mapped_column(Integer, default=2)  # Version 2 = section-level caching

    # Relationships
    repository: Mapped["Repository"] = relationship("Repository", back_populates="reports")
    accessed_by: Mapped[list["UserReportAccess"]] = relationship(
        "UserReportAccess", back_populates="report", cascade="all, delete-orphan"
    )
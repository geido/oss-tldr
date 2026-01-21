"""UserReportAccess model."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from database.connection import Base


class UserReportAccess(Base):
    """User-Report Access tracking (which users have viewed which reports)."""

    __tablename__ = "user_report_access"
    __table_args__ = (UniqueConstraint("user_id", "report_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    report_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )
    accessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="accessed_reports")
    report: Mapped["Report"] = relationship("Report", back_populates="accessed_by")
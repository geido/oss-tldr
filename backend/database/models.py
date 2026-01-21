"""SQLAlchemy ORM models for OSS TL;DR."""
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database.connection import Base


class User(Base):
    """User model (synchronized with GitHub OAuth)."""

    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True)  # GitHub user ID
    login = Column(String(255), nullable=False, index=True)
    name = Column(String(255))
    email = Column(String(255))
    avatar_url = Column(String(512))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tracked_repos = relationship(
        "UserRepository", back_populates="user", cascade="all, delete-orphan"
    )
    accessed_reports = relationship(
        "UserReportAccess", back_populates="user", cascade="all, delete-orphan"
    )


class Repository(Base):
    """Repository model (cached GitHub repository metadata)."""

    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True)
    full_name = Column(String(255), unique=True, nullable=False, index=True)
    owner = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    html_url = Column(String(512), nullable=False)
    is_private = Column(Boolean, default=False)
    is_fork = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    language = Column(String(100))
    stargazers_count = Column(Integer, default=0)
    github_updated_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    reports = relationship(
        "Report", back_populates="repository", cascade="all, delete-orphan"
    )
    tracked_by = relationship(
        "UserRepository", back_populates="repository", cascade="all, delete-orphan"
    )


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

    id = Column(Integer, primary_key=True)
    repository_id = Column(
        Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False
    )
    timeframe = Column(String(20), nullable=False)
    timeframe_start = Column(DateTime(timezone=True), nullable=False)
    timeframe_end = Column(DateTime(timezone=True), nullable=False)

    # Section data (no expiration - data is permanent for the given timeframe)
    prs = Column(JSONB)
    prs_generated_at = Column(DateTime(timezone=True))

    issues = Column(JSONB)
    issues_generated_at = Column(DateTime(timezone=True))

    people = Column(JSONB)
    people_generated_at = Column(DateTime(timezone=True))

    # TL;DR summary (cached with 1-hour expiration like other sections)
    tldr_text = Column(Text)
    tldr_generated_at = Column(DateTime(timezone=True))

    # Overall record metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    version = Column(Integer, default=2)  # Version 2 = section-level caching

    # Relationships
    repository = relationship("Repository", back_populates="reports")
    accessed_by = relationship(
        "UserReportAccess", back_populates="report", cascade="all, delete-orphan"
    )


class UserRepository(Base):
    """User-Repository tracking (many-to-many relationship)."""

    __tablename__ = "user_repositories"
    __table_args__ = (UniqueConstraint("user_id", "repository_id"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    repository_id = Column(
        Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False
    )
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="tracked_repos")
    repository = relationship("Repository", back_populates="tracked_by")


class UserReportAccess(Base):
    """User-Report Access tracking (which users have viewed which reports)."""

    __tablename__ = "user_report_access"
    __table_args__ = (UniqueConstraint("user_id", "report_id"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    report_id = Column(
        Integer, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )
    accessed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="accessed_reports")
    report = relationship("Report", back_populates="accessed_by")

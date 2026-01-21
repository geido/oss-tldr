"""Reports repository with section-level caching support."""
from typing import Optional, Literal, Any
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Report
from repositories.base import BaseRepository

# Cache expiration policy (from CLAUDE.md)
CACHE_EXPIRATION = {
    "last_day": timedelta(hours=1),
    "last_week": timedelta(hours=6),
    "last_month": timedelta(days=1),
    "last_year": timedelta(days=7),
}

SectionType = Literal["prs", "issues", "people", "tldr"]


class ReportsRepository(BaseRepository[Report]):
    """Repository for Report model with section-level caching operations."""

    def __init__(self, session: AsyncSession):
        """Initialize reports repository."""
        super().__init__(Report, session)

    async def get_or_create_report_record(
        self,
        repository_id: int,
        timeframe: str,
        timeframe_start: datetime,
        timeframe_end: datetime,
    ) -> Report:
        """
        Get or create a report record for the given repository and timeframe.

        This creates the base report record without any section data.
        Sections are populated separately via update_section().

        Args:
            repository_id: Repository ID
            timeframe: "last_day", "last_week", "last_month", or "last_year"
            timeframe_start: Start of timeframe
            timeframe_end: End of timeframe

        Returns:
            Report record (existing or newly created)
        """
        # Look for existing report with same repo + timeframe
        query = (
            select(Report)
            .where(
                and_(
                    Report.repository_id == repository_id,
                    Report.timeframe == timeframe,
                )
            )
            .order_by(Report.created_at.desc())
            .limit(1)
        )

        result = await self.session.execute(query)
        report = result.scalar_one_or_none()

        if not report:
            # Create new report record
            report = Report(
                repository_id=repository_id,
                timeframe=timeframe,
                timeframe_start=timeframe_start,
                timeframe_end=timeframe_end,
                version=2,  # Version 2 = section-level caching
            )
            self.session.add(report)
            await self.session.flush()
            await self.session.refresh(report)

        return report

    async def get_cached_section(
        self,
        repository_id: int,
        timeframe: str,
        section: SectionType,
        skip_expiration_check: bool = False,
    ) -> Optional[Any]:
        """
        Get cached section data if it exists and is fresh (< 1 hour old).

        Args:
            repository_id: Repository ID
            timeframe: "last_day", "last_week", "last_month", or "last_year"
            section: Section type ("prs", "issues", "people", or "tldr")
            skip_expiration_check: If True, ignore 1-hour expiration check

        Returns:
            Section data if cached and fresh, None otherwise
        """
        # Get the most recent report for this repo + timeframe
        query = (
            select(Report)
            .where(
                and_(
                    Report.repository_id == repository_id,
                    Report.timeframe == timeframe,
                )
            )
            .order_by(Report.created_at.desc())
            .limit(1)
        )

        result = await self.session.execute(query)
        report = result.scalar_one_or_none()

        if not report:
            return None

        # Map section name to actual column name (tldr -> tldr_text)
        column_name = "tldr_text" if section == "tldr" else section

        # Get section data
        section_data = getattr(report, column_name, None)
        if section_data is None:
            return None

        # Check expiration (1 hour threshold) unless explicitly skipped
        if not skip_expiration_check:
            section_timestamp = getattr(report, f"{column_name}_generated_at", None)
            if section_timestamp:
                age = datetime.now(timezone.utc) - section_timestamp
                if age > timedelta(hours=1):
                    print(
                        f"⏰ Cache expired for {section} (age: {age.total_seconds() / 60:.1f} minutes)"
                    )
                    return None

        return section_data

    async def update_section(
        self,
        report_id: int,
        section: SectionType,
        data: Any,
    ) -> Report:
        """
        Update a specific section of a report with new data.

        Args:
            report_id: Report ID
            section: Section type ("prs", "issues", "people", or "tldr")
            data: Section data to store

        Returns:
            Updated Report
        """
        # Get the report
        query = select(Report).where(Report.id == report_id)
        result = await self.session.execute(query)
        report = result.scalar_one_or_none()

        if not report:
            raise ValueError(f"Report with ID {report_id} not found")

        # Map section name to actual column name (tldr -> tldr_text)
        column_name = "tldr_text" if section == "tldr" else section

        # Update section data and timestamp
        now = datetime.now(timezone.utc)
        setattr(report, column_name, data)
        setattr(report, f"{column_name}_generated_at", now)

        await self.session.flush()
        await self.session.refresh(report)
        return report

    async def get_cached_report(
        self,
        repository_id: int,
        timeframe: str,
        timeframe_start: datetime,
        timeframe_end: datetime,
    ) -> Optional[Report]:
        """
        Find cached report if exists and not expired.

        Instead of requiring exact timeframe matches, we find the most recent
        non-expired report for the given repository and timeframe type.
        This allows cache hits even when resolve_timeframe returns slightly
        different datetimes due to being called at different times.

        Args:
            repository_id: Repository ID
            timeframe: "last_day", "last_week", "last_month", or "last_year"
            timeframe_start: Start of timeframe (not used for matching)
            timeframe_end: End of timeframe (not used for matching)

        Returns:
            Most recent non-expired Report if found, None otherwise
        """
        query = (
            select(Report)
            .where(
                and_(
                    Report.repository_id == repository_id,
                    Report.timeframe == timeframe,
                    or_(
                        Report.expires_at.is_(None),
                        Report.expires_at > datetime.now(timezone.utc),
                    ),
                )
            )
            .order_by(Report.generated_at.desc())
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def create_report(
        self,
        repository_id: int,
        timeframe: str,
        timeframe_start: datetime,
        timeframe_end: datetime,
        data: dict,  # type: ignore
        set_expiration: bool = True,
    ) -> Report:
        """
        Create new report.

        Args:
            repository_id: Repository ID
            timeframe: "last_day", "last_week", "last_month", or "last_year"
            timeframe_start: Start of timeframe
            timeframe_end: End of timeframe
            data: Report data with keys: tldr, prs, issues, people
            set_expiration: Whether to set expiration based on timeframe

        Returns:
            Created Report
        """
        expires_at = None
        if set_expiration and timeframe in CACHE_EXPIRATION:
            expires_at = datetime.now(timezone.utc) + CACHE_EXPIRATION[timeframe]

        report = Report(
            repository_id=repository_id,
            timeframe=timeframe,
            timeframe_start=timeframe_start,
            timeframe_end=timeframe_end,
            tldr_text=data.get("tldr"),
            prs=data.get("prs"),
            issues=data.get("issues"),
            people=data.get("people"),
            expires_at=expires_at,
        )
        self.session.add(report)
        await self.session.flush()
        await self.session.refresh(report)
        return report

    async def get_reports_by_repository(
        self, repository_id: int, limit: int = 10
    ) -> list[Report]:
        """Get all reports for a repository."""
        result = await self.session.execute(
            select(Report)
            .where(Report.repository_id == repository_id)
            .order_by(Report.generated_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def delete_expired_reports(self) -> int:
        """Delete all expired reports. Returns count of deleted reports."""
        result = await self.session.execute(
            select(Report).where(
                and_(
                    Report.expires_at.is_not(None),
                    Report.expires_at < datetime.now(timezone.utc),
                )
            )
        )
        reports = result.scalars().all()
        count = len(reports)

        for report in reports:
            await self.session.delete(report)

        await self.session.flush()
        return count

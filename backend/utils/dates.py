from datetime import datetime, timedelta, timezone


def resolve_timeframe(timeframe: str) -> tuple[datetime, datetime]:
    """
    Resolve timeframe to deterministic date boundaries.

    Uses day-based boundaries so that the same timeframe returns the same
    date range regardless of what time of day it's called.

    - "last_day": Yesterday (00:00:00 to 23:59:59)
    - "last_week": Last 7 complete days (not including today)
    - "last_month": Last 30 complete days (not including today)
    - "last_year": Last 365 complete days (not including today)

    This ensures reports are cacheable - the same timeframe always means
    the same data, no expiration needed.
    """
    # Get current date at midnight UTC (start of today)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if timeframe == "last_day":
        # Yesterday: from start of yesterday to end of yesterday
        start = today_start - timedelta(days=1)
        end = today_start - timedelta(microseconds=1)  # 23:59:59.999999 yesterday
        return start, end
    elif timeframe == "last_week":
        # Last 7 complete days: 7 days ago (00:00:00) to yesterday (23:59:59)
        start = today_start - timedelta(days=7)
        end = today_start - timedelta(microseconds=1)
        return start, end
    elif timeframe == "last_month":
        # Last 30 complete days: 30 days ago (00:00:00) to yesterday (23:59:59)
        start = today_start - timedelta(days=30)
        end = today_start - timedelta(microseconds=1)
        return start, end
    elif timeframe == "last_year":
        # Last 365 complete days: 365 days ago (00:00:00) to yesterday (23:59:59)
        start = today_start - timedelta(days=365)
        end = today_start - timedelta(microseconds=1)
        return start, end
    else:
        raise ValueError(f"Invalid timeframe: {timeframe}")

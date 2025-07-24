from datetime import datetime, timedelta, timezone


def resolve_timeframe(timeframe: str) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    if timeframe == "last_day":
        return now - timedelta(days=1), now
    elif timeframe == "last_week":
        return now - timedelta(weeks=1), now
    elif timeframe == "last_month":
        return now - timedelta(days=30), now
    elif timeframe == "last_year":
        return now - timedelta(days=365), now
    else:
        raise ValueError("Invalid timeframe")

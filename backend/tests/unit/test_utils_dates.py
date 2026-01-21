from datetime import datetime, timedelta, timezone

import pytest

from utils import dates


class FixedDatetime(datetime):
    """Deterministic datetime for testing."""

    @classmethod
    def now(cls, tz=None):  # type: ignore[override]
        return datetime(2024, 1, 15, 12, 0, 0, tzinfo=tz or timezone.utc)


def test_resolve_timeframe_boundaries(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(dates, "datetime", FixedDatetime)

    today_start = datetime(2024, 1, 15, tzinfo=timezone.utc)

    start, end = dates.resolve_timeframe("last_day")
    assert start == today_start - timedelta(days=1)
    assert end == today_start - timedelta(microseconds=1)

    start, end = dates.resolve_timeframe("last_week")
    assert start == today_start - timedelta(days=7)
    assert end == today_start - timedelta(microseconds=1)

    start, end = dates.resolve_timeframe("last_month")
    assert start == today_start - timedelta(days=30)
    assert end == today_start - timedelta(microseconds=1)

    start, end = dates.resolve_timeframe("last_year")
    assert start == today_start - timedelta(days=365)
    assert end == today_start - timedelta(microseconds=1)


def test_resolve_timeframe_invalid(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(dates, "datetime", FixedDatetime)
    with pytest.raises(ValueError):
        dates.resolve_timeframe("decade")

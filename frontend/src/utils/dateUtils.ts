import { Timeframe } from "../types/github";

export function getDateRangeFromTimeframe(timeframe: Timeframe): {
  start: Date;
  end: Date;
} {
  const now = new Date();

  switch (timeframe) {
    case "last_day":
      return {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now,
      };
    case "last_week":
      return {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now,
      };
    case "last_month":
      return {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now,
      };
    case "last_year":
      return {
        start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        end: now,
      };
    default:
      throw new Error("Invalid timeframe");
  }
}

export function formatDateRange(timeframe: Timeframe): string {
  const { start, end } = getDateRangeFromTimeframe(timeframe);

  const formatOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };

  const startFormatted = start.toLocaleDateString("en-US", formatOptions);
  const endFormatted = end.toLocaleDateString("en-US", formatOptions);

  // If same year, don't repeat it
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear === endYear) {
    return `${startFormatted} - ${endFormatted}, ${endYear}`;
  } else {
    return `${startFormatted}, ${startYear} - ${endFormatted}, ${endYear}`;
  }
}

export function formatDateRangeShort(timeframe: Timeframe): string {
  const { start, end } = getDateRangeFromTimeframe(timeframe);

  const formatShort = (date: Date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${month}/${day}`;
  };

  return `${formatShort(start)} - ${formatShort(end)}`;
}

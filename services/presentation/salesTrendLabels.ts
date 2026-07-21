export type TrendDateFormatter = (
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions & { timeZone?: string }
) => string;

/**
 * Keeps short weekday labels when they identify each plotted service day. A
 * weekly series can otherwise render every point as the same weekday, so a
 * collision switches the historical labels to localized numeric dates.
 */
export function buildConciseTrendDateLabels(
  dateKeys: readonly string[],
  todayKey: string,
  todayLabel: string,
  formatDate: TrendDateFormatter
): string[] {
  const historicalKeys = dateKeys.filter((dateKey) => dateKey !== todayKey);
  const weekdayLabels = historicalKeys.map((dateKey) =>
    formatTrendDate(dateKey, formatDate, { weekday: "short" })
  );
  const weekdayCollision = new Set(weekdayLabels).size !== weekdayLabels.length;

  let historicalLabels = weekdayCollision
    ? historicalKeys.map((dateKey) =>
        formatTrendDate(dateKey, formatDate, { month: "numeric", day: "numeric" })
      )
    : weekdayLabels;

  if (new Set(historicalLabels).size !== historicalLabels.length) {
    historicalLabels = historicalKeys.map((dateKey) =>
      formatTrendDate(dateKey, formatDate, { year: "2-digit", month: "numeric", day: "numeric" })
    );
  }

  const labelsByDate = new Map(historicalKeys.map((dateKey, index) => [dateKey, historicalLabels[index]!]));
  return dateKeys.map((dateKey) => dateKey === todayKey ? todayLabel : labelsByDate.get(dateKey) ?? "—");
}

function formatTrendDate(
  dateKey: string,
  formatDate: TrendDateFormatter,
  options: Intl.DateTimeFormatOptions
) {
  return formatDate(`${dateKey}T12:00:00.000Z`, { ...options, timeZone: "UTC" });
}

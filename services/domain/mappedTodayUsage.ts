/**
 * Deterministic mapped POS usage for the current operating day.
 *
 * This is total recipe-mapped demand observed today — before the count-window
 * split that separates subtractable `todayDepletion` from
 * `unattributedTodayDepletion` absorbed by a same-day verified count.
 * Operators need the total as a structured fact so midday counts do not look
 * like "no POS use" when sales already sit inside the counted baseline.
 *
 * Always a finite non-negative quantity. Zero means no mapped sales today;
 * contamination of on-hand does not erase observed POS demand.
 */
export function computeMappedTodayUsage(input: {
  mappedTodayUsage: number;
}): number {
  if (!Number.isFinite(input.mappedTodayUsage) || input.mappedTodayUsage <= 0) {
    return 0;
  }

  return Math.round(input.mappedTodayUsage * 100) / 100;
}

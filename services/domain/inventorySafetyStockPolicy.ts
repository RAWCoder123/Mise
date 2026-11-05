/**
 * Deterministic safety-stock policy helpers for inventory reorder triggers.
 * Defaults of zero preserve pre-tip reorder-threshold behavior.
 */

export function finiteNonNegativePolicyNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
}

/** Buffer quantity in inventory units. 0 means unused / not configured. */
export function normalizeSafetyStock(value: unknown, maximum = 1_000_000): number {
  const numeric = finiteNonNegativePolicyNumber(value, 0);
  return Math.min(maximum, numeric);
}

/**
 * Effective reorder trigger: the greater of the configured reorder threshold
 * and safety stock. Safety stock of 0 leaves reorder_threshold unchanged.
 */
export function effectiveReorderThreshold(
  reorderThreshold: unknown,
  safetyStock: unknown
): number {
  return Math.max(
    finiteNonNegativePolicyNumber(reorderThreshold, 0),
    normalizeSafetyStock(safetyStock)
  );
}

/**
 * True when projected quantity is at or below a binding safety-stock buffer.
 * Inactive when safety stock is 0, not binding (below reorder threshold), or
 * when projected quantity is already a hard stockout (0) — those stay critical.
 */
export function projectedAtOrBelowSafetyStock(
  projectedQuantity: unknown,
  safetyStock: unknown,
  reorderThreshold: unknown
): boolean {
  const safety = normalizeSafetyStock(safetyStock);
  const reorder = finiteNonNegativePolicyNumber(reorderThreshold, 0);
  const projected = finiteNonNegativePolicyNumber(projectedQuantity, 0);
  if (safety <= 0) return false;
  if (safety < reorder) return false;
  if (projected <= 0) return false;
  return projected <= safety;
}

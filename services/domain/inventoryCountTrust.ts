/**
 * Bounded inventory-count trust summary for operator-facing stock claims.
 *
 * Stock answers must never treat projected Low/Critical as authoritative when
 * physical counts are missing, stale, or contaminated. This helper collapses
 * per-item prediction evidence into one fail-closed trust state.
 */

export type InventoryCountTrustState =
  | "authoritative"
  | "stale"
  | "unverified"
  | "contaminated"
  | "empty"
  | "unavailable";

export interface InventoryCountTrustEvidence {
  countEvidence: "verified_count" | "no_verified_count" | "contaminated_projection";
  countFreshness: "fresh" | "stale" | "unverified";
}

export interface InventoryCountTrustSummary {
  itemCount: number;
  freshCount: number;
  staleCount: number;
  unverifiedCount: number;
  contaminatedCount: number;
  state: InventoryCountTrustState;
}

/**
 * Summarize count trust across inventory predictions. Empty catalogs and
 * contaminated projections fail closed before any “stock looks ready” claim.
 */
export function summarizeInventoryCountTrust(
  evidence: readonly InventoryCountTrustEvidence[] | null | undefined
): InventoryCountTrustSummary {
  if (evidence == null) {
    return {
      itemCount: 0,
      freshCount: 0,
      staleCount: 0,
      unverifiedCount: 0,
      contaminatedCount: 0,
      state: "unavailable"
    };
  }

  if (evidence.length === 0) {
    return {
      itemCount: 0,
      freshCount: 0,
      staleCount: 0,
      unverifiedCount: 0,
      contaminatedCount: 0,
      state: "empty"
    };
  }

  let freshCount = 0;
  let staleCount = 0;
  let unverifiedCount = 0;
  let contaminatedCount = 0;

  for (const item of evidence) {
    if (item.countEvidence === "contaminated_projection") {
      contaminatedCount += 1;
      unverifiedCount += 1;
      continue;
    }
    if (item.countEvidence === "no_verified_count" || item.countFreshness === "unverified") {
      unverifiedCount += 1;
      continue;
    }
    if (item.countFreshness === "stale") {
      staleCount += 1;
      continue;
    }
    freshCount += 1;
  }

  const itemCount = evidence.length;
  let state: InventoryCountTrustState;
  if (contaminatedCount > 0) {
    state = "contaminated";
  } else if (unverifiedCount === itemCount || freshCount === 0 && staleCount === 0) {
    state = "unverified";
  } else if (freshCount === 0 || staleCount > freshCount) {
    state = "stale";
  } else if (unverifiedCount > freshCount) {
    state = "unverified";
  } else {
    state = "authoritative";
  }

  return {
    itemCount,
    freshCount,
    staleCount,
    unverifiedCount,
    contaminatedCount,
    state
  };
}

/** True when stock risk / all-clear claims may be spoken as authoritative. */
export function inventoryCountTrustAllowsStockClaims(trust: InventoryCountTrustSummary): boolean {
  return trust.state === "authoritative";
}

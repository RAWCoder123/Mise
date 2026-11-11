/**
 * Manager-verified purchase-line item-key aliases.
 *
 * MISE-004C nets by exact `normalized_item_key`. A credit memo that uses
 * different wording from the invoice forms its own group and is flagged
 * `unmatched_credit`. Fuzzy matching is forbidden. A manager may explicitly
 * declare that one exact key means another within the same restaurant and
 * supplier scope so factual nets can join without rewriting ledger text.
 */

import {
  type PurchaseLine,
  type PurchaseLineNetByItem
} from "./purchaseLines";

export const PURCHASE_LINE_ITEM_KEY_ALIAS_EVIDENCE_VERSION =
  "mise.purchase_line_item_key_alias.v1" as const;

export const PURCHASE_LINE_ITEM_KEY_MAX_CHARACTERS = 500;

export type PurchaseLineItemKeyAliasStatus = "verified" | "revoked";

export interface PurchaseLineItemKeyAlias {
  id: string;
  restaurantId: string;
  supplierId: string | null;
  aliasItemKey: string;
  canonicalItemKey: string;
  status: PurchaseLineItemKeyAliasStatus;
  evidenceVersion: typeof PURCHASE_LINE_ITEM_KEY_ALIAS_EVIDENCE_VERSION;
  aliasedBy: string | null;
  aliasedAt: string;
  revokedBy: string | null;
  revokedAt: string | null;
}

export interface PurchaseLineAliasCandidate {
  supplierId: string | null;
  aliasItemKey: string;
  sampleRawDescription: string;
  creditLineCount: number;
  latestTransactionDate: string | null;
  canonicalItemKey: string | null;
  aliasId: string | null;
  /** Exact purchase keys available as alias targets for this supplier scope. */
  canonicalTargets: string[];
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

export function requirePurchaseLineItemKey(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("A normalized purchase item key is required.");
  }
  const trimmed = value.trim();
  if (
    trimmed === "" ||
    trimmed.length > PURCHASE_LINE_ITEM_KEY_MAX_CHARACTERS ||
    CONTROL_CHARACTERS.test(trimmed)
  ) {
    throw new Error("Normalized purchase item key is invalid.");
  }
  return trimmed;
}

function supplierScopeKey(supplierId: string | null) {
  return supplierId ?? "";
}

function aliasMapKey(supplierId: string | null, itemKey: string) {
  return `${supplierScopeKey(supplierId)}\u0000${itemKey}`;
}

export function collectSupersededPurchaseLineIds(lines: readonly PurchaseLine[]) {
  return new Set(
    lines
      .map((line) => line.supersedesLineId)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
}

export function isPurchaseLineCurrent(
  line: PurchaseLine,
  supersededIds: ReadonlySet<string>
) {
  return !supersededIds.has(line.id);
}

/**
 * One-hop only. Chains and reverse maps are rejected at write time; reads never
 * walk further than a single verified alias.
 */
export function resolvePurchaseLineItemKey(
  normalizedItemKey: string | null,
  supplierId: string | null,
  aliases: readonly PurchaseLineItemKeyAlias[]
): string | null {
  if (normalizedItemKey === null) return null;
  const key = requirePurchaseLineItemKey(normalizedItemKey);
  const match = aliases.find(
    (alias) =>
      alias.status === "verified" &&
      alias.supplierId === supplierId &&
      alias.aliasItemKey === key
  );
  return match?.canonicalItemKey ?? key;
}

/**
 * Distinct current purchase keys for a supplier scope. Exact list only — never
 * fuzzy suggestions.
 */
export function listCanonicalPurchaseKeysForSupplier(
  lines: readonly PurchaseLine[],
  supplierId: string | null
): string[] {
  const superseded = collectSupersededPurchaseLineIds(lines);
  const keys = new Set<string>();
  for (const line of lines) {
    if (!isPurchaseLineCurrent(line, superseded)) continue;
    if (line.supplierId !== supplierId) continue;
    if (line.lineType !== "purchase") continue;
    if (line.normalizedItemKey === null) continue;
    keys.add(line.normalizedItemKey);
  }
  return [...keys].sort((left, right) => left.localeCompare(right));
}

/**
 * Builds manager review rows: unmatched credit keys plus verified aliases.
 * Canonical targets are exact purchase keys in the same supplier scope.
 */
export function buildPurchaseLineAliasCandidates(
  lines: readonly PurchaseLine[],
  aliases: readonly PurchaseLineItemKeyAlias[]
): PurchaseLineAliasCandidate[] {
  const superseded = collectSupersededPurchaseLineIds(lines);
  const verifiedByAliasKey = new Map<string, PurchaseLineItemKeyAlias>();
  for (const alias of aliases) {
    if (alias.status !== "verified") continue;
    verifiedByAliasKey.set(aliasMapKey(alias.supplierId, alias.aliasItemKey), alias);
  }

  const creditGroups = new Map<
    string,
    {
      supplierId: string | null;
      aliasItemKey: string;
      sampleRawDescription: string;
      creditLineCount: number;
      latestTransactionDate: string | null;
    }
  >();
  const purchaseKeysBySupplier = new Map<string, Set<string>>();

  for (const line of lines) {
    if (!isPurchaseLineCurrent(line, superseded)) continue;
    if (line.normalizedItemKey === null) continue;
    const supplierKey = supplierScopeKey(line.supplierId);
    if (line.lineType === "purchase") {
      const set = purchaseKeysBySupplier.get(supplierKey) ?? new Set<string>();
      set.add(line.normalizedItemKey);
      purchaseKeysBySupplier.set(supplierKey, set);
      continue;
    }
    if (line.lineType !== "credit") continue;
    const key = aliasMapKey(line.supplierId, line.normalizedItemKey);
    const existing = creditGroups.get(key);
    if (!existing) {
      creditGroups.set(key, {
        supplierId: line.supplierId,
        aliasItemKey: line.normalizedItemKey,
        sampleRawDescription: line.rawItemDescription,
        creditLineCount: 1,
        latestTransactionDate: line.transactionDate
      });
    } else {
      existing.creditLineCount += 1;
      if (line.transactionDate > (existing.latestTransactionDate ?? "")) {
        existing.latestTransactionDate = line.transactionDate;
        existing.sampleRawDescription = line.rawItemDescription;
      }
    }
  }

  const candidates = new Map<string, PurchaseLineAliasCandidate>();

  for (const group of creditGroups.values()) {
    const purchaseKeys = purchaseKeysBySupplier.get(supplierScopeKey(group.supplierId));
    const hasMatchingPurchase = purchaseKeys?.has(group.aliasItemKey) === true;
    const verified = verifiedByAliasKey.get(
      aliasMapKey(group.supplierId, group.aliasItemKey)
    );
    // Raw-key unmatched credits, or credits already covered by a verified alias.
    if (hasMatchingPurchase && !verified) continue;
    const targets = [...(purchaseKeys ?? [])]
      .filter((key) => key !== group.aliasItemKey)
      .sort((left, right) => left.localeCompare(right));
    candidates.set(aliasMapKey(group.supplierId, group.aliasItemKey), {
      supplierId: group.supplierId,
      aliasItemKey: group.aliasItemKey,
      sampleRawDescription: group.sampleRawDescription,
      creditLineCount: group.creditLineCount,
      latestTransactionDate: group.latestTransactionDate,
      canonicalItemKey: verified?.canonicalItemKey ?? null,
      aliasId: verified?.id ?? null,
      canonicalTargets: targets
    });
  }

  for (const alias of verifiedByAliasKey.values()) {
    const key = aliasMapKey(alias.supplierId, alias.aliasItemKey);
    if (candidates.has(key)) continue;
    const purchaseKeys = purchaseKeysBySupplier.get(supplierScopeKey(alias.supplierId));
    const targets = [...(purchaseKeys ?? [])]
      .filter((itemKey) => itemKey !== alias.aliasItemKey)
      .sort((left, right) => left.localeCompare(right));
    candidates.set(key, {
      supplierId: alias.supplierId,
      aliasItemKey: alias.aliasItemKey,
      sampleRawDescription: alias.aliasItemKey,
      creditLineCount: 0,
      latestTransactionDate: alias.aliasedAt.slice(0, 10),
      canonicalItemKey: alias.canonicalItemKey,
      aliasId: alias.id,
      canonicalTargets: targets
    });
  }

  return [...candidates.values()].sort((left, right) => {
    const leftLinked = left.aliasId ? 1 : 0;
    const rightLinked = right.aliasId ? 1 : 0;
    if (leftLinked !== rightLinked) return leftLinked - rightLinked;
    return (
      left.aliasItemKey.localeCompare(right.aliasItemKey) ||
      supplierScopeKey(left.supplierId).localeCompare(supplierScopeKey(right.supplierId))
    );
  });
}

/** Apply verified aliases while aggregating demo nets (parity with SQL). */
export function netPurchaseLinesWithAliases(
  lines: readonly PurchaseLine[],
  aliases: readonly PurchaseLineItemKeyAlias[]
): PurchaseLineNetByItem[] {
  const superseded = collectSupersededPurchaseLineIds(lines);
  const groups = new Map<string, PurchaseLineNetByItem>();
  for (const line of lines) {
    if (superseded.has(line.id)) continue;
    const resolvedKey = resolvePurchaseLineItemKey(
      line.normalizedItemKey,
      line.supplierId,
      aliases
    );
    const key = [
      line.supplierId ?? "",
      resolvedKey ?? "",
      line.unitOfMeasure ?? "",
      line.currency ?? ""
    ].join("\u0000");
    const group = groups.get(key) ?? {
      supplierId: line.supplierId,
      normalizedItemKey: resolvedKey,
      unitOfMeasure: line.unitOfMeasure,
      currency: line.currency,
      purchaseLineCount: 0,
      creditLineCount: 0,
      netQuantity: null,
      netExtendedPrice: null,
      unmatchedCredit: false,
      firstTransactionDate: line.transactionDate,
      lastTransactionDate: line.transactionDate
    };
    const sign = line.lineType === "credit" ? -1 : 1;
    if (line.lineType === "credit") group.creditLineCount += 1;
    else group.purchaseLineCount += 1;
    if (line.quantity !== null) {
      group.netQuantity = (group.netQuantity ?? 0) + sign * line.quantity;
    }
    if (line.extendedPrice !== null) {
      group.netExtendedPrice = (group.netExtendedPrice ?? 0) + sign * line.extendedPrice;
    }
    if (line.transactionDate < group.firstTransactionDate!) {
      group.firstTransactionDate = line.transactionDate;
    }
    if (line.transactionDate > group.lastTransactionDate!) {
      group.lastTransactionDate = line.transactionDate;
    }
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, unmatchedCredit: group.purchaseLineCount === 0 }))
    .sort((left, right) =>
      (left.normalizedItemKey ?? "").localeCompare(right.normalizedItemKey ?? "")
    );
}

export function normalizePurchaseLineItemKeyAliasRow(
  row: Record<string, unknown>
): PurchaseLineItemKeyAlias {
  const nullableText = (name: string) =>
    row[name] === null || row[name] === undefined ? null : String(row[name]);
  return {
    id: String(row.id),
    restaurantId: String(row.restaurant_id),
    supplierId: nullableText("supplier_id"),
    aliasItemKey: String(row.alias_item_key),
    canonicalItemKey: String(row.canonical_item_key),
    status: row.status as PurchaseLineItemKeyAliasStatus,
    evidenceVersion: PURCHASE_LINE_ITEM_KEY_ALIAS_EVIDENCE_VERSION,
    aliasedBy: nullableText("aliased_by"),
    aliasedAt: String(row.aliased_at),
    revokedBy: nullableText("revoked_by"),
    revokedAt: nullableText("revoked_at")
  };
}

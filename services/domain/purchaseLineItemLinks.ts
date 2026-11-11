/**
 * Manager-verified purchase-line → inventory-item identity links.
 *
 * Invoice lines carry priced `normalized_item_key` values but never invent
 * inventory identity. A manager must explicitly bind a key (optionally scoped
 * to a durable supplier) to a same-tenant inventory item. Suggestions are
 * exact normalized-key equality only — no fuzzy matching, stemming, or
 * cross-supplier inference.
 */

import type { InventoryItem } from "../../types/mise";
import {
  normalizePurchaseLineDescription,
  type PurchaseLine
} from "./purchaseLines";

export const PURCHASE_LINE_ITEM_LINK_EVIDENCE_VERSION =
  "mise.purchase_line_item_link.v1" as const;

export const PURCHASE_LINE_ITEM_KEY_MAX_CHARACTERS = 500;

export type PurchaseLineItemLinkStatus = "verified" | "revoked";

export interface PurchaseLineItemLink {
  id: string;
  restaurantId: string;
  supplierId: string | null;
  normalizedItemKey: string;
  inventoryItemId: string;
  status: PurchaseLineItemLinkStatus;
  evidenceVersion: typeof PURCHASE_LINE_ITEM_LINK_EVIDENCE_VERSION;
  linkedBy: string | null;
  linkedAt: string;
  revokedBy: string | null;
  revokedAt: string | null;
}

export interface PurchaseLineLinkCandidate {
  supplierId: string | null;
  normalizedItemKey: string;
  sampleRawDescription: string;
  lineCount: number;
  latestConfirmedUnitPrice: number | null;
  latestConfirmedCurrency: string | null;
  latestTransactionDate: string | null;
  linkedInventoryItemId: string | null;
  linkId: string | null;
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

export function inventoryItemPurchaseLineKey(item: InventoryItem): string | null {
  return normalizePurchaseLineDescription(item.item_name).normalizedItemKey;
}

/**
 * Exact normalized-key equality only. Ambiguous spellings stay distinct and
 * are never auto-bound.
 */
export function suggestInventoryItemsForPurchaseLineKey(
  normalizedItemKey: string,
  items: readonly InventoryItem[],
  options: { limit?: number } = {}
): InventoryItem[] {
  const key = requirePurchaseLineItemKey(normalizedItemKey);
  const limit =
    typeof options.limit === "number" && Number.isFinite(options.limit)
      ? Math.max(1, Math.floor(options.limit))
      : 20;
  const matches = items.filter((item) => inventoryItemPurchaseLineKey(item) === key);
  return matches
    .slice()
    .sort((left, right) => left.item_name.localeCompare(right.item_name) || left.id.localeCompare(right.id))
    .slice(0, limit);
}

export function isPurchaseLineCurrent(line: PurchaseLine, supersededIds: ReadonlySet<string>) {
  return !supersededIds.has(line.id);
}

export function collectSupersededPurchaseLineIds(lines: readonly PurchaseLine[]) {
  return new Set(
    lines
      .map((line) => line.supersedesLineId)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
}

function supplierScopeKey(supplierId: string | null) {
  return supplierId ?? "";
}

function candidateGroupKey(supplierId: string | null, normalizedItemKey: string) {
  return `${supplierScopeKey(supplierId)}\u0000${normalizedItemKey}`;
}

/**
 * Builds manager review candidates from current purchase lines and verified
 * links. One row per (supplier, normalized_item_key).
 */
export function buildPurchaseLineLinkCandidates(
  lines: readonly PurchaseLine[],
  links: readonly PurchaseLineItemLink[]
): PurchaseLineLinkCandidate[] {
  const superseded = collectSupersededPurchaseLineIds(lines);
  const verifiedByKey = new Map<string, PurchaseLineItemLink>();
  for (const link of links) {
    if (link.status !== "verified") continue;
    verifiedByKey.set(candidateGroupKey(link.supplierId, link.normalizedItemKey), link);
  }

  const groups = new Map<
    string,
    {
      supplierId: string | null;
      normalizedItemKey: string;
      sampleRawDescription: string;
      lineCount: number;
      latestTransactionDate: string | null;
    }
  >();
  const priced = new Map<
    string,
    { unitPrice: number; currency: string | null; date: string; lineIndex: number }
  >();

  for (const line of lines) {
    if (!isPurchaseLineCurrent(line, superseded)) continue;
    if (line.normalizedItemKey === null) continue;
    if (line.lineType !== "purchase") continue;
    const key = candidateGroupKey(line.supplierId, line.normalizedItemKey);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        supplierId: line.supplierId,
        normalizedItemKey: line.normalizedItemKey,
        sampleRawDescription: line.rawItemDescription,
        lineCount: 1,
        latestTransactionDate: line.transactionDate
      });
    } else {
      existing.lineCount += 1;
      if (line.transactionDate > (existing.latestTransactionDate ?? "")) {
        existing.latestTransactionDate = line.transactionDate;
        existing.sampleRawDescription = line.rawItemDescription;
      }
    }

    if (line.parseConfidence === "confirmed" && line.unitPrice !== null) {
      const prior = priced.get(key);
      if (
        !prior ||
        line.transactionDate > prior.date ||
        (line.transactionDate === prior.date && line.lineIndex > prior.lineIndex)
      ) {
        priced.set(key, {
          unitPrice: line.unitPrice,
          currency: line.currency,
          date: line.transactionDate,
          lineIndex: line.lineIndex
        });
      }
    }
  }

  return [...groups.values()]
    .map((group) => {
      const key = candidateGroupKey(group.supplierId, group.normalizedItemKey);
      const link = verifiedByKey.get(key) ?? null;
      const price = priced.get(key) ?? null;
      return {
        supplierId: group.supplierId,
        normalizedItemKey: group.normalizedItemKey,
        sampleRawDescription: group.sampleRawDescription,
        lineCount: group.lineCount,
        latestConfirmedUnitPrice: price?.unitPrice ?? null,
        latestConfirmedCurrency: price?.currency ?? null,
        latestTransactionDate: group.latestTransactionDate,
        linkedInventoryItemId: link?.inventoryItemId ?? null,
        linkId: link?.id ?? null
      };
    })
    .sort((left, right) => {
      const leftLinked = left.linkedInventoryItemId ? 1 : 0;
      const rightLinked = right.linkedInventoryItemId ? 1 : 0;
      if (leftLinked !== rightLinked) return leftLinked - rightLinked;
      return (
        left.normalizedItemKey.localeCompare(right.normalizedItemKey) ||
        supplierScopeKey(left.supplierId).localeCompare(supplierScopeKey(right.supplierId))
      );
    });
}

export function selectLatestConfirmedUnitPriceForLink(
  lines: readonly PurchaseLine[],
  link: Pick<PurchaseLineItemLink, "supplierId" | "normalizedItemKey">
): { unitPrice: number; currency: string | null; sourceDocumentReference: string; lineId: string } | null {
  const superseded = collectSupersededPurchaseLineIds(lines);
  let best: {
    unitPrice: number;
    currency: string | null;
    sourceDocumentReference: string;
    lineId: string;
    date: string;
    lineIndex: number;
  } | null = null;
  for (const line of lines) {
    if (!isPurchaseLineCurrent(line, superseded)) continue;
    if (line.lineType !== "purchase") continue;
    if (line.normalizedItemKey !== link.normalizedItemKey) continue;
    if ((line.supplierId ?? null) !== (link.supplierId ?? null)) continue;
    if (line.parseConfidence !== "confirmed" || line.unitPrice === null) continue;
    if (
      !best ||
      line.transactionDate > best.date ||
      (line.transactionDate === best.date && line.lineIndex > best.lineIndex)
    ) {
      best = {
        unitPrice: line.unitPrice,
        currency: line.currency,
        sourceDocumentReference: line.sourceDocumentReference,
        lineId: line.id,
        date: line.transactionDate,
        lineIndex: line.lineIndex
      };
    }
  }
  if (!best) return null;
  return {
    unitPrice: best.unitPrice,
    currency: best.currency,
    sourceDocumentReference: best.sourceDocumentReference,
    lineId: best.lineId
  };
}

export function normalizePurchaseLineItemLinkRow(
  row: Record<string, unknown>
): PurchaseLineItemLink {
  const nullableText = (name: string) => (row[name] === null || row[name] === undefined ? null : String(row[name]));
  return {
    id: String(row.id),
    restaurantId: String(row.restaurant_id),
    supplierId: nullableText("supplier_id"),
    normalizedItemKey: String(row.normalized_item_key),
    inventoryItemId: String(row.inventory_item_id),
    status: row.status as PurchaseLineItemLinkStatus,
    evidenceVersion: PURCHASE_LINE_ITEM_LINK_EVIDENCE_VERSION,
    linkedBy: nullableText("linked_by"),
    linkedAt: String(row.linked_at),
    revokedBy: nullableText("revoked_by"),
    revokedAt: nullableText("revoked_at")
  };
}

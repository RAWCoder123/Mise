import type { SupplierRecipient } from "../../types/mise";

export interface SupplierRecipientDirectoryEntry {
  restaurantId: string;
  supplierName: string;
  email: string | null;
  recipientId: string | null;
  updatedAt: string | null;
  source: "current" | "saved" | "current_and_saved";
}

export interface SupplierCatalogReference {
  restaurantId: string;
  supplierName: string;
}

/**
 * Builds the screen-facing supplier directory without inventing recipient rows.
 * Current inventory suppliers remain visible even when no recipient has been saved,
 * while saved recipients remain recoverable after a supplier leaves inventory.
 */
export function buildSupplierRecipientDirectory(
  restaurantId: string,
  currentSupplierNames: readonly string[],
  recipients: readonly SupplierRecipient[]
): SupplierRecipientDirectoryEntry[] {
  const entries = new Map<string, SupplierRecipientDirectoryEntry>();

  for (const rawName of currentSupplierNames) {
    const supplierName = normalizeDisplayName(rawName);
    if (!supplierName) continue;
    const key = supplierKey(supplierName);
    if (entries.has(key)) continue;
    entries.set(key, {
      restaurantId,
      supplierName,
      email: null,
      recipientId: null,
      updatedAt: null,
      source: "current"
    });
  }

  for (const recipient of recipients) {
    if (recipient.restaurant_id !== restaurantId) continue;
    const savedName = normalizeDisplayName(recipient.supplier_name);
    if (!savedName) continue;
    const key = supplierKey(savedName);
    const existing = entries.get(key);
    if (existing?.recipientId && !isNewer(recipient.updated_at, existing.updatedAt)) {
      continue;
    }
    entries.set(key, {
      restaurantId,
      supplierName: existing?.source === "current" || existing?.source === "current_and_saved"
        ? existing.supplierName
        : savedName,
      email: recipient.email,
      recipientId: recipient.id,
      updatedAt: recipient.updated_at,
      source: existing?.source === "current" || existing?.source === "current_and_saved"
        ? "current_and_saved"
        : "saved"
    });
  }

  return [...entries.values()].sort((left, right) => {
    const keyDelta = compareStrings(supplierKey(left.supplierName), supplierKey(right.supplierName));
    return keyDelta || compareStrings(left.supplierName, right.supplierName);
  });
}

export function supplierRecipientDirectoryKey(supplierName: string) {
  return supplierKey(normalizeDisplayName(supplierName));
}

/**
 * Resolves a requested supplier to an existing tenant-scoped catalog identity.
 * References are ordered by authority, so callers can preserve the same source
 * preference as the hosted upsert (inventory first and saved recipients last).
 */
export function findSupplierRecipientCatalogName(
  restaurantId: string,
  requestedSupplierName: string,
  references: readonly SupplierCatalogReference[]
) {
  const requestedKey = supplierRecipientDirectoryKey(requestedSupplierName);
  if (!requestedKey) return null;

  for (const reference of references) {
    if (reference.restaurantId !== restaurantId) continue;
    const canonicalName = normalizeDisplayName(reference.supplierName);
    if (canonicalName && supplierKey(canonicalName) === requestedKey) return canonicalName;
  }

  return null;
}

function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function supplierKey(value: string) {
  return value.toLocaleLowerCase("en-US");
}

function isNewer(candidate: string, current: string | null) {
  if (!current) return true;
  const candidateTime = Date.parse(candidate);
  const currentTime = Date.parse(current);
  if (!Number.isFinite(candidateTime)) return false;
  if (!Number.isFinite(currentTime)) return true;
  return candidateTime > currentTime;
}

function compareStrings(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

import type { Supplier, SupplierRecipient } from "../../types/mise";

export interface SupplierRecipientDirectoryEntry {
  restaurantId: string;
  supplierId: string;
  supplierName: string;
  email: string | null;
  recipientId: string | null;
  updatedAt: string | null;
  source: "current" | "saved" | "current_and_saved";
}

/**
 * Builds the screen-facing supplier directory without inventing recipient rows.
 * Every tenant supplier remains visible even when no recipient has been saved.
 * Supplier IDs, not display names, bind saved recipients to their directory row.
 */
export function buildSupplierRecipientDirectory(
  restaurantId: string,
  suppliers: readonly Supplier[],
  recipients: readonly SupplierRecipient[]
): SupplierRecipientDirectoryEntry[] {
  const entries = new Map<string, SupplierRecipientDirectoryEntry>();

  for (const supplier of suppliers) {
    if (supplier.restaurant_id !== restaurantId) continue;
    const supplierName = normalizeDisplayName(supplier.display_name);
    if (!supplier.id || !supplierName) {
      throw new Error("Supplier directory received an invalid durable identity.");
    }
    if (entries.has(supplier.id)) {
      throw new Error("Supplier directory received a duplicate durable identity.");
    }
    entries.set(supplier.id, {
      restaurantId,
      supplierId: supplier.id,
      supplierName,
      email: null,
      recipientId: null,
      updatedAt: null,
      source: "current"
    });
  }

  for (const recipient of recipients) {
    if (recipient.restaurant_id !== restaurantId) continue;
    const existing = entries.get(recipient.supplier_id);
    if (!existing) {
      throw new Error("Supplier recipient is detached from its durable supplier identity.");
    }
    if (existing?.recipientId && !isNewer(recipient.updated_at, existing.updatedAt)) {
      continue;
    }
    entries.set(recipient.supplier_id, {
      restaurantId,
      supplierId: recipient.supplier_id,
      supplierName: existing.supplierName,
      email: recipient.email,
      recipientId: recipient.id,
      updatedAt: recipient.updated_at,
      source: "current_and_saved"
    });
  }

  return [...entries.values()].sort((left, right) => {
    const keyDelta = compareStrings(supplierKey(left.supplierName), supplierKey(right.supplierName));
    return keyDelta || compareStrings(left.supplierName, right.supplierName);
  });
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

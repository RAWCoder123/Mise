import type { Supplier } from "../../types/mise";

const SUPPLIER_NAME_MAX_CHARACTERS = 160;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Demo uses the same bounded display-name contract as hosted supplier
 * identity. Names are accepted only while creating or repairing a supplier;
 * authority lookups use the persisted supplier UUID after that point.
 */
export function normalizeDemoSupplierDisplayName(value: string) {
  const displayName = value.trim().replace(/\s+/g, " ");
  if (
    CONTROL_CHARACTER_PATTERN.test(value) ||
    displayName.length < 1 ||
    displayName.length > SUPPLIER_NAME_MAX_CHARACTERS ||
    CONTROL_CHARACTER_PATTERN.test(displayName)
  ) {
    throw new Error("Enter a valid supplier name.");
  }
  return displayName;
}

export function demoSupplierNormalizedName(value: string) {
  return normalizeDemoSupplierDisplayName(value).toLocaleLowerCase("en-US");
}

/**
 * One-time local-state migration helper. It deterministically gives legacy
 * name-only rows a UUID scoped by restaurant plus exact normalized name. Once
 * persisted, a rename keeps the UUID and this helper is never consulted for
 * authority.
 */
export function demoSupplierIdForLegacyName(restaurantId: string, displayName: string) {
  const source = `${restaurantId}\u0000${demoSupplierNormalizedName(displayName)}`;
  const words = [
    hash32(source, 0x811c9dc5),
    hash32(source, 0x9e3779b9),
    hash32(source, 0x85ebca6b),
    hash32(source, 0xc2b2ae35)
  ];
  const hex = words.map((word) => word.toString(16).padStart(8, "0")).join("").split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  const compact = hex.join("");
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export function createDemoSupplierId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return demoSupplierIdForLegacyName(
    "00000000-0000-4000-8000-000000000000",
    `demo-${Date.now()}-${Math.random()}`
  );
}

export function isDemoSupplierId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function createDemoSupplier(
  restaurantId: string,
  displayName: string,
  now: string,
  id = createDemoSupplierId()
): Supplier {
  const canonicalDisplayName = normalizeDemoSupplierDisplayName(displayName);
  return {
    id,
    restaurant_id: restaurantId,
    display_name: canonicalDisplayName,
    normalized_name: demoSupplierNormalizedName(canonicalDisplayName),
    created_at: now,
    updated_at: now
  };
}

export function findDemoSupplierById(
  suppliers: readonly Supplier[],
  restaurantId: string,
  supplierId: string | null | undefined
) {
  if (!supplierId) return null;
  return suppliers.find(
    (supplier) => supplier.restaurant_id === restaurantId && supplier.id === supplierId
  ) ?? null;
}

/** Migration/setup discovery only. Never use this helper for purchasing/send authority. */
export function findDemoSupplierByLegacyName(
  suppliers: readonly Supplier[],
  restaurantId: string,
  displayName: string
) {
  let normalizedName: string;
  try {
    normalizedName = demoSupplierNormalizedName(displayName);
  } catch {
    return null;
  }
  return suppliers.find(
    (supplier) =>
      supplier.restaurant_id === restaurantId && supplier.normalized_name === normalizedName
  ) ?? null;
}

/**
 * Creates the unique tenant-scoped supplier catalog used by seed data and the
 * v11 -> v12 repair. Source order is authoritative display precedence.
 */
export function buildDemoSupplierCatalog(
  references: readonly { restaurantId: string; displayName: string; createdAt?: string }[],
  fallbackNow: string
) {
  const suppliers: Supplier[] = [];
  const seen = new Set<string>();
  const seenIds = new Set<string>();
  for (const reference of references) {
    let normalizedName: string;
    try {
      normalizedName = demoSupplierNormalizedName(reference.displayName);
    } catch {
      continue;
    }
    const key = `${reference.restaurantId}\u0000${normalizedName}`;
    if (seen.has(key)) continue;
    const id = demoSupplierIdForLegacyName(reference.restaurantId, reference.displayName);
    if (seenIds.has(id)) continue;
    seen.add(key);
    seenIds.add(id);
    suppliers.push(
      createDemoSupplier(
        reference.restaurantId,
        reference.displayName,
        reference.createdAt ?? fallbackNow,
        id
      )
    );
  }
  return suppliers;
}

function hash32(value: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= hash >>> 13;
  }
  return hash >>> 0;
}

export type IngredientSubstitutionStatus = "draft" | "verified" | "rejected" | "expired";
export type IngredientSubstitutionCanonicalUnit = "g" | "ml" | "each";

export interface IngredientSubstitution {
  id: string;
  restaurantId: string;
  sourceInventoryItemId: string;
  substituteInventoryItemId: string;
  sourceQuantity: number;
  substituteQuantity: number;
  canonicalUnit: IngredientSubstitutionCanonicalUnit;
  verificationStatus: IngredientSubstitutionStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IngredientSubstitutionInput {
  restaurantId: string;
  sourceInventoryItemId: string;
  substituteInventoryItemId: string;
  sourceQuantity: number;
  substituteQuantity: number;
  canonicalUnit: IngredientSubstitutionCanonicalUnit;
  substitutionId?: string | null;
}

export interface IngredientSubstitutionListItem extends IngredientSubstitution {
  sourceItemName: string;
  substituteItemName: string;
}

const MAX_QUANTITY = 1_000_000;

export const ingredientSubstitutionLimits = {
  maxQuantity: MAX_QUANTITY
} as const;

export function isIngredientSubstitutionCanonicalUnit(
  value: unknown
): value is IngredientSubstitutionCanonicalUnit {
  return value === "g" || value === "ml" || value === "each";
}

export function isIngredientSubstitutionStatus(
  value: unknown
): value is IngredientSubstitutionStatus {
  return (
    value === "draft" ||
    value === "verified" ||
    value === "rejected" ||
    value === "expired"
  );
}

export function requireSubstitutionQuantity(value: unknown): number {
  const quantity = typeof value === "number" ? value : Number(value);
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > MAX_QUANTITY
  ) {
    throw new Error(
      `Substitution quantity must be greater than zero and no more than ${MAX_QUANTITY.toLocaleString()}.`
    );
  }
  return quantity;
}

export function requireSubstitutionCanonicalUnit(
  value: unknown
): IngredientSubstitutionCanonicalUnit {
  if (!isIngredientSubstitutionCanonicalUnit(value)) {
    throw new Error("Canonical unit must be g, ml, or each.");
  }
  return value;
}

/**
 * Convert a source-item canonical quantity into the substitute-item quantity
 * using a verified ratio. Returns null when the ratio is inactive or invalid.
 */
export function convertSourceQuantityToSubstitute(
  sourceCanonicalQuantity: number,
  substitution: Pick<
    IngredientSubstitution,
    "sourceQuantity" | "substituteQuantity" | "verificationStatus" | "effectiveFrom" | "effectiveTo"
  >,
  at: string | Date = new Date()
): number | null {
  if (!isActiveVerifiedSubstitution(substitution, at)) return null;
  if (
    !Number.isFinite(sourceCanonicalQuantity) ||
    sourceCanonicalQuantity < 0 ||
    substitution.sourceQuantity <= 0
  ) {
    return null;
  }
  return (sourceCanonicalQuantity / substitution.sourceQuantity) * substitution.substituteQuantity;
}

export function isActiveVerifiedSubstitution(
  substitution: Pick<
    IngredientSubstitution,
    "verificationStatus" | "effectiveFrom" | "effectiveTo"
  >,
  at: string | Date = new Date()
): boolean {
  if (substitution.verificationStatus !== "verified") return false;
  const instant = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (!Number.isFinite(instant)) return false;
  const from = Date.parse(substitution.effectiveFrom);
  if (!Number.isFinite(from) || from > instant) return false;
  if (substitution.effectiveTo == null) return true;
  const to = Date.parse(substitution.effectiveTo);
  return Number.isFinite(to) && to > instant;
}

export function listActiveVerifiedSubstitutesForItem(
  substitutions: readonly IngredientSubstitution[],
  inventoryItemId: string,
  at: string | Date = new Date()
): IngredientSubstitution[] {
  return substitutions.filter(
    (entry) =>
      entry.sourceInventoryItemId === inventoryItemId &&
      isActiveVerifiedSubstitution(entry, at)
  );
}

export function normalizeIngredientSubstitution(row: Record<string, unknown>): IngredientSubstitution {
  const canonicalUnit = row.canonical_unit ?? row.canonicalUnit;
  const verificationStatus = row.verification_status ?? row.verificationStatus;
  if (!isIngredientSubstitutionCanonicalUnit(canonicalUnit)) {
    throw new Error("Ingredient substitution canonical unit is invalid.");
  }
  if (!isIngredientSubstitutionStatus(verificationStatus)) {
    throw new Error("Ingredient substitution verification status is invalid.");
  }
  const id = String(row.id ?? "");
  const restaurantId = String(row.restaurant_id ?? row.restaurantId ?? "");
  const sourceInventoryItemId = String(
    row.source_inventory_item_id ?? row.sourceInventoryItemId ?? ""
  );
  const substituteInventoryItemId = String(
    row.substitute_inventory_item_id ?? row.substituteInventoryItemId ?? ""
  );
  if (!id || !restaurantId || !sourceInventoryItemId || !substituteInventoryItemId) {
    throw new Error("Ingredient substitution identity is incomplete.");
  }
  return {
    id,
    restaurantId,
    sourceInventoryItemId,
    substituteInventoryItemId,
    sourceQuantity: Number(row.source_quantity ?? row.sourceQuantity),
    substituteQuantity: Number(row.substitute_quantity ?? row.substituteQuantity),
    canonicalUnit,
    verificationStatus,
    effectiveFrom: String(row.effective_from ?? row.effectiveFrom ?? ""),
    effectiveTo:
      row.effective_to == null && row.effectiveTo == null
        ? null
        : String(row.effective_to ?? row.effectiveTo),
    verifiedAt:
      row.verified_at == null && row.verifiedAt == null
        ? null
        : String(row.verified_at ?? row.verifiedAt),
    verifiedBy:
      row.verified_by == null && row.verifiedBy == null
        ? null
        : String(row.verified_by ?? row.verifiedBy),
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? "")
  };
}

export function presentIngredientSubstitutionRatio(
  substitution: Pick<IngredientSubstitution, "sourceQuantity" | "substituteQuantity" | "canonicalUnit">
): string {
  const source = trimQuantity(substitution.sourceQuantity);
  const substitute = trimQuantity(substitution.substituteQuantity);
  return `${source} ${substitution.canonicalUnit} → ${substitute} ${substitution.canonicalUnit}`;
}

function trimQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const fixed = value.toFixed(4).replace(/\.?0+$/, "");
  return fixed || "0";
}

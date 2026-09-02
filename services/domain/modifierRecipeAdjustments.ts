/**
 * POS modifier → inventory delta helpers for `modifier_recipe_adjustments`.
 * Verified adjustments add or remove canonical quantity when a sale line
 * includes the matching external modifier id. Never invents deltas.
 */

export type ModifierRecipeAdjustmentStatus = "draft" | "verified" | "rejected" | "expired";
export type ModifierRecipeAdjustmentCanonicalUnit = "g" | "ml" | "each";

export interface ModifierRecipeAdjustment {
  id: string;
  restaurantId: string;
  recipeVersionId: string;
  externalModifierId: string;
  modifierName: string;
  inventoryItemId: string;
  quantityDelta: number;
  canonicalUnit: ModifierRecipeAdjustmentCanonicalUnit;
  verificationStatus: ModifierRecipeAdjustmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ModifierRecipeAdjustmentInput {
  restaurantId: string;
  menuItemId: string;
  externalModifierId: string;
  modifierName: string;
  inventoryItemId: string;
  quantityDelta: number;
  canonicalUnit: ModifierRecipeAdjustmentCanonicalUnit;
  adjustmentId?: string | null;
}

export interface ModifierRecipeAdjustmentListItem extends ModifierRecipeAdjustment {
  menuItemId: string | null;
  menuItemName: string;
  inventoryItemName: string;
}

const MAX_ABS_DELTA = 1_000_000;
const MAX_MODIFIER_ID_LENGTH = 128;
const MAX_MODIFIER_NAME_LENGTH = 160;

export const modifierRecipeAdjustmentLimits = {
  maxAbsDelta: MAX_ABS_DELTA,
  maxModifierIdLength: MAX_MODIFIER_ID_LENGTH,
  maxModifierNameLength: MAX_MODIFIER_NAME_LENGTH
} as const;

export function isModifierRecipeAdjustmentCanonicalUnit(
  value: unknown
): value is ModifierRecipeAdjustmentCanonicalUnit {
  return value === "g" || value === "ml" || value === "each";
}

export function isModifierRecipeAdjustmentStatus(
  value: unknown
): value is ModifierRecipeAdjustmentStatus {
  return (
    value === "draft" ||
    value === "verified" ||
    value === "rejected" ||
    value === "expired"
  );
}

export function requireModifierQuantityDelta(value: unknown): number {
  const quantity = typeof value === "number" ? value : Number(value);
  if (
    !Number.isFinite(quantity) ||
    quantity === 0 ||
    Math.abs(quantity) > MAX_ABS_DELTA
  ) {
    throw new Error(
      `Modifier quantity delta must be non-zero and no more than ${MAX_ABS_DELTA.toLocaleString()} in absolute value.`
    );
  }
  return quantity;
}

export function requireModifierCanonicalUnit(
  value: unknown
): ModifierRecipeAdjustmentCanonicalUnit {
  if (!isModifierRecipeAdjustmentCanonicalUnit(value)) {
    throw new Error("Canonical unit must be g, ml, or each.");
  }
  return value;
}

export function requireExternalModifierId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("External modifier id is required.");
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_MODIFIER_ID_LENGTH) {
    throw new Error(
      `External modifier id must be 1–${MAX_MODIFIER_ID_LENGTH} characters.`
    );
  }
  return trimmed;
}

export function requireModifierName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Modifier name is required.");
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_MODIFIER_NAME_LENGTH) {
    throw new Error(
      `Modifier name must be 1–${MAX_MODIFIER_NAME_LENGTH} characters.`
    );
  }
  return trimmed;
}

export function isVerifiedModifierAdjustment(
  adjustment: Pick<ModifierRecipeAdjustment, "verificationStatus">
): boolean {
  return adjustment.verificationStatus === "verified";
}

/**
 * Apply verified modifier deltas onto a base canonical quantity map for one
 * sold unit. Returns null when any selected modifier has no verified mapping
 * for the recipe version (fail closed rather than invent depletion).
 */
export function applyVerifiedModifierDeltas(input: {
  baseCanonicalByItemId: ReadonlyMap<string, number>;
  recipeVersionId: string;
  selectedExternalModifierIds: readonly string[];
  adjustments: readonly ModifierRecipeAdjustment[];
}): Map<string, number> | null {
  const next = new Map(input.baseCanonicalByItemId);
  const selected = [
    ...new Set(
      input.selectedExternalModifierIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    )
  ];
  if (selected.length === 0) return next;

  for (const modifierId of selected) {
    const matches = input.adjustments.filter(
      (entry) =>
        entry.recipeVersionId === input.recipeVersionId &&
        entry.externalModifierId === modifierId &&
        isVerifiedModifierAdjustment(entry)
    );
    if (matches.length === 0) return null;
    for (const match of matches) {
      const current = next.get(match.inventoryItemId) ?? 0;
      next.set(match.inventoryItemId, current + match.quantityDelta);
    }
  }
  return next;
}

export function listVerifiedModifierAdjustmentsForVersion(
  adjustments: readonly ModifierRecipeAdjustment[],
  recipeVersionId: string
): ModifierRecipeAdjustment[] {
  return adjustments.filter(
    (entry) =>
      entry.recipeVersionId === recipeVersionId && isVerifiedModifierAdjustment(entry)
  );
}

export function normalizeModifierRecipeAdjustment(
  row: Record<string, unknown>
): ModifierRecipeAdjustment {
  const canonicalUnit = row.canonical_unit ?? row.canonicalUnit;
  const verificationStatus = row.verification_status ?? row.verificationStatus;
  if (!isModifierRecipeAdjustmentCanonicalUnit(canonicalUnit)) {
    throw new Error("Modifier recipe adjustment canonical unit is invalid.");
  }
  if (!isModifierRecipeAdjustmentStatus(verificationStatus)) {
    throw new Error("Modifier recipe adjustment verification status is invalid.");
  }
  const id = String(row.id ?? "");
  const restaurantId = String(row.restaurant_id ?? row.restaurantId ?? "");
  const recipeVersionId = String(row.recipe_version_id ?? row.recipeVersionId ?? "");
  const externalModifierId = String(
    row.external_modifier_id ?? row.externalModifierId ?? ""
  ).trim();
  const modifierName = String(row.modifier_name ?? row.modifierName ?? "").trim();
  const inventoryItemId = String(
    row.inventory_item_id ?? row.inventoryItemId ?? ""
  );
  const quantityDelta = Number(row.quantity_delta ?? row.quantityDelta);
  if (
    !id ||
    !restaurantId ||
    !recipeVersionId ||
    !externalModifierId ||
    !modifierName ||
    !inventoryItemId ||
    !Number.isFinite(quantityDelta) ||
    quantityDelta === 0
  ) {
    throw new Error("Modifier recipe adjustment identity is incomplete.");
  }
  return {
    id,
    restaurantId,
    recipeVersionId,
    externalModifierId,
    modifierName,
    inventoryItemId,
    quantityDelta,
    canonicalUnit,
    verificationStatus,
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? "")
  };
}

export function presentModifierQuantityDelta(
  adjustment: Pick<ModifierRecipeAdjustment, "quantityDelta" | "canonicalUnit">
): string {
  const signed = trimQuantity(adjustment.quantityDelta);
  const prefix = adjustment.quantityDelta > 0 ? "+" : "";
  return `${prefix}${signed} ${adjustment.canonicalUnit}`;
}

function trimQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const fixed = value.toFixed(4).replace(/\.?0+$/, "");
  return fixed || "0";
}

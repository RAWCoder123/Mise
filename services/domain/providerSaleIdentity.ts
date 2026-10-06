export interface VerifiedProviderSaleMapping {
  restaurantId: string;
  sourcePos: string;
  providerLocationId: string;
  externalCatalogItemId: string;
  externalVariationId: string;
  menuItemId: string;
}

interface ProviderSaleIdentity {
  restaurant_id: string;
  item_name: string;
  source_pos?: string | null;
  provider_location_id?: string | null;
  provider_catalog_item_id?: string | null;
  provider_variation_id?: string | null;
}

interface RecipeIdentity {
  restaurant_id: string;
  menu_item_name: string;
  menu_item_id?: string | null;
}

const providerSources = new Set(["square", "toast", "clover", "lightspeed"]);

export function saleRequiresVerifiedProviderIdentity(sale: Pick<ProviderSaleIdentity, "source_pos" | "provider_location_id" | "provider_catalog_item_id" | "provider_variation_id">) {
  return providerSources.has(normalize(sale.source_pos))
    || Boolean(sale.provider_location_id)
    || Boolean(sale.provider_catalog_item_id)
    || Boolean(sale.provider_variation_id);
}

export function resolveVerifiedProviderMenuItemId(
  sale: ProviderSaleIdentity,
  mappings: readonly VerifiedProviderSaleMapping[]
) {
  if (!saleRequiresVerifiedProviderIdentity(sale)) return null;
  if (!sale.provider_variation_id) return null;
  if (!sale.provider_location_id) return null;
  const sourcePos = normalize(sale.source_pos);
  const providerLocationId = normalize(sale.provider_location_id);
  const matches = mappings.filter((mapping) =>
    mapping.restaurantId === sale.restaurant_id
    && normalize(mapping.sourcePos) === sourcePos
    && normalize(mapping.providerLocationId) === providerLocationId
    && mapping.externalVariationId === sale.provider_variation_id
    && (!sale.provider_catalog_item_id || mapping.externalCatalogItemId === sale.provider_catalog_item_id)
  );
  if (matches.length !== 1) return null;
  return matches[0]!.menuItemId;
}

export function saleMatchesRecipe(
  sale: ProviderSaleIdentity,
  recipe: RecipeIdentity,
  providerMappings: readonly VerifiedProviderSaleMapping[]
) {
  if (sale.restaurant_id !== recipe.restaurant_id) return false;
  if (saleRequiresVerifiedProviderIdentity(sale)) {
    const menuItemId = resolveVerifiedProviderMenuItemId(sale, providerMappings);
    return Boolean(menuItemId && recipe.menu_item_id && menuItemId === recipe.menu_item_id);
  }
  return normalize(sale.item_name) === normalize(recipe.menu_item_name);
}

export function recipeDemandKey(recipe: Pick<RecipeIdentity, "menu_item_id" | "menu_item_name">) {
  return recipe.menu_item_id ? `menu:${recipe.menu_item_id}` : normalize(recipe.menu_item_name);
}

export function saleDemandKey(sale: ProviderSaleIdentity, providerMappings: readonly VerifiedProviderSaleMapping[]) {
  if (saleRequiresVerifiedProviderIdentity(sale)) {
    const menuItemId = resolveVerifiedProviderMenuItemId(sale, providerMappings);
    return menuItemId ? `menu:${menuItemId}` : null;
  }
  return normalize(sale.item_name);
}

/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005JC). Only ASCII A-Z is folded; Unicode-aware `toLowerCase`
 * would map Kelvin sign `K` → `k` and could invent a provider source
 * token or item-name match the hosted COLLATE C path would not.
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * Collapse only ASCII whitespace so client provider-sale identity stays
 * aligned with server helpers that trim/fold under COLLATE "C".
 */
function normalize(value: string | null | undefined) {
  if (value == null) return "";
  return asciiCLower(value)
    .replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "")
    .replace(/[ \t\n\r\f\v]+/g, " ");
}

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

export function saleRequiresVerifiedProviderIdentity(sale: Pick<ProviderSaleIdentity, "source_pos" | "provider_catalog_item_id" | "provider_variation_id">) {
  return providerSources.has(normalize(sale.source_pos))
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
  return mappings.find((mapping) =>
    mapping.restaurantId === sale.restaurant_id
    && normalize(mapping.sourcePos) === sourcePos
    && normalize(mapping.providerLocationId) === providerLocationId
    && mapping.externalVariationId === sale.provider_variation_id
    && (!sale.provider_catalog_item_id || mapping.externalCatalogItemId === sale.provider_catalog_item_id)
  )?.menuItemId ?? null;
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

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
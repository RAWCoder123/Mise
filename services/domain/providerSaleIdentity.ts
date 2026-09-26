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

/**
 * MISE-005I. Matches `pos_sales_provider_*_check` /
 * `<column> collate "C" !~ '[[:cntrl:]]'`: ASCII C0 controls and DEL only.
 * Unicode `\p{Cc}` / `\s` would reject a different set than the server CHECK.
 */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

function printableProviderIdentityToken(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > 128 || CONTROL_CHARACTERS.test(trimmed)) return null;
  return trimmed;
}

export function saleRequiresVerifiedProviderIdentity(
  sale: Pick<
    ProviderSaleIdentity,
    "source_pos" | "provider_location_id" | "provider_catalog_item_id" | "provider_variation_id"
  >
) {
  return (
    providerSources.has(normalize(sale.source_pos))
    || Boolean(sale.provider_location_id)
    || Boolean(sale.provider_catalog_item_id)
    || Boolean(sale.provider_variation_id)
  );
}

export function resolveVerifiedProviderMenuItemId(
  sale: ProviderSaleIdentity,
  mappings: readonly VerifiedProviderSaleMapping[]
) {
  if (!saleRequiresVerifiedProviderIdentity(sale)) return null;
  const providerVariationId = printableProviderIdentityToken(sale.provider_variation_id);
  const providerLocationId = printableProviderIdentityToken(sale.provider_location_id);
  const providerCatalogItemId = printableProviderIdentityToken(sale.provider_catalog_item_id);
  // Control-bearing or empty identity tokens fail closed: never match a recipe.
  if (!providerVariationId || !providerLocationId) return null;
  if (
    sale.provider_catalog_item_id != null
    && sale.provider_catalog_item_id.trim() !== ""
    && !providerCatalogItemId
  ) {
    return null;
  }
  const sourcePos = normalize(sale.source_pos);
  const normalizedLocationId = normalize(providerLocationId);
  const matches = mappings.filter(
    (mapping) =>
      mapping.restaurantId === sale.restaurant_id
      && normalize(mapping.sourcePos) === sourcePos
      && normalize(mapping.providerLocationId) === normalizedLocationId
      && mapping.externalVariationId === providerVariationId
      && (!providerCatalogItemId || mapping.externalCatalogItemId === providerCatalogItemId)
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

export function saleDemandKey(
  sale: ProviderSaleIdentity,
  providerMappings: readonly VerifiedProviderSaleMapping[]
) {
  if (saleRequiresVerifiedProviderIdentity(sale)) {
    const menuItemId = resolveVerifiedProviderMenuItemId(sale, providerMappings);
    return menuItemId ? `menu:${menuItemId}` : null;
  }
  return normalize(sale.item_name);
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

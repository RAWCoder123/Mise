import { inventoryItemNameKey } from "./inventoryItemCreate";

export const RECIPE_INVENTORY_PICKER_LIMIT = 8;

export type InventoryItemSearchFields = {
  id: string;
  item_name: string;
  category?: string | null;
  supplier_name?: string | null;
  unit?: string | null;
};

export type InventoryItemSearchMatch<T extends InventoryItemSearchFields> = {
  item: T;
  score: number;
  exact: boolean;
};

function tokenize(query: string): string[] {
  return inventoryItemNameKey(query)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreInventoryItemMatch(item: InventoryItemSearchFields, query: string): number | null {
  const normalizedQuery = inventoryItemNameKey(query);
  if (!normalizedQuery) return 0;

  const nameKey = inventoryItemNameKey(item.item_name);
  if (!nameKey) return null;

  if (nameKey === normalizedQuery) return 1000;

  let score = 0;
  if (nameKey.startsWith(normalizedQuery)) score = 800;
  else if (nameKey.includes(normalizedQuery)) score = 600;

  const tokens = tokenize(query);
  if (tokens.length > 1) {
    const allTokensPresent = tokens.every((token) => nameKey.includes(token));
    if (allTokensPresent) score = Math.max(score, 700);
    else return score > 0 ? score : null;
  }

  const categoryKey = inventoryItemNameKey(item.category ?? "");
  const supplierKey = inventoryItemNameKey(item.supplier_name ?? "");
  if (categoryKey.includes(normalizedQuery)) score = Math.max(score, 350);
  if (supplierKey.includes(normalizedQuery)) score = Math.max(score, 300);

  return score > 0 ? score : null;
}

/**
 * Rank inventory items for recipe-mapping pickers.
 * Empty query returns a stable alphabetical preview (not a search hit list).
 */
export function searchInventoryItemsForPicker<T extends InventoryItemSearchFields>(
  items: readonly T[],
  query: string,
  options?: { limit?: number }
): InventoryItemSearchMatch<T>[] {
  const limit = Math.max(1, Math.min(options?.limit ?? RECIPE_INVENTORY_PICKER_LIMIT, 50));
  const normalizedQuery = inventoryItemNameKey(query);

  if (!normalizedQuery) {
    return [...items]
      .sort((left, right) =>
        inventoryItemNameKey(left.item_name).localeCompare(inventoryItemNameKey(right.item_name))
      )
      .slice(0, limit)
      .map((item) => ({ item, score: 0, exact: false }));
  }

  return items
    .map((item) => {
      const score = scoreInventoryItemMatch(item, query);
      if (score == null) return null;
      return {
        item,
        score,
        exact: score >= 1000
      } satisfies InventoryItemSearchMatch<T>;
    })
    .filter((match): match is InventoryItemSearchMatch<T> => match != null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return inventoryItemNameKey(left.item.item_name).localeCompare(
        inventoryItemNameKey(right.item.item_name)
      );
    })
    .slice(0, limit);
}

/**
 * Resolve the inventory item a manager is linking.
 * Accepts an explicit selection id, an exact name, or a single unambiguous search hit.
 */
export function resolveInventoryItemForRecipeLink<T extends InventoryItemSearchFields>(
  items: readonly T[],
  query: string,
  selectedItemId?: string | null
): T | null {
  if (selectedItemId) {
    const selected = items.find((item) => item.id === selectedItemId) ?? null;
    if (selected) return selected;
  }

  const normalizedQuery = inventoryItemNameKey(query);
  if (!normalizedQuery) return null;

  const exact = items.find((item) => inventoryItemNameKey(item.item_name) === normalizedQuery);
  if (exact) return exact;

  const matches = searchInventoryItemsForPicker(items, query, { limit: 2 });
  const onlyMatch = matches.length === 1 ? matches[0] : undefined;
  if (onlyMatch && onlyMatch.score >= 600) {
    return onlyMatch.item;
  }

  return null;
}

export function filterMenuItemsForPicker(menuItems: readonly string[], query: string, limit = 5): string[] {
  const normalizedQuery = inventoryItemNameKey(query);
  const unique = [...new Set(menuItems.map((item) => item.trim()).filter(Boolean))];
  if (!normalizedQuery) {
    return unique.slice(0, limit);
  }

  return unique
    .map((item) => {
      const key = inventoryItemNameKey(item);
      let score = 0;
      if (key === normalizedQuery) score = 1000;
      else if (key.startsWith(normalizedQuery)) score = 800;
      else if (key.includes(normalizedQuery)) score = 600;
      else return null;
      return { item, score };
    })
    .filter((match): match is { item: string; score: number } => match != null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return inventoryItemNameKey(left.item).localeCompare(inventoryItemNameKey(right.item));
    })
    .slice(0, limit)
    .map((match) => match.item);
}

function scoreExtraSearchText(extraSearchText: string | null | undefined, query: string): number | null {
  const normalizedQuery = inventoryItemNameKey(query);
  if (!normalizedQuery) return null;
  const extraKey = inventoryItemNameKey(extraSearchText ?? "");
  if (!extraKey) return null;
  if (extraKey === normalizedQuery) return 550;
  if (extraKey.startsWith(normalizedQuery)) return 450;
  if (extraKey.includes(normalizedQuery)) return 400;
  return null;
}

/**
 * Filter inventory rows for list, waste find, and count-sheet search.
 * Empty query preserves the caller's order. Non-empty query ranks matches with no picker limit.
 */
export function filterInventoryItemsBySearch<T extends InventoryItemSearchFields>(
  items: readonly T[],
  query: string,
  options?: { getExtraSearchText?: (item: T) => string | null | undefined }
): T[] {
  const normalizedQuery = inventoryItemNameKey(query);
  if (!normalizedQuery) {
    return [...items];
  }

  return items
    .map((item) => {
      const baseScore = scoreInventoryItemMatch(item, query);
      const extraScore = scoreExtraSearchText(options?.getExtraSearchText?.(item), query);
      if (baseScore == null && extraScore == null) return null;
      return {
        item,
        score: Math.max(baseScore ?? 0, extraScore ?? 0)
      };
    })
    .filter((match): match is { item: T; score: number } => match != null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return inventoryItemNameKey(left.item.item_name).localeCompare(
        inventoryItemNameKey(right.item.item_name)
      );
    })
    .map((match) => match.item);
}

/** Show location chip search once a restaurant has enough stations to hunt through. */
export const STORAGE_LOCATION_CHIP_SEARCH_THRESHOLD = 5;

export type StorageLocationSearchFields = {
  id: string;
  name: string;
};

function scoreStorageLocationMatch(name: string, query: string): number | null {
  const normalizedQuery = inventoryItemNameKey(query);
  if (!normalizedQuery) return 0;

  const nameKey = inventoryItemNameKey(name);
  if (!nameKey) return null;

  if (nameKey === normalizedQuery) return 1000;
  if (nameKey.startsWith(normalizedQuery)) return 800;
  if (nameKey.includes(normalizedQuery)) return 600;

  const tokens = tokenize(query);
  if (tokens.length > 1) {
    const allTokensPresent = tokens.every((token) => nameKey.includes(token));
    if (allTokensPresent) return 700;
  }

  return null;
}

/**
 * Rank storage locations for transfer / receive put-away chip pickers.
 * Empty query preserves caller order. Selected location stays visible even when it
 * does not match the query so operators cannot lose their current choice.
 */
export function filterStorageLocationsBySearch<T extends StorageLocationSearchFields>(
  locations: readonly T[],
  query: string,
  options?: { selectedId?: string | null }
): T[] {
  const normalizedQuery = inventoryItemNameKey(query);
  const selectedId = String(options?.selectedId ?? "").trim() || null;
  const selected = selectedId
    ? locations.find((location) => location.id === selectedId) ?? null
    : null;

  if (!normalizedQuery) {
    return [...locations];
  }

  const ranked = locations
    .map((location) => {
      const score = scoreStorageLocationMatch(location.name, query);
      if (score == null) return null;
      return { location, score };
    })
    .filter((match): match is { location: T; score: number } => match != null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return inventoryItemNameKey(left.location.name).localeCompare(
        inventoryItemNameKey(right.location.name)
      );
    })
    .map((match) => match.location);

  if (!selected) return ranked;
  if (ranked.some((location) => location.id === selected.id)) {
    return ranked;
  }
  return [selected, ...ranked];
}

/** Show recommendation find once the review queue is long enough to hunt through. */
export const PURCHASE_RECOMMENDATION_SEARCH_THRESHOLD = 5;

/** Show mapped-dish find once recipe baselines are long enough to hunt through. */
export const RECIPE_BASELINE_SEARCH_THRESHOLD = 5;

export type RecipeBaselineSearchFields = {
  menu_item_name: string;
  linkedInventoryItems?: readonly string[] | null;
  ingredients?: readonly { itemName: string }[] | null;
};

function recipeBaselineExtraSearchText(item: RecipeBaselineSearchFields): string {
  const linked = item.linkedInventoryItems ?? [];
  const ingredientNames = (item.ingredients ?? []).map((ingredient) => ingredient.itemName);
  return [...linked, ...ingredientNames].filter(Boolean).join(" ");
}

/**
 * Rank mapped recipe baselines for Settings → Recipes dish find.
 * Empty query preserves caller order. Non-empty query matches dish name or linked ingredients.
 */
export function filterRecipeBaselineItemsBySearch<T extends RecipeBaselineSearchFields>(
  items: readonly T[],
  query: string
): T[] {
  const adapted = items.map((item, index) => ({
    id: `recipe-baseline-${index}`,
    item_name: item.menu_item_name,
    source: item
  }));

  return filterInventoryItemsBySearch(adapted, query, {
    getExtraSearchText: (row) => recipeBaselineExtraSearchText(row.source)
  }).map((row) => row.source);
}

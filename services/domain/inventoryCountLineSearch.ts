/**
 * Ranked find for inventory count sheet lines.
 * Never invents count rows; only filters the caller-supplied session lines.
 * Draft counts for filtered-out lines must remain in the caller's draft state.
 */

export const INVENTORY_COUNT_LINE_SEARCH_THRESHOLD = 8;

export type InventoryCountLineSearchFields = {
  id: string;
  inventory_item_id: string;
  item_name: string;
  unit?: string | null;
};

function normalizeSearchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenize(query: string): string[] {
  return normalizeSearchKey(query)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreCountLineMatch(line: InventoryCountLineSearchFields, query: string): number | null {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return 0;

  const nameKey = normalizeSearchKey(line.item_name);
  if (!nameKey) return null;

  if (nameKey === normalizedQuery) return 1000;

  let score = 0;
  if (nameKey.startsWith(normalizedQuery)) score = 800;
  else if (nameKey.includes(normalizedQuery)) score = 600;

  const tokens = tokenize(query);
  if (tokens.length > 1) {
    const allTokensPresent = tokens.every((token) => nameKey.includes(token));
    if (allTokensPresent) score = Math.max(score, 700);
  }

  const unitKey = normalizeSearchKey(line.unit ?? "");
  if (unitKey && unitKey.includes(normalizedQuery)) score = Math.max(score, 250);

  return score > 0 ? score : null;
}

/**
 * Rank count-session lines for the operator sheet.
 * Empty query preserves caller order (full list). Non-empty query ranks name
 * and unit matches without inventing rows or dropping draft identity.
 */
export function filterInventoryCountLinesBySearch<T extends InventoryCountLineSearchFields>(
  lines: readonly T[],
  query: string
): T[] {
  const unique: T[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const inventoryItemId = line.inventory_item_id?.trim();
    if (!inventoryItemId || seen.has(inventoryItemId)) continue;
    seen.add(inventoryItemId);
    unique.push(line);
  }

  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return unique;

  return unique
    .map((line, index) => {
      const score = scoreCountLineMatch(line, query);
      if (score == null) return null;
      return { line, score, index };
    })
    .filter((match): match is { line: T; score: number; index: number } => match != null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .map((match) => match.line);
}

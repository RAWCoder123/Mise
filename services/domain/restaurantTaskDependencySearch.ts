/**
 * Ranked find for Create Task prerequisite (dependency) picker.
 * Never invents tasks; only filters the caller-supplied open shared-task list.
 */

export const RESTAURANT_TASK_DEPENDENCY_SEARCH_THRESHOLD = 8;

export type RestaurantTaskDependencySearchFields = {
  id: string;
  title: string;
  status?: string | null;
  operationalCategory?: string | null;
  relatedSupplierName?: string | null;
  detail?: string | null;
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

function scoreDependencyMatch(
  task: RestaurantTaskDependencySearchFields,
  query: string
): number | null {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return 0;

  const titleKey = normalizeSearchKey(task.title);
  if (!titleKey) return null;

  if (titleKey === normalizedQuery) return 1000;

  let score = 0;
  if (titleKey.startsWith(normalizedQuery)) score = 800;
  else if (titleKey.includes(normalizedQuery)) score = 600;

  const tokens = tokenize(query);
  if (tokens.length > 1) {
    const allTokensPresent = tokens.every((token) => titleKey.includes(token));
    if (allTokensPresent) score = Math.max(score, 700);
  }

  const statusKey = normalizeSearchKey(task.status ?? "");
  if (statusKey && statusKey.includes(normalizedQuery)) score = Math.max(score, 400);

  const categoryKey = normalizeSearchKey(task.operationalCategory ?? "");
  if (categoryKey && categoryKey.includes(normalizedQuery)) score = Math.max(score, 350);

  const supplierKey = normalizeSearchKey(task.relatedSupplierName ?? "");
  if (supplierKey && supplierKey.includes(normalizedQuery)) score = Math.max(score, 300);

  const detailKey = normalizeSearchKey(task.detail ?? "");
  if (detailKey && detailKey.includes(normalizedQuery)) score = Math.max(score, 250);

  return score > 0 ? score : null;
}

/**
 * Rank open shared restaurant tasks for the Create Task prerequisite picker.
 * Empty query preserves caller order (full deduped list). Non-empty query ranks
 * title/status/category/supplier/detail matches without inventing rows.
 */
export function filterRestaurantTaskDependenciesBySearch<
  T extends RestaurantTaskDependencySearchFields
>(tasks: readonly T[], query: string): T[] {
  const unique: T[] = [];
  const seen = new Set<string>();
  for (const task of tasks) {
    const id = task.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(task);
  }

  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return unique;

  return unique
    .map((task, index) => {
      const score = scoreDependencyMatch(task, query);
      if (score == null) return null;
      return { task, score, index };
    })
    .filter((match): match is { task: T; score: number; index: number } => match != null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .map((match) => match.task);
}

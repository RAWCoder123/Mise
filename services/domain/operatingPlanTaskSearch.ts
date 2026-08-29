/**
 * Ranked find for Today focused operating-plan bucket tasks.
 * Never invents plan items; only filters the caller-supplied focused bucket.
 * Empty query preserves caller order (bucket caps / focus still apply upstream).
 */

export const OPERATING_PLAN_TASK_SEARCH_THRESHOLD = 5;

export type OperatingPlanTaskSearchFields = {
  id: string;
  title: string;
  detail?: string | null;
  why?: string | null;
  effect?: string | null;
  kind?: string | null;
  priority?: string | null;
  serviceWindow?: string | null;
  status?: string | null;
  completionResult?: string | null;
  relatedRefs?: ReadonlyArray<{ type?: string | null; id?: string | null }>;
  reprioritization?: { code?: string | null; reason?: string | null } | null;
};

function normalizeSearchKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function tokenize(query: string): string[] {
  return normalizeSearchKey(query)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreTextMatch(haystack: string, query: string): number | null {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return 0;

  const key = normalizeSearchKey(haystack);
  if (!key) return null;

  if (key === normalizedQuery) return 1000;

  let score = 0;
  if (key.startsWith(normalizedQuery)) score = 800;
  else if (key.includes(normalizedQuery)) score = 600;

  const tokens = tokenize(query);
  if (tokens.length > 1) {
    const allTokensPresent = tokens.every((token) => key.includes(token));
    if (allTokensPresent) score = Math.max(score, 700);
  }

  return score > 0 ? score : null;
}

function scoreOperatingPlanTaskMatch(
  item: OperatingPlanTaskSearchFields,
  query: string
): number | null {
  const titleScore = scoreTextMatch(item.title, query);
  const detailScore = scoreTextMatch(item.detail ?? "", query);
  const whyScore = scoreTextMatch(item.why ?? "", query);
  const effectScore = scoreTextMatch(item.effect ?? "", query);
  const kindScore = scoreTextMatch(item.kind ?? "", query);
  const priorityScore = scoreTextMatch(item.priority ?? "", query);
  const windowScore = scoreTextMatch(item.serviceWindow ?? "", query);
  const statusScore = scoreTextMatch(item.status ?? "", query);
  const completionScore = scoreTextMatch(item.completionResult ?? "", query);
  const reprioCodeScore = scoreTextMatch(item.reprioritization?.code ?? "", query);
  const reprioReasonScore = scoreTextMatch(item.reprioritization?.reason ?? "", query);

  let relatedScore: number | null = null;
  for (const related of item.relatedRefs ?? []) {
    const typeScore = scoreTextMatch(related.type ?? "", query);
    const idScore = scoreTextMatch(related.id ?? "", query);
    const best =
      typeScore == null && idScore == null ? null : Math.max(typeScore ?? 0, idScore ?? 0);
    if (best != null) {
      relatedScore = relatedScore == null ? best : Math.max(relatedScore, best);
    }
  }

  if (
    titleScore == null &&
    detailScore == null &&
    whyScore == null &&
    effectScore == null &&
    kindScore == null &&
    priorityScore == null &&
    windowScore == null &&
    statusScore == null &&
    completionScore == null &&
    relatedScore == null &&
    reprioCodeScore == null &&
    reprioReasonScore == null
  ) {
    return null;
  }

  // Prefer title, then detail/why, then related identity, then secondary metadata.
  return Math.max(
    titleScore != null ? titleScore + 50 : 0,
    detailScore != null ? detailScore + 30 : 0,
    whyScore != null ? whyScore + 25 : 0,
    effectScore != null ? effectScore + 15 : 0,
    relatedScore != null ? relatedScore + 20 : 0,
    completionScore != null ? Math.min(completionScore + 5, 650) : 0,
    reprioReasonScore != null ? Math.min(reprioReasonScore + 5, 550) : 0,
    kindScore != null ? Math.min(kindScore, 400) : 0,
    priorityScore != null ? Math.min(priorityScore, 350) : 0,
    windowScore != null ? Math.min(windowScore, 300) : 0,
    statusScore != null ? Math.min(statusScore, 250) : 0,
    reprioCodeScore != null ? Math.min(reprioCodeScore, 250) : 0
  );
}

/**
 * Rank Today focused-bucket operating-plan items for text find.
 * Empty query preserves caller order. Non-empty query matches title, detail,
 * why, effect, related refs, and bounded metadata without inventing rows or
 * changing upstream focus / bucket membership.
 */
export function filterOperatingPlanTasksBySearch<T extends OperatingPlanTaskSearchFields>(
  items: readonly T[],
  query: string
): T[] {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return [...items];

  return items
    .map((item, index) => {
      const score = scoreOperatingPlanTaskMatch(item, query);
      if (score == null) return null;
      return { item, score, index };
    })
    .filter((match): match is { item: T; score: number; index: number } => match != null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .map((match) => match.item);
}

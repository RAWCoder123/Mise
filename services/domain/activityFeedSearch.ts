/**
 * Ranked find for More → Activity history.
 * Never invents events; only filters the caller-supplied loaded feed.
 * Empty query preserves caller order (category/date filters still apply upstream).
 */

export const ACTIVITY_FEED_SEARCH_THRESHOLD = 5;

export type ActivityFeedSearchFields = {
  id: string;
  title: string;
  summary: string;
  category?: string | null;
  status?: string | null;
  activityType?: string | null;
  triggerType?: string | null;
  triggerReference?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  actionId?: string | null;
  evidenceReferences?: ReadonlyArray<{ type?: string | null; summary?: string | null }>;
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

function scoreActivityMatch(event: ActivityFeedSearchFields, query: string): number | null {
  const titleScore = scoreTextMatch(event.title, query);
  const summaryScore = scoreTextMatch(event.summary, query);
  const categoryScore = scoreTextMatch(event.category ?? "", query);
  const statusScore = scoreTextMatch(event.status ?? "", query);
  const activityTypeScore = scoreTextMatch(event.activityType ?? "", query);
  const triggerTypeScore = scoreTextMatch(event.triggerType ?? "", query);
  const triggerRefScore = scoreTextMatch(event.triggerReference ?? "", query);
  const relatedTypeScore = scoreTextMatch(event.relatedEntityType ?? "", query);
  const relatedIdScore = scoreTextMatch(event.relatedEntityId ?? "", query);
  const actionScore = scoreTextMatch(event.actionId ?? "", query);

  let evidenceScore: number | null = null;
  for (const evidence of event.evidenceReferences ?? []) {
    const typeScore = scoreTextMatch(evidence.type ?? "", query);
    const summaryEvidenceScore = scoreTextMatch(evidence.summary ?? "", query);
    const best =
      typeScore == null && summaryEvidenceScore == null
        ? null
        : Math.max(typeScore ?? 0, summaryEvidenceScore ?? 0);
    if (best != null) {
      evidenceScore = evidenceScore == null ? best : Math.max(evidenceScore, best);
    }
  }

  if (
    titleScore == null &&
    summaryScore == null &&
    categoryScore == null &&
    statusScore == null &&
    activityTypeScore == null &&
    triggerTypeScore == null &&
    triggerRefScore == null &&
    relatedTypeScore == null &&
    relatedIdScore == null &&
    actionScore == null &&
    evidenceScore == null
  ) {
    return null;
  }

  // Prefer title, then summary, then related identity, then secondary metadata.
  return Math.max(
    titleScore != null ? titleScore + 50 : 0,
    summaryScore != null ? summaryScore + 30 : 0,
    relatedIdScore != null ? relatedIdScore + 20 : 0,
    relatedTypeScore != null ? relatedTypeScore + 10 : 0,
    triggerRefScore != null ? triggerRefScore + 10 : 0,
    evidenceScore != null ? Math.min(evidenceScore + 5, 650) : 0,
    categoryScore != null ? Math.min(categoryScore, 400) : 0,
    statusScore != null ? Math.min(statusScore, 350) : 0,
    activityTypeScore != null ? Math.min(activityTypeScore, 350) : 0,
    triggerTypeScore != null ? Math.min(triggerTypeScore, 300) : 0,
    actionScore != null ? Math.min(actionScore, 250) : 0
  );
}

/**
 * Rank Activity feed events for title/summary/related text find.
 * Empty query preserves caller order. Non-empty query matches title, summary,
 * related entity, trigger reference, evidence, and bounded metadata without
 * inventing rows or changing upstream category/date filters.
 */
export function filterActivityFeedBySearch<T extends ActivityFeedSearchFields>(
  events: readonly T[],
  query: string
): T[] {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return [...events];

  return events
    .map((event, index) => {
      const score = scoreActivityMatch(event, query);
      if (score == null) return null;
      return { event, score, index };
    })
    .filter((match): match is { event: T; score: number; index: number } => match != null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .map((match) => match.event);
}

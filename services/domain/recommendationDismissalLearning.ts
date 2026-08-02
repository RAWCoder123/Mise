/**
 * Explainable dismissal-reason clustering from purchase recommendation decisions.
 * When managers chronically dismiss an item for the same reason category, Mise
 * surfaces a bounded insight/Today task and explains the pattern on new
 * recommendations. Quantity is never auto-suppressed from dismissals alone —
 * critical stockouts must remain visible.
 */

export const DISMISSAL_LEARNING_WINDOW_DAYS = 180;
export const DISMISSAL_LEARNING_MAX_SAMPLES = 8;
export const DISMISSAL_LEARNING_MIN_SAMPLES = 3;
/** Dominant known category must cover at least this share of kept samples. */
export const DISMISSAL_DOMINANT_SHARE = 0.6;

export type DismissalReasonCategory =
  | "too_much_stock"
  | "already_ordered"
  | "wrong_timing"
  | "wrong_item";

export type DismissalSample = {
  inventoryItemId: string;
  category: DismissalReasonCategory | "other";
  createdAt: string;
};

export type DismissalFeedback = {
  inventoryItemId: string;
  sampleCount: number;
  categoryCount: number;
  category: DismissalReasonCategory;
  isChronic: boolean;
};

export type RecommendationDismissalSnippet = {
  inventory_item_id: string;
  status: string;
  created_at: string;
  dismiss_reason?: string | null;
};

const CATEGORY_PATTERNS: ReadonlyArray<{
  category: DismissalReasonCategory;
  patterns: readonly RegExp[];
}> = [
  {
    category: "already_ordered",
    patterns: [
      /\balready\s+ordered\b/,
      /\bon\s+order\b/,
      /\bordered\s+elsewhere\b/,
      /\bordered\s+from\b/,
      /\bcoming\s+in\b/,
      /\bdelivery\s+coming\b/,
      /\bwalk[-\s]?in\b/,
      /\bpo\s+already\b/,
      /\bopen\s+po\b/,
      /\bopen\s+purchase\s+order\b/
    ]
  },
  {
    category: "wrong_timing",
    patterns: [
      /\btoo\s+early\b/,
      /\bnot\s+yet\b/,
      /\bwrong\s+(day|time|timing)\b/,
      /\bwait\b/,
      /\blater\b/,
      /\bnext\s+week\b/,
      /\btomorrow\b/,
      /\bpremature\b/,
      /\bafter\s+service\b/
    ]
  },
  {
    category: "wrong_item",
    patterns: [
      /\bwrong\s+item\b/,
      /\bwrong\s+product\b/,
      /\bincorrect\s+item\b/,
      /\bduplicate\b/,
      /\bnot\s+this\b/,
      /\bmapped\s+wrong\b/,
      /\bwrong\s+sku\b/
    ]
  },
  {
    category: "too_much_stock",
    patterns: [
      /\btoo\s+much\b/,
      /\benough\b/,
      /\boverstock(?:ed)?\b/,
      /\balready\s+have\b/,
      /\bplenty\b/,
      /\bexcess\b/,
      /\bdon'?t\s+need\b/,
      /\bdo\s+not\s+need\b/,
      /\bnot\s+needed\b/,
      /\bfull\b/,
      /\bsurplus\b/,
      /\bpar\s+too\s+high\b/,
      /\bstocked\b/
    ]
  }
];

export function classifyDismissReason(reason: string | null | undefined): DismissalReasonCategory | "other" | null {
  if (typeof reason !== "string") return null;
  const normalized = reason.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return null;
  for (const entry of CATEGORY_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) {
      return entry.category;
    }
  }
  return "other";
}

export function extractDismissalSamplesFromRecommendations(
  history: readonly RecommendationDismissalSnippet[]
): DismissalSample[] {
  const samples: DismissalSample[] = [];
  for (const recommendation of history) {
    if (recommendation.status !== "dismissed") continue;
    const category = classifyDismissReason(recommendation.dismiss_reason);
    if (!category) continue;
    const createdAt =
      typeof recommendation.created_at === "string" && recommendation.created_at.trim()
        ? recommendation.created_at
        : "";
    if (!createdAt) continue;
    const inventoryItemId =
      typeof recommendation.inventory_item_id === "string"
        ? recommendation.inventory_item_id.trim()
        : "";
    if (!inventoryItemId) continue;
    samples.push({
      inventoryItemId,
      category,
      createdAt
    });
  }
  return samples;
}

export function buildDismissalFeedbackByItem(
  samples: readonly DismissalSample[],
  nowMs = Date.now()
): Map<string, DismissalFeedback> {
  const byItem = new Map<string, DismissalSample[]>();
  const oldest = nowMs - DISMISSAL_LEARNING_WINDOW_DAYS * 86_400_000;
  const newest = nowMs + 86_400_000;

  for (const sample of samples.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const timestamp = Date.parse(sample.createdAt);
    if (!Number.isFinite(timestamp) || timestamp < oldest || timestamp > newest) continue;
    const list = byItem.get(sample.inventoryItemId) ?? [];
    if (list.length >= DISMISSAL_LEARNING_MAX_SAMPLES) continue;
    list.push(sample);
    byItem.set(sample.inventoryItemId, list);
  }

  const result = new Map<string, DismissalFeedback>();
  for (const [inventoryItemId, itemSamples] of byItem) {
    if (itemSamples.length < DISMISSAL_LEARNING_MIN_SAMPLES) continue;
    const counts = new Map<DismissalReasonCategory, number>();
    for (const sample of itemSamples) {
      if (sample.category === "other") continue;
      counts.set(sample.category, (counts.get(sample.category) ?? 0) + 1);
    }
    let dominant: DismissalReasonCategory | null = null;
    let dominantCount = 0;
    for (const [category, count] of counts) {
      if (count > dominantCount) {
        dominant = category;
        dominantCount = count;
      }
    }
    if (!dominant || dominantCount < DISMISSAL_LEARNING_MIN_SAMPLES) continue;
    if (dominantCount / itemSamples.length < DISMISSAL_DOMINANT_SHARE - 1e-9) continue;
    result.set(inventoryItemId, {
      inventoryItemId,
      sampleCount: itemSamples.length,
      categoryCount: dominantCount,
      category: dominant,
      isChronic: true
    });
  }
  return result;
}

export function dismissalFeedbackReasonFragment(feedback: DismissalFeedback): string {
  switch (feedback.category) {
    case "too_much_stock":
      return `Managers often dismissed this as too much stock (${feedback.categoryCount} of ${feedback.sampleCount} recent dismissals); verify count and par before approving.`;
    case "already_ordered":
      return `Managers often dismissed this as already ordered elsewhere (${feedback.categoryCount} of ${feedback.sampleCount} recent dismissals); confirm open purchase orders before approving.`;
    case "wrong_timing":
      return `Managers often dismissed this as too early (${feedback.categoryCount} of ${feedback.sampleCount} recent dismissals); verify timing, count, and par before approving.`;
    case "wrong_item":
      return `Managers often dismissed this as the wrong item (${feedback.categoryCount} of ${feedback.sampleCount} recent dismissals); confirm the inventory mapping before approving.`;
  }
}

export function buildChronicDismissalInsightInput(feedback: DismissalFeedback): {
  insightType: "ordering";
  severity: "warning";
  category: DismissalReasonCategory;
  sampleCount: number;
  categoryCount: number;
} | null {
  if (!feedback.isChronic) return null;
  return {
    insightType: "ordering",
    severity: "warning",
    category: feedback.category,
    sampleCount: feedback.sampleCount,
    categoryCount: feedback.categoryCount
  };
}

export function dismissalCategoryLabel(category: DismissalReasonCategory): string {
  switch (category) {
    case "too_much_stock":
      return "too much stock";
    case "already_ordered":
      return "already ordered";
    case "wrong_timing":
      return "wrong timing";
    case "wrong_item":
      return "wrong item";
  }
}

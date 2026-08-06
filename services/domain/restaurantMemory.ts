import type { LearningMemorySignal, LearningMemorySummary } from "../../types/mise";
import { createId } from "./miseDomain";
import type { Outcome } from "./miseActions";

export type RestaurantMemoryType =
  | "demand_pattern"
  | "prep_habit"
  | "waste_pattern"
  | "supplier_reliability"
  | "staff_timing"
  | "safety_stock_preference"
  | "service_window"
  | "approval_preference"
  | "seasonal_effect"
  | "weather_effect"
  | "local_event_effect"
  | "menu_dependency"
  | "operational_exception"
  | "rejected_recommendation"
  | "edited_quantity"
  | "recurring_bottleneck"
  | "action_outcome";

export type RestaurantMemoryStatus =
  | "active"
  | "confirmed"
  | "corrected"
  | "dismissed"
  | "forgotten"
  | "disabled";

export interface RestaurantMemoryEvidence {
  type: string;
  id: string;
  summary: string;
  observedAt: string;
}

export interface RestaurantMemory {
  id: string;
  restaurantId: string;
  memoryType: RestaurantMemoryType;
  statement: string;
  evidence: RestaurantMemoryEvidence[];
  confidence: number;
  firstObservedAt: string;
  lastUpdatedAt: string;
  scope: string;
  source: string;
  status: RestaurantMemoryStatus;
  affectsRecommendations: boolean;
  affectsAutomation: boolean;
  correctionNote: string | null;
}

export interface RestaurantMemoryRuleDraft {
  memoryId: string;
  restaurantId: string;
  title: string;
  statement: string;
  enabled: false;
  sourceMemoryStatus: RestaurantMemoryStatus;
}

function requireRestaurantId(restaurantId: string) {
  const normalized = restaurantId.trim();
  if (!normalized) throw new Error("Restaurant memory requires a restaurant id.");
  return normalized;
}

function boundedStatement(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) throw new Error("Restaurant memory requires a non-empty statement.");
  return normalized.slice(0, 320);
}

export function confidenceFromEvidence(
  evidence: readonly RestaurantMemoryEvidence[],
  options: { now?: string; base?: number } = {}
): number {
  if (evidence.length === 0) return 0;
  const now = Date.parse(options.now ?? new Date().toISOString());
  const recencyBoosts: number[] = evidence.map((entry) => {
    const observed = Date.parse(entry.observedAt);
    if (!Number.isFinite(observed)) return 0;
    const ageDays = Math.max(0, (now - observed) / (24 * 60 * 60 * 1000));
    if (ageDays <= 7) return 0.12;
    if (ageDays <= 30) return 0.08;
    if (ageDays <= 90) return 0.04;
    return 0.01;
  });
  const sampleScore = Math.min(0.55, evidence.length * 0.12);
  const recencyScore = Math.min(
    0.35,
    recencyBoosts.reduce((sum, value) => sum + value, 0 as number)
  );
  const base = options.base ?? 0.15;
  return Math.max(0, Math.min(0.99, Number((base + sampleScore + recencyScore).toFixed(2))));
}

export function createMemory(input: {
  restaurantId: string;
  memoryType: RestaurantMemoryType;
  statement: string;
  evidence: readonly RestaurantMemoryEvidence[];
  scope?: string;
  source?: string;
  affectsRecommendations?: boolean;
  affectsAutomation?: boolean;
  now?: string;
}): RestaurantMemory {
  const restaurantId = requireRestaurantId(input.restaurantId);
  if (input.evidence.length === 0) {
    throw new Error("Restaurant memory cannot be created without evidence.");
  }
  const now = input.now ? new Date(input.now).toISOString() : new Date().toISOString();
  const evidence = input.evidence.map((entry) => ({
    ...entry,
    observedAt: new Date(entry.observedAt).toISOString()
  }));

  return {
    id: createId("memory"),
    restaurantId,
    memoryType: input.memoryType,
    statement: boundedStatement(input.statement),
    evidence,
    confidence: confidenceFromEvidence(evidence, { now }),
    firstObservedAt: now,
    lastUpdatedAt: now,
    scope: (input.scope ?? "restaurant").trim() || "restaurant",
    source: (input.source ?? "mise_learning").trim() || "mise_learning",
    status: "active",
    affectsRecommendations: input.affectsRecommendations ?? true,
    affectsAutomation: input.affectsAutomation ?? false,
    correctionNote: null
  };
}

export function createMemoryFromLearningSignals(
  restaurantId: string,
  summary: LearningMemorySummary,
  options: { now?: string } = {}
): RestaurantMemory[] {
  const now = options.now ?? new Date().toISOString();
  return summary.signals
    .filter((signal) => signal.label.trim() && signal.detail.trim())
    .map((signal) =>
      createMemory({
        restaurantId,
        memoryType: classifyLearningSignal(signal),
        statement: `${signal.label}: ${signal.detail}`,
        evidence: [
          {
            type: "learning_signal",
            id: `${signal.label}:${signal.value}`,
            summary: `${signal.value} — ${signal.detail}`,
            observedAt: now
          }
        ],
        source: "learning_memory_summary",
        affectsRecommendations: true,
        affectsAutomation: false,
        now
      })
    );
}

function classifyLearningSignal(signal: LearningMemorySignal): RestaurantMemoryType {
  const haystack = `${signal.label} ${signal.detail}`.toLowerCase();
  if (haystack.includes("supplier")) return "supplier_reliability";
  if (haystack.includes("waste")) return "waste_pattern";
  if (haystack.includes("approv") || haystack.includes("prefer")) return "approval_preference";
  if (haystack.includes("safety") || haystack.includes("par") || haystack.includes("buffer")) {
    return "safety_stock_preference";
  }
  if (haystack.includes("staff") || haystack.includes("labor")) return "staff_timing";
  if (haystack.includes("prep")) return "prep_habit";
  return "demand_pattern";
}

export function createMemoryFromOutcome(
  restaurantId: string,
  outcome: Outcome,
  options: { statement?: string; now?: string } = {}
): RestaurantMemory {
  if (!outcome.lesson?.trim() && !options.statement?.trim()) {
    throw new Error("Outcome memories require a lesson or explicit statement.");
  }
  return createMemory({
    restaurantId,
    memoryType: "action_outcome",
    statement: options.statement?.trim() || outcome.lesson!,
    evidence: [
      {
        type: "action_outcome",
        id: outcome.id,
        summary: `Outcome for action ${outcome.actionId}`,
        observedAt: outcome.measuredAt
      }
    ],
    source: "action_outcome",
    affectsRecommendations: true,
    affectsAutomation: false,
    now: options.now ?? outcome.measuredAt
  });
}

export function confirmMemory(
  memory: RestaurantMemory,
  now = new Date().toISOString()
): RestaurantMemory {
  if (memory.status === "forgotten") {
    throw new Error("Forgotten memories cannot be confirmed.");
  }
  return {
    ...memory,
    status: "confirmed",
    confidence: Math.min(0.99, Number((memory.confidence + 0.05).toFixed(2))),
    lastUpdatedAt: new Date(now).toISOString(),
    correctionNote: null
  };
}

export function correctMemory(
  memory: RestaurantMemory,
  statement: string,
  now = new Date().toISOString()
): RestaurantMemory {
  if (memory.status === "forgotten") {
    throw new Error("Forgotten memories cannot be corrected.");
  }
  return {
    ...memory,
    status: "corrected",
    statement: boundedStatement(statement),
    lastUpdatedAt: new Date(now).toISOString(),
    correctionNote: boundedStatement(statement),
    confidence: Math.max(0.2, Number((memory.confidence - 0.1).toFixed(2)))
  };
}

export function dismissMemory(
  memory: RestaurantMemory,
  now = new Date().toISOString()
): RestaurantMemory {
  return {
    ...memory,
    status: "dismissed",
    affectsRecommendations: false,
    affectsAutomation: false,
    lastUpdatedAt: new Date(now).toISOString()
  };
}

export function forgetMemory(
  memory: RestaurantMemory,
  now = new Date().toISOString()
): RestaurantMemory {
  return {
    ...memory,
    status: "forgotten",
    affectsRecommendations: false,
    affectsAutomation: false,
    lastUpdatedAt: new Date(now).toISOString()
  };
}

export function temporarilyDisableMemory(
  memory: RestaurantMemory,
  now = new Date().toISOString()
): RestaurantMemory {
  return {
    ...memory,
    status: "disabled",
    affectsRecommendations: false,
    affectsAutomation: false,
    lastUpdatedAt: new Date(now).toISOString()
  };
}

export function convertMemoryToRule(memory: RestaurantMemory): RestaurantMemoryRuleDraft {
  if (memory.status === "forgotten" || memory.status === "dismissed") {
    throw new Error("Dismissed or forgotten memories cannot become rules.");
  }
  return {
    memoryId: memory.id,
    restaurantId: memory.restaurantId,
    title: memory.memoryType.replace(/_/g, " "),
    statement: memory.statement,
    enabled: false,
    sourceMemoryStatus: memory.status
  };
}

export function activeMemoriesForRecommendations(
  memories: readonly RestaurantMemory[]
): RestaurantMemory[] {
  return memories.filter(
    (memory) =>
      memory.affectsRecommendations &&
      (memory.status === "active" || memory.status === "confirmed" || memory.status === "corrected")
  );
}

/** Persisted row shape matching Codex `public.restaurant_memories`. */
export interface PersistedRestaurantMemoryRow {
  id: string;
  restaurant_id: string;
  memory_type: RestaurantMemoryType;
  statement: string;
  evidence?: RestaurantMemoryEvidence[] | null;
  confidence: number;
  first_observed_at: string;
  last_updated_at: string;
  scope: string;
  source: string;
  status: RestaurantMemoryStatus;
  affects_recommendations?: boolean | null;
  affects_automation?: boolean | null;
  correction?: string | null;
}

export function restaurantMemoryFromPersistedRow(
  row: PersistedRestaurantMemoryRow
): RestaurantMemory {
  return {
    id: row.id,
    restaurantId: row.restaurant_id.trim(),
    memoryType: row.memory_type,
    // Hosted corrections are preserved separately for auditability; expose the
    // corrected wording as the effective operator-facing statement.
    statement: row.correction?.trim() || row.statement,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    confidence: Number(row.confidence),
    firstObservedAt: new Date(row.first_observed_at).toISOString(),
    lastUpdatedAt: new Date(row.last_updated_at).toISOString(),
    scope: row.scope,
    source: row.source,
    status: row.status,
    affectsRecommendations: Boolean(row.affects_recommendations ?? true),
    affectsAutomation: Boolean(row.affects_automation ?? false),
    correctionNote: row.correction ?? null
  };
}

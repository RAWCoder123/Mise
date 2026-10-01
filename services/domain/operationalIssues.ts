import type { PurchaseRecommendation } from "../../types/mise";
import { createId } from "./miseDomain";

export const OPERATIONAL_ISSUE_CATEGORIES = [
  "inventory",
  "orders",
  "sales",
  "team",
  "waste",
  "integrations",
  "tasks",
  "system"
] as const;

export type OperationalIssueCategory = (typeof OPERATIONAL_ISSUE_CATEGORIES)[number];

export const OPERATIONAL_ISSUE_SEVERITIES = ["info", "watch", "warning", "critical"] as const;
export type OperationalIssueSeverity = (typeof OPERATIONAL_ISSUE_SEVERITIES)[number];

export const OPERATIONAL_ISSUE_STATUSES = [
  "open",
  "monitoring",
  "action_prepared",
  "resolved",
  "dismissed",
  "expired"
] as const;
export type OperationalIssueStatus = (typeof OPERATIONAL_ISSUE_STATUSES)[number];

export const OPERATIONAL_ISSUE_STATUS_FILTERS = [
  "open",
  "resolved",
  "all"
] as const;
export type OperationalIssueStatusFilter = (typeof OPERATIONAL_ISSUE_STATUS_FILTERS)[number];

export interface OperationalIssueEvidence {
  type: string;
  id?: string;
  inventoryItemId?: string;
  recommendedQuantity?: number;
  unit?: string;
  observedAt?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface OperationalIssue {
  id: string;
  restaurantId: string;
  locationId: string | null;
  category: OperationalIssueCategory;
  severity: OperationalIssueSeverity;
  title: string;
  explanation: string;
  evidence: OperationalIssueEvidence[];
  firstDetectedAt: string;
  lastDetectedAt: string;
  deadline: string | null;
  status: OperationalIssueStatus;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  dedupeKey: string;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedOperationalIssueRow {
  id: string;
  restaurant_id: string;
  location_id?: string | null;
  category: OperationalIssueCategory | string;
  severity: OperationalIssueSeverity | string;
  title: string;
  explanation: string;
  evidence?: OperationalIssueEvidence[] | null;
  first_detected_at: string;
  last_detected_at: string;
  deadline?: string | null;
  status: OperationalIssueStatus | string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  dedupe_key: string;
  correlation_id?: string | null;
  created_at: string;
  updated_at: string;
}

const OPEN_STATUSES = new Set<OperationalIssueStatus>(["open", "monitoring", "action_prepared"]);
const RESOLVED_STATUSES = new Set<OperationalIssueStatus>(["resolved", "dismissed", "expired"]);

const SEVERITY_RANK: Record<OperationalIssueSeverity, number> = {
  critical: 4,
  warning: 3,
  watch: 2,
  info: 1
};

function requireRestaurantId(value: string): string {
  const restaurantId = value.trim();
  if (!restaurantId) throw new Error("Operational issue restaurant id is required.");
  return restaurantId;
}

function requireBoundedText(value: string, field: string, max: number): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Operational issue ${field} is required.`);
  if (trimmed.length > max) throw new Error(`Operational issue ${field} is too long.`);
  return trimmed;
}

function requireCategory(value: string): OperationalIssueCategory {
  if ((OPERATIONAL_ISSUE_CATEGORIES as readonly string[]).includes(value)) {
    return value as OperationalIssueCategory;
  }
  throw new Error("Operational issue category is invalid.");
}

function requireSeverity(value: string): OperationalIssueSeverity {
  if ((OPERATIONAL_ISSUE_SEVERITIES as readonly string[]).includes(value)) {
    return value as OperationalIssueSeverity;
  }
  throw new Error("Operational issue severity is invalid.");
}

function requireStatus(value: string): OperationalIssueStatus {
  if ((OPERATIONAL_ISSUE_STATUSES as readonly string[]).includes(value)) {
    return value as OperationalIssueStatus;
  }
  throw new Error("Operational issue status is invalid.");
}

function iso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Operational issue timestamp is invalid.");
  return parsed.toISOString();
}

export function isOpenOperationalIssueStatus(status: OperationalIssueStatus): boolean {
  return OPEN_STATUSES.has(status);
}

export function severityRank(severity: OperationalIssueSeverity): number {
  return SEVERITY_RANK[severity];
}

export function inventoryRiskDedupeKey(inventoryItemId: string): string {
  return `inventory-risk:${inventoryItemId.trim()}`;
}

export function severityFromRecommendationUrgency(
  urgency: PurchaseRecommendation["urgency"]
): OperationalIssueSeverity {
  if (urgency === "high") return "critical";
  if (urgency === "medium") return "warning";
  return "watch";
}

export function statusFromRecommendationStatus(
  status: PurchaseRecommendation["status"]
): OperationalIssueStatus {
  if (status === "ordered") return "resolved";
  if (status === "dismissed") return "dismissed";
  if (status === "approved") return "action_prepared";
  return "open";
}

/**
 * Builds the durable inventory-risk issue that hosted triggers upsert when a
 * purchase recommendation is created or refreshed.
 */
export function operationalIssueFromPurchaseRecommendation(
  recommendation: PurchaseRecommendation,
  existing: OperationalIssue | null = null
): OperationalIssue {
  const restaurantId = requireRestaurantId(recommendation.restaurant_id);
  const inventoryItemId = recommendation.inventory_item_id.trim();
  if (!inventoryItemId) throw new Error("Operational issue inventory item id is required.");
  const detectedAt = iso(recommendation.created_at);
  const severity = severityFromRecommendationUrgency(recommendation.urgency);
  const status = statusFromRecommendationStatus(recommendation.status);
  const title = requireBoundedText(`${recommendation.item_name} inventory risk`, "title", 160);
  const explanation = requireBoundedText(recommendation.reason, "explanation", 2000);
  const evidence: OperationalIssueEvidence[] = [
    {
      type: "purchase_recommendation",
      id: recommendation.id,
      inventoryItemId,
      recommendedQuantity: recommendation.recommended_quantity,
      unit: recommendation.unit,
      observedAt: detectedAt
    }
  ];

  return {
    id: existing?.id ?? createId("issue"),
    restaurantId,
    locationId: existing?.locationId ?? null,
    category: "inventory",
    severity,
    title,
    explanation,
    evidence,
    firstDetectedAt: existing?.firstDetectedAt ?? detectedAt,
    lastDetectedAt:
      existing && existing.lastDetectedAt > detectedAt ? existing.lastDetectedAt : detectedAt,
    deadline: existing?.deadline ?? null,
    status,
    relatedEntityType: "inventory_item",
    relatedEntityId: inventoryItemId,
    dedupeKey: inventoryRiskDedupeKey(inventoryItemId),
    correlationId: existing?.correlationId ?? createId("corr"),
    createdAt: existing?.createdAt ?? detectedAt,
    updatedAt: detectedAt
  };
}

export function operationalIssueFromPersistedRow(row: PersistedOperationalIssueRow): OperationalIssue {
  const restaurantId = requireRestaurantId(row.restaurant_id);
  const firstDetectedAt = iso(row.first_detected_at);
  const lastDetectedAt = iso(row.last_detected_at);
  if (lastDetectedAt < firstDetectedAt) {
    throw new Error("Operational issue detection window is invalid.");
  }
  return {
    id: row.id,
    restaurantId,
    locationId: row.location_id ?? null,
    category: requireCategory(row.category),
    severity: requireSeverity(row.severity),
    title: requireBoundedText(row.title, "title", 160),
    explanation: requireBoundedText(row.explanation, "explanation", 2000),
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    firstDetectedAt,
    lastDetectedAt,
    deadline: row.deadline ? iso(row.deadline) : null,
    status: requireStatus(row.status),
    relatedEntityType: row.related_entity_type ?? null,
    relatedEntityId: row.related_entity_id ?? null,
    dedupeKey: requireBoundedText(row.dedupe_key, "dedupe key", 240),
    correlationId: row.correlation_id?.trim() || createId("corr"),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

export function operationalIssueToPersistedRow(issue: OperationalIssue): PersistedOperationalIssueRow {
  return {
    id: issue.id,
    restaurant_id: issue.restaurantId,
    location_id: issue.locationId,
    category: issue.category,
    severity: issue.severity,
    title: issue.title,
    explanation: issue.explanation,
    evidence: issue.evidence,
    first_detected_at: issue.firstDetectedAt,
    last_detected_at: issue.lastDetectedAt,
    deadline: issue.deadline,
    status: issue.status,
    related_entity_type: issue.relatedEntityType,
    related_entity_id: issue.relatedEntityId,
    dedupe_key: issue.dedupeKey,
    correlation_id: issue.correlationId,
    created_at: issue.createdAt,
    updated_at: issue.updatedAt
  };
}

export function sortOperationalIssues(issues: readonly OperationalIssue[]): OperationalIssue[] {
  return [...issues].sort((left, right) => {
    const openDelta =
      Number(isOpenOperationalIssueStatus(right.status)) -
      Number(isOpenOperationalIssueStatus(left.status));
    if (openDelta !== 0) return openDelta;
    const severityDelta = severityRank(right.severity) - severityRank(left.severity);
    if (severityDelta !== 0) return severityDelta;
    return right.lastDetectedAt.localeCompare(left.lastDetectedAt) || left.id.localeCompare(right.id);
  });
}

export function filterOperationalIssues(
  issues: readonly OperationalIssue[],
  filter: OperationalIssueStatusFilter = "open"
): OperationalIssue[] {
  if (filter === "all") return [...issues];
  if (filter === "resolved") {
    return issues.filter((issue) => RESOLVED_STATUSES.has(issue.status));
  }
  return issues.filter((issue) => OPEN_STATUSES.has(issue.status));
}

export function assertOperationalIssuesTenantScoped(
  issues: readonly OperationalIssue[],
  restaurantId: string
): void {
  const normalized = requireRestaurantId(restaurantId);
  if (issues.some((issue) => issue.restaurantId !== normalized)) {
    throw new Error("Operational issues failed restaurant scope validation.");
  }
}

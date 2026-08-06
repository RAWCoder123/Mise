import type {
  InventoryItem,
  LearningMemorySummary,
  PosSale,
  PurchaseRecommendation,
  SupplierOrder
} from "../../types/mise";
import type { OperationalFinding } from "./operationalFindings";
import type { AutonomyLevel } from "./operationalStatus";
import type { RestaurantTask } from "./restaurantTasks";
import { createId } from "./miseDomain";

export type ActivityType =
  | "forecast_updated"
  | "prep_plan_updated"
  | "inventory_risk_detected"
  | "physical_count_requested"
  | "supplier_prices_checked"
  | "order_prepared"
  | "order_approved"
  | "order_sent"
  | "supplier_confirmation_received"
  | "delivery_expected"
  | "delivery_logged"
  | "invoice_discrepancy_detected"
  | "waste_analysis_completed"
  | "staff_schedule_analyzed"
  | "staffing_gap_detected"
  | "pos_sync_completed"
  | "reservation_forecast_updated"
  | "customer_review_trend_detected"
  | "menu_item_performance_analyzed"
  | "task_created"
  | "task_completed"
  | "task_reopened"
  | "task_unblocked"
  | "automation_failed"
  | "approval_required"
  | "recommendation_created"
  | "recommendation_dismissed"
  | "recommendation_outcome_measured"
  | "restaurant_memory_updated"
  | "inventory_count_recorded";

export type ActivityCategory =
  | "inventory"
  | "orders"
  | "sales"
  | "team"
  | "tasks"
  | "waste"
  | "approvals"
  | "integrations"
  | "memory"
  | "system";

export type ActivityStatus =
  | "monitoring"
  | "prepared"
  | "waiting_for_approval"
  | "scheduled"
  | "sent"
  | "confirmed"
  | "completed"
  | "failed"
  | "could_not_verify"
  | "partially_completed"
  | "cancelled"
  | "reversed";

export type ActivityRelatedEntityType =
  | "inventory_item"
  | "purchase_recommendation"
  | "supplier_order"
  | "supplier"
  | "menu_item"
  | "employee"
  | "shift"
  | "task"
  | "restaurant_task"
  | "finding"
  | "memory"
  | "mise_action"
  | "pos_import";

export interface ActivityEvidenceReference {
  type: string;
  id: string;
  summary: string;
  observedAt?: string;
}

export interface ActivityEvent {
  id: string;
  restaurantId: string;
  locationId: string | null;
  occurredAt: string;
  createdAt: string;
  activityType: ActivityType;
  category: ActivityCategory;
  title: string;
  summary: string;
  triggerType: string;
  triggerReference: string | null;
  evidenceReferences: ActivityEvidenceReference[];
  sourceSystems: string[];
  actionId: string | null;
  recommendationId: string | null;
  autonomyLevel: AutonomyLevel;
  confidence: number | null;
  status: ActivityStatus;
  requiresAttention: boolean;
  attentionDeadline: string | null;
  relatedEntityType: ActivityRelatedEntityType | null;
  relatedEntityId: string | null;
  parentActivityId: string | null;
  sequenceId: string | null;
  metadata: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface ActivityStory {
  sequenceId: string;
  title: string;
  currentStatus: ActivityStatus;
  requiresAttention: boolean;
  attentionDeadline: string | null;
  events: ActivityEvent[];
}

export type ActivityFeedFilter =
  | "all"
  | "completed_by_mise"
  | "needs_attention"
  | "approvals"
  | "inventory"
  | "orders"
  | "team"
  | "sales"
  | "waste"
  | "errors";

export type ActivityDateRange = "all" | "today" | "yesterday" | "this_week";

export const ACTIVITY_FEED_FILTERS: readonly ActivityFeedFilter[] = [
  "all",
  "completed_by_mise",
  "needs_attention",
  "approvals",
  "inventory",
  "orders",
  "team",
  "sales",
  "waste",
  "errors"
] as const;

/** Inclusive local-day bounds in ISO for activity history date chips. */
export function activityDateRangeBounds(
  range: ActivityDateRange,
  now = new Date()
): { since?: string; until?: string } {
  if (range === "all") return {};

  const startOfLocalDay = (date: Date) => {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  };
  const endOfLocalDay = (date: Date) => {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
  };

  if (range === "today") {
    return {
      since: startOfLocalDay(now).toISOString(),
      until: endOfLocalDay(now).toISOString()
    };
  }
  if (range === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      since: startOfLocalDay(yesterday).toISOString(),
      until: endOfLocalDay(yesterday).toISOString()
    };
  }

  const weekStart = startOfLocalDay(now);
  const day = weekStart.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - daysFromMonday);
  return {
    since: weekStart.toISOString(),
    until: endOfLocalDay(now).toISOString()
  };
}

export interface ActivityWindowSummary {
  since: string;
  forecastUpdates: number;
  ordersPrepared: number;
  staffingRisks: number;
  routineChecks: number;
  needsAttention: number;
  sentence: string;
}

type ActivityBaseInput = {
  restaurantId: string;
  occurredAt: string;
  locationId?: string | null;
  createdAt?: string;
  sequenceId?: string | null;
  parentActivityId?: string | null;
  actionId?: string | null;
  confidence?: number | null;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
};

function requireRestaurantId(restaurantId: string) {
  const normalized = restaurantId.trim();
  if (!normalized) throw new Error("Activity events require a restaurant id.");
  return normalized;
}

function iso(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Activity events require a valid occurredAt timestamp.");
  }
  return new Date(parsed).toISOString();
}

function clampConfidence(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function buildEvent(
  input: ActivityBaseInput & {
    activityType: ActivityType;
    category: ActivityCategory;
    title: string;
    summary: string;
    triggerType: string;
    triggerReference?: string | null;
    evidenceReferences?: ActivityEvidenceReference[];
    sourceSystems?: string[];
    recommendationId?: string | null;
    autonomyLevel: AutonomyLevel;
    status: ActivityStatus;
    requiresAttention?: boolean;
    attentionDeadline?: string | null;
    relatedEntityType?: ActivityRelatedEntityType | null;
    relatedEntityId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }
): ActivityEvent {
  const restaurantId = requireRestaurantId(input.restaurantId);
  const occurredAt = iso(input.occurredAt);
  const createdAt = input.createdAt ? iso(input.createdAt) : occurredAt;
  const metadata = { ...(input.metadata ?? {}) };
  if (input.idempotencyKey) {
    metadata.idempotencyKey = input.idempotencyKey;
  }

  return {
    id: createId("activity"),
    restaurantId,
    locationId: input.locationId ?? null,
    occurredAt,
    createdAt,
    activityType: input.activityType,
    category: input.category,
    title: input.title,
    summary: input.summary,
    triggerType: input.triggerType,
    triggerReference: input.triggerReference ?? null,
    evidenceReferences: input.evidenceReferences ?? [],
    sourceSystems: input.sourceSystems ?? ["mise"],
    actionId: input.actionId ?? null,
    recommendationId: input.recommendationId ?? null,
    autonomyLevel: input.autonomyLevel,
    confidence: clampConfidence(input.confidence),
    status: input.status,
    requiresAttention: Boolean(input.requiresAttention),
    attentionDeadline: input.attentionDeadline ? iso(input.attentionDeadline) : null,
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
    parentActivityId: input.parentActivityId ?? null,
    sequenceId: input.sequenceId ?? null,
    metadata,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    resolvedAt: null,
    resolvedBy: null
  };
}

export function assertTenantScoped(events: readonly ActivityEvent[], restaurantId: string) {
  const normalized = requireRestaurantId(restaurantId);
  if (events.some((event) => event.restaurantId !== normalized)) {
    throw new Error("Activity events failed restaurant scope validation.");
  }
}

export function fromRestaurantTaskActivity(
  task: RestaurantTask,
  input: {
    activityType: "task_created" | "task_completed" | "task_reopened" | "task_unblocked";
    title: string;
    summary: string;
    occurredAt?: string;
    status: "scheduled" | "completed" | "waiting_for_approval" | "could_not_verify";
    idempotencySuffix: string;
    metadata?: Record<string, unknown>;
  }
): ActivityEvent {
  return buildEvent({
    restaurantId: task.restaurantId,
    locationId: task.locationId,
    occurredAt: input.occurredAt ?? task.updatedAt,
    activityType: input.activityType,
    category: "tasks",
    title: input.title,
    summary: input.summary,
    triggerType: input.activityType,
    triggerReference: task.id,
    sourceSystems: ["mise", "restaurant_tasks"],
    autonomyLevel: 1,
    status: input.status,
    requiresAttention: task.status === "blocked" || task.status === "could_not_verify",
    attentionDeadline: task.dueAt,
    relatedEntityType: "restaurant_task",
    relatedEntityId: task.id,
    sequenceId: `restaurant_task:${task.id}`,
    metadata: {
      origin: task.origin,
      priority: task.priority,
      timingBucket: task.timingBucket,
      serviceWindow: task.serviceWindow,
      assigneeUserId: task.assigneeUserId,
      verificationMethod: task.verificationMethod,
      ...(input.metadata ?? {})
    },
    idempotencyKey: `restaurant_task:${task.id}:${input.idempotencySuffix}`
  });
}

export function activityIdempotencyKey(event: Pick<
  ActivityEvent,
  "activityType" | "relatedEntityType" | "relatedEntityId" | "occurredAt" | "metadata"
>) {
  const explicit = event.metadata.idempotencyKey;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const bucket = event.occurredAt.slice(0, 16);
  return [
    event.activityType,
    event.relatedEntityType ?? "none",
    event.relatedEntityId ?? "none",
    bucket
  ].join(":");
}

export function dedupeActivityEvents(events: readonly ActivityEvent[]): ActivityEvent[] {
  const seen = new Set<string>();
  const result: ActivityEvent[] = [];
  for (const event of [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    const key = `${event.restaurantId}:${activityIdempotencyKey(event)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(event);
  }
  return result;
}

export function filterActivities(
  events: readonly ActivityEvent[],
  filter: ActivityFeedFilter
): ActivityEvent[] {
  switch (filter) {
    case "all":
      return [...events];
    case "completed_by_mise":
      return events.filter(
        (event) =>
          event.status === "completed" ||
          event.status === "confirmed" ||
          event.status === "sent"
      );
    case "needs_attention":
      return events.filter((event) => event.requiresAttention);
    case "approvals":
      return events.filter(
        (event) =>
          event.category === "approvals" ||
          event.activityType === "approval_required" ||
          event.status === "waiting_for_approval"
      );
    case "inventory":
      return events.filter((event) => event.category === "inventory");
    case "orders":
      return events.filter((event) => event.category === "orders");
    case "team":
      return events.filter((event) => event.category === "team");
    case "sales":
      return events.filter((event) => event.category === "sales");
    case "waste":
      return events.filter((event) => event.category === "waste");
    case "errors":
      return events.filter(
        (event) =>
          event.status === "failed" ||
          event.status === "could_not_verify" ||
          event.activityType === "automation_failed"
      );
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}

export function groupRelatedActivities(events: readonly ActivityEvent[]): ActivityStory[] {
  const bySequence = new Map<string, ActivityEvent[]>();
  const ungrouped: ActivityEvent[] = [];

  for (const event of events) {
    if (!event.sequenceId) {
      ungrouped.push(event);
      continue;
    }
    const current = bySequence.get(event.sequenceId) ?? [];
    current.push(event);
    bySequence.set(event.sequenceId, current);
  }

  const stories: ActivityStory[] = [];
  for (const [sequenceId, sequenceEvents] of bySequence) {
    const ordered = [...sequenceEvents].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const latest = ordered[ordered.length - 1]!;
    const titleSeed =
      ordered.find((event) => event.activityType === "inventory_risk_detected") ??
      ordered.find((event) => event.activityType === "recommendation_created") ??
      ordered[0]!;
    stories.push({
      sequenceId,
      title: titleSeed.relatedEntityType === "inventory_item"
        ? `${titleSeed.metadata.itemName ?? "Inventory"} response`
        : titleSeed.title,
      currentStatus: latest.status,
      requiresAttention: ordered.some((event) => event.requiresAttention && !event.resolvedAt),
      attentionDeadline:
        ordered
          .filter((event) => event.attentionDeadline)
          .map((event) => event.attentionDeadline!)
          .sort()[0] ?? null,
      events: ordered
    });
  }

  for (const event of ungrouped) {
    stories.push({
      sequenceId: event.id,
      title: event.title,
      currentStatus: event.status,
      requiresAttention: event.requiresAttention && !event.resolvedAt,
      attentionDeadline: event.attentionDeadline,
      events: [event]
    });
  }

  return stories.sort((a, b) => {
    const aTime = a.events[a.events.length - 1]?.occurredAt ?? "";
    const bTime = b.events[b.events.length - 1]?.occurredAt ?? "";
    return bTime.localeCompare(aTime);
  });
}

export function summarizeActivityWindow(
  events: readonly ActivityEvent[],
  since: string
): ActivityWindowSummary {
  const sinceIso = iso(since);
  const windowEvents = events.filter((event) => event.occurredAt >= sinceIso);
  const forecastUpdates = windowEvents.filter((event) => event.activityType === "forecast_updated").length;
  const ordersPrepared = windowEvents.filter(
    (event) =>
      event.activityType === "order_prepared" ||
      event.activityType === "recommendation_created" ||
      event.activityType === "approval_required"
  ).length;
  const staffingRisks = windowEvents.filter(
    (event) =>
      event.activityType === "staffing_gap_detected" || event.activityType === "staff_schedule_analyzed"
  ).length;
  const routineChecks = windowEvents.filter(
    (event) =>
      event.activityType === "supplier_prices_checked" ||
      event.activityType === "waste_analysis_completed" ||
      event.activityType === "pos_sync_completed" ||
      event.activityType === "menu_item_performance_analyzed"
  ).length;
  const needsAttention = windowEvents.filter((event) => event.requiresAttention).length;

  const parts: string[] = [];
  if (forecastUpdates > 0) {
    parts.push(`updated ${forecastUpdates} forecast${forecastUpdates === 1 ? "" : "s"}`);
  }
  if (ordersPrepared > 0) {
    parts.push(`prepared ${ordersPrepared} supplier order${ordersPrepared === 1 ? "" : "s"}`);
  }
  if (staffingRisks > 0) {
    parts.push(`detected ${staffingRisks} staffing risk${staffingRisks === 1 ? "" : "s"}`);
  }
  if (routineChecks > 0) {
    parts.push(`completed ${routineChecks} routine check${routineChecks === 1 ? "" : "s"}`);
  }
  const sentence =
    parts.length === 0
      ? `Since ${sinceIso.slice(11, 16) || "earlier"}, Mise recorded no operator-facing activity.`
      : `Since ${sinceIso.slice(11, 16) || "earlier"}, Mise ${parts.join(", ")}.`;

  return {
    since: sinceIso,
    forecastUpdates,
    ordersPrepared,
    staffingRisks,
    routineChecks,
    needsAttention,
    sentence
  };
}

export function fromPurchaseRecommendationCreated(
  recommendation: PurchaseRecommendation,
  options: { sequenceId?: string | null; confidence?: number | null; attentionDeadline?: string | null } = {}
): ActivityEvent {
  const needsApproval = recommendation.status === "pending";
  return buildEvent({
    restaurantId: recommendation.restaurant_id,
    occurredAt: recommendation.created_at,
    activityType: needsApproval ? "approval_required" : "recommendation_created",
    category: needsApproval ? "approvals" : "orders",
    title: needsApproval ? "Approval required" : "Recommendation created",
    summary: needsApproval
      ? `A ${recommendation.recommended_quantity} ${recommendation.unit} ${recommendation.item_name} reorder is ready for approval.`
      : `${recommendation.item_name} recommendation recorded.`,
    triggerType: "inventory_depletion",
    triggerReference: recommendation.inventory_item_id,
    evidenceReferences: [
      {
        type: "purchase_recommendation",
        id: recommendation.id,
        summary: recommendation.reason,
        observedAt: recommendation.created_at
      }
    ],
    sourceSystems: ["mise", "inventory", "pos"],
    recommendationId: recommendation.id,
    autonomyLevel: 3,
    confidence: options.confidence ?? null,
    status: needsApproval ? "waiting_for_approval" : "prepared",
    requiresAttention: needsApproval,
    attentionDeadline: options.attentionDeadline ?? null,
    relatedEntityType: "purchase_recommendation",
    relatedEntityId: recommendation.id,
    sequenceId: options.sequenceId ?? null,
    metadata: {
      itemName: recommendation.item_name,
      supplierName: recommendation.supplier_name,
      quantity: recommendation.recommended_quantity,
      unit: recommendation.unit,
      urgency: recommendation.urgency
    },
    idempotencyKey: `recommendation_created:${recommendation.id}`
  });
}

export function fromPurchaseRecommendationApproved(
  recommendation: PurchaseRecommendation,
  options: { occurredAt?: string; actorUserId?: string | null; sequenceId?: string | null } = {}
): ActivityEvent {
  return buildEvent({
    restaurantId: recommendation.restaurant_id,
    occurredAt: options.occurredAt ?? recommendation.created_at,
    activityType: "order_approved",
    category: "orders",
    title: "Order approved",
    summary: `${recommendation.item_name}: ${recommendation.recommended_quantity} ${recommendation.unit} approved.`,
    triggerType: "owner_approval",
    triggerReference: recommendation.id,
    evidenceReferences: [
      {
        type: "purchase_recommendation",
        id: recommendation.id,
        summary: recommendation.reason,
        observedAt: recommendation.created_at
      }
    ],
    recommendationId: recommendation.id,
    autonomyLevel: 3,
    status: "confirmed",
    relatedEntityType: "purchase_recommendation",
    relatedEntityId: recommendation.id,
    sequenceId: options.sequenceId ?? null,
    metadata: {
      itemName: recommendation.item_name,
      quantity: recommendation.recommended_quantity,
      unit: recommendation.unit,
      actorUserId: options.actorUserId ?? null
    },
    idempotencyKey: `recommendation_approved:${recommendation.id}:${recommendation.status}`
  });
}

export function fromPurchaseRecommendationDismissed(
  recommendation: PurchaseRecommendation,
  options: { occurredAt?: string; sequenceId?: string | null } = {}
): ActivityEvent {
  return buildEvent({
    restaurantId: recommendation.restaurant_id,
    occurredAt: options.occurredAt ?? recommendation.created_at,
    activityType: "recommendation_dismissed",
    category: "orders",
    title: "Recommendation dismissed",
    summary: `${recommendation.item_name} reorder was dismissed.`,
    triggerType: "owner_decision",
    triggerReference: recommendation.id,
    recommendationId: recommendation.id,
    autonomyLevel: 2,
    status: "cancelled",
    relatedEntityType: "purchase_recommendation",
    relatedEntityId: recommendation.id,
    sequenceId: options.sequenceId ?? null,
    metadata: { itemName: recommendation.item_name },
    idempotencyKey: `recommendation_dismissed:${recommendation.id}`
  });
}

export function fromSupplierOrderDrafted(
  order: SupplierOrder,
  options: { itemCount?: number; sequenceId?: string | null } = {}
): ActivityEvent {
  return buildEvent({
    restaurantId: order.restaurant_id,
    occurredAt: order.created_at,
    activityType: "order_prepared",
    category: "orders",
    title: "Order prepared",
    summary:
      options.itemCount && options.itemCount > 0
        ? `${order.supplier_name} draft prepared with ${options.itemCount} item${options.itemCount === 1 ? "" : "s"}.`
        : `${order.supplier_name} supplier draft prepared.`,
    triggerType: "approved_recommendations",
    triggerReference: order.id,
    autonomyLevel: 3,
    status: "prepared",
    relatedEntityType: "supplier_order",
    relatedEntityId: order.id,
    sequenceId: options.sequenceId ?? null,
    sourceSystems: ["mise", "purchasing"],
    metadata: {
      supplierName: order.supplier_name,
      itemCount: options.itemCount ?? null,
      deliveryDate: order.delivery_date
    },
    idempotencyKey: `order_prepared:${order.id}`
  });
}

export function fromSupplierOrderSent(
  order: SupplierOrder,
  options: { occurredAt?: string; sequenceId?: string | null } = {}
): ActivityEvent {
  return buildEvent({
    restaurantId: order.restaurant_id,
    occurredAt: options.occurredAt ?? order.created_at,
    activityType: "order_sent",
    category: "orders",
    title: "Order sent",
    summary: `${order.supplier_name} order marked sent.`,
    triggerType: "owner_send",
    triggerReference: order.id,
    autonomyLevel: 3,
    status: "sent",
    relatedEntityType: "supplier_order",
    relatedEntityId: order.id,
    sequenceId: options.sequenceId ?? null,
    sourceSystems: ["mise", "gmail"],
    metadata: { supplierName: order.supplier_name },
    idempotencyKey: `order_sent:${order.id}`
  });
}

export function fromInventoryCountRecorded(
  item: InventoryItem,
  options: {
    occurredAt: string;
    previousQuantity?: number | null;
    eventId?: string | null;
    sequenceId?: string | null;
  }
): ActivityEvent {
  return buildEvent({
    restaurantId: item.restaurant_id,
    occurredAt: options.occurredAt,
    activityType: "inventory_count_recorded",
    category: "inventory",
    title: "Inventory count recorded",
    summary: `${item.item_name} counted at ${item.current_quantity} ${item.unit}.`,
    triggerType: "physical_count",
    triggerReference: options.eventId ?? item.id,
    autonomyLevel: 4,
    status: "completed",
    relatedEntityType: "inventory_item",
    relatedEntityId: item.id,
    sequenceId: options.sequenceId ?? null,
    sourceSystems: ["mise", "inventory"],
    evidenceReferences: [
      {
        type: "inventory_item",
        id: item.id,
        summary: `Current quantity ${item.current_quantity} ${item.unit}`,
        observedAt: options.occurredAt
      }
    ],
    metadata: {
      itemName: item.item_name,
      quantity: item.current_quantity,
      unit: item.unit,
      previousQuantity: options.previousQuantity ?? null
    },
    idempotencyKey: `inventory_count:${options.eventId ?? `${item.id}:${options.occurredAt}`}`
  });
}

export function fromInventoryReceipt(
  item: InventoryItem,
  options: {
    occurredAt: string;
    quantityReceived: number;
    eventId?: string | null;
    sequenceId?: string | null;
  }
): ActivityEvent {
  return buildEvent({
    restaurantId: item.restaurant_id,
    occurredAt: options.occurredAt,
    activityType: "delivery_logged",
    category: "orders",
    title: "Delivery logged",
    summary: `${options.quantityReceived} ${item.unit} of ${item.item_name} received.`,
    triggerType: "delivery_receipt",
    triggerReference: options.eventId ?? item.id,
    autonomyLevel: 4,
    status: "completed",
    relatedEntityType: "inventory_item",
    relatedEntityId: item.id,
    sequenceId: options.sequenceId ?? null,
    sourceSystems: ["mise", "inventory"],
    metadata: {
      itemName: item.item_name,
      quantityReceived: options.quantityReceived,
      unit: item.unit
    },
    idempotencyKey: `delivery_logged:${options.eventId ?? `${item.id}:${options.occurredAt}`}`
  });
}

export function fromInventoryWasteRecorded(
  item: InventoryItem,
  options: {
    occurredAt: string;
    quantity: number;
    canonicalUnit: string;
    repeatedRecently?: boolean;
    eventId?: string | null;
    sequenceId?: string | null;
  }
): ActivityEvent {
  return buildEvent({
    restaurantId: item.restaurant_id,
    occurredAt: options.occurredAt,
    activityType: "waste_analysis_completed",
    category: "waste",
    title: options.repeatedRecently ? "Waste pattern needs review" : "Waste recorded and analyzed",
    summary: `${options.quantity} ${options.canonicalUnit} of ${item.item_name} was recorded as waste.`,
    triggerType: "inventory_waste",
    triggerReference: options.eventId ?? item.id,
    autonomyLevel: 2,
    status: "completed",
    requiresAttention: Boolean(options.repeatedRecently),
    relatedEntityType: "inventory_item",
    relatedEntityId: item.id,
    sequenceId: options.sequenceId ?? null,
    sourceSystems: ["mise", "inventory"],
    evidenceReferences: [
      {
        type: "inventory_event",
        id: options.eventId ?? item.id,
        summary: `${options.quantity} ${options.canonicalUnit} recorded as waste`,
        observedAt: options.occurredAt
      }
    ],
    metadata: {
      itemName: item.item_name,
      quantity: options.quantity,
      canonicalUnit: options.canonicalUnit,
      repeatedRecently: Boolean(options.repeatedRecently)
    },
    idempotencyKey: `waste_analysis:${options.eventId ?? `${item.id}:${options.occurredAt}`}`
  });
}

export function fromOperationalFinding(
  finding: OperationalFinding,
  options: { sequenceId?: string | null } = {}
): ActivityEvent {
  const isRisk = finding.category === "inventory" || finding.severity === "urgent";
  return buildEvent({
    restaurantId: finding.restaurantId,
    occurredAt: finding.generatedAt,
    activityType: isRisk ? "inventory_risk_detected" : "menu_item_performance_analyzed",
    category:
      finding.category === "ordering"
        ? "orders"
        : finding.category === "waste"
          ? "waste"
          : finding.category === "sales"
            ? "sales"
            : "inventory",
    title: finding.title,
    summary: finding.explanation,
    triggerType: "operational_finding",
    triggerReference: finding.id,
    evidenceReferences: finding.evidence.map((entry) => ({
      type: entry.type,
      id: entry.id,
      summary: entry.summary,
      observedAt: entry.observedAt
    })),
    autonomyLevel: 2,
    confidence: finding.confidence.score,
    status: finding.managerFeedback.state === "unreviewed" ? "waiting_for_approval" : "completed",
    requiresAttention: finding.managerFeedback.state === "unreviewed" && finding.severity !== "info",
    relatedEntityType: "finding",
    relatedEntityId: finding.id,
    sequenceId: options.sequenceId ?? null,
    sourceSystems: ["mise", "findings"],
    metadata: {
      category: finding.category,
      severity: finding.severity,
      recommendedAction: finding.recommendedAction,
      freshness: finding.freshness.state
    },
    idempotencyKey: `finding:${finding.id}:${finding.policyVersion}`
  });
}

export function fromPosSyncCompleted(input: {
  restaurantId: string;
  occurredAt: string;
  importId: string | null;
  recordsProcessed: number;
  provider?: string | null;
}): ActivityEvent {
  return buildEvent({
    restaurantId: input.restaurantId,
    occurredAt: input.occurredAt,
    activityType: "pos_sync_completed",
    category: "integrations",
    title: "POS sync completed",
    summary: `${input.recordsProcessed} sale row${input.recordsProcessed === 1 ? "" : "s"} imported${
      input.provider ? ` from ${input.provider}` : ""
    }.`,
    triggerType: "pos_sync",
    triggerReference: input.importId,
    autonomyLevel: 4,
    status: "completed",
    relatedEntityType: "pos_import",
    relatedEntityId: input.importId,
    sourceSystems: ["mise", "pos", input.provider ?? "unknown"].filter(Boolean) as string[],
    metadata: {
      recordsProcessed: input.recordsProcessed,
      provider: input.provider ?? null,
      importId: input.importId
    },
    idempotencyKey: `pos_sync:${input.importId ?? input.occurredAt}`
  });
}

export function fromLearningMemoryUpdated(
  restaurantId: string,
  memory: LearningMemorySummary,
  options: { occurredAt?: string } = {}
): ActivityEvent {
  const occurredAt = options.occurredAt ?? new Date().toISOString();
  return buildEvent({
    restaurantId,
    occurredAt,
    activityType: "restaurant_memory_updated",
    category: "memory",
    title: "Restaurant memory updated",
    summary: memory.operatorCopy || memory.label,
    triggerType: "learning_summary",
    triggerReference: null,
    autonomyLevel: 5,
    confidence: Number.isFinite(memory.score) ? Math.max(0, Math.min(1, memory.score / 100)) : null,
    status: "completed",
    relatedEntityType: "memory",
    relatedEntityId: null,
    sourceSystems: ["mise", "learning"],
    metadata: {
      label: memory.label,
      score: memory.score,
      signalCount: memory.signals.length
    },
    idempotencyKey: `memory_updated:${restaurantId}:${occurredAt.slice(0, 13)}:${memory.label}`
  });
}

/** Deterministic inventory-risk activity from structured item state — no fabrication. */
export function fromInventoryRiskSignal(input: {
  restaurantId: string;
  item: InventoryItem;
  occurredAt: string;
  projectedQuantity: number;
  reason: string;
  confidence?: number | null;
  attentionDeadline?: string | null;
  sequenceId?: string | null;
}): ActivityEvent {
  return buildEvent({
    restaurantId: input.restaurantId,
    occurredAt: input.occurredAt,
    activityType: "inventory_risk_detected",
    category: "inventory",
    title: "Inventory risk detected",
    summary: input.reason,
    triggerType: "depletion_projection",
    triggerReference: input.item.id,
    autonomyLevel: 2,
    confidence: input.confidence ?? null,
    status: "monitoring",
    requiresAttention: true,
    attentionDeadline: input.attentionDeadline ?? null,
    relatedEntityType: "inventory_item",
    relatedEntityId: input.item.id,
    sequenceId: input.sequenceId ?? null,
    sourceSystems: ["mise", "inventory", "pos"],
    evidenceReferences: [
      {
        type: "inventory_item",
        id: input.item.id,
        summary: `${input.item.item_name} projected at ${input.projectedQuantity} ${input.item.unit}`,
        observedAt: input.occurredAt
      }
    ],
    metadata: {
      itemName: input.item.item_name,
      projectedQuantity: input.projectedQuantity,
      unit: input.item.unit
    },
    idempotencyKey: `inventory_risk:${input.item.id}:${input.occurredAt.slice(0, 13)}`
  });
}

export function buildShortageResponseSequenceId(restaurantId: string, inventoryItemId: string) {
  return `seq_shortage_${requireRestaurantId(restaurantId)}_${inventoryItemId}`;
}

/** Persisted row shape matching Codex `public.activity_events`. */
export interface PersistedActivityEventRow {
  id: string;
  restaurant_id: string;
  location_id?: string | null;
  event_type: ActivityType;
  category: ActivityCategory;
  title: string;
  summary: string;
  occurred_at: string;
  recorded_at: string;
  source?: string | null;
  actor_type?: string | null;
  actor_user_id?: string | null;
  trigger_type: string;
  trigger_reference?: string | null;
  evidence_references?: ActivityEvidenceReference[] | null;
  source_systems?: string[] | null;
  action_id?: string | null;
  recommendation_id?: string | null;
  autonomy_level: AutonomyLevel | number;
  confidence?: number | null;
  status: ActivityStatus;
  requires_attention?: boolean | null;
  attention_deadline?: string | null;
  related_entity_type?: ActivityRelatedEntityType | string | null;
  related_entity_id?: string | null;
  parent_activity_id?: string | null;
  sequence_id?: string | null;
  correlation_id?: string | null;
  causation_id?: string | null;
  idempotency_key: string;
  metadata?: Record<string, unknown> | null;
  error_code?: string | null;
  error_message?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

export function activityEventFromPersistedRow(row: PersistedActivityEventRow): ActivityEvent {
  const restaurantId = requireRestaurantId(row.restaurant_id);
  const metadata = { ...(row.metadata ?? {}) };
  if (row.idempotency_key) metadata.idempotencyKey = row.idempotency_key;
  if (row.correlation_id) metadata.correlationId = row.correlation_id;
  if (row.causation_id) metadata.causationId = row.causation_id;
  if (row.source) metadata.source = row.source;
  if (row.actor_type) metadata.actorType = row.actor_type;
  if (row.actor_user_id) metadata.actorUserId = row.actor_user_id;

  const autonomy = Number(row.autonomy_level);
  if (![1, 2, 3, 4, 5].includes(autonomy)) {
    throw new Error("Activity event autonomy level is invalid.");
  }

  return {
    id: row.id,
    restaurantId,
    locationId: row.location_id ?? null,
    occurredAt: iso(row.occurred_at),
    createdAt: iso(row.recorded_at),
    activityType: row.event_type,
    category: row.category,
    title: row.title,
    summary: row.summary,
    triggerType: row.trigger_type,
    triggerReference: row.trigger_reference ?? null,
    evidenceReferences: Array.isArray(row.evidence_references) ? row.evidence_references : [],
    sourceSystems:
      Array.isArray(row.source_systems) && row.source_systems.length > 0
        ? row.source_systems
        : ["mise"],
    actionId: row.action_id ?? null,
    recommendationId: row.recommendation_id ?? null,
    autonomyLevel: autonomy as AutonomyLevel,
    confidence: clampConfidence(row.confidence),
    status: row.status,
    requiresAttention: Boolean(row.requires_attention),
    attentionDeadline: row.attention_deadline ? iso(row.attention_deadline) : null,
    relatedEntityType: (row.related_entity_type as ActivityRelatedEntityType | null) ?? null,
    relatedEntityId: row.related_entity_id ?? null,
    parentActivityId: row.parent_activity_id ?? null,
    sequenceId: row.sequence_id ?? null,
    metadata,
    errorCode: row.error_code ?? null,
    errorMessage: row.error_message ?? null,
    resolvedAt: row.resolved_at ? iso(row.resolved_at) : null,
    resolvedBy: row.resolved_by ?? null
  };
}

export function activityEventToPersistedInsert(event: ActivityEvent): PersistedActivityEventRow {
  return {
    id: event.id,
    restaurant_id: event.restaurantId,
    location_id: event.locationId,
    event_type: event.activityType,
    category: event.category,
    title: event.title,
    summary: event.summary,
    occurred_at: event.occurredAt,
    recorded_at: event.createdAt,
    source: typeof event.metadata.source === "string" ? event.metadata.source : "mise",
    actor_type: typeof event.metadata.actorType === "string" ? event.metadata.actorType : "mise",
    actor_user_id:
      typeof event.metadata.actorUserId === "string" ? event.metadata.actorUserId : null,
    trigger_type: event.triggerType,
    trigger_reference: event.triggerReference,
    evidence_references: event.evidenceReferences,
    source_systems: event.sourceSystems,
    action_id: event.actionId,
    recommendation_id: event.recommendationId,
    autonomy_level: event.autonomyLevel,
    confidence: event.confidence,
    status: event.status,
    requires_attention: event.requiresAttention,
    attention_deadline: event.attentionDeadline,
    related_entity_type: event.relatedEntityType,
    related_entity_id: event.relatedEntityId,
    parent_activity_id: event.parentActivityId,
    sequence_id: event.sequenceId,
    idempotency_key: activityIdempotencyKey(event),
    metadata: event.metadata,
    error_code: event.errorCode,
    error_message: event.errorMessage,
    resolved_at: event.resolvedAt,
    resolved_by: event.resolvedBy
  };
}

/** Helper for tests and projections that need a sales-backed forecast update event. */
export function fromForecastUpdated(input: {
  restaurantId: string;
  occurredAt: string;
  operatingDate: string;
  sales: readonly PosSale[];
  deltaPercent?: number | null;
}): ActivityEvent {
  const todaySales = input.sales.filter(
    (sale) => sale.restaurant_id === input.restaurantId && sale.sale_date === input.operatingDate
  );
  const itemsSold = todaySales.reduce((sum, sale) => sum + sale.quantity_sold, 0);
  const delta =
    input.deltaPercent !== null && input.deltaPercent !== undefined && Number.isFinite(input.deltaPercent)
      ? Math.round(input.deltaPercent)
      : null;
  return buildEvent({
    restaurantId: input.restaurantId,
    occurredAt: input.occurredAt,
    activityType: "forecast_updated",
    category: "sales",
    title: "Forecast updated",
    summary:
      delta === null
        ? `Demand forecast refreshed using ${itemsSold} sold units on ${input.operatingDate}.`
        : `Lunch demand is expected to be ${Math.abs(delta)}% ${delta >= 0 ? "higher" : "lower"} than the comparison window.`,
    triggerType: "sales_history",
    triggerReference: input.operatingDate,
    autonomyLevel: 4,
    status: "completed",
    sourceSystems: ["mise", "pos"],
    metadata: {
      operatingDate: input.operatingDate,
      itemsSold,
      deltaPercent: delta
    },
    idempotencyKey: `forecast_updated:${input.restaurantId}:${input.operatingDate}:${input.occurredAt.slice(0, 13)}`
  });
}

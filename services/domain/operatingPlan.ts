import type {
  PurchaseRecommendation,
  RestaurantOperationalProfile,
  SupplierOrder
} from "../../types/mise";
import type { ActivityEvent } from "./activityEvents";
import type {
  RestaurantTask,
  RestaurantTaskServiceWindow,
  RestaurantTaskVerificationMethod
} from "./restaurantTasks";
import { visibleRestaurantTasksForToday } from "./restaurantTasks";
import {
  classifyOperationalTodayTaskTiming,
  DEFAULT_TODAY_TASK_DUE_SOON_WINDOW_MS,
  type OperationalTodayTask,
  type OperationalTodayTaskActionIntent,
  type OperationalTodayTaskPriority,
  type OperationalTodayTaskTiming
} from "./todayTasks";

/**
 * Deterministic Daily Operating Plan projection.
 * Composes authoritative Today tasks, orders, recommendations, and activity.
 * Never fabricates staffing, weather, reservations, or unverified cutoffs.
 */
export type OperatingPlanItemKind =
  | "mise_task"
  | "human_task"
  | "approval"
  | "observation"
  | "monitoring"
  | "completed"
  | "failed";

export type ServiceWindowId =
  | "before_prep"
  | "before_lunch"
  | "before_supplier_cutoff"
  | "before_dinner"
  | "during_service"
  | "closing"
  | "end_of_day"
  | "unscheduled";

export type OperatingPlanBucket = "now" | "up_next" | "later" | "done";

export type VerificationMethod = "count" | "review" | "receipt" | "provider_sync" | "none";
export type OperatingPlanPriority = OperationalTodayTaskPriority | "low";

export type OperatingPlanRelatedEntityType =
  | "inventory_item"
  | "purchase_recommendation"
  | "supplier_order"
  | "insight"
  | "pos_integration"
  | "setup_step"
  | "task";

export type ReprioritizationCode =
  | "overdue_deadline"
  | "delivery_overdue"
  | "delivery_due_today"
  | "due_soon"
  | "stock_risk"
  | "provider_failure";

export interface OperatingPlanRelatedRef {
  type: OperatingPlanRelatedEntityType;
  id: string;
}

export interface ServiceWindowDescriptor {
  id: ServiceWindowId;
  /** Locale-neutral label key fragment; UI localizes via presentation/i18n. */
  labelCode: `operatingPlan.window.${ServiceWindowId}`;
  /** Evidence from operational profile or null when only structural. */
  evidence: string | null;
}

export interface OperatingPlanItem {
  id: string;
  restaurantId: string;
  kind: OperatingPlanItemKind;
  title: string;
  detail: string;
  why: string;
  neededBy: string | null;
  effect: string;
  serviceWindow: ServiceWindowId;
  bucket: OperatingPlanBucket;
  priority: OperatingPlanPriority;
  relatedRefs: OperatingPlanRelatedRef[];
  dependencyIds: string[];
  verificationMethod: VerificationMethod;
  /** Only populated from real source/activity state when the item is completed. */
  completionResult: string | null;
  reprioritization: {
    code: ReprioritizationCode;
    reason: string;
  } | null;
  requiredRole: "member" | "manager" | "owner_admin";
  status: "open" | "completed";
  sourceTask: OperationalTodayTask | null;
  sourceRestaurantTask: RestaurantTask | null;
}

export interface DailyOperatingPlan {
  restaurantId: string;
  operatingDate: string;
  restaurantTimeZone: string;
  generatedAt: string;
  serviceWindows: ServiceWindowDescriptor[];
  items: OperatingPlanItem[];
  buckets: Record<OperatingPlanBucket, OperatingPlanItem[]>;
}

export interface BuildDailyOperatingPlanInput {
  restaurantId: string;
  restaurantTimeZone: string;
  operatingDate: string;
  prepWindows?: readonly string[];
  tasks: readonly OperationalTodayTask[];
  orders?: readonly SupplierOrder[];
  recommendations?: readonly PurchaseRecommendation[];
  activityEvents?: readonly ActivityEvent[];
  centralTasks?: readonly RestaurantTask[];
  now?: Date;
  dueSoonWindowMs?: number;
}

const WINDOW_ORDER: readonly ServiceWindowId[] = [
  "before_prep",
  "before_lunch",
  "before_supplier_cutoff",
  "before_dinner",
  "during_service",
  "closing",
  "end_of_day",
  "unscheduled"
];

const BUCKET_ORDER: readonly OperatingPlanBucket[] = ["now", "up_next", "later", "done"];

export function buildDailyOperatingPlan(input: BuildDailyOperatingPlanInput): DailyOperatingPlan {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("A restaurant is required to build an operating plan.");
  if (!validDateKey(input.operatingDate)) {
    throw new Error("Operating plan requires a valid operating date.");
  }

  const now = validNow(input.now);
  const dueSoonWindowMs = validDueSoonWindow(input.dueSoonWindowMs);
  const sortOptions = {
    restaurantTimeZone: input.restaurantTimeZone,
    now,
    dueSoonWindowMs
  };

  const orders = (input.orders ?? []).filter((order) => order.restaurant_id === restaurantId);
  const recommendations = (input.recommendations ?? []).filter(
    (recommendation) => recommendation.restaurant_id === restaurantId
  );
  const activityEvents = (input.activityEvents ?? []).filter(
    (event) => event.restaurantId === restaurantId
  );
  const tasks = input.tasks.filter((task) => task.restaurantId === restaurantId);
  const centralTasks = visibleRestaurantTasksForToday(input.centralTasks ?? [], {
    includeCompleted: true
  }).filter((task) => task.restaurantId === restaurantId);

  const orderById = new Map(orders.map((order) => [order.id, order]));
  const recommendationById = new Map(recommendations.map((recommendation) => [recommendation.id, recommendation]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const serviceWindows = buildServiceWindowDescriptors(input.prepWindows ?? []);
  const localHour = hourInTimeZone(now, input.restaurantTimeZone);
  const currentWindow = currentServiceWindow(localHour);

  const draftItems = tasks.map((task) => {
    const timing = classifyOperationalTodayTaskTiming(task, sortOptions);
    const order = task.source.kind === "order" ? orderById.get(task.source.id) ?? null : null;
    const recommendation =
      task.source.kind === "recommendation" ? recommendationById.get(task.source.id) ?? null : null;
    const kind = kindForTask(task);
    const why = whyForTask(task, recommendation, order);
    const neededBy = neededByForTask(task, order);
    const effect = effectForIntent(task.action.intent, task);
    const verificationMethod = verificationForIntent(task.action.intent);
    const relatedRefs = relatedRefsForTask(task);
    const dependencyIds = dependencyIdsForTask(task, taskById, recommendations);
    const completionResult =
      task.status === "completed" ? completionResultForTask(task, activityEvents) : null;
    const serviceWindow = assignServiceWindow(task, timing, currentWindow, order);
    const reprioritization = reprioritizationForTask({
      task,
      timing,
      order,
      recommendation,
      operatingDate: input.operatingDate,
      now,
      dueSoonWindowMs
    });
    const bucket = bucketForItem(task, timing, reprioritization);

    return {
      id: task.id,
      restaurantId,
      kind,
      title: task.title,
      detail: task.detail,
      why,
      neededBy,
      effect,
      serviceWindow,
      bucket,
      priority: task.priority,
      relatedRefs,
      dependencyIds,
      verificationMethod,
      completionResult,
      reprioritization,
      requiredRole: task.requiredRole,
      status: task.status === "completed" ? "completed" : "open",
      sourceTask: task,
      sourceRestaurantTask: null
    } satisfies OperatingPlanItem;
  });

  const centralItems = centralTasks.map((task) =>
    operatingPlanItemFromRestaurantTask(task, {
      now,
      dueSoonWindowMs,
      currentWindow
    })
  );

  const items = sortPlanItems([...draftItems, ...centralItems], sortOptions);

  const buckets: Record<OperatingPlanBucket, OperatingPlanItem[]> = {
    now: [],
    up_next: [],
    later: [],
    done: []
  };
  for (const item of items) {
    buckets[item.bucket].push(item);
  }

  return {
    restaurantId,
    operatingDate: input.operatingDate,
    restaurantTimeZone: input.restaurantTimeZone,
    generatedAt: now.toISOString(),
    serviceWindows,
    items,
    buckets
  };
}

function operatingPlanItemFromRestaurantTask(
  task: RestaurantTask,
  options: { now: Date; dueSoonWindowMs: number; currentWindow: ServiceWindowId }
): OperatingPlanItem {
  const completed = task.status === "completed";
  const timing = centralTaskTiming(task, options.now, options.dueSoonWindowMs);
  const reprioritization = centralTaskReprioritization(task, timing);
  const bucket: OperatingPlanBucket = completed
    ? "done"
    : reprioritization
      ? "now"
      : task.status === "blocked"
        ? "later"
        : timing === "overdue" || timing === "due_soon" || task.timingBucket === "now"
          ? "now"
          : timing === "today" || task.timingBucket === "up_next"
            ? "up_next"
            : "later";
  return {
    id: task.id,
    restaurantId: task.restaurantId,
    kind: restaurantTaskKind(task),
    title: task.title,
    detail: task.detail ?? task.title,
    why:
      task.detail ??
      (task.origin === "human"
        ? "A restaurant operator added this work to the shared operating plan."
        : "This shared restaurant task is ready for an authorized team member."),
    neededBy: task.dueAt ?? task.windowEnd,
    effect: "Records a restaurant-wide result that authorized team members can verify.",
    serviceWindow: serviceWindowForRestaurantTask(task.serviceWindow, options.currentWindow),
    bucket,
    priority: task.priority,
    relatedRefs: relatedRefsForRestaurantTask(task),
    dependencyIds: task.dependencyIds,
    verificationMethod: verificationForRestaurantTask(task.verificationMethod),
    completionResult: completed ? task.completionResult : null,
    reprioritization,
    requiredRole: task.requiredRole,
    status: completed ? "completed" : "open",
    sourceTask: null,
    sourceRestaurantTask: task
  };
}

function restaurantTaskKind(task: RestaurantTask): OperatingPlanItemKind {
  if (task.status === "completed") return "completed";
  if (task.status === "could_not_verify") return "failed";
  if (task.origin === "human") return "human_task";
  if (task.origin === "approval") return "approval";
  if (task.origin === "automated") return "monitoring";
  return "mise_task";
}

function centralTaskTiming(
  task: RestaurantTask,
  now: Date,
  dueSoonWindowMs: number
): OperationalTodayTaskTiming {
  if (!task.dueAt && !task.windowEnd) return "unscheduled";
  const due = Date.parse(task.dueAt ?? task.windowEnd!);
  if (!Number.isFinite(due)) return "unscheduled";
  if (due < now.getTime()) return "overdue";
  if (due - now.getTime() <= dueSoonWindowMs) return "due_soon";
  return task.timingBucket === "later" ? "later" : "today";
}

function centralTaskReprioritization(
  task: RestaurantTask,
  timing: OperationalTodayTaskTiming
): OperatingPlanItem["reprioritization"] {
  if (task.status === "completed") return null;
  if (task.status === "could_not_verify") {
    return {
      code: "provider_failure",
      reason: "Verification failed, so this shared task moved into Now for review."
    };
  }
  if (timing === "overdue") {
    return { code: "overdue_deadline", reason: "The shared task deadline is overdue." };
  }
  if (timing === "due_soon") {
    return { code: "due_soon", reason: "The shared task deadline falls inside the due-soon window." };
  }
  return null;
}

function serviceWindowForRestaurantTask(
  serviceWindow: RestaurantTaskServiceWindow | null,
  currentWindow: ServiceWindowId
): ServiceWindowId {
  if (!serviceWindow) return currentWindow;
  if (serviceWindow === "before_dinner_service") return "before_dinner";
  if (serviceWindow === "during_closing") return "closing";
  if (serviceWindow === "custom") return currentWindow;
  return serviceWindow;
}

function verificationForRestaurantTask(
  method: RestaurantTaskVerificationMethod
): VerificationMethod {
  if (method === "count") return "count";
  if (method === "receipt" || method === "photo") return "receipt";
  if (method === "source_state") return "provider_sync";
  if (method === "none") return "none";
  return "review";
}

function relatedRefsForRestaurantTask(task: RestaurantTask): OperatingPlanRelatedRef[] {
  const refs: OperatingPlanRelatedRef[] = [{ type: "task", id: task.id }];
  if (task.relatedInventoryItemId) refs.push({ type: "inventory_item", id: task.relatedInventoryItemId });
  if (task.relatedRecommendationId) refs.push({ type: "purchase_recommendation", id: task.relatedRecommendationId });
  if (task.relatedOrderId) refs.push({ type: "supplier_order", id: task.relatedOrderId });
  return refs;
}

export function buildServiceWindowDescriptors(
  prepWindows: readonly string[]
): ServiceWindowDescriptor[] {
  const evidenceByWindow = evidenceFromPrepWindows(prepWindows);
  return WINDOW_ORDER.map((id) => ({
    id,
    labelCode: `operatingPlan.window.${id}` as const,
    evidence: evidenceByWindow.get(id) ?? null
  }));
}

export function currentServiceWindow(localHour: number): ServiceWindowId {
  if (!Number.isFinite(localHour)) return "unscheduled";
  if (localHour < 10) return "before_prep";
  if (localHour < 14) return "before_lunch";
  if (localHour < 17) return "before_dinner";
  if (localHour < 21) return "during_service";
  return "closing";
}

export function hourInTimeZone(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23"
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    if (Number.isFinite(hour)) return hour;
  } catch {
    // Invalid timezones fall through to UTC.
  }
  return date.getUTCHours();
}

function evidenceFromPrepWindows(prepWindows: readonly string[]): Map<ServiceWindowId, string> {
  const evidence = new Map<ServiceWindowId, string>();
  for (const raw of prepWindows) {
    const token = raw.trim().toLocaleLowerCase("en-US");
    if (!token) continue;
    const windowId = parsePrepWindowToken(token);
    if (!windowId) continue;
    const existing = evidence.get(windowId);
    evidence.set(windowId, existing ? `${existing}; ${raw.trim()}` : raw.trim());
  }
  return evidence;
}

function parsePrepWindowToken(token: string): ServiceWindowId | null {
  if (token === "am" || token.includes("prep") || token.includes("morning")) return "before_prep";
  if (token.includes("lunch") || token === "midday") return "before_lunch";
  if (token.includes("dinner") || token === "pm" || token.includes("evening")) return "before_dinner";
  if (token.includes("service") || token.includes("rush")) return "during_service";
  if (token.includes("close") || token.includes("closing") || token.includes("end of day")) {
    return "closing";
  }
  return null;
}

function kindForTask(task: OperationalTodayTask): OperatingPlanItemKind {
  if (task.status === "completed") return "completed";
  if (task.source.kind === "integration" && task.source.status === "error") return "failed";
  if (task.action.intent === "review_recommendation") return "approval";
  if (task.action.intent === "update_inventory_count") return "human_task";
  if (task.action.intent === "review_insight") return "observation";
  if (
    task.action.intent === "manage_pos_connection" ||
    task.action.intent === "connect_pos" ||
    task.action.intent === "repair_pos_connection"
  ) {
    return task.source.status === "connected" ? "monitoring" : "mise_task";
  }
  return "mise_task";
}

function whyForTask(
  task: OperationalTodayTask,
  recommendation: PurchaseRecommendation | null,
  order: SupplierOrder | null
) {
  if (recommendation?.reason?.trim()) return recommendation.reason.trim();
  if (order?.delivery_date && validDateKey(order.delivery_date)) {
    return `Supplier delivery is scheduled for ${order.delivery_date}.`;
  }
  if (task.detail.trim()) return task.detail.trim();
  return task.completion.reason;
}

function neededByForTask(task: OperationalTodayTask, order: SupplierOrder | null): string | null {
  if (task.dueAt) return task.dueAt;
  if (task.dueDate) return task.dueDate;
  if (order?.delivery_date && validDateKey(order.delivery_date)) return order.delivery_date;
  return null;
}

function effectForIntent(intent: OperationalTodayTaskActionIntent, task: OperationalTodayTask) {
  if (intent === "update_inventory_count") {
    return "Confirms on-hand stock before service depletes coverage further.";
  }
  if (intent === "review_recommendation") {
    return "Keeps reorder decisions operator-approved before any supplier draft moves.";
  }
  if (intent === "prepare_supplier_draft") {
    return "Builds an approved supplier draft that still requires send approval.";
  }
  if (intent === "send_supplier_order") {
    return task.source.status === "draft"
      ? "Moves an approved draft to the supplier only after explicit send approval."
      : "Keeps the sent or completed supplier order visible for delivery follow-through.";
  }
  if (intent === "finish_setup") {
    return "Closes the setup gap that blocks reliable operational projections.";
  }
  if (intent === "connect_pos" || intent === "manage_pos_connection" || intent === "repair_pos_connection") {
    return "Restores trustworthy sales signal freshness for depletion and recommendations.";
  }
  if (intent === "review_insight") {
    return "Surfaces an active restaurant insight for operator review.";
  }
  return task.detail;
}

function verificationForIntent(intent: OperationalTodayTaskActionIntent): VerificationMethod {
  if (intent === "update_inventory_count") return "count";
  if (intent === "send_supplier_order") return "receipt";
  if (
    intent === "connect_pos" ||
    intent === "manage_pos_connection" ||
    intent === "repair_pos_connection"
  ) {
    return "provider_sync";
  }
  if (
    intent === "review_recommendation" ||
    intent === "prepare_supplier_draft" ||
    intent === "review_insight" ||
    intent === "finish_setup"
  ) {
    return "review";
  }
  return "none";
}

function relatedRefsForTask(task: OperationalTodayTask): OperatingPlanRelatedRef[] {
  const refs: OperatingPlanRelatedRef[] = [];
  if (task.source.kind === "inventory") {
    refs.push({ type: "inventory_item", id: task.source.id });
  } else if (task.source.kind === "recommendation") {
    refs.push({ type: "purchase_recommendation", id: task.source.id });
  } else if (task.source.kind === "order") {
    refs.push({ type: "supplier_order", id: task.source.id });
  } else if (task.source.kind === "insight") {
    refs.push({ type: "insight", id: task.source.id });
  } else if (task.source.kind === "integration") {
    refs.push({ type: "pos_integration", id: task.source.id });
  } else if (task.source.kind === "setup") {
    refs.push({ type: "setup_step", id: task.source.id });
  }
  if (task.action.entityId && !refs.some((ref) => ref.id === task.action.entityId)) {
    if (task.action.intent === "send_supplier_order") {
      refs.push({ type: "supplier_order", id: task.action.entityId });
    } else if (task.action.intent === "update_inventory_count") {
      refs.push({ type: "inventory_item", id: task.action.entityId });
    } else if (
      task.action.intent === "review_recommendation" ||
      task.action.intent === "prepare_supplier_draft"
    ) {
      refs.push({ type: "purchase_recommendation", id: task.action.entityId });
    }
  }
  return refs;
}

function dependencyIdsForTask(
  task: OperationalTodayTask,
  taskById: Map<string, OperationalTodayTask>,
  recommendations: readonly PurchaseRecommendation[]
): string[] {
  const deps: string[] = [];

  if (task.action.intent === "prepare_supplier_draft" && task.source.kind === "recommendation") {
    const reviewId = `today:recommendation:${encodeURIComponent(task.source.id)}:review_recommendation`;
    if (taskById.has(reviewId)) deps.push(reviewId);
  }

  if (task.action.intent === "send_supplier_order" && task.source.kind === "order") {
    const linked = recommendations.find(
      (recommendation) => recommendation.supplier_order_id === task.source.id
    );
    if (linked) {
      const prepareId = `today:recommendation:${encodeURIComponent(linked.id)}:prepare_supplier_draft`;
      if (taskById.has(prepareId)) deps.push(prepareId);
      const reviewId = `today:recommendation:${encodeURIComponent(linked.id)}:review_recommendation`;
      if (taskById.has(reviewId)) deps.push(reviewId);
    }
  }

  return deps;
}

function completionResultForTask(
  task: OperationalTodayTask,
  activityEvents: readonly ActivityEvent[]
): string {
  const matched = activityEvents
    .filter((event) => activityMatchesTask(event, task))
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))[0];
  if (matched?.summary?.trim()) return matched.summary.trim();
  if (matched?.title?.trim()) return matched.title.trim();
  return task.completion.reason;
}

function activityMatchesTask(event: ActivityEvent, task: OperationalTodayTask) {
  if (event.relatedEntityId && event.relatedEntityId === task.source.id) return true;
  if (event.triggerReference && event.triggerReference === task.source.id) return true;
  return event.evidenceReferences.some((evidence) => evidence.id === task.source.id);
}

function assignServiceWindow(
  task: OperationalTodayTask,
  timing: OperationalTodayTaskTiming,
  currentWindow: ServiceWindowId,
  order: SupplierOrder | null
): ServiceWindowId {
  if (task.status === "completed") return "closing";
  if (task.action.intent === "update_inventory_count") return "before_prep";
  if (task.action.intent === "review_recommendation") {
    return task.priority === "urgent" ? "before_prep" : "before_lunch";
  }
  if (task.action.intent === "prepare_supplier_draft") return "before_lunch";
  if (task.action.intent === "send_supplier_order") {
    if (order?.delivery_date && timing === "overdue") return "before_prep";
    return currentWindow === "before_dinner" || currentWindow === "during_service"
      ? "before_dinner"
      : "before_lunch";
  }
  if (task.action.intent === "review_insight") return "during_service";
  if (
    task.action.intent === "finish_setup" ||
    task.action.intent === "connect_pos" ||
    task.action.intent === "manage_pos_connection" ||
    task.action.intent === "repair_pos_connection"
  ) {
    return task.priority === "urgent" ? currentWindow : "unscheduled";
  }
  if (timing === "later") return "unscheduled";
  return currentWindow;
}

function reprioritizationForTask(input: {
  task: OperationalTodayTask;
  timing: OperationalTodayTaskTiming;
  order: SupplierOrder | null;
  recommendation: PurchaseRecommendation | null;
  operatingDate: string;
  now: Date;
  dueSoonWindowMs: number;
}): OperatingPlanItem["reprioritization"] {
  const { task, timing, order, recommendation, operatingDate } = input;
  if (task.status === "completed") return null;

  if (task.source.kind === "integration" && task.source.status === "error") {
    return {
      code: "provider_failure",
      reason: "Sales connection reports an error and was moved into Now."
    };
  }

  if (order?.delivery_date && validDateKey(order.delivery_date)) {
    if (order.delivery_date < operatingDate && order.status !== "completed") {
      return {
        code: "delivery_overdue",
        reason: `Delivery date ${order.delivery_date} is past operating date ${operatingDate}.`
      };
    }
    if (order.delivery_date === operatingDate && order.status === "draft") {
      return {
        code: "delivery_due_today",
        reason: `Supplier delivery is needed today (${order.delivery_date}).`
      };
    }
  }

  if (timing === "overdue") {
    return {
      code: "overdue_deadline",
      reason: "An evidenced deadline is already overdue."
    };
  }

  if (timing === "due_soon") {
    return {
      code: "due_soon",
      reason: "An evidenced deadline falls inside the due-soon window."
    };
  }

  if (
    task.priority === "urgent" &&
    (task.source.kind === "inventory" ||
      recommendation?.urgency === "high" ||
      task.action.intent === "update_inventory_count")
  ) {
    return {
      code: "stock_risk",
      reason: "Projected stock risk requires attention before the next service window."
    };
  }

  return null;
}

function bucketForItem(
  task: OperationalTodayTask,
  timing: OperationalTodayTaskTiming,
  reprioritization: OperatingPlanItem["reprioritization"]
): OperatingPlanBucket {
  if (task.status === "completed") return "done";
  if (reprioritization) return "now";
  if (timing === "overdue" || timing === "due_soon") return "now";
  if (timing === "today") return "up_next";
  return "later";
}

function sortPlanItems(
  items: readonly OperatingPlanItem[],
  options: { restaurantTimeZone: string; now: Date; dueSoonWindowMs: number }
): OperatingPlanItem[] {
  const bucketRank: Record<OperatingPlanBucket, number> = {
    now: 0,
    up_next: 1,
    later: 2,
    done: 3
  };
  const windowRank = new Map(WINDOW_ORDER.map((id, index) => [id, index]));
  const priorityRank: Record<OperatingPlanPriority, number> = {
    urgent: 0,
    high: 1,
    normal: 2,
    low: 3
  };

  return [...items].sort((left, right) => {
    const bucketDelta = bucketRank[left.bucket] - bucketRank[right.bucket];
    if (bucketDelta !== 0) return bucketDelta;
    const windowDelta = (windowRank.get(left.serviceWindow) ?? 99) - (windowRank.get(right.serviceWindow) ?? 99);
    if (windowDelta !== 0) return windowDelta;
    const priorityDelta = priorityRank[left.priority] - priorityRank[right.priority];
    if (priorityDelta !== 0) return priorityDelta;
    const leftTiming = timingForPlanItem(left, options);
    const rightTiming = timingForPlanItem(right, options);
    const timingRank: Record<OperationalTodayTaskTiming, number> = {
      overdue: 0,
      due_soon: 1,
      today: 2,
      later: 3,
      unscheduled: 4
    };
    const timingDelta = timingRank[leftTiming] - timingRank[rightTiming];
    if (timingDelta !== 0) return timingDelta;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

function timingForPlanItem(
  item: OperatingPlanItem,
  options: { restaurantTimeZone: string; now: Date; dueSoonWindowMs: number }
): OperationalTodayTaskTiming {
  if (item.sourceTask) return classifyOperationalTodayTaskTiming(item.sourceTask, options);
  if (item.sourceRestaurantTask) {
    return centralTaskTiming(item.sourceRestaurantTask, options.now, options.dueSoonWindowMs);
  }
  return "unscheduled";
}

function validNow(value: Date | undefined) {
  const now = value ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Operating plan requires a valid current time.");
  return now;
}

function validDueSoonWindow(value: number | undefined) {
  if (value === undefined) return DEFAULT_TODAY_TASK_DUE_SOON_WINDOW_MS;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Operating plan due-soon window must be a non-negative duration.");
  }
  return value;
}

function validDateKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Helper for application layers that already have an operational profile. */
export function prepWindowsFromProfile(
  profile: Pick<RestaurantOperationalProfile, "prepWindows"> | null | undefined
): string[] {
  return [...(profile?.prepWindows ?? [])];
}

export function operatingPlanBucketOrder(): readonly OperatingPlanBucket[] {
  return BUCKET_ORDER;
}

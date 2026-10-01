export type RestaurantTaskOrigin =
  | "human"
  | "mise"
  | "automated"
  | "approval"
  | "verification";

export type RestaurantTaskCategory =
  | "inventory"
  | "orders"
  | "prep"
  | "service"
  | "team"
  | "cleaning"
  | "maintenance"
  | "deliveries"
  | "closing"
  | "integrations"
  | "other";

export type RestaurantTaskPriority = "urgent" | "high" | "normal" | "low";
export type RestaurantTaskStatus =
  | "waiting"
  | "blocked"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "could_not_verify";
export type RestaurantTaskTimingBucket = "now" | "up_next" | "later";
export type RestaurantTaskServiceWindow =
  | "before_lunch"
  | "before_prep"
  | "before_supplier_cutoff"
  | "before_dinner_service"
  | "during_closing"
  | "end_of_day"
  | "custom";
export type RestaurantTaskRequiredRole = "member" | "manager" | "owner_admin";
export type RestaurantTaskVerificationMethod =
  | "none"
  | "checklist"
  | "photo"
  | "count"
  | "receipt"
  | "manager_review"
  | "source_state";

export interface RestaurantTaskEvidence {
  type?: string;
  label?: string;
  [key: string]: unknown;
}

export interface RestaurantTask {
  id: string;
  restaurantId: string;
  locationId: string | null;
  origin: RestaurantTaskOrigin;
  title: string;
  detail: string | null;
  operationalCategory: RestaurantTaskCategory;
  priority: RestaurantTaskPriority;
  status: RestaurantTaskStatus;
  timingBucket: RestaurantTaskTimingBucket;
  dueAt: string | null;
  serviceWindow: RestaurantTaskServiceWindow | null;
  windowStart: string | null;
  windowEnd: string | null;
  requiredRole: RestaurantTaskRequiredRole;
  assigneeUserId: string | null;
  verificationMethod: RestaurantTaskVerificationMethod;
  verificationRequired: boolean;
  checklist: RestaurantTaskEvidence[];
  completionResult: string | null;
  completionEvidence: RestaurantTaskEvidence[];
  completedAt: string | null;
  completedBy: string | null;
  relatedInventoryItemId: string | null;
  relatedOrderId: string | null;
  relatedRecommendationId: string | null;
  relatedSupplierName: string | null;
  sourceReference: string | null;
  createdBy: string;
  clientTaskId: string;
  correlationId: string;
  dependencyIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PersistedRestaurantTaskRow {
  id: string;
  restaurant_id: string;
  location_id: string | null;
  origin: string;
  title: string;
  detail: string | null;
  operational_category: string;
  priority: string;
  status: string;
  timing_bucket: string;
  due_at: string | null;
  service_window: string | null;
  window_start: string | null;
  window_end: string | null;
  required_role: string;
  assignee_user_id: string | null;
  verification_method: string;
  verification_required: boolean;
  checklist: unknown;
  completion_result: string | null;
  completion_evidence: unknown;
  completed_at: string | null;
  completed_by: string | null;
  related_inventory_item_id: string | null;
  related_order_id: string | null;
  related_recommendation_id: string | null;
  related_supplier_name: string | null;
  source_reference: string | null;
  created_by: string;
  client_task_id: string;
  correlation_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRestaurantTaskInput {
  restaurantId: string;
  clientTaskId: string;
  title: string;
  detail?: string | null;
  origin?: RestaurantTaskOrigin;
  operationalCategory?: RestaurantTaskCategory;
  priority?: RestaurantTaskPriority;
  timingBucket?: RestaurantTaskTimingBucket;
  dueAt?: string | null;
  serviceWindow?: RestaurantTaskServiceWindow | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  requiredRole?: RestaurantTaskRequiredRole;
  assigneeUserId?: string | null;
  verificationMethod?: RestaurantTaskVerificationMethod;
  checklist?: RestaurantTaskEvidence[];
  relatedInventoryItemId?: string | null;
  relatedOrderId?: string | null;
  relatedRecommendationId?: string | null;
  relatedSupplierName?: string | null;
  sourceReference?: string | null;
  dependencyIds?: string[];
}

export interface CompleteRestaurantTaskInput {
  restaurantId: string;
  taskId: string;
  completionResult: string;
  completionEvidence?: RestaurantTaskEvidence[];
}

export interface RescheduleRestaurantTaskInput {
  restaurantId: string;
  taskId: string;
  timingBucket: RestaurantTaskTimingBucket;
  dueAt?: string | null;
}

const origins = new Set<RestaurantTaskOrigin>(["human", "mise", "automated", "approval", "verification"]);
const categories = new Set<RestaurantTaskCategory>([
  "inventory", "orders", "prep", "service", "team", "cleaning", "maintenance",
  "deliveries", "closing", "integrations", "other"
]);
const priorities = new Set<RestaurantTaskPriority>(["urgent", "high", "normal", "low"]);
const statuses = new Set<RestaurantTaskStatus>([
  "waiting", "blocked", "in_progress", "completed", "cancelled", "could_not_verify"
]);
const timingBuckets = new Set<RestaurantTaskTimingBucket>(["now", "up_next", "later"]);
const serviceWindows = new Set<RestaurantTaskServiceWindow>([
  "before_lunch", "before_prep", "before_supplier_cutoff", "before_dinner_service",
  "during_closing", "end_of_day", "custom"
]);
const requiredRoles = new Set<RestaurantTaskRequiredRole>(["member", "manager", "owner_admin"]);
const verificationMethods = new Set<RestaurantTaskVerificationMethod>([
  "none", "checklist", "photo", "count", "receipt", "manager_review", "source_state"
]);

export function normalizeCreateRestaurantTaskInput(
  input: CreateRestaurantTaskInput
): Required<Omit<CreateRestaurantTaskInput,
  "detail" | "dueAt" | "serviceWindow" | "windowStart" | "windowEnd" |
  "assigneeUserId" | "relatedInventoryItemId" | "relatedOrderId" |
  "relatedRecommendationId" | "relatedSupplierName" | "sourceReference">> & {
    detail: string | null;
    dueAt: string | null;
    serviceWindow: RestaurantTaskServiceWindow | null;
    windowStart: string | null;
    windowEnd: string | null;
    assigneeUserId: string | null;
    relatedInventoryItemId: string | null;
    relatedOrderId: string | null;
    relatedRecommendationId: string | null;
    relatedSupplierName: string | null;
    sourceReference: string | null;
  } {
  const restaurantId = requiredText(input.restaurantId, 200, "Restaurant id");
  const clientTaskId = requiredText(input.clientTaskId, 200, "Client task id");
  const title = requiredText(input.title, 160, "Task title");
  const detail = optionalText(input.detail, 2000, "Task detail");
  const origin = input.origin ?? "human";
  const operationalCategory = input.operationalCategory ?? "other";
  const priority = input.priority ?? "normal";
  const timingBucket = input.timingBucket ?? "now";
  const serviceWindow = input.serviceWindow ?? null;
  const requiredRole = input.requiredRole ?? "member";
  const verificationMethod = input.verificationMethod ?? "none";
  if (!origins.has(origin)) throw new Error("Task origin is invalid.");
  if (!categories.has(operationalCategory)) throw new Error("Task category is invalid.");
  if (!priorities.has(priority)) throw new Error("Task priority is invalid.");
  if (!timingBuckets.has(timingBucket)) throw new Error("Task timing is invalid.");
  if (serviceWindow !== null && !serviceWindows.has(serviceWindow)) throw new Error("Task service window is invalid.");
  if (!requiredRoles.has(requiredRole)) throw new Error("Task required role is invalid.");
  if (!verificationMethods.has(verificationMethod)) throw new Error("Task verification method is invalid.");

  const dueAt = optionalIso(input.dueAt, "Task due time");
  const windowStart = optionalIso(input.windowStart, "Task window start");
  const windowEnd = optionalIso(input.windowEnd, "Task window end");
  if ((windowStart === null) !== (windowEnd === null)) {
    throw new Error("Task windows require both a start and end.");
  }
  if (windowStart && windowEnd && Date.parse(windowEnd) <= Date.parse(windowStart)) {
    throw new Error("Task window end must be after its start.");
  }
  if (serviceWindow === "custom" && !windowStart) {
    throw new Error("Custom task windows require start and end times.");
  }

  const checklist = boundedEvidence(input.checklist ?? [], "Task checklist");
  const dependencyIds = [...new Set((input.dependencyIds ?? []).map((id) => requiredText(id, 200, "Dependency id")))];
  if (dependencyIds.length > 32) throw new Error("Task dependencies exceed the supported limit.");

  return {
    restaurantId,
    clientTaskId,
    title,
    detail,
    origin,
    operationalCategory,
    priority,
    timingBucket,
    dueAt,
    serviceWindow,
    windowStart,
    windowEnd,
    requiredRole,
    assigneeUserId: optionalText(input.assigneeUserId, 200, "Task assignee"),
    verificationMethod,
    checklist,
    relatedInventoryItemId: optionalText(input.relatedInventoryItemId, 200, "Related inventory item"),
    relatedOrderId: optionalText(input.relatedOrderId, 200, "Related order"),
    relatedRecommendationId: optionalText(input.relatedRecommendationId, 200, "Related recommendation"),
    relatedSupplierName: optionalText(input.relatedSupplierName, 200, "Related supplier"),
    sourceReference: optionalText(input.sourceReference, 240, "Task source reference"),
    dependencyIds
  };
}

export function normalizeCompleteRestaurantTaskInput(input: CompleteRestaurantTaskInput) {
  return {
    restaurantId: requiredText(input.restaurantId, 200, "Restaurant id"),
    taskId: requiredText(input.taskId, 200, "Task id"),
    completionResult: requiredText(input.completionResult, 1000, "Completion result"),
    completionEvidence: boundedEvidence(input.completionEvidence ?? [], "Completion evidence")
  };
}

export function restaurantTaskFromPersistedRow(
  row: PersistedRestaurantTaskRow,
  dependencyIds: readonly string[] = []
): RestaurantTask {
  if (!origins.has(row.origin as RestaurantTaskOrigin)) throw new Error("Task row has an invalid origin.");
  if (!categories.has(row.operational_category as RestaurantTaskCategory)) throw new Error("Task row has an invalid category.");
  if (!priorities.has(row.priority as RestaurantTaskPriority)) throw new Error("Task row has an invalid priority.");
  if (!statuses.has(row.status as RestaurantTaskStatus)) throw new Error("Task row has an invalid status.");
  if (!timingBuckets.has(row.timing_bucket as RestaurantTaskTimingBucket)) throw new Error("Task row has invalid timing.");
  if (row.service_window !== null && !serviceWindows.has(row.service_window as RestaurantTaskServiceWindow)) {
    throw new Error("Task row has an invalid service window.");
  }
  if (!requiredRoles.has(row.required_role as RestaurantTaskRequiredRole)) throw new Error("Task row has an invalid required role.");
  if (!verificationMethods.has(row.verification_method as RestaurantTaskVerificationMethod)) {
    throw new Error("Task row has an invalid verification method.");
  }
  if (row.verification_required !== (row.verification_method !== "none")) {
    throw new Error("Task row has contradictory verification state.");
  }
  const checklist = boundedEvidence(row.checklist, "Task checklist");
  const completionEvidence = boundedEvidence(row.completion_evidence, "Completion evidence");
  if (row.status === "completed") {
    if (!row.completed_at || !row.completed_by || !row.completion_result?.trim()) {
      throw new Error("Completed task row is missing its result.");
    }
    if (row.verification_required && completionEvidence.length === 0) {
      throw new Error("Completed task row is missing verification evidence.");
    }
  }

  return {
    id: requiredText(row.id, 200, "Task id"),
    restaurantId: requiredText(row.restaurant_id, 200, "Restaurant id"),
    locationId: optionalText(row.location_id, 200, "Location id"),
    origin: row.origin as RestaurantTaskOrigin,
    title: requiredText(row.title, 160, "Task title"),
    detail: optionalText(row.detail, 2000, "Task detail"),
    operationalCategory: row.operational_category as RestaurantTaskCategory,
    priority: row.priority as RestaurantTaskPriority,
    status: row.status as RestaurantTaskStatus,
    timingBucket: row.timing_bucket as RestaurantTaskTimingBucket,
    dueAt: optionalIso(row.due_at, "Task due time"),
    serviceWindow: row.service_window as RestaurantTaskServiceWindow | null,
    windowStart: optionalIso(row.window_start, "Task window start"),
    windowEnd: optionalIso(row.window_end, "Task window end"),
    requiredRole: row.required_role as RestaurantTaskRequiredRole,
    assigneeUserId: optionalText(row.assignee_user_id, 200, "Task assignee"),
    verificationMethod: row.verification_method as RestaurantTaskVerificationMethod,
    verificationRequired: row.verification_required,
    checklist,
    completionResult: optionalText(row.completion_result, 1000, "Task completion result"),
    completionEvidence,
    completedAt: optionalIso(row.completed_at, "Task completed time"),
    completedBy: optionalText(row.completed_by, 200, "Task completer"),
    relatedInventoryItemId: optionalText(row.related_inventory_item_id, 200, "Related inventory item"),
    relatedOrderId: optionalText(row.related_order_id, 200, "Related order"),
    relatedRecommendationId: optionalText(row.related_recommendation_id, 200, "Related recommendation"),
    relatedSupplierName: optionalText(row.related_supplier_name, 200, "Related supplier"),
    sourceReference: optionalText(row.source_reference, 240, "Task source reference"),
    createdBy: requiredText(row.created_by, 200, "Task creator"),
    clientTaskId: requiredText(row.client_task_id, 200, "Client task id"),
    correlationId: requiredText(row.correlation_id, 200, "Task correlation id"),
    dependencyIds: [...new Set(dependencyIds.map((id) => requiredText(id, 200, "Dependency id")))],
    createdAt: requiredIso(row.created_at, "Task created time"),
    updatedAt: requiredIso(row.updated_at, "Task updated time")
  };
}

export function createRestaurantTaskRpcArguments(input: CreateRestaurantTaskInput) {
  const task = normalizeCreateRestaurantTaskInput(input);
  return {
    p_restaurant_id: task.restaurantId,
    p_client_task_id: task.clientTaskId,
    p_title: task.title,
    p_detail: task.detail,
    p_origin: task.origin,
    p_operational_category: task.operationalCategory,
    p_priority: task.priority,
    p_timing_bucket: task.timingBucket,
    p_due_at: task.dueAt,
    p_service_window: task.serviceWindow,
    p_window_start: task.windowStart,
    p_window_end: task.windowEnd,
    p_required_role: task.requiredRole,
    p_assignee_user_id: task.assigneeUserId,
    p_verification_method: task.verificationMethod,
    p_checklist: task.checklist,
    p_related_inventory_item_id: task.relatedInventoryItemId,
    p_related_order_id: task.relatedOrderId,
    p_related_recommendation_id: task.relatedRecommendationId,
    p_related_supplier_name: task.relatedSupplierName,
    p_source_reference: task.sourceReference,
    p_dependency_ids: task.dependencyIds
  };
}

export function completeRestaurantTaskRpcArguments(input: CompleteRestaurantTaskInput) {
  const task = normalizeCompleteRestaurantTaskInput(input);
  return {
    p_restaurant_id: task.restaurantId,
    p_task_id: task.taskId,
    p_completion_result: task.completionResult,
    p_completion_evidence: task.completionEvidence
  };
}

export function normalizeRescheduleRestaurantTaskInput(input: RescheduleRestaurantTaskInput) {
  const timingBucket = input.timingBucket;
  if (!timingBuckets.has(timingBucket)) throw new Error("Task timing is invalid.");
  return {
    restaurantId: requiredText(input.restaurantId, 200, "Restaurant id"),
    taskId: requiredText(input.taskId, 200, "Task id"),
    timingBucket,
    dueAt: optionalIso(input.dueAt, "Task due time")
  };
}

export function rescheduleRestaurantTaskRpcArguments(input: RescheduleRestaurantTaskInput) {
  const task = normalizeRescheduleRestaurantTaskInput(input);
  return {
    p_restaurant_id: task.restaurantId,
    p_task_id: task.taskId,
    p_timing_bucket: task.timingBucket,
    p_due_at: task.dueAt
  };
}

export function isOpenRestaurantTask(task: Pick<RestaurantTask, "status">) {
  return task.status === "waiting" || task.status === "blocked" || task.status === "in_progress" || task.status === "could_not_verify";
}

/**
 * Returns only tasks that belong on run-the-day surfaces. Cancelled tasks are
 * terminal but intentionally never projected as open or completed work.
 */
export function visibleRestaurantTasksForToday(
  tasks: readonly RestaurantTask[],
  options: { includeCompleted?: boolean } = {}
) {
  return tasks.filter(
    (task) => isOpenRestaurantTask(task) || (options.includeCompleted === true && task.status === "completed")
  );
}

/** Projects a durable shared task into the legacy Today-summary task contract. */
export function operationalTodayTaskFromRestaurantTask(
  task: RestaurantTask
): OperationalTodayTask {
  if (!isOpenRestaurantTask(task) && task.status !== "completed") {
    throw new Error("Only active or completed restaurant tasks can be projected into Today.");
  }
  const completed = task.status === "completed";
  return {
    id: task.id,
    restaurantId: task.restaurantId,
    source: {
      kind: "restaurant_task",
      id: task.id,
      status: task.status
    },
    title: task.title,
    detail: task.detail ?? task.title,
    priority: task.priority === "low" ? "normal" : task.priority,
    dueAt: task.dueAt ?? task.windowEnd,
    dueDate: null,
    action: {
      intent: "open_restaurant_task",
      label: completed ? "Review result" : "Open task",
      route: `/tasks/${task.id}`,
      entityId: task.id
    },
    requiredRole: task.requiredRole,
    status: completed ? "completed" : "open",
    completion: {
      derivedFromSource: true,
      canToggleDirectly: false,
      reason: completed
        ? task.completionResult ?? "The restaurant task has a recorded result."
        : task.status === "blocked"
          ? "The restaurant task is waiting on prerequisite work."
          : "The restaurant task remains open in the shared operating plan."
    }
  };
}

export function canRestaurantRoleCompleteSharedTask(
  role: RestaurantRole,
  actorUserId: string | null | undefined,
  task: Pick<RestaurantTask, "requiredRole" | "assigneeUserId">
) {
  const hasRole = task.requiredRole === "member"
    ? true
    : task.requiredRole === "manager"
      ? role !== "staff"
      : role === "owner" || role === "admin";
  if (!hasRole) return false;
  return task.assigneeUserId === null || task.assigneeUserId === actorUserId || role !== "staff";
}

/** Reschedule is manager+ only; staff cannot move shared operating-plan work. */
export function canRestaurantRoleRescheduleSharedTask(role: RestaurantRole) {
  return role === "owner" || role === "admin" || role === "manager";
}

/** Hosted JSONB equality is key-order agnostic; replay checks mirror that here. */
export function restaurantTaskMatchesCreateRequest(
  task: RestaurantTask,
  input: CreateRestaurantTaskInput
) {
  const normalized = normalizeCreateRestaurantTaskInput(input);
  return (
    task.restaurantId === normalized.restaurantId &&
    task.clientTaskId === normalized.clientTaskId &&
    task.title === normalized.title &&
    task.detail === normalized.detail &&
    task.origin === normalized.origin &&
    task.operationalCategory === normalized.operationalCategory &&
    task.priority === normalized.priority &&
    task.timingBucket === normalized.timingBucket &&
    task.dueAt === normalized.dueAt &&
    task.serviceWindow === normalized.serviceWindow &&
    task.windowStart === normalized.windowStart &&
    task.windowEnd === normalized.windowEnd &&
    task.requiredRole === normalized.requiredRole &&
    task.assigneeUserId === normalized.assigneeUserId &&
    task.verificationMethod === normalized.verificationMethod &&
    sameJson(task.checklist, normalized.checklist) &&
    task.relatedInventoryItemId === normalized.relatedInventoryItemId &&
    task.relatedOrderId === normalized.relatedOrderId &&
    task.relatedRecommendationId === normalized.relatedRecommendationId &&
    task.relatedSupplierName === normalized.relatedSupplierName &&
    task.sourceReference === normalized.sourceReference &&
    sameStringSet(task.dependencyIds, normalized.dependencyIds)
  );
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function sameJson(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length && left.every((value, index) => sameJson(value, right[index]));
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord).sort();
    const rightKeys = Object.keys(rightRecord).sort();
    return leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) => key === rightKeys[index] && sameJson(leftRecord[key], rightRecord[key]));
  }
  return false;
}

function requiredText(value: unknown, max: number, label: string) {
  if (typeof value !== "string") throw new Error(`${label} is required.`);
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > max) throw new Error(`${label} is invalid.`);
  return normalized;
}

function optionalText(value: unknown, max: number, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} is invalid.`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > max) throw new Error(`${label} is invalid.`);
  return normalized;
}

function requiredIso(value: unknown, label: string) {
  const normalized = optionalIso(value, label);
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function optionalIso(value: unknown, label: string): string | null {
  const normalized = optionalText(value, 100, label);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is invalid.`);
  return new Date(parsed).toISOString();
}

function boundedEvidence(value: unknown, label: string): RestaurantTaskEvidence[] {
  if (!Array.isArray(value) || value.length > 32) throw new Error(`${label} must be a bounded array.`);
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${label} contains an invalid entry.`);
    }
    const record = { ...(entry as Record<string, unknown>) };
    if (typeof record.type !== "string" || !record.type.trim()) {
      const labelValue = typeof record.label === "string" ? record.label.trim() : "";
      if (!labelValue) throw new Error(`${label} entries require a type or label.`);
      record.type = "checklist_item";
    } else {
      record.type = record.type.trim();
    }
    return record as RestaurantTaskEvidence;
  });
}
import type { OperationalTodayTask } from "./todayTasks";
import type { RestaurantRole } from "../../types/mise";

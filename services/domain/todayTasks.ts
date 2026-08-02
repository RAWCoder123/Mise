import type {
  Insight,
  InventoryCountSession,
  InventoryOutlookItem,
  PosIntegration,
  PurchaseRecommendation,
  RestaurantRole,
  SetupReadinessStep,
  SetupReadinessStepId,
  SetupReadinessSummary,
  SupplierOrder
} from "../../types/mise";
import type { TodayTaskPresentationDescriptor } from "../../types/presentation";

/**
 * Today tasks are projections of authoritative workflow state. They are never
 * independently persisted or manually completed.
 */
export type OperationalTodayTaskSourceKind =
  | "inventory"
  | "inventory_count_session"
  | "recommendation"
  | "order"
  | "setup"
  | "integration"
  | "insight"
  | "recipe";

export type OperationalTodayTaskPriority = "urgent" | "high" | "normal";
export type OperationalTodayTaskStatus = "open" | "completed";
export type OperationalTodayTaskRequiredRole = "member" | "manager" | "owner_admin";
export type OperationalTodayTaskTiming = "overdue" | "due_soon" | "today" | "later" | "unscheduled";

export type OperationalTodayTaskActionIntent =
  | "update_inventory_count"
  | "begin_inventory_count_session"
  | "continue_inventory_count_session"
  | "review_recommendation"
  | "prepare_supplier_draft"
  | "send_supplier_order"
  | "receive_supplier_order"
  | "finish_setup"
  | "connect_pos"
  | "manage_pos_connection"
  | "repair_pos_connection"
  | "review_insight"
  | "map_unmapped_pos_items"
  | "repair_incompatible_recipe_units";

/** Exhaustive list for presentation and contract tests. Keep in sync with the union above. */
export const OPERATIONAL_TODAY_TASK_ACTION_INTENTS = [
  "update_inventory_count",
  "begin_inventory_count_session",
  "continue_inventory_count_session",
  "review_recommendation",
  "prepare_supplier_draft",
  "send_supplier_order",
  "receive_supplier_order",
  "finish_setup",
  "connect_pos",
  "manage_pos_connection",
  "repair_pos_connection",
  "review_insight",
  "map_unmapped_pos_items",
  "repair_incompatible_recipe_units"
] as const satisfies readonly OperationalTodayTaskActionIntent[];

/** Stable synthetic source id for the suggested begin-count task (not a DB session id). */
export const SUGGESTED_INVENTORY_COUNT_SESSION_SOURCE_ID = "suggested_begin";

/** Stable synthetic source id for the unmapped POS recipe repair task. */
export const UNMAPPED_POS_RECIPE_SOURCE_ID = "unmapped_pos_items";

/** Stable synthetic source id for unit-incompatible recipe repair task. */
export const INCOMPATIBLE_RECIPE_UNITS_SOURCE_ID = "incompatible_recipe_units";

/** Stable synthetic source id prefix for chronic short-ship ordering tasks. */
export const CHRONIC_SHORT_SHIP_SOURCE_ID_PREFIX = "chronic_short_ship_";

/** Stable synthetic source id prefix for chronic waste tasks. */
export const CHRONIC_WASTE_SOURCE_ID_PREFIX = "chronic_waste_";

/** Stable synthetic source id prefix for chronic count-shrink tasks. */
export const CHRONIC_COUNT_SHRINK_SOURCE_ID_PREFIX = "chronic_count_shrink_";

export type OperationalTodayTaskRoute =
  | "/inventory"
  | `/inventory/${string}`
  | "/inventory/count"
  | "/orders"
  | `/orders/${string}`
  | "/insights"
  | "/setup"
  | "/settings"
  | "/settings/pos"
  | "/settings/recipes";

export interface OperationalTodayTaskAction {
  intent: OperationalTodayTaskActionIntent;
  label: string;
  route: OperationalTodayTaskRoute;
  entityId: string | null;
}

export interface OperationalTodayTask {
  id: string;
  restaurantId: string;
  source: {
    kind: OperationalTodayTaskSourceKind;
    id: string;
    status: string;
  };
  title: string;
  detail: string;
  /** Locale-neutral generated copy; raw title/detail remain for legacy clients and evidence. */
  presentation?: TodayTaskPresentationDescriptor;
  priority: OperationalTodayTaskPriority;
  /** A canonical UTC ISO instant. Null when the source has no exact deadline. */
  dueAt: string | null;
  /** A restaurant-local YYYY-MM-DD commitment when the source is date-only. */
  dueDate: string | null;
  action: OperationalTodayTaskAction;
  requiredRole: OperationalTodayTaskRequiredRole;
  status: OperationalTodayTaskStatus;
  completion: {
    derivedFromSource: true;
    canToggleDirectly: false;
    reason: string;
  };
}

export interface DeriveOperationalTodayTasksInput {
  restaurantId: string;
  restaurantTimeZone: string;
  inventoryOutlooks: readonly InventoryOutlookItem[];
  recommendations: readonly PurchaseRecommendation[];
  orders: readonly SupplierOrder[];
  setupReadiness?: SetupReadinessSummary | null;
  /** Undefined means integration readiness was not loaded; [] means no POS connection exists. */
  posIntegrations?: readonly PosIntegration[];
  /** Sold POS menu item names that still lack recipe baselines. */
  unmappedPosMenuItems?: readonly string[];
  /** Menu item names with recipe links that cannot drive POS consumption due to unit mismatch. */
  incompatibleRecipeMenuItems?: readonly string[];
  /** Chronic supplier short-ship patterns derived from receiving history. */
  chronicShortShipItems?: readonly ChronicShortShipTodayItem[];
  /** Chronic waste patterns derived from waste ledger history. */
  chronicWasteItems?: readonly ChronicLossTodayItem[];
  /** Chronic unexplained count-shrink patterns derived from manual counts. */
  chronicCountShrinkItems?: readonly ChronicLossTodayItem[];
  insights: readonly Insight[];
  openCountSession?: InventoryCountSession | null;
  now?: Date;
  includeCompleted?: boolean;
}

export type ChronicShortShipTodayItem = {
  inventoryItemId: string;
  itemName: string;
  supplierName: string;
  fillPercent: number;
  sampleCount: number;
};

export type ChronicLossTodayItem = {
  inventoryItemId: string;
  itemName: string;
  lossPercent: number;
  sampleCount: number;
};

export interface OperationalTodayTaskSortOptions {
  restaurantTimeZone: string;
  now?: Date;
  dueSoonWindowMs?: number;
}

export const DEFAULT_TODAY_TASK_DUE_SOON_WINDOW_MS = 4 * 60 * 60 * 1000;

export function deriveOperationalTodayTasks(
  input: DeriveOperationalTodayTasksInput
): OperationalTodayTask[] {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("A restaurant is required to derive Today tasks.");

  const includeCompleted = input.includeCompleted ?? false;
  const tasks: OperationalTodayTask[] = [];
  const recommendations = input.recommendations.filter(
    (recommendation) => recommendation.restaurant_id === restaurantId
  );
  const orders = input.orders.filter((order) => order.restaurant_id === restaurantId);
  const activeRecommendationItemIds = new Set(
    recommendations
      .filter((recommendation) => recommendation.status === "pending" || recommendation.status === "approved")
      .map((recommendation) => recommendation.inventory_item_id)
  );

  const openCountSession =
    input.openCountSession &&
    input.openCountSession.restaurant_id === restaurantId &&
    (input.openCountSession.status === "in_progress" || input.openCountSession.status === "submitted")
      ? input.openCountSession
      : null;
  if (openCountSession) {
    const awaitingApproval = openCountSession.status === "submitted";
    pushIfVisible(
      tasks,
      buildTask({
        restaurantId,
        sourceKind: "inventory_count_session",
        sourceId: openCountSession.id,
        sourceStatus: openCountSession.status,
        title: awaitingApproval ? "Approve inventory count" : "Continue inventory count",
        detail: awaitingApproval
          ? "A submitted multi-item count is waiting for manager approval before stock is updated."
          : "An inventory count session is in progress. Finish counting items and submit for approval.",
        presentation: {
          code: awaitingApproval
            ? "today.inventory_count_session.approve"
            : "today.inventory_count_session.continue",
          values: {
            status: openCountSession.status
          }
        },
        priority: awaitingApproval ? "high" : "normal",
        action: {
          intent: "continue_inventory_count_session",
          label: awaitingApproval ? "Review count" : "Continue count",
          route: "/inventory/count",
          entityId: openCountSession.id
        },
        // Staff may count and submit; only managers+ approve ledger adjustments.
        requiredRole: awaitingApproval ? "manager" : "member",
        isComplete: false,
        completionReason: awaitingApproval
          ? "Count session is submitted and awaiting approval."
          : "Count session is still in progress."
      }),
      includeCompleted
    );
  } else {
    const riskOutlooks = input.inventoryOutlooks.filter(
      (outlook) =>
        outlook.item.restaurant_id === restaurantId && outlook.prediction.projectedStatus !== "Good"
    );
    if (riskOutlooks.length > 0) {
      const hasCritical = riskOutlooks.some(
        (outlook) => outlook.prediction.projectedStatus === "Critical"
      );
      const hasLow = riskOutlooks.some((outlook) => outlook.prediction.projectedStatus === "Low");
      pushIfVisible(
        tasks,
        buildTask({
          restaurantId,
          sourceKind: "inventory_count_session",
          sourceId: SUGGESTED_INVENTORY_COUNT_SESSION_SOURCE_ID,
          sourceStatus: "suggested",
          title: "Start inventory count",
          detail:
            "Stock-risk items need a multi-item count. Staff can begin the session and submit it for manager approval.",
          presentation: {
            code: "today.inventory_count_session.begin",
            values: { riskItemCount: riskOutlooks.length }
          },
          priority: hasCritical ? "urgent" : hasLow ? "high" : "normal",
          action: {
            intent: "begin_inventory_count_session",
            label: "Start count",
            route: "/inventory/count",
            entityId: null
          },
          // Matches begin_count_session Edge/SQL staff+ authority.
          requiredRole: "member",
          isComplete: false,
          completionReason: "No open inventory count session exists while stock-risk items remain."
        }),
        includeCompleted
      );
    }
  }

  for (const recommendation of recommendations) {
    const reviewComplete = recommendation.status !== "pending";
    pushIfVisible(
      tasks,
      buildTask({
        restaurantId,
        sourceKind: "recommendation",
        sourceId: recommendation.id,
        sourceStatus: recommendation.status,
        title: `Review ${recommendation.item_name} reorder`,
        detail: recommendation.reason,
        presentation: {
          code: "today.recommendation.review",
          values: {
            itemName: recommendation.item_name,
            rawReason: recommendation.reason
          }
        },
        priority: priorityForUrgency(recommendation.urgency),
        action: {
          intent: "review_recommendation",
          label: "Review recommendation",
          route: "/orders",
          entityId: recommendation.id
        },
        requiredRole: "manager",
        isComplete: reviewComplete,
        completionReason: reviewComplete
          ? `Recommendation is ${recommendation.status}.`
          : "Recommendation remains pending operator review."
      }),
      includeCompleted
    );

    if (recommendation.status === "approved") {
      const draftComplete = Boolean(recommendation.supplier_order_id);
      pushIfVisible(
        tasks,
        buildTask({
          restaurantId,
          sourceKind: "recommendation",
          sourceId: recommendation.id,
          sourceStatus: recommendation.status,
          title: `Prepare ${recommendation.supplier_name} supplier draft`,
          detail: `${recommendation.item_name} was approved and must remain operator-reviewed before sending.`,
          presentation: {
            code: "today.recommendation.prepare_draft",
            values: {
              itemName: recommendation.item_name,
              supplierName: recommendation.supplier_name
            }
          },
          priority: priorityForUrgency(recommendation.urgency),
          action: {
            intent: "prepare_supplier_draft",
            label: "Prepare draft",
            route: "/orders",
            entityId: recommendation.id
          },
          requiredRole: "manager",
          isComplete: draftComplete,
          completionReason: draftComplete
            ? "The approved recommendation is linked to a supplier draft."
            : "The approved recommendation is not linked to a supplier draft."
        }),
        includeCompleted
      );
    }
  }

  // Stock-risk items are handled by the inventory count session path above
  // (begin / continue / approve). Do not also emit per-item detail shortcuts
  // that bypass submit → approve → ledger adjustment.
  const suppressPerItemInventoryOutlookTasks = Boolean(openCountSession)
    || input.inventoryOutlooks.some(
      (outlook) =>
        outlook.item.restaurant_id === restaurantId && outlook.prediction.projectedStatus !== "Good"
    );

  for (const outlook of input.inventoryOutlooks) {
    if (suppressPerItemInventoryOutlookTasks) break;
    const { item, prediction } = outlook;
    if (item.restaurant_id !== restaurantId) continue;
    if (prediction.projectedStatus === "Good") continue;
    if (activeRecommendationItemIds.has(item.id)) continue;

    const status = prediction.projectedStatus;
    pushIfVisible(
      tasks,
      buildTask({
        restaurantId,
        sourceKind: "inventory",
        sourceId: item.id,
        sourceStatus: status,
        title: status === "Watch" ? `Confirm ${item.item_name} count` : `Resolve ${item.item_name} stock risk`,
        detail: `${prediction.coverageLabel}. ${prediction.suggestedAction}.`,
        presentation: status === "Watch"
          ? {
              code: "today.inventory.confirm_count",
              values: {
                itemName: item.item_name,
                projectedQuantity: prediction.projectedQuantity,
                unit: item.unit
              }
            }
          : {
              code: "today.inventory.resolve_stock",
              values: {
                itemName: item.item_name,
                projectedQuantity: prediction.projectedQuantity,
                unit: item.unit,
                status
              }
            },
        priority: status === "Critical" ? "urgent" : status === "Low" ? "high" : "normal",
        action: {
          intent: "update_inventory_count",
          label: "Review count",
          route: `/inventory/${encodeURIComponent(item.id)}`,
          entityId: item.id
        },
        requiredRole: "manager",
        isComplete: false,
        completionReason: `Projected inventory status remains ${status}.`
      }),
      includeCompleted
    );
  }

  for (const order of orders) {
    const isComplete = order.status === "completed";
    const awaitingReceive = order.status === "sent";
    const presentationCode = isComplete
      ? "today.order.review"
      : awaitingReceive
        ? "today.order.receive"
        : "today.order.send";
    pushIfVisible(
      tasks,
      buildTask({
        restaurantId,
        sourceKind: "order",
        sourceId: order.id,
        sourceStatus: order.status,
        title: awaitingReceive
          ? `Receive ${order.supplier_name} delivery`
          : isComplete
            ? `Review ${order.supplier_name} order`
            : `Send ${order.supplier_name} order`,
        detail: awaitingReceive
          ? order.delivery_date
            ? `Confirm received quantities for the ${order.delivery_date} delivery.`
            : "Confirm received quantities so Mise updates on-hand inventory."
          : order.delivery_date
            ? `Supplier delivery is scheduled for ${order.delivery_date}.`
            : "Review the approved draft before it leaves the restaurant.",
        presentation: {
          code: presentationCode,
          values: {
            supplierName: order.supplier_name,
            deliveryDate: validDateKey(order.delivery_date) ? order.delivery_date : null
          }
        },
        priority: awaitingReceive ? "urgent" : "high",
        dueDate: validDateKey(order.delivery_date) ? order.delivery_date : null,
        action: {
          intent: awaitingReceive ? "receive_supplier_order" : "send_supplier_order",
          label: awaitingReceive ? "Receive delivery" : isComplete ? "View order" : "Review and send",
          route: `/orders/${encodeURIComponent(order.id)}`,
          entityId: order.id
        },
        requiredRole: "manager",
        isComplete,
        completionReason: isComplete
          ? "Supplier order was received and inventory was updated."
          : awaitingReceive
            ? "Supplier order is marked placed/sent and still needs receiving."
            : "Supplier order remains a draft and has not been represented as placed or sent."
      }),
      includeCompleted
    );
  }

  const unmappedPosMenuItems = normalizeRecipeMenuItemNames(input.unmappedPosMenuItems, { sort: true });
  if (unmappedPosMenuItems.length > 0) {
    const sampleItemName = unmappedPosMenuItems[0] ?? null;
    pushIfVisible(
      tasks,
      buildTask({
        restaurantId,
        sourceKind: "recipe",
        sourceId: UNMAPPED_POS_RECIPE_SOURCE_ID,
        sourceStatus: "unmapped",
        title:
          unmappedPosMenuItems.length === 1
            ? `Map ${sampleItemName ?? "POS item"} to ingredients`
            : `Map ${unmappedPosMenuItems.length} unmapped POS menu items`,
        detail:
          unmappedPosMenuItems.length === 1
            ? `${sampleItemName ?? "This POS menu item"} sold without a recipe baseline, so Mise cannot deplete inventory from those sales.`
            : `${unmappedPosMenuItems.length} sold POS menu items lack recipe baselines, so Mise cannot deplete inventory from those sales.`,
        presentation: {
          code: "today.recipe.map_unmapped",
          values: {
            unmappedCount: unmappedPosMenuItems.length,
            sampleItemName
          }
        },
        priority: unmappedPosMenuItems.length >= 3 ? "high" : "normal",
        action: {
          intent: "map_unmapped_pos_items",
          label: "Map recipes",
          route: "/settings/recipes",
          entityId: sampleItemName
        },
        requiredRole: "manager",
        isComplete: false,
        completionReason: "Sold POS menu items remain without recipe baselines."
      }),
      includeCompleted
    );
  }

  // Preserve caller order (baseline already prefers sold dishes first).
  const incompatibleRecipeMenuItems = normalizeRecipeMenuItemNames(input.incompatibleRecipeMenuItems, {
    sort: false
  });
  if (incompatibleRecipeMenuItems.length > 0) {
    const sampleItemName = incompatibleRecipeMenuItems[0] ?? null;
    pushIfVisible(
      tasks,
      buildTask({
        restaurantId,
        sourceKind: "recipe",
        sourceId: INCOMPATIBLE_RECIPE_UNITS_SOURCE_ID,
        sourceStatus: "incompatible_units",
        title:
          incompatibleRecipeMenuItems.length === 1
            ? `Fix recipe units for ${sampleItemName ?? "POS item"}`
            : `Fix units on ${incompatibleRecipeMenuItems.length} recipe mappings`,
        detail:
          incompatibleRecipeMenuItems.length === 1
            ? `${sampleItemName ?? "This POS menu item"} has a recipe unit that does not match its inventory item, so Mise cannot deplete stock from those sales.`
            : `${incompatibleRecipeMenuItems.length} recipe mappings use units that do not match inventory, so Mise cannot deplete stock from those sales.`,
        presentation: {
          code: "today.recipe.repair_incompatible_units",
          values: {
            incompatibleCount: incompatibleRecipeMenuItems.length,
            sampleItemName
          }
        },
        priority: incompatibleRecipeMenuItems.length >= 3 ? "high" : "normal",
        action: {
          intent: "repair_incompatible_recipe_units",
          label: "Fix recipe units",
          route: "/settings/recipes",
          entityId: sampleItemName
        },
        requiredRole: "manager",
        isComplete: false,
        completionReason: "Recipe mappings remain with units that cannot drive POS consumption."
      }),
      includeCompleted
    );
  }

  if (input.setupReadiness) {
    for (const step of input.setupReadiness.steps) {
      // Prefer dedicated recipe repair tasks over the generic setup recipes step.
      if (
        step.id === "recipes" &&
        step.status !== "complete" &&
        (unmappedPosMenuItems.length > 0 || incompatibleRecipeMenuItems.length > 0)
      ) {
        continue;
      }
      pushIfVisible(tasks, buildSetupTask(restaurantId, step, input.setupReadiness), includeCompleted);
    }
  }

  if (input.posIntegrations !== undefined) {
    const integrations = input.posIntegrations.filter(
      (integration) => integration.restaurant_id === restaurantId
    );
    if (integrations.length === 0) {
      pushIfVisible(
        tasks,
        buildTask({
          restaurantId,
          sourceKind: "integration",
          sourceId: "pos",
          sourceStatus: "missing",
          title: "Connect restaurant sales",
          detail: "Connect a POS provider or choose the supported import workflow before relying on live sales signals.",
          presentation: {
            code: "today.integration.connect",
            values: {}
          },
          priority: "high",
          action: {
            intent: "connect_pos",
            label: "Connect POS",
            route: "/settings/pos",
            entityId: null
          },
          requiredRole: "owner_admin",
          isComplete: false,
          completionReason: "No restaurant-scoped POS integration exists."
        }),
        includeCompleted
      );
    } else {
      for (const integration of integrations) {
        const isComplete = integration.status === "connected";
        const provider = providerLabel(integration.provider);
        pushIfVisible(
          tasks,
          buildTask({
            restaurantId,
            sourceKind: "integration",
            sourceId: integration.id,
            sourceStatus: integration.status,
            title: isComplete ? `${provider} sales connected` : `Fix ${provider} sales connection`,
            detail: integrationDetail(integration),
            presentation: {
              code: isComplete ? "today.integration.connected" : "today.integration.repair",
              values: {
                providerName: provider,
                status: integration.status,
                lastSyncAt: integration.last_sync_at
              }
            },
            priority: integration.status === "error" ? "urgent" : "high",
            action: {
              // Keep manage_pos_connection across connected/broken states so task IDs stay stable.
              intent: "manage_pos_connection",
              label: isComplete ? "View connection" : "Repair connection",
              route: "/settings/pos",
              entityId: integration.id
            },
            requiredRole: "owner_admin",
            isComplete,
            completionReason: isComplete
              ? "POS integration reports a connected source state."
              : `POS integration reports ${integration.status}.`
          }),
          includeCompleted
        );
      }
    }
  }

  const chronicShortShipItems = (input.chronicShortShipItems ?? [])
    .filter((item) => item.inventoryItemId.trim() && item.itemName.trim())
    .slice(0, 2);
  for (const item of chronicShortShipItems) {
    pushIfVisible(
      tasks,
      buildTask({
        restaurantId,
        sourceKind: "insight",
        sourceId: `${CHRONIC_SHORT_SHIP_SOURCE_ID_PREFIX}${item.inventoryItemId}`,
        sourceStatus: "chronic_short_ship",
        title: `${item.itemName} is often short-shipped`,
        detail: `Recent ${item.supplierName} deliveries averaged about ${item.fillPercent}% of ordered across ${item.sampleCount} receives.`,
        presentation: {
          code: "today.ordering.chronic_short_ship",
          values: {
            itemName: item.itemName,
            supplierName: item.supplierName,
            fillPercent: item.fillPercent,
            sampleCount: item.sampleCount
          }
        },
        priority: "high",
        action: {
          intent: "review_insight",
          label: "Review short-ships",
          route: "/orders",
          entityId: item.inventoryItemId
        },
        requiredRole: "manager",
        isComplete: false,
        completionReason: "Receiving history still shows a chronic short-ship pattern."
      }),
      includeCompleted
    );
  }

  const chronicWasteItems = (input.chronicWasteItems ?? [])
    .filter((item) => item.inventoryItemId.trim() && item.itemName.trim())
    .slice(0, 2);
  for (const item of chronicWasteItems) {
    pushIfVisible(
      tasks,
      buildTask({
        restaurantId,
        sourceKind: "insight",
        sourceId: `${CHRONIC_WASTE_SOURCE_ID_PREFIX}${item.inventoryItemId}`,
        sourceStatus: "chronic_waste",
        title: `${item.itemName} has a chronic waste pattern`,
        detail: `Recent waste averaged about ${item.lossPercent}% of on-hand across ${item.sampleCount} records.`,
        presentation: {
          code: "today.waste.chronic_waste",
          values: {
            itemName: item.itemName,
            lossPercent: item.lossPercent,
            sampleCount: item.sampleCount
          }
        },
        priority: "high",
        action: {
          intent: "review_insight",
          label: "Review waste",
          route: "/inventory",
          entityId: item.inventoryItemId
        },
        requiredRole: "manager",
        isComplete: false,
        completionReason: "Waste history still shows a chronic loss pattern."
      }),
      includeCompleted
    );
  }

  const chronicCountShrinkItems = (input.chronicCountShrinkItems ?? [])
    .filter((item) => item.inventoryItemId.trim() && item.itemName.trim())
    .slice(0, 2);
  for (const item of chronicCountShrinkItems) {
    pushIfVisible(
      tasks,
      buildTask({
        restaurantId,
        sourceKind: "insight",
        sourceId: `${CHRONIC_COUNT_SHRINK_SOURCE_ID_PREFIX}${item.inventoryItemId}`,
        sourceStatus: "chronic_count_shrink",
        title: `${item.itemName} often shrinks between counts`,
        detail: `Recent counts averaged about ${item.lossPercent}% below system across ${item.sampleCount} counts.`,
        presentation: {
          code: "today.inventory.chronic_count_shrink",
          values: {
            itemName: item.itemName,
            lossPercent: item.lossPercent,
            sampleCount: item.sampleCount
          }
        },
        priority: "high",
        action: {
          intent: "begin_inventory_count_session",
          label: "Start recount",
          route: "/inventory/count",
          entityId: item.inventoryItemId
        },
        requiredRole: "manager",
        isComplete: false,
        completionReason: "Count history still shows a chronic shrink pattern."
      }),
      includeCompleted
    );
  }

  for (const insight of input.insights) {
    if (insight.restaurant_id !== restaurantId) continue;
    if (insight.severity === "info") continue;
    // Inventory and ordering risks already have authoritative workflow tasks above.
    if (insight.insight_type === "inventory" || insight.insight_type === "ordering") continue;
    // Chronic waste has a dedicated manager task above.
    if (insight.presentation?.code === "insight.rule.waste.chronic_waste") continue;
    pushIfVisible(
      tasks,
      buildTask({
        restaurantId,
        sourceKind: "insight",
        sourceId: insight.id,
        sourceStatus: insight.severity,
        title: insight.title,
        detail: insight.recommended_action || insight.description,
        presentation: {
          code: "today.insight.review",
          values: {
            insightType: insight.insight_type,
            rawTitle: insight.title,
            rawEvidence: insight.recommended_action || insight.description
          }
        },
        priority: insight.severity === "urgent" ? "urgent" : "high",
        action: {
          intent: "review_insight",
          label: "Review insight",
          route: "/insights",
          entityId: insight.id
        },
        requiredRole: "member",
        isComplete: false,
        completionReason: "The current restaurant insight remains active."
      }),
      includeCompleted
    );
  }

  return sortOperationalTodayTasks(tasks, {
    restaurantTimeZone: input.restaurantTimeZone,
    now: input.now
  });
}

export function operationalTodayTaskId(
  sourceKind: OperationalTodayTaskSourceKind,
  sourceId: string,
  intent: OperationalTodayTaskActionIntent
) {
  return `today:${sourceKind}:${encodeURIComponent(sourceId)}:${intent}`;
}

export function classifyOperationalTodayTaskTiming(
  task: Pick<OperationalTodayTask, "dueAt" | "dueDate">,
  options: OperationalTodayTaskSortOptions
): OperationalTodayTaskTiming {
  const now = validNow(options.now);
  const dueSoonWindowMs = validDueSoonWindow(options.dueSoonWindowMs);
  const dueAt = utcInstant(task.dueAt);
  if (dueAt !== null) {
    if (dueAt < now.getTime()) return "overdue";
    if (dueAt <= now.getTime() + dueSoonWindowMs) return "due_soon";
    if (
      dateKeyInTimeZone(new Date(dueAt), options.restaurantTimeZone) ===
      dateKeyInTimeZone(now, options.restaurantTimeZone)
    ) {
      return "today";
    }
    return "later";
  }

  if (validDateKey(task.dueDate)) {
    const today = dateKeyInTimeZone(now, options.restaurantTimeZone);
    if (task.dueDate < today) return "overdue";
    if (task.dueDate === today) return "today";
    return "later";
  }
  return "unscheduled";
}

export function sortOperationalTodayTasks(
  tasks: readonly OperationalTodayTask[],
  options: OperationalTodayTaskSortOptions
): OperationalTodayTask[] {
  const timingRank: Record<OperationalTodayTaskTiming, number> = {
    overdue: 0,
    due_soon: 1,
    today: 2,
    later: 3,
    unscheduled: 4
  };
  const priorityRank: Record<OperationalTodayTaskPriority, number> = {
    urgent: 0,
    high: 1,
    normal: 2
  };

  return [...tasks].sort((left, right) => {
    if (left.status !== right.status) return left.status === "open" ? -1 : 1;
    const timingDelta =
      timingRank[classifyOperationalTodayTaskTiming(left, options)] -
      timingRank[classifyOperationalTodayTaskTiming(right, options)];
    if (timingDelta !== 0) return timingDelta;
    const priorityDelta = priorityRank[left.priority] - priorityRank[right.priority];
    if (priorityDelta !== 0) return priorityDelta;
    const dueDelta = sortableDueValue(left) - sortableDueValue(right);
    if (Number.isFinite(dueDelta) && dueDelta !== 0) return dueDelta;
    return compareStrings(left.id, right.id);
  });
}

export function canRestaurantRoleActOnTodayTask(
  role: RestaurantRole,
  task: Pick<OperationalTodayTask, "requiredRole">
) {
  if (task.requiredRole === "member") return true;
  if (task.requiredRole === "manager") return role !== "staff";
  return role === "owner" || role === "admin";
}

/**
 * Keep urgency ordering inside each group, but surface work the current role can
 * act on before locked manager/owner follow-ups. Tasks are assumed pre-sorted.
 */
export function prioritizeOperationalTodayTasksForRole(
  tasks: readonly OperationalTodayTask[],
  role: RestaurantRole
): OperationalTodayTask[] {
  const actionable: OperationalTodayTask[] = [];
  const restricted: OperationalTodayTask[] = [];
  for (const task of tasks) {
    if (canRestaurantRoleActOnTodayTask(role, task)) actionable.push(task);
    else restricted.push(task);
  }
  return [...actionable, ...restricted];
}

function buildSetupTask(
  restaurantId: string,
  step: SetupReadinessStep,
  readiness: SetupReadinessSummary
) {
  const isComplete = step.status === "complete";
  const copy = setupTaskCopy(step.id, readiness);
  return buildTask({
    restaurantId,
    sourceKind: "setup",
    sourceId: step.id,
    sourceStatus: step.status,
    title: isComplete ? `${copy.completedTitle}` : copy.title,
    detail: step.missing.length > 0 ? step.missing.join(", ") : step.detail,
    presentation: setupTaskPresentation(step, readiness),
    priority: step.status === "active" ? "high" : "normal",
    action: {
      intent: "finish_setup",
      label: isComplete ? "Review setup" : copy.actionLabel,
      route: copy.route,
      entityId: step.id
    },
    requiredRole: copy.requiredRole,
    isComplete,
    completionReason: isComplete
      ? `${step.label} setup is complete in the readiness source.`
      : `${step.label} setup remains ${step.status}.`
  });
}

function setupTaskPresentation(
  step: SetupReadinessStep,
  readiness: SetupReadinessSummary
): TodayTaskPresentationDescriptor {
  const rawEvidence = step.missing.length > 0 ? step.missing.join(", ") : step.detail;
  if (step.id === "profile") {
    return {
      code: step.status === "complete" ? "today.setup.profile.complete" : "today.setup.profile.open",
      values: { rawEvidence }
    };
  }
  if (step.id === "inventory") {
    return {
      code: step.status === "complete" ? "today.setup.inventory.complete" : "today.setup.inventory.open",
      values: { rawEvidence }
    };
  }
  if (step.id === "recipes") {
    return {
      code: step.status === "complete" ? "today.setup.recipes.complete" : "today.setup.recipes.open",
      values: { rawEvidence }
    };
  }
  return {
    code: step.status === "complete"
      ? "today.setup.email.complete"
      : readiness.emailConnectionStatus === "needs_reauth"
        ? "today.setup.email.reconnect"
        : "today.setup.email.connect",
    values: { rawEvidence }
  };
}

function setupTaskCopy(stepId: SetupReadinessStepId, readiness: SetupReadinessSummary): {
  title: string;
  completedTitle: string;
  actionLabel: string;
  route: OperationalTodayTaskRoute;
  requiredRole: OperationalTodayTaskRequiredRole;
} {
  if (stepId === "profile") {
    return {
      title: "Finish restaurant profile",
      completedTitle: "Restaurant profile complete",
      actionLabel: "Finish profile",
      route: "/setup",
      requiredRole: "owner_admin"
    };
  }
  if (stepId === "inventory") {
    return {
      title: "Finish inventory baseline",
      completedTitle: "Inventory baseline complete",
      actionLabel: "Finish inventory",
      route: "/setup",
      requiredRole: "manager"
    };
  }
  if (stepId === "recipes") {
    return {
      title: "Map recipes to inventory",
      completedTitle: "Recipe mapping complete",
      actionLabel: "Review recipes",
      route: "/settings/recipes",
      requiredRole: "manager"
    };
  }
  const needsReconnect = readiness.emailConnectionStatus === "needs_reauth";
  return {
    title: needsReconnect ? "Reconnect Gmail sender" : "Connect Gmail sender",
    completedTitle: "Gmail sender connected",
    actionLabel: needsReconnect ? "Reconnect Gmail" : "Connect Gmail",
    route: "/settings",
    requiredRole: "owner_admin"
  };
}

function buildTask(input: {
  restaurantId: string;
  sourceKind: OperationalTodayTaskSourceKind;
  sourceId: string;
  sourceStatus: string;
  title: string;
  detail: string;
  presentation: TodayTaskPresentationDescriptor;
  priority: OperationalTodayTaskPriority;
  dueAt?: string | null;
  dueDate?: string | null;
  action: OperationalTodayTaskAction;
  requiredRole: OperationalTodayTaskRequiredRole;
  isComplete: boolean;
  completionReason: string;
}): OperationalTodayTask {
  const dueAt = utcIso(input.dueAt);
  return {
    id: operationalTodayTaskId(input.sourceKind, input.sourceId, input.action.intent),
    restaurantId: input.restaurantId,
    source: {
      kind: input.sourceKind,
      id: input.sourceId,
      status: input.sourceStatus
    },
    title: input.title,
    detail: input.detail,
    presentation: input.presentation,
    priority: input.priority,
    dueAt,
    dueDate: validDateKey(input.dueDate) ? input.dueDate : null,
    action: input.action,
    requiredRole: input.requiredRole,
    status: input.isComplete ? "completed" : "open",
    completion: {
      derivedFromSource: true,
      canToggleDirectly: false,
      reason: input.completionReason
    }
  };
}

function pushIfVisible(
  tasks: OperationalTodayTask[],
  task: OperationalTodayTask,
  includeCompleted: boolean
) {
  if (task.status === "open" || includeCompleted) tasks.push(task);
}

function priorityForUrgency(urgency: PurchaseRecommendation["urgency"]): OperationalTodayTaskPriority {
  if (urgency === "high") return "urgent";
  if (urgency === "medium") return "high";
  return "normal";
}

function providerLabel(provider: PosIntegration["provider"]) {
  if (provider === "manual_csv") return "Manual CSV";
  if (provider === "demo") return "Demo POS";
  return `${provider.charAt(0).toUpperCase()}${provider.slice(1)}`;
}

function integrationDetail(integration: PosIntegration) {
  if (integration.status === "connected") {
    return integration.last_sync_at
      ? `Last successful sync: ${integration.last_sync_at}.`
      : "The provider reports a connected source state."
  }
  if (integration.status === "error") return "The provider reports an error. Review it before relying on current sales.";
  if (integration.status === "paused") return "Sales synchronization is paused.";
  return "This sales source is not connected.";
}

function normalizeRecipeMenuItemNames(
  items: readonly string[] | undefined,
  options?: { sort?: boolean }
): string[] {
  if (!items?.length) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of items) {
    const name = item.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(name);
  }
  if (options?.sort === false) return normalized;
  return normalized.sort((left, right) => compareStrings(left, right));
}

function validNow(value: Date | undefined) {
  const now = value ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Today task sorting requires a valid current time.");
  return now;
}

function validDueSoonWindow(value: number | undefined) {
  if (value === undefined) return DEFAULT_TODAY_TASK_DUE_SOON_WINDOW_MS;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Today task due-soon window must be a non-negative duration.");
  }
  return value;
}

function utcIso(value: string | null | undefined) {
  const timestamp = utcInstant(value ?? null);
  return timestamp === null ? null : new Date(timestamp).toISOString();
}

function utcInstant(value: string | null) {
  if (!value || !/Z$/i.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
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

function dateKeyInTimeZone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const year = values.get("year");
    const month = values.get("month");
    const day = values.get("day");
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Invalid or unavailable timezones intentionally fall back to UTC below.
  }
  return date.toISOString().slice(0, 10);
}

function sortableDueValue(task: Pick<OperationalTodayTask, "dueAt" | "dueDate">) {
  const instant = utcInstant(task.dueAt);
  if (instant !== null) return instant;
  if (validDateKey(task.dueDate)) return Date.parse(`${task.dueDate}T00:00:00.000Z`);
  return Number.POSITIVE_INFINITY;
}

function compareStrings(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

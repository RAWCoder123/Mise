import type {
  AiInsight,
  AuditLog,
  InventoryItem,
  MenuItemIngredient,
  PosSale,
  PurchaseRecommendation,
  SupplierRecipient
} from "../../types/mise";
import {
  DEMO_RESTAURANT_ID,
  DEMO_USER_ID,
  approveRecommendationInDemoState,
  dismissRecommendationInDemoState,
  isRollingDemoCurrentDaySale,
  markSupplierOrderSentInDemoState,
  rebuildInsights,
  rebuildPurchaseRecommendations,
  undoRecommendationInDemoState,
  type DemoState
} from "../demoData";
import {
  appendDemoRecommendationActivity,
  appendDemoSupplierOrderActivity,
  seedDemoActivityFromState
} from "../demo/demoActivity";
import {
  filterActivities,
  fromInventoryWasteRecorded,
  fromRecalculationRunActivity,
  fromRestaurantTaskActivity,
  type ActivityFeedFilter
} from "../domain/activityEvents";
import {
  confidenceFromEvidence,
  confirmMemory,
  correctMemory,
  createMemory,
  dismissMemory,
  forgetMemory,
  temporarilyDisableMemory,
  type RestaurantMemoryStatus
} from "../domain/restaurantMemory";
import {
  createPreparedAction,
  markApproved,
  markExecuted,
  markRejected,
  measureOutcome,
  miseActionIdempotencyKey
} from "../domain/miseActions";
import {
  defaultAutonomyRules,
  type RestaurantAutonomyRule
} from "../domain/restaurantAutonomy";
import type { ActivityEvent } from "../domain/activityEvents";
import {
  canRestaurantRoleCompleteSharedTask,
  normalizeCompleteRestaurantTaskInput,
  normalizeCreateRestaurantTaskInput,
  restaurantTaskMatchesCreateRequest,
  type RestaurantTask
} from "../domain/restaurantTasks";
import type {
  PersistedRecalculationRun,
  SupplierDeliveryRecordResult
} from "./repositoryContracts";
import {
  buildSupplierOrderMessage,
  createId,
  severityRank,
  severityRankForUrgency
} from "../domain/miseDomain";
import { TeamMembershipError } from "../domain/teamMembership";
import { acceptInventoryEvent } from "../domain/inventoryLedger";
import {
  normalizeOperationalFindingDecision,
  normalizeOperationalFindingDecisionInput
} from "../domain/operationalFindingDecisions";
import {
  findSupplierRecipientCatalogName,
  supplierRecipientDirectoryKey
} from "../domain/supplierRecipients";
import { mutateDemoState, readDemoState, resetDemoStore } from "../localStore";
import {
  normalizeAppUser,
  normalizeInsight,
  normalizeAiInsight,
  normalizeAuditLog,
  normalizeRestaurantEmailConnection,
  normalizeInventoryItem,
  normalizeMenuItemIngredient,
  normalizePosIntegration,
  normalizePosSale,
  normalizePurchaseRecommendation,
  normalizeRestaurant,
  normalizeRestaurantMembership,
  normalizeRestaurantTeamMember,
  normalizeSetupAttachment,
  normalizeSupplierItem,
  normalizeSupplierOrder,
  normalizeSupplierDeliveryItemRecord,
  normalizeSupplierDeliveryRecord,
  normalizeSupplierRecipient
} from "../miseValidation";
import { addDaysToDateKey, toDateKeyInTimeZone } from "../../utils/format";
import {
  GmailIntegrationError,
  RESTAURANT_EXPORT_DATASETS,
  normalizeRestaurantDataExport,
  normalizeRestaurantData,
  operationalDecisionHistoryCutoffIso,
  recommendationHistoryCutoffIso,
  type AuditLogInput,
  type MiseRepository,
  type RestaurantSetupSnapshotSummary
} from "./repositoryContracts";

async function readReadyDemoState(restaurantId: string = DEMO_RESTAURANT_ID) {
  return mutateDemoState((state) => {
    refreshLocalDemoSalesDate(state, restaurantId);
    rebuildPurchaseRecommendations(state, restaurantId);
    rebuildInsights(state, restaurantId);
    if (!Array.isArray(state.activityEvents)) state.activityEvents = [];
    if (!Array.isArray(state.restaurantMemories)) state.restaurantMemories = [];
    if (!Array.isArray(state.miseActions)) state.miseActions = [];
    if (!Array.isArray(state.autonomyRules)) state.autonomyRules = [];
    if (!Array.isArray(state.actionOutcomes)) state.actionOutcomes = [];
    if (!Array.isArray(state.supplierDeliveries)) state.supplierDeliveries = [];
    if (!Array.isArray(state.supplierDeliveryItems)) state.supplierDeliveryItems = [];
    if (!Array.isArray(state.restaurantTasks)) state.restaurantTasks = [];
    seedDemoActivityFromState(state);
    if (state.autonomyRules.length === 0) {
      state.autonomyRules = defaultAutonomyRules(restaurantId);
    }
    if (state.restaurantMemories.length === 0) {
      const now = new Date().toISOString();
      const primarySupplier = state.inventoryItems.find((item) => item.restaurant_id === restaurantId)
        ?.supplier_name;
      state.restaurantMemories = [
        createMemory({
          restaurantId,
          memoryType: "demand_pattern",
          statement: "Friday dinner usually pulls more produce volume than weekday lunch.",
          evidence: [
            {
              type: "pos_sale_window",
              id: "demo-friday-produce",
              summary: "Repeated Friday dinner spikes on produce items",
              observedAt: now
            }
          ],
          affectsRecommendations: true,
          affectsAutomation: false,
          now
        }),
        createMemory({
          restaurantId,
          memoryType: "supplier_reliability",
          statement: primarySupplier
            ? `${primarySupplier} deliveries usually arrive same-day when the order is sent before 10:00.`
            : "Preferred suppliers usually arrive same-day when the order is sent before 10:00.",
          evidence: [
            {
              type: "supplier_order",
              id: "demo-supplier-reliability",
              summary: "Same-day deliveries observed in demo history",
              observedAt: now
            }
          ],
          affectsRecommendations: true,
          affectsAutomation: false,
          now
        })
      ];
    }
    for (const order of state.supplierOrders.filter((entry) => entry.restaurant_id === restaurantId)) {
      const key = miseActionIdempotencyKey(restaurantId, "send_supplier_order", order.id);
      if (!state.miseActions.some((action) => action.idempotencyKey === key)) {
        state.miseActions.push(
          createPreparedAction({
            restaurantId,
            actionType: "send_supplier_order",
            idempotencyKey: key,
            expectedImpact: { supplierName: order.supplier_name, orderId: order.id },
            now: order.created_at
          })
        );
      }
    }
    return state;
  });
}

function refreshLocalDemoSalesDate(state: DemoState, restaurantId: string) {
  const timeZone = state.restaurants.find((restaurant) => restaurant.id === restaurantId)?.timezone ?? "UTC";
  const today = toDateKeyInTimeZone(new Date(), timeZone);
  state.posSales
    .filter((sale) => sale.restaurant_id === restaurantId)
    .filter((sale) => isRollingDemoCurrentDaySale(sale.id))
    .forEach((sale) => {
      sale.sale_date = today;
    });
}

function fetchRestaurantFromState(state: DemoState, restaurantId: string) {
  const restaurant = state.restaurants.find((item) => item.id === restaurantId);
  if (!restaurant) throw new Error("Restaurant not found");
  return normalizeRestaurant(restaurant);
}

function requireActiveDemoRestaurant(state: DemoState, restaurantId: string) {
  if (state.currentRestaurantId !== restaurantId || !state.restaurants.some((entry) => entry.id === restaurantId)) {
    throw new Error("Restaurant not found");
  }
}

function appendDemoAuditLog(state: DemoState, input: AuditLogInput) {
  const entry: AuditLog = {
    ...input,
    entity_id: input.entity_id ?? null,
    metadata: input.metadata ?? {},
    actor_user_id: DEMO_USER_ID,
    id: createId("audit"),
    created_at: new Date().toISOString()
  };
  state.auditLogs.push(normalizeAuditLog(entry));
}

function prepareResetDemoState(state: DemoState) {
  rebuildPurchaseRecommendations(state, state.currentRestaurantId);
  rebuildInsights(state, state.currentRestaurantId);
}

function buildDemoRestaurantExport(state: DemoState, restaurantId: string) {
  const restaurant = fetchRestaurantFromState(state, restaurantId);
  const generatedAt = new Date().toISOString();
  const datasets = Object.fromEntries(
    RESTAURANT_EXPORT_DATASETS.map((name) => [name, []])
  ) as unknown as Record<(typeof RESTAURANT_EXPORT_DATASETS)[number], unknown[]>;
  const tenantRows = <TRow extends { restaurant_id: string }>(rows: TRow[]) =>
    rows.filter((row) => row.restaurant_id === restaurantId);

  datasets.pos_sales = tenantRows(state.posSales);
  datasets.inventory_items = tenantRows(state.inventoryItems);
  datasets.menu_item_ingredients = tenantRows(state.menuItemIngredients);
  datasets.purchase_recommendations = tenantRows(state.purchaseRecommendations);
  datasets.supplier_orders = tenantRows(state.supplierOrders);
  datasets.pos_integrations = tenantRows(state.posIntegrations);
  datasets.sales_imports = tenantRows(state.salesImports);
  datasets.insights = tenantRows(state.insights);
  datasets.supplier_items = tenantRows(state.supplierItems);
  datasets.purchase_orders = tenantRows(state.purchaseOrders);
  datasets.ai_insights = tenantRows(state.aiInsights);
  datasets.restaurant_email_connections = tenantRows(state.emailConnections);
  datasets.supplier_recipients = tenantRows(state.supplierRecipients);
  datasets.operational_finding_decisions = tenantRows(state.operationalFindingDecisions);
  datasets.operational_issues = [];
  datasets.inventory_events = (state.inventoryEvents ?? [])
    .filter((event) => event.restaurantId === restaurantId)
    .map((event) => ({
      id: event.id,
      sequence: event.sequence,
      restaurant_id: event.restaurantId,
      inventory_item_id: event.inventoryItemId,
      event_type: event.eventType,
      quantity: event.quantity,
      canonical_unit: event.canonicalUnit,
      effective_at: event.effectiveAt,
      recorded_at: event.recordedAt,
      actor_user_id: event.actorUserId,
      source: event.source,
      source_reference: event.sourceReference,
      reason_code: event.reasonCode,
      client_event_id: event.clientEventId,
      idempotency_key: event.idempotencyKey,
      supersedes_event_id: event.supersedesEventId,
      metadata: event.metadata
    }));
  datasets.activity_events = (state.activityEvents ?? [])
    .filter((event) => event.restaurantId === restaurantId)
    .map((event) => ({ ...event, restaurant_id: event.restaurantId }));
  datasets.mise_actions = (state.miseActions ?? [])
    .filter((action) => action.restaurantId === restaurantId)
    .map((action) => ({ ...action, restaurant_id: action.restaurantId }));
  datasets.action_outcomes = (state.actionOutcomes ?? [])
    .filter((outcome) => outcome.restaurantId === restaurantId)
    .map((outcome) => ({ ...outcome, restaurant_id: outcome.restaurantId }));
  datasets.restaurant_memories = (state.restaurantMemories ?? [])
    .filter((memory) => memory.restaurantId === restaurantId)
    .map((memory) => ({ ...memory, restaurant_id: memory.restaurantId }));
  datasets.restaurant_autonomy_rules = (state.autonomyRules ?? [])
    .filter((rule) => rule.restaurantId === restaurantId)
    .map((rule) => ({ ...rule, restaurant_id: rule.restaurantId }));
  datasets.supplier_order_confirmations = [];
  datasets.supplier_deliveries = tenantRows(state.supplierDeliveries ?? []);
  datasets.supplier_delivery_items = tenantRows(state.supplierDeliveryItems ?? []);
  datasets.restaurant_tasks = (state.restaurantTasks ?? [])
    .filter((task) => task.restaurantId === restaurantId)
    .map((task) => ({ ...task, restaurant_id: task.restaurantId }));
  datasets.restaurant_task_dependencies = (state.restaurantTasks ?? [])
    .filter((task) => task.restaurantId === restaurantId)
    .flatMap((task) => task.dependencyIds.map((dependencyId) => ({
      restaurant_id: task.restaurantId,
      task_id: task.id,
      depends_on_task_id: dependencyId,
      created_by: task.createdBy,
      created_at: task.createdAt
    })));
  datasets.recalculation_runs = (state.recalculationRuns ?? [])
    .filter((run) => run.restaurantId === restaurantId)
    .map((run) => ({ ...run, restaurant_id: run.restaurantId }));
  datasets.audit_logs = tenantRows(state.auditLogs);

  const team = state.users
    .filter((user) => user.restaurant_id === restaurantId)
    .map((user) => ({
      restaurant_id: restaurantId,
      user_id: user.id,
      role: "owner" as const,
      status: "active" as const,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
      updated_at: user.created_at
    }));
  const counts = Object.fromEntries([
    ["team", team.length],
    ...RESTAURANT_EXPORT_DATASETS.map((name) => [name, datasets[name].length])
  ]);

  return normalizeRestaurantDataExport({
    schemaVersion: 1,
    generatedAt,
    restaurantId,
    restaurant,
    team,
    datasets,
    counts,
    retention: {
      scope: "restaurant_operational_data",
      credentialsExcluded: true,
      privateSecurityLogsExcluded: true,
      backupDeletion: "Demo data is stored only on this device and is removed when demo data is reset."
    }
  }, restaurantId);
}

function deterministicDemoEventId(restaurantId: string, clientEventId: string) {
  const value = `${restaurantId}\u001f${clientEventId}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `demo_inventory_event_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createLocalDemoRepository(): MiseRepository {
  async function listInventoryEvents(
    restaurantId: string,
    options?: Parameters<MiseRepository["listInventoryEvents"]>[1]
  ) {
    const state = await readReadyDemoState(restaurantId);
    requireActiveDemoRestaurant(state, restaurantId);
    let events = (state.inventoryEvents ?? []).filter(
      (event) => event.restaurantId === restaurantId
    );
    if (options?.eventTypes?.length) {
      const allowed = new Set(options.eventTypes);
      events = events.filter((event) => allowed.has(event.eventType));
    }
    if (options?.since) {
      const sinceMs = Date.parse(options.since);
      if (Number.isFinite(sinceMs)) {
        events = events.filter((event) => Date.parse(event.recordedAt) >= sinceMs);
      }
    }
    events.sort(
      (left, right) =>
        Date.parse(right.recordedAt) - Date.parse(left.recordedAt) ||
        right.sequence - left.sequence ||
        left.id.localeCompare(right.id)
    );
    if (options?.limit != null && Number.isFinite(options.limit) && options.limit >= 0) {
      events = events.slice(0, options.limit);
    }
    return events;
  }

  async function recordInventoryEvent(
    input: Parameters<MiseRepository["recordInventoryEvent"]>[0]
  ) {
    return mutateDemoState((state) => {
      requireActiveDemoRestaurant(state, input.restaurantId);
      const item = state.inventoryItems.find(
        (entry) =>
          entry.restaurant_id === input.restaurantId &&
          entry.id === input.inventoryItemId
      );
      if (!item) throw new Error("Inventory item not found");
      const normalizedItem = normalizeInventoryItem(item);
      const conversion = normalizedItem.canonical_quantity_per_unit;
      if (
        normalizedItem.canonical_unit_verification_status !== "verified" ||
        normalizedItem.canonical_unit !== input.canonicalUnit ||
        conversion === null ||
        conversion === undefined ||
        !Number.isFinite(conversion) ||
        conversion <= 0
      ) {
        throw new Error("Inventory item canonical conversion is not verified");
      }

      const nativeQuantity = input.quantity / conversion;
      const projectedQuantity =
        input.eventType === "count"
          ? nativeQuantity
          : input.eventType === "stockout"
            ? 0
            : input.eventType === "receipt"
              ? item.current_quantity + nativeQuantity
              : input.eventType === "waste" || input.eventType === "usage"
                ? item.current_quantity - nativeQuantity
                : item.current_quantity + nativeQuantity;
      if (
        !Number.isFinite(projectedQuantity) ||
        projectedQuantity < 0 ||
        projectedQuantity > 1_000_000
      ) {
        throw new Error("Inventory event would move on-hand outside supported limits");
      }

      const acceptance = acceptInventoryEvent({
        existingEvents: state.inventoryEvents ?? [],
        candidate: input,
        authority: {
          id: deterministicDemoEventId(input.restaurantId, input.clientEventId),
          actorUserId: DEMO_USER_ID,
          recordedAt: new Date().toISOString()
        }
      });
      if (acceptance.status !== "accepted") return acceptance;

      state.inventoryEvents = [...(state.inventoryEvents ?? []), acceptance.event];
      item.current_quantity = projectedQuantity;
      item.last_updated = acceptance.event.recordedAt;
      if (input.eventType === "waste") {
        const timeZone = state.restaurants.find(
          (restaurant) => restaurant.id === input.restaurantId
        )?.timezone ?? "UTC";
        const effectiveDate = toDateKeyInTimeZone(new Date(input.effectiveAt), timeZone);
        const recentCutoff = addDaysToDateKey(effectiveDate, -6);
        const supersededEventIds = new Set(
          state.inventoryEvents
            .filter((event) => event.eventType === "correction" && event.supersedesEventId)
            .map((event) => event.supersedesEventId!)
        );
        const repeatedRecently = new Set(
          state.inventoryEvents
            .filter(
              (event) =>
                event.restaurantId === input.restaurantId &&
                event.eventType === "waste" &&
                event.inventoryItemId === input.inventoryItemId &&
                !supersededEventIds.has(event.id)
            )
            .map((event) =>
              toDateKeyInTimeZone(new Date(event.effectiveAt), timeZone)
            )
            .filter((date) => date >= recentCutoff && date <= effectiveDate)
        ).size >= 2;
        const activity = fromInventoryWasteRecorded(normalizedItem, {
          occurredAt: input.effectiveAt,
          quantity: input.quantity,
          canonicalUnit: input.canonicalUnit,
          repeatedRecently,
          eventId: acceptance.event.id,
          sequenceId: `inventory-item:${input.inventoryItemId}`
        });
        state.activityEvents = [...(state.activityEvents ?? []), activity];
      }
      appendDemoAuditLog(state, {
        restaurant_id: input.restaurantId,
        action: "inventory_event.recorded",
        entity_table: "inventory_events",
        entity_id: acceptance.event.id,
        metadata: {
          event_type: input.eventType,
          client_event_id: input.clientEventId,
          sequence: acceptance.event.sequence,
          simulated: true
        }
      });
      return acceptance;
    });
  }

  return {
    async fetchMembershipsForAuthUser(userId) {
      const state = await readReadyDemoState();
      const user = state.users.find((entry) => entry.id === userId);
      if (!user?.restaurant_id) return [];
      return [
        normalizeRestaurantMembership({
          id: `membership_${user.id}`,
          restaurant_id: user.restaurant_id,
          user_id: user.id,
          role: "owner",
          status: "active",
          created_at: user.created_at,
          updated_at: user.created_at
        })
      ];
    },

    async fetchRestaurantTeam(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      requireActiveDemoRestaurant(state, restaurantId);
      const user = state.users.find((entry) => entry.restaurant_id === restaurantId) ?? state.users[0];
      if (!user) return [];
      return [
        normalizeRestaurantTeamMember({
          restaurant_id: restaurantId,
          user_id: user.id,
          role: "owner",
          status: "active",
          name: user.name,
          email: user.email,
          created_at: user.created_at,
          updated_at: user.created_at
        })
      ];
    },

    async addRestaurantMemberByEmail() {
      throw new TeamMembershipError(
        "account_not_found",
        "Demo mode is a single-operator workspace. Create a hosted account to add teammates."
      );
    },

    async addRestaurantMember() {
      throw new Error("Team membership management is available only for authenticated restaurant workspaces.");
    },

    async updateRestaurantMember() {
      throw new Error("Team membership management is available only for authenticated restaurant workspaces.");
    },

    async removeRestaurantMember() {
      throw new Error("Team membership management is available only for authenticated restaurant workspaces.");
    },

    async updateMyProfile(name) {
      return mutateDemoState((state) => {
        const user = state.users[0];
        if (!user) throw new Error("Demo user missing");
        user.name = name;
        return normalizeAppUser(user);
      });
    },

    async deleteAccount(_restaurantId) {
      // Demo accounts live only on this device; deletion resets the local store.
      await resetDemoStore();
    },

    async exportRestaurantData(restaurantId) {
      return buildDemoRestaurantExport(await readReadyDemoState(restaurantId), restaurantId);
    },

    async createRestaurantWithOwner(name, cuisineType) {
      return mutateDemoState((state) => {
        const restaurant = state.restaurants[0];
        if (!restaurant) throw new Error("Demo restaurant missing");
        restaurant.name = name.trim() || restaurant.name;
        restaurant.cuisine_type = cuisineType?.trim() || restaurant.cuisine_type;
        return normalizeRestaurant(restaurant);
      });
    },

    async fetchRestaurant(restaurantId) {
      return fetchRestaurantFromState(await readReadyDemoState(restaurantId), restaurantId);
    },

    async updateRestaurantProfile(restaurantId, patch) {
      return mutateDemoState((state) => {
        const restaurant = state.restaurants.find((entry) => entry.id === restaurantId);
        if (!restaurant) throw new Error("Restaurant not found");
        Object.assign(restaurant, patch);
        return normalizeRestaurant(restaurant);
      });
    },

    async fetchRestaurantOpsProfile(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      return {
        restaurant: fetchRestaurantFromState(state, restaurantId),
        posIntegrations: state.posIntegrations
          .filter((integration) => integration.restaurant_id === restaurantId)
          .map(normalizePosIntegration),
        supplierItems: state.supplierItems
          .filter((item) => item.restaurant_id === restaurantId)
          .map(normalizeSupplierItem),
        recentAiInsights: state.aiInsights
          .filter((insight) => insight.restaurant_id === restaurantId)
          .map(normalizeAiInsight)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 5)
      };
    },

    async fetchPosIntegrations(restaurantId) {
      const state = await readDemoState();
      return state.posIntegrations
        .filter((integration) => integration.restaurant_id === restaurantId)
        .map(normalizePosIntegration);
    },

    async fetchAiInsights(restaurantId) {
      const state = await readDemoState();
      return state.aiInsights
        .filter((insight) => insight.restaurant_id === restaurantId)
        .map(normalizeAiInsight)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async createAiInsight(input) {
      return mutateDemoState((state) => {
        const insight: AiInsight = {
          ...input,
          id: createId("ai"),
          created_at: new Date().toISOString()
        };
        state.aiInsights.push(insight);
        return normalizeAiInsight(insight);
      });
    },

    async recordAuditLog(input) {
      await mutateDemoState((state) => appendDemoAuditLog(state, input));
    },

    async fetchRestaurantData(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      return normalizeRestaurantData(
        fetchRestaurantFromState(state, restaurantId),
        state.posSales.filter((sale) => sale.restaurant_id === restaurantId),
        state.inventoryItems.filter((item) => item.restaurant_id === restaurantId),
        state.purchaseRecommendations.filter((recommendation) => recommendation.restaurant_id === restaurantId),
        state.insights.filter((insight) => insight.restaurant_id === restaurantId),
        state.menuItemIngredients.filter((mapping) => mapping.restaurant_id === restaurantId)
      );
    },

    async recordOperationalFindingDecision(input) {
      const normalized = normalizeOperationalFindingDecisionInput(input);
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, normalized.restaurantId);
        const existing = state.operationalFindingDecisions.find(
          (decision) =>
            decision.restaurant_id === normalized.restaurantId &&
            (
              decision.client_event_id === normalized.clientEventId ||
              decision.idempotency_key === normalized.idempotencyKey
            )
        );
        const recordedAt = existing?.recorded_at ?? new Date().toISOString();
        const sequence = existing?.sequence ?? state.operationalFindingDecisions.length + 1;
        const raw = {
          id: deterministicDemoEventId(normalized.restaurantId, normalized.clientEventId)
            .replace("demo_inventory_event_", "demo_finding_decision_"),
          sequence,
          restaurant_id: normalized.restaurantId,
          finding_id: normalized.finding.id,
          policy_version: normalized.finding.policyVersion,
          decision_type: normalized.decisionType,
          finding_generated_at: normalized.finding.generatedAt,
          finding_category: normalized.finding.category,
          severity: normalized.finding.severity,
          confidence_score: normalized.finding.confidence.score,
          evidence: normalized.finding.evidence,
          original_recommended_action: normalized.finding.recommendedAction,
          edited_recommended_action: normalized.editedRecommendedAction ?? null,
          client_event_id: normalized.clientEventId,
          idempotency_key: normalized.idempotencyKey,
          actor_user_id: DEMO_USER_ID,
          recorded_at: recordedAt
        };
        if (existing) {
          if (JSON.stringify(existing) !== JSON.stringify(raw)) {
            throw new Error("Operational finding decision idempotency conflict.");
          }
          return normalizeOperationalFindingDecision(existing, normalized.restaurantId);
        }
        state.operationalFindingDecisions.push(raw);
        appendDemoAuditLog(state, {
          restaurant_id: normalized.restaurantId,
          action: "operational_finding.decision_recorded",
          entity_table: "operational_finding_decisions",
          entity_id: raw.id,
          metadata: {
            finding_id: raw.finding_id,
            policy_version: raw.policy_version,
            decision_type: raw.decision_type,
            client_event_id: raw.client_event_id,
            sequence: raw.sequence,
            simulated: true
          }
        });
        return normalizeOperationalFindingDecision(raw, normalized.restaurantId);
      });
    },

    async fetchOperationalFindingDecisions(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      const cutoff = operationalDecisionHistoryCutoffIso();
      return state.operationalFindingDecisions
        .filter(
          (decision) =>
            decision.restaurant_id === restaurantId &&
            decision.recorded_at >= cutoff
        )
        .sort((left, right) => right.recorded_at.localeCompare(left.recorded_at))
        .map((decision) => normalizeOperationalFindingDecision(decision, restaurantId));
    },

    async fetchInventoryItems(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      return state.inventoryItems
        .filter((item) => item.restaurant_id === restaurantId)
        .map(normalizeInventoryItem)
        .sort((a, b) => a.item_name.localeCompare(b.item_name));
    },

    listInventoryEvents,

    recordInventoryEvent,

    async verifyInventoryItemCanonicalUnit(
      restaurantId,
      itemId,
      canonicalUnit,
      canonicalQuantityPerUnit
    ) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        if (
          !Number.isFinite(canonicalQuantityPerUnit) ||
          canonicalQuantityPerUnit <= 0 ||
          canonicalQuantityPerUnit > 1_000_000_000
        ) {
          throw new Error("Canonical quantity per inventory unit is invalid");
        }
        const item = state.inventoryItems.find(
          (entry) => entry.restaurant_id === restaurantId && entry.id === itemId
        );
        if (!item) throw new Error("Inventory item not found");
        const now = new Date().toISOString();
        item.canonical_unit = canonicalUnit;
        item.canonical_quantity_per_unit = canonicalQuantityPerUnit;
        item.canonical_unit_verification_status = "verified";
        item.canonical_unit_verified_at = now;
        item.canonical_unit_verified_by = DEMO_USER_ID;
        item.last_updated = now;
        appendDemoAuditLog(state, {
          restaurant_id: restaurantId,
          action: "inventory_item.canonical_unit_verified",
          entity_table: "inventory_items",
          entity_id: item.id,
          metadata: {
            canonical_unit: canonicalUnit,
            canonical_quantity_per_unit: canonicalQuantityPerUnit,
            simulated: true
          }
        });
        return normalizeInventoryItem(item);
      });
    },

    async fetchPlanningData(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      const restaurant = fetchRestaurantFromState(state, restaurantId);
      return {
        inventoryItems: state.inventoryItems.filter((item) => item.restaurant_id === restaurantId).map(normalizeInventoryItem),
        sales: state.posSales.filter((sale) => sale.restaurant_id === restaurantId).map(normalizePosSale),
        menuItemIngredients: state.menuItemIngredients
          .filter((mapping) => mapping.restaurant_id === restaurantId)
          .map(normalizeMenuItemIngredient),
        operatingDate: toDateKeyInTimeZone(new Date(), restaurant.timezone)
      };
    },

    async saveRestaurantSetupSnapshot(restaurantId, input) {
      return mutateDemoState((state) => {
        const now = new Date().toISOString();

        input.suppliers.forEach((supplierInput) => {
          const existing = state.supplierRecipients.find(
            (recipient) =>
              recipient.restaurant_id === restaurantId &&
              recipient.supplier_name.trim().toLowerCase() === supplierInput.supplier_name.trim().toLowerCase()
          );
          if (existing) {
            existing.supplier_name = supplierInput.supplier_name;
            existing.email = supplierInput.email;
            existing.updated_at = now;
          } else {
            state.supplierRecipients.push({
              ...supplierInput,
              id: createId("recipient"),
              created_at: now,
              updated_at: now
            });
          }
        });

        const inventoryByName = new Map<string, InventoryItem>();
        input.inventoryItems.forEach((inventoryInput) => {
          const key = inventoryInput.item_name.trim().toLowerCase();
          const existing = state.inventoryItems.find(
            (item) => item.restaurant_id === restaurantId && item.item_name.trim().toLowerCase() === key
          );
          if (existing) {
            Object.assign(existing, inventoryInput, { last_updated: now });
            inventoryByName.set(key, existing);
          } else {
            const item: InventoryItem = {
              ...inventoryInput,
              id: createId("item"),
              last_updated: now
            };
            state.inventoryItems.push(item);
            inventoryByName.set(key, item);
          }
        });

        input.recipeMappings.forEach((mappingInput) => {
          const inventoryItem = inventoryByName.get(mappingInput.inventory_item_name.trim().toLowerCase()) ??
            state.inventoryItems.find(
              (item) =>
                item.restaurant_id === restaurantId &&
                item.item_name.trim().toLowerCase() === mappingInput.inventory_item_name.trim().toLowerCase()
            );
          if (!inventoryItem) throw new Error("Recipe inventory item was not persisted.");
          const existing = state.menuItemIngredients.find(
            (mapping) =>
              mapping.restaurant_id === restaurantId &&
              mapping.inventory_item_id === inventoryItem.id &&
              mapping.menu_item_name.trim().toLowerCase() === mappingInput.menu_item_name.trim().toLowerCase()
          );
          if (existing) {
            existing.menu_item_name = mappingInput.menu_item_name;
            existing.quantity_used_per_sale = mappingInput.quantity_used_per_sale;
            existing.unit = mappingInput.unit;
          } else {
            state.menuItemIngredients.push({
              id: createId("map"),
              restaurant_id: restaurantId,
              menu_item_name: mappingInput.menu_item_name,
              inventory_item_id: inventoryItem.id,
              quantity_used_per_sale: mappingInput.quantity_used_per_sale,
              unit: mappingInput.unit
            });
          }
        });

        input.posSales.forEach((saleInput) => {
          const existing = saleInput.source_record_id
            ? state.posSales.find(
                (sale) =>
                  sale.restaurant_id === restaurantId &&
                  sale.source_pos === saleInput.source_pos &&
                  sale.source_record_id === saleInput.source_record_id
              )
            : undefined;
          if (existing) {
            Object.assign(existing, saleInput);
          } else {
            state.posSales.push({
              ...saleInput,
              id: createId("sale"),
              created_at: now
            });
          }
        });

        const summary: RestaurantSetupSnapshotSummary = {
          inventoryItemsSaved: input.inventoryItems.length,
          supplierRecipientsSaved: input.suppliers.length,
          recipeMappingsSaved: input.recipeMappings.length,
          posSalesRowsSaved: input.posSales.length,
          attachmentMetadataSaved: input.attachments.length,
          skippedRecipeIngredients: input.skippedRecipeIngredients
        };
        appendDemoAuditLog(state, {
          restaurant_id: restaurantId,
          action: "setup_completed",
          entity_table: "restaurants",
          entity_id: restaurantId,
          metadata: {
            inventory_items_saved: summary.inventoryItemsSaved,
            supplier_recipients_saved: summary.supplierRecipientsSaved,
            recipe_mappings_saved: summary.recipeMappingsSaved,
            pos_sales_rows_saved: summary.posSalesRowsSaved,
            attachment_metadata_saved: summary.attachmentMetadataSaved,
            skipped_recipe_ingredients: summary.skippedRecipeIngredients
          }
        });
        return summary;
      });
    },

    async upsertInventoryItem(input) {
      return mutateDemoState((state) => {
        const now = new Date().toISOString();
        const existing = state.inventoryItems.find(
          (item) =>
            item.restaurant_id === input.restaurant_id &&
            item.item_name.trim().toLowerCase() === input.item_name.trim().toLowerCase()
        );

        if (existing) {
          Object.assign(existing, input, { last_updated: now });
          return normalizeInventoryItem(existing);
        }

        const item: InventoryItem = {
          ...input,
          id: createId("item"),
          last_updated: now
        };
        state.inventoryItems.push(item);
        return normalizeInventoryItem(item);
      });
    },

    async createPosSale(input) {
      return mutateDemoState((state) => {
        const sale: PosSale = {
          ...input,
          id: createId("sale"),
          created_at: new Date().toISOString()
        };
        state.posSales.push(sale);
        return normalizePosSale(sale);
      });
    },

    async updateInventoryItem(restaurantId, itemId, patch) {
      const payload = { ...patch, last_updated: new Date().toISOString() };
      return mutateDemoState((state) => {
        const item = state.inventoryItems.find((entry) => entry.restaurant_id === restaurantId && entry.id === itemId);
        if (!item) throw new Error("Inventory item not found");
        Object.assign(item, payload);
        return normalizeInventoryItem(item);
      });
    },

    async updateInventoryItemAndSignals(
      restaurantId,
      itemId,
      expectedLastUpdated,
      patch,
      recommendations,
      insights
    ) {
      return mutateDemoState((state) => {
        const item = state.inventoryItems.find(
          (entry) => entry.restaurant_id === restaurantId && entry.id === itemId
        );
        if (!item) throw new Error("Inventory item not found");
        if (item.last_updated !== expectedLastUpdated) {
          throw new Error("Inventory item changed since it was loaded. Reload and try again.");
        }
        Object.assign(item, patch, { last_updated: new Date().toISOString() });
        state.purchaseRecommendations = [
          ...state.purchaseRecommendations.filter(
            (recommendation) => recommendation.restaurant_id !== restaurantId || recommendation.status !== "pending"
          ),
          ...recommendations.map((recommendation) => ({
            ...recommendation,
            id: createId("rec"),
            created_at: new Date().toISOString()
          }))
        ];
        state.insights = [
          ...state.insights.filter((insight) => insight.restaurant_id !== restaurantId),
          ...insights
        ];
        return normalizeInventoryItem(item);
      });
    },

    async updateMenuItemIngredientQuantity(restaurantId, mappingId, quantityUsedPerSale) {
      return mutateDemoState((state) => {
        const mapping = state.menuItemIngredients.find(
          (entry) => entry.restaurant_id === restaurantId && entry.id === mappingId
        );
        if (!mapping) throw new Error("Recipe baseline mapping not found");
        mapping.quantity_used_per_sale = quantityUsedPerSale;
        return normalizeMenuItemIngredient(mapping);
      });
    },

    async upsertMenuItemIngredient(input) {
      return mutateDemoState((state) => {
        const inventoryItem = state.inventoryItems.find(
          (item) => item.restaurant_id === input.restaurant_id && item.id === input.inventory_item_id
        );
        if (!inventoryItem) throw new Error("Inventory item not found");

        const existing = state.menuItemIngredients.find(
          (entry) =>
            entry.restaurant_id === input.restaurant_id &&
            entry.inventory_item_id === input.inventory_item_id &&
            entry.menu_item_name.trim().toLowerCase() === input.menu_item_name.trim().toLowerCase()
        );

        if (existing) {
          existing.menu_item_name = input.menu_item_name;
          existing.quantity_used_per_sale = input.quantity_used_per_sale;
          existing.unit = input.unit || inventoryItem.unit;
          return normalizeMenuItemIngredient(existing);
        }

        const mapping: MenuItemIngredient = {
          ...input,
          id: createId("map"),
          unit: input.unit || inventoryItem.unit
        };
        state.menuItemIngredients.push(mapping);
        return normalizeMenuItemIngredient(mapping);
      });
    },

    async saveRecipeMappingAndSignals(input) {
      return mutateDemoState((state) => {
        const inventoryItem = state.inventoryItems.find(
          (item) => item.restaurant_id === input.restaurantId && item.id === input.inventoryItemId
        );
        if (!inventoryItem) throw new Error("Inventory item not found");
        let mapping = input.mappingId
          ? state.menuItemIngredients.find(
              (entry) => entry.restaurant_id === input.restaurantId && entry.id === input.mappingId
            )
          : state.menuItemIngredients.find(
              (entry) =>
                entry.restaurant_id === input.restaurantId &&
                entry.inventory_item_id === input.inventoryItemId &&
                entry.menu_item_name.trim().toLowerCase() === input.menuItemName.trim().toLowerCase()
            );
        if (input.mappingId) {
          if (!mapping) throw new Error("Recipe mapping not found");
          if (mapping.quantity_used_per_sale !== input.expectedQuantity) {
            throw new Error("Recipe mapping changed since it was loaded. Reload and try again.");
          }
        }
        if (mapping) {
          mapping.menu_item_name = input.menuItemName;
          mapping.quantity_used_per_sale = input.quantityUsedPerSale;
          mapping.unit = input.unit;
        } else {
          mapping = {
            id: createId("map"),
            restaurant_id: input.restaurantId,
            menu_item_name: input.menuItemName,
            inventory_item_id: input.inventoryItemId,
            quantity_used_per_sale: input.quantityUsedPerSale,
            unit: input.unit
          };
          state.menuItemIngredients.push(mapping);
        }
        state.purchaseRecommendations = [
          ...state.purchaseRecommendations.filter(
            (recommendation) => recommendation.restaurant_id !== input.restaurantId || recommendation.status !== "pending"
          ),
          ...input.recommendations.map((recommendation) => ({
            ...recommendation,
            id: createId("rec"),
            created_at: new Date().toISOString()
          }))
        ];
        state.insights = [
          ...state.insights.filter((insight) => insight.restaurant_id !== input.restaurantId),
          ...input.insights
        ];
        return normalizeMenuItemIngredient(mapping);
      });
    },

    async findPendingRecommendation(restaurantId, itemId) {
      const state = await readReadyDemoState(restaurantId);
      const recommendation = state.purchaseRecommendations.find(
        (entry) => entry.restaurant_id === restaurantId && entry.inventory_item_id === itemId && entry.status === "pending"
      );
      return recommendation ? normalizePurchaseRecommendation(recommendation) : null;
    },

    async createPurchaseRecommendation(input) {
      return mutateDemoState((state) => {
        const existing = state.purchaseRecommendations.find(
          (recommendation) =>
            recommendation.restaurant_id === input.restaurant_id &&
            recommendation.inventory_item_id === input.inventory_item_id &&
            recommendation.status === "pending"
        );
        if (existing) return normalizePurchaseRecommendation(existing);
        const recommendation: PurchaseRecommendation = {
          ...input,
          id: createId("rec"),
          created_at: new Date().toISOString()
        };
        state.purchaseRecommendations.push(recommendation);
        return normalizePurchaseRecommendation(recommendation);
      });
    },

    async fetchPurchaseRecommendations(restaurantId, status = "pending") {
      const state = await readReadyDemoState(restaurantId);
      return state.purchaseRecommendations
        .filter((recommendation) => recommendation.restaurant_id === restaurantId)
        .filter((recommendation) => status === "all" || recommendation.status === status)
        .map(normalizePurchaseRecommendation)
        .sort((a, b) => severityRankForUrgency(b.urgency) - severityRankForUrgency(a.urgency));
    },

    async fetchRecommendationHistory(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      const cutoff = recommendationHistoryCutoffIso();
      return state.purchaseRecommendations
        .filter((recommendation) => recommendation.restaurant_id === restaurantId)
        .filter((recommendation) => recommendation.created_at >= cutoff)
        .map(normalizePurchaseRecommendation)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async updatePurchaseRecommendation(restaurantId, recommendationId, patch) {
      return mutateDemoState((state) => {
        const recommendation = state.purchaseRecommendations.find(
          (item) => item.restaurant_id === restaurantId && item.id === recommendationId
        );
        if (!recommendation) throw new Error("Recommendation not found");
        Object.assign(recommendation, patch);
        return normalizePurchaseRecommendation(recommendation);
      });
    },

    async approvePurchaseRecommendation(restaurantId, recommendationId, recommendedQuantity) {
      return mutateDemoState((state) => {
        const result = approveRecommendationInDemoState(
          state,
          restaurantId,
          recommendationId,
          recommendedQuantity
        );
        if (result.outcome === "applied") {
          appendDemoRecommendationActivity(state, result.recommendation, "pending");
          if (result.order) {
            appendDemoSupplierOrderActivity(state, result.order, { previousStatus: null });
          }
          appendDemoAuditLog(state, {
            restaurant_id: restaurantId,
            action: "recommendation_approved",
            entity_table: "purchase_recommendations",
            entity_id: result.recommendation.id,
            metadata: {
              supplier_name: result.recommendation.supplier_name,
              urgency: result.recommendation.urgency,
              supplier_order_id: result.order?.id ?? null
            }
          });
        }
        return {
          ...result,
          recommendation: normalizePurchaseRecommendation(result.recommendation),
          order: result.order ? normalizeSupplierOrder(result.order) : null
        };
      });
    },

    async dismissPurchaseRecommendation(restaurantId, recommendationId) {
      return mutateDemoState((state) => {
        const result = dismissRecommendationInDemoState(state, restaurantId, recommendationId);
        if (result.outcome === "applied") {
          appendDemoRecommendationActivity(state, result.recommendation, "pending");
          appendDemoAuditLog(state, {
            restaurant_id: restaurantId,
            action: "recommendation_dismissed",
            entity_table: "purchase_recommendations",
            entity_id: result.recommendation.id,
            metadata: {
              supplier_name: result.recommendation.supplier_name,
              urgency: result.recommendation.urgency
            }
          });
        }
        return { ...result, recommendation: normalizePurchaseRecommendation(result.recommendation) };
      });
    },

    async undoPurchaseRecommendationAction(restaurantId, recommendationId) {
      return mutateDemoState((state) => {
        const result = undoRecommendationInDemoState(state, restaurantId, recommendationId);
        if (result.outcome === "applied") {
          appendDemoAuditLog(state, {
            restaurant_id: restaurantId,
            action: "recommendation_undo",
            entity_table: "purchase_recommendations",
            entity_id: result.recommendation.id,
            metadata: {
              previous_status: result.previousStatus,
              supplier_name: result.recommendation.supplier_name
            }
          });
        }
        return {
          ...result,
          recommendation: normalizePurchaseRecommendation(result.recommendation),
          order: result.order ? normalizeSupplierOrder(result.order) : null
        };
      });
    },

    async replacePendingRecommendations(restaurantId, inserts) {
      await mutateDemoState((state) => {
        const created = inserts.map((insert) => ({
          ...insert,
          id: createId("rec"),
          created_at: new Date().toISOString()
        }));
        state.purchaseRecommendations = [
          ...state.purchaseRecommendations.filter(
            (recommendation) => recommendation.restaurant_id !== restaurantId || recommendation.status !== "pending"
          ),
          ...created
        ];
        for (const recommendation of created) {
          appendDemoRecommendationActivity(state, recommendation, null);
        }
      });
    },

    async fetchApprovedRecommendations(restaurantId, supplierName) {
      const state = await readDemoState();
      return state.purchaseRecommendations
        .filter(
          (recommendation) =>
            recommendation.restaurant_id === restaurantId &&
            recommendation.status === "approved" &&
            (!supplierName || recommendation.supplier_name === supplierName)
        )
        .map(normalizePurchaseRecommendation);
    },

    async markApprovedRecommendationsOrdered(restaurantId, supplierName) {
      return mutateDemoState((state) => {
        const ordered = state.purchaseRecommendations.filter(
          (recommendation) =>
            recommendation.restaurant_id === restaurantId &&
            recommendation.supplier_name === supplierName &&
            recommendation.status === "approved"
        );
        ordered.forEach((recommendation) => {
          recommendation.status = "ordered";
        });
        return ordered.map(normalizePurchaseRecommendation);
      });
    },

    async upsertSupplierOrderDraft(draft) {
      return mutateDemoState((state) => {
        const existing = state.supplierOrders.find(
          (order) =>
            order.restaurant_id === draft.restaurant_id &&
            order.supplier_name === draft.supplier_name &&
            order.status === "draft"
        );
        if (existing) {
          existing.order_message = draft.order_message;
          existing.delivery_date = draft.delivery_date;
          return normalizeSupplierOrder(existing);
        }
        state.supplierOrders.push(draft);
        return normalizeSupplierOrder(draft);
      });
    },

    async deleteSupplierOrderDraft(restaurantId, supplierName) {
      await mutateDemoState((state) => {
        state.supplierOrders = state.supplierOrders.filter(
          (order) =>
            order.restaurant_id !== restaurantId ||
            order.supplier_name !== supplierName ||
            order.status !== "draft"
        );
      });
    },

    async fetchSupplierOrders(restaurantId) {
      const state = await readDemoState();
      return state.supplierOrders
        .filter((order) => order.restaurant_id === restaurantId)
        .map(normalizeSupplierOrder)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async fetchSupplierDeliveryHistory(restaurantId) {
      const state = await readDemoState();
      const deliveries = (state.supplierDeliveries ?? [])
        .filter((delivery) => delivery.restaurant_id === restaurantId)
        .sort((left, right) => right.received_at.localeCompare(left.received_at))
        .slice(0, 100)
        .map((delivery) => normalizeSupplierDeliveryRecord(delivery));
      const deliveryIds = new Set(deliveries.map((delivery) => delivery.id));
      const items = (state.supplierDeliveryItems ?? [])
        .filter(
          (item) => item.restaurant_id === restaurantId && deliveryIds.has(item.delivery_id)
        )
        .slice(0, 1000)
        .map((item) => normalizeSupplierDeliveryItemRecord(item));
      return { deliveries, items };
    },

    async fetchSupplierOrder(restaurantId, orderId) {
      const state = await readDemoState();
      const order = state.supplierOrders.find((item) => item.restaurant_id === restaurantId && item.id === orderId);
      if (!order) throw new Error("Order draft not found");
      return normalizeSupplierOrder(order);
    },

    async updateSupplierOrder(restaurantId, orderId, patch) {
      return mutateDemoState((state) => {
        const order = state.supplierOrders.find((item) => item.restaurant_id === restaurantId && item.id === orderId);
        if (!order) throw new Error("Order draft not found");
        if (order.status !== "draft") throw new Error("Sent orders cannot be edited.");
        Object.assign(order, patch);
        if (Object.prototype.hasOwnProperty.call(patch, "operator_note")) {
          order.operator_note = patch.operator_note?.trim() || null;
          const linked = state.purchaseRecommendations.filter(
            (recommendation) =>
              recommendation.restaurant_id === restaurantId &&
              recommendation.supplier_order_id === orderId &&
              recommendation.status === "approved"
          );
          order.order_message = buildSupplierOrderMessage(order.supplier_name, linked, order.operator_note);
        }
        return normalizeSupplierOrder(order);
      });
    },

    async markSupplierOrderSent(restaurantId, orderId) {
      return mutateDemoState((state) => {
        const result = markSupplierOrderSentInDemoState(state, restaurantId, orderId);
        if (result.outcome === "applied") {
          appendDemoSupplierOrderActivity(state, result.order, { previousStatus: "draft" });
          appendDemoAuditLog(state, {
            restaurant_id: restaurantId,
            action: "supplier_order_sent",
            entity_table: "supplier_orders",
            entity_id: result.order.id,
            metadata: {
              supplier_name: result.order.supplier_name,
              ordered_recommendation_count: result.orderedRecommendations.length
            }
          });
        }
        return {
          ...result,
          order: normalizeSupplierOrder(result.order),
          orderedRecommendations: result.orderedRecommendations.map(normalizePurchaseRecommendation)
        };
      });
    },

    async connectRestaurantGmail(restaurantId) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        const now = new Date().toISOString();
        let connection = state.emailConnections.find(
          (entry) => entry.restaurant_id === restaurantId && entry.provider === "gmail"
        );
        if (!connection) {
          connection = {
            id: createId("email_connection"),
            restaurant_id: restaurantId,
            provider: "gmail",
            status: "connected",
            sender_email: "demo.sender@example.com",
            last_verified_at: now,
            created_at: now,
            updated_at: now
          };
          state.emailConnections.push(connection);
        } else {
          connection.status = "connected";
          connection.sender_email = "demo.sender@example.com";
          connection.last_verified_at = now;
          connection.updated_at = now;
        }
        appendDemoAuditLog(state, {
          restaurant_id: restaurantId,
          action: "gmail_demo_connected",
          entity_table: "restaurant_email_connections",
          entity_id: connection.id,
          metadata: { provider: "gmail", simulated: true }
        });
        return {
          status: "connected" as const,
          outcome: "demo_connected" as const,
          connection: normalizeRestaurantEmailConnection(connection)
        };
      });
    },

    async connectRestaurantSquare(restaurantId) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        const now = new Date().toISOString();
        let integration = state.posIntegrations.find(
          (entry) => entry.restaurant_id === restaurantId && entry.provider === "square"
        );
        if (!integration) {
          integration = {
            id: createId("pos_integration"),
            restaurant_id: restaurantId,
            provider: "square",
            status: "connected",
            external_location_id: "demo-square-location",
            last_sync_at: now,
            sync_cursor: null,
            settings: {},
            created_at: now,
            updated_at: now
          };
          state.posIntegrations.push(integration);
        } else {
          integration.status = "connected";
          integration.updated_at = now;
          integration.last_sync_at = now;
        }
        state.posProvider = "Square";
        state.posConnectedAt = now;
        appendDemoAuditLog(state, {
          restaurant_id: restaurantId,
          action: "square_demo_connected",
          entity_table: "pos_integrations",
          entity_id: integration.id,
          metadata: { provider: "square", simulated: true }
        });
        return {
          status: "connected" as const,
          outcome: "demo_connected" as const,
          integration: normalizePosIntegration(integration)
        };
      });
    },

    async disconnectRestaurantSquare(restaurantId) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        const integration = state.posIntegrations.find(
          (entry) => entry.restaurant_id === restaurantId && entry.provider === "square"
        );
        const alreadyDisconnected = !integration || integration.status === "not_connected";
        if (integration) {
          integration.status = "not_connected";
          integration.last_sync_at = null;
          integration.sync_cursor = null;
          integration.updated_at = new Date().toISOString();
        }
        if (state.posProvider === "Square") {
          state.posProvider = null;
          state.posConnectedAt = null;
        }
        appendDemoAuditLog(state, {
          restaurant_id: restaurantId,
          action: "square_demo_disconnected",
          entity_table: "pos_integrations",
          entity_id: integration?.id ?? null,
          metadata: { provider: "square", simulated: true }
        });
        return {
          status: "not_connected" as const,
          outcome: alreadyDisconnected ? ("already_disconnected" as const) : ("disconnected" as const)
        };
      });
    },

    async syncSquarePosSales(restaurantId, _from, _to) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        const salesCount = state.posSales.filter((sale) => sale.restaurant_id === restaurantId).length;
        return {
          status: "completed" as const,
          importId: null,
          recordsProcessed: salesCount,
          catalogProcessed: 0
        };
      });
    },

    async fetchSquarePosIntegration(restaurantId) {
      const state = await readDemoState();
      requireActiveDemoRestaurant(state, restaurantId);
      const integration = state.posIntegrations.find(
        (entry) => entry.restaurant_id === restaurantId && entry.provider === "square"
      );
      return integration ? normalizePosIntegration(integration) : null;
    },

    async disconnectRestaurantGmail(restaurantId) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        const connection = state.emailConnections.find(
          (entry) => entry.restaurant_id === restaurantId && entry.provider === "gmail"
        );
        const alreadyDisconnected = !connection || connection.status === "not_connected";
        if (connection) {
          connection.status = "not_connected";
          connection.sender_email = null;
          connection.last_verified_at = null;
          connection.updated_at = new Date().toISOString();
        }
        appendDemoAuditLog(state, {
          restaurant_id: restaurantId,
          action: "gmail_demo_disconnected",
          entity_table: "restaurant_email_connections",
          entity_id: connection?.id ?? null,
          metadata: { provider: "gmail", simulated: true, already_disconnected: alreadyDisconnected }
        });
        return {
          status: "not_connected" as const,
          outcome: alreadyDisconnected ? "already_disconnected" as const : "disconnected" as const
        };
      });
    },

    async sendSupplierOrderEmail(restaurantId, orderId) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        const order = state.supplierOrders.find(
          (entry) => entry.restaurant_id === restaurantId && entry.id === orderId
        );
        if (!order) throw new Error("Order draft not found");
        const connection = state.emailConnections.find(
          (entry) => entry.restaurant_id === restaurantId && entry.provider === "gmail"
        );
        if (connection?.status === "needs_reauth") {
          throw new GmailIntegrationError("needs_reauth", "Reconnect the demo Gmail sender before sending this order.");
        }
        if (!connection || connection.status !== "connected") {
          throw new GmailIntegrationError("gmail_not_connected", "Connect the demo Gmail sender before sending this order.");
        }
        const recipient = state.supplierRecipients.find(
          (entry) =>
            entry.restaurant_id === restaurantId &&
            entry.supplier_name.trim().toLowerCase() === order.supplier_name.trim().toLowerCase()
        );
        if (!recipient?.email) {
          throw new GmailIntegrationError("supplier_email_missing", `Add an email recipient for ${order.supplier_name} before sending.`);
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) {
          throw new GmailIntegrationError("supplier_email_invalid", `Add a valid email recipient for ${order.supplier_name} before sending.`);
        }

        const actionKey = miseActionIdempotencyKey(
          restaurantId,
          "send_supplier_order",
          orderId
        );
        let existingAction = (state.miseActions ?? []).find(
          (entry) => entry.idempotencyKey === actionKey
        );
        if (!existingAction) {
          existingAction = createPreparedAction({
            restaurantId,
            actionType: "send_supplier_order",
            idempotencyKey: actionKey,
            expectedImpact: { supplierName: order.supplier_name, orderId },
            now: order.created_at
          });
          state.miseActions = [...(state.miseActions ?? []), existingAction];
        }
        if (["rejected", "cancelled", "reversed", "unverified"].includes(existingAction.status)) {
          throw new Error("This supplier order action is not approved for sending.");
        }

        const wasAlreadySent = order.status === "sent" || order.status === "completed";
        const result = markSupplierOrderSentInDemoState(state, restaurantId, orderId);
        const providerMessageId = `demo-gmail:${orderId}`;
        if (!wasAlreadySent) {
          appendDemoSupplierOrderActivity(state, result.order, { previousStatus: "draft" });
          const approvedAction =
            existingAction.status === "prepared" ||
            existingAction.status === "waiting_for_approval" ||
            existingAction.status === "failed"
              ? markApproved(existingAction, DEMO_USER_ID)
              : existingAction;
          const executedAction =
            approvedAction.status === "executed"
              ? approvedAction
              : markExecuted(approvedAction, {
                  supplierOrderId: orderId,
                  provider: "gmail",
                  providerMessageId,
                  simulated: true
                });
          state.miseActions = (state.miseActions ?? []).map((entry) =>
            entry.id === existingAction.id ? executedAction : entry
          );
          appendDemoAuditLog(state, {
            restaurant_id: restaurantId,
            action: "supplier_email_sent",
            entity_table: "supplier_orders",
            entity_id: orderId,
            metadata: {
              provider: "gmail",
              provider_message_id: providerMessageId,
              simulated: true,
              ordered_recommendation_count: result.orderedRecommendations.length
            }
          });
        }
        return {
          status: "sent" as const,
          outcome: wasAlreadySent ? "already_sent" as const : result.outcome,
          providerMessageId,
          order: normalizeSupplierOrder(result.order),
          orderedRecommendations: result.orderedRecommendations.map(normalizePurchaseRecommendation)
        };
      });
    },

    async fetchInsights(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      return state.insights
        .filter((insight) => insight.restaurant_id === restaurantId)
        .map(normalizeInsight)
        .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
    },

    async replaceInsights(restaurantId, insights) {
      await mutateDemoState((state) => {
        state.insights = [
          ...state.insights.filter((insight) => insight.restaurant_id !== restaurantId),
          ...insights
        ];
      });
    },

    async replaceOperationalSignals(restaurantId, recommendations, insights) {
      await mutateDemoState((state) => {
        state.purchaseRecommendations = [
          ...state.purchaseRecommendations.filter(
            (recommendation) => recommendation.restaurant_id !== restaurantId || recommendation.status !== "pending"
          ),
          ...recommendations.map((recommendation) => ({
            ...recommendation,
            id: createId("rec"),
            created_at: new Date().toISOString()
          }))
        ];
        state.insights = [
          ...state.insights.filter((insight) => insight.restaurant_id !== restaurantId),
          ...insights
        ];
      });
    },

    async fetchEmailConnectionState(restaurantId) {
      const state = await readDemoState();
      const connection =
        state.emailConnections.find((entry) => entry.restaurant_id === restaurantId && entry.provider === "gmail") ??
        null;
      return connection ? normalizeRestaurantEmailConnection(connection) : null;
    },

    async fetchSupplierRecipients(restaurantId) {
      const state = await readDemoState();
      return state.supplierRecipients
        .filter((recipient) => recipient.restaurant_id === restaurantId)
        .map(normalizeSupplierRecipient)
        .sort((a, b) => a.supplier_name.localeCompare(b.supplier_name));
    },

    async upsertSupplierRecipient(input) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, input.restaurant_id);
        const catalogReferences = [
          ...state.inventoryItems.map((item) => ({ restaurantId: item.restaurant_id, supplierName: item.supplier_name })),
          ...state.supplierItems.map((item) => ({ restaurantId: item.restaurant_id, supplierName: item.supplier_name })),
          ...state.supplierOrders.map((order) => ({ restaurantId: order.restaurant_id, supplierName: order.supplier_name })),
          ...state.purchaseRecommendations.map((recommendation) => ({
            restaurantId: recommendation.restaurant_id,
            supplierName: recommendation.supplier_name
          })),
          ...state.purchaseOrders.map((order) => ({ restaurantId: order.restaurant_id, supplierName: order.supplier_name })),
          ...state.supplierRecipients.map((recipient) => ({
            restaurantId: recipient.restaurant_id,
            supplierName: recipient.supplier_name
          }))
        ];
        const canonicalSupplierName = findSupplierRecipientCatalogName(
          input.restaurant_id,
          input.supplier_name,
          catalogReferences
        );
        if (!canonicalSupplierName) throw new Error("Supplier is not part of this restaurant catalog");

        const now = new Date().toISOString();
        const existing = state.supplierRecipients.find(
          (recipient) =>
            recipient.restaurant_id === input.restaurant_id &&
            supplierRecipientDirectoryKey(recipient.supplier_name) ===
              supplierRecipientDirectoryKey(canonicalSupplierName)
        );

        if (existing) {
          const changed = existing.supplier_name !== canonicalSupplierName || existing.email !== input.email;
          if (!changed) return normalizeSupplierRecipient(existing);
          existing.supplier_name = canonicalSupplierName;
          existing.email = input.email;
          existing.updated_at = now;
          appendDemoAuditLog(state, {
            restaurant_id: input.restaurant_id,
            action: "supplier_recipient_updated",
            entity_table: "supplier_recipients",
            entity_id: existing.id,
            metadata: { supplier_name: canonicalSupplierName, email_configured: true, simulated: true }
          });
          return normalizeSupplierRecipient(existing);
        }

        const recipient: SupplierRecipient = {
          ...input,
          supplier_name: canonicalSupplierName,
          id: createId("recipient"),
          created_at: now,
          updated_at: now
        };
        state.supplierRecipients.push(recipient);
        appendDemoAuditLog(state, {
          restaurant_id: input.restaurant_id,
          action: "supplier_recipient_created",
          entity_table: "supplier_recipients",
          entity_id: recipient.id,
          metadata: { supplier_name: canonicalSupplierName, email_configured: true, simulated: true }
        });
        return normalizeSupplierRecipient(recipient);
      });
    },

    async createSetupAttachment(input) {
      const now = new Date().toISOString();
      return normalizeSetupAttachment({
        ...input,
        id: createId("setup_ref"),
        created_by: null,
        created_at: now,
        updated_at: now
      });
    },

    async loadDemoPOSData(provider, setupProfile) {
      const state = await resetDemoStore(provider, setupProfile, prepareResetDemoState);
      const restaurant = state.restaurants[0];
      if (!restaurant) throw new Error("Demo restaurant missing");
      return normalizeRestaurant(restaurant);
    },

    async resetDemoData(provider, setupProfile) {
      const state = await resetDemoStore(provider, setupProfile, prepareResetDemoState);
      const restaurant = state.restaurants[0];
      if (!restaurant) throw new Error("Demo restaurant missing");
      return normalizeRestaurant(restaurant);
    },

    async fetchPOSStatus() {
      const state = await readDemoState();
      return {
        provider: state.posProvider,
        connectedAt: state.posConnectedAt,
        label: state.posProvider ? "Demo connected" : "Demo mode"
      };
    },

    async listActivityEvents(restaurantId, options = {}) {
      const state = await readReadyDemoState(restaurantId);
      let events = (state.activityEvents ?? [])
        .filter((event) => event.restaurantId === restaurantId)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      if (options.since) {
        events = events.filter((event) => event.occurredAt >= options.since!);
      }
      if (options.until) {
        events = events.filter((event) => event.occurredAt <= options.until!);
      }
      if (options.attentionOnly) {
        events = events.filter((event) => event.requiresAttention);
      }
      if (options.filter && options.filter !== "all") {
        events = filterActivities(events, options.filter as ActivityFeedFilter);
      }
      return events.slice(0, options.limit ?? 100);
    },

    async listRestaurantTasks(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      requireActiveDemoRestaurant(state, restaurantId);
      return (state.restaurantTasks ?? [])
        .filter((task) => task.restaurantId === restaurantId)
        .map((task) => ({ ...task, dependencyIds: [...task.dependencyIds] }));
    },

    async createRestaurantTask(input) {
      const normalized = normalizeCreateRestaurantTaskInput(input);
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, normalized.restaurantId);
        const existing = (state.restaurantTasks ?? []).find(
          (task) =>
            task.restaurantId === normalized.restaurantId &&
            task.clientTaskId === normalized.clientTaskId
        );
        if (existing) {
          if (
            existing.createdBy !== DEMO_USER_ID ||
            !restaurantTaskMatchesCreateRequest(existing, normalized)
          ) {
            throw new Error("Client task id already belongs to a different request.");
          }
          return { ...existing, dependencyIds: [...existing.dependencyIds] };
        }
        if (normalized.assigneeUserId && normalized.assigneeUserId !== DEMO_USER_ID) {
          throw new Error("Task assignee is not an active demo restaurant member.");
        }
        const dependencies = normalized.dependencyIds.map((dependencyId) =>
          (state.restaurantTasks ?? []).find(
            (task) => task.restaurantId === normalized.restaurantId && task.id === dependencyId
          )
        );
        if (dependencies.some((task) => !task)) {
          throw new Error("Every dependency must be a task in the same restaurant.");
        }
        const now = new Date().toISOString();
        const task: RestaurantTask = {
          id: createId("restaurant_task"),
          restaurantId: normalized.restaurantId,
          locationId: null,
          origin: normalized.origin,
          title: normalized.title,
          detail: normalized.detail,
          operationalCategory: normalized.operationalCategory,
          priority: normalized.priority,
          status: dependencies.length > 0 ? "blocked" : "waiting",
          timingBucket: normalized.timingBucket,
          dueAt: normalized.dueAt,
          serviceWindow: normalized.serviceWindow,
          windowStart: normalized.windowStart,
          windowEnd: normalized.windowEnd,
          requiredRole: normalized.requiredRole,
          assigneeUserId: normalized.assigneeUserId,
          verificationMethod: normalized.verificationMethod,
          verificationRequired: normalized.verificationMethod !== "none",
          checklist: normalized.checklist,
          completionResult: null,
          completionEvidence: [],
          completedAt: null,
          completedBy: null,
          relatedInventoryItemId: normalized.relatedInventoryItemId,
          relatedOrderId: normalized.relatedOrderId,
          relatedRecommendationId: normalized.relatedRecommendationId,
          relatedSupplierName: normalized.relatedSupplierName,
          sourceReference: normalized.sourceReference,
          createdBy: DEMO_USER_ID,
          clientTaskId: normalized.clientTaskId,
          correlationId: createId("task_correlation"),
          dependencyIds: normalized.dependencyIds,
          createdAt: now,
          updatedAt: now
        };
        state.restaurantTasks = [task, ...(state.restaurantTasks ?? [])];
        state.activityEvents = [
          ...(state.activityEvents ?? []),
          fromRestaurantTaskActivity(task, {
            activityType: "task_created",
            title: task.origin === "mise" ? "Mise prepared a restaurant task" : "Restaurant task created",
            summary: `${task.title} · ${task.status === "blocked" ? "Waiting on prerequisite work." : "Ready for the operating plan."}`,
            status: task.status === "blocked" ? "waiting_for_approval" : "scheduled",
            idempotencySuffix: "created",
            metadata: { dependencyIds: task.dependencyIds }
          })
        ];
        return { ...task, dependencyIds: [...task.dependencyIds] };
      });
    },

    async completeRestaurantTask(input) {
      const normalized = normalizeCompleteRestaurantTaskInput(input);
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, normalized.restaurantId);
        const index = (state.restaurantTasks ?? []).findIndex(
          (task) => task.restaurantId === normalized.restaurantId && task.id === normalized.taskId
        );
        if (index < 0) throw new Error("Restaurant task not found.");
        const current = state.restaurantTasks[index]!;
        if (current.status === "completed") return { ...current, dependencyIds: [...current.dependencyIds] };
        if (current.status === "cancelled") throw new Error("Cancelled tasks cannot be completed.");
        if (!canRestaurantRoleCompleteSharedTask("owner", DEMO_USER_ID, current)) {
          throw new Error("Only the assignee or an authorized restaurant role may complete this task.");
        }
        const incompleteDependency = current.dependencyIds.some((dependencyId) =>
          state.restaurantTasks.some(
            (task) => task.id === dependencyId && task.restaurantId === normalized.restaurantId && task.status !== "completed"
          )
        );
        if (incompleteDependency) throw new Error("Task prerequisites are not complete.");
        if (current.verificationRequired && normalized.completionEvidence.length === 0) {
          throw new Error("Verification evidence is required for this task.");
        }
        const now = new Date().toISOString();
        const completed: RestaurantTask = {
          ...current,
          status: "completed",
          completionResult: normalized.completionResult,
          completionEvidence: normalized.completionEvidence,
          completedAt: now,
          completedBy: DEMO_USER_ID,
          updatedAt: now
        };
        state.restaurantTasks[index] = completed;
        const events: ActivityEvent[] = [
          fromRestaurantTaskActivity(completed, {
            activityType: "task_completed",
            title: "Restaurant task completed",
            summary: `${completed.title} · Result: ${completed.completionResult}`,
            occurredAt: now,
            status: "completed",
            idempotencySuffix: "completed",
            metadata: { completionResult: completed.completionResult }
          })
        ];
        state.restaurantTasks = state.restaurantTasks.map((task) => {
          if (
            task.restaurantId !== normalized.restaurantId ||
            task.status !== "blocked" ||
            !task.dependencyIds.includes(completed.id)
          ) return task;
          const remainsBlocked = task.dependencyIds.some((dependencyId) =>
            state.restaurantTasks.some(
              (candidate) =>
                candidate.restaurantId === normalized.restaurantId &&
                candidate.id === dependencyId &&
                candidate.status !== "completed"
            )
          );
          if (remainsBlocked) return task;
          const unblocked: RestaurantTask = { ...task, status: "waiting", updatedAt: now };
          events.push(
            fromRestaurantTaskActivity(unblocked, {
              activityType: "task_unblocked",
              title: "Restaurant task is ready",
              summary: `${unblocked.title} moved to ready because its prerequisite work was completed.`,
              occurredAt: now,
              status: "scheduled",
              idempotencySuffix: `unblocked:${completed.id}`,
              metadata: { completedDependencyId: completed.id }
            })
          );
          return unblocked;
        });
        state.activityEvents = [...(state.activityEvents ?? []), ...events];
        return { ...completed, dependencyIds: [...completed.dependencyIds] };
      });
    },

    async reopenRestaurantTask(restaurantId, taskId) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        const index = (state.restaurantTasks ?? []).findIndex(
          (task) => task.restaurantId === restaurantId && task.id === taskId
        );
        if (index < 0) throw new Error("Restaurant task not found.");
        const current = state.restaurantTasks[index]!;
        if (current.status !== "completed") return { ...current, dependencyIds: [...current.dependencyIds] };
        const remainsBlocked = current.dependencyIds.some((dependencyId) =>
          state.restaurantTasks.some(
            (task) => task.restaurantId === restaurantId && task.id === dependencyId && task.status !== "completed"
          )
        );
        const now = new Date().toISOString();
        const reopened: RestaurantTask = {
          ...current,
          status: remainsBlocked ? "blocked" : "waiting",
          completionResult: null,
          completionEvidence: [],
          completedAt: null,
          completedBy: null,
          updatedAt: now
        };
        state.restaurantTasks[index] = reopened;
        state.activityEvents = [
          ...(state.activityEvents ?? []),
          fromRestaurantTaskActivity(reopened, {
            activityType: "task_reopened",
            title: "Restaurant task reopened",
            summary: `${reopened.title} was reopened for another verified result.`,
            occurredAt: now,
            status: "scheduled",
            idempotencySuffix: `reopened:${now}`
          })
        ];
        return { ...reopened, dependencyIds: [...reopened.dependencyIds] };
      });
    },

    async listRecalculationRuns(restaurantId, options = {}) {
      const state = await readReadyDemoState(restaurantId);
      let runs = (state.recalculationRuns ?? []).filter(
        (run) => run.restaurantId === restaurantId
      );
      if (options.sinceOperatingDate) {
        const since = options.sinceOperatingDate;
        runs = runs.filter((run) => run.operatingDate >= since);
      }
      return runs
        .slice()
        .sort(
          (left, right) =>
            right.operatingDate.localeCompare(left.operatingDate) || left.attempt - right.attempt
        )
        .slice(0, options.limit ?? 64)
        .map((run) => ({ ...run }));
    },

    async recordRecalculationRun(input) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, input.restaurantId);
        if (!Number.isInteger(input.attempt) || input.attempt < 1 || input.attempt > 4) {
          throw new Error("Recalculation run attempt is out of range.");
        }
        if (input.status === "failed" && !input.failureReason) {
          throw new Error("A failed recalculation run requires a failure reason.");
        }
        if (input.status === "succeeded" && (input.failureReason || input.timedOut)) {
          throw new Error("A succeeded recalculation run cannot carry a failure.");
        }

        const existing = (state.recalculationRuns ?? []).find(
          (run) =>
            run.restaurantId === input.restaurantId &&
            run.idempotencyKey === input.idempotencyKey
        );
        if (existing) {
          // Mirrors the RPC: an identical replay is the same fact recorded
          // twice; anything else is a different attempt wearing a used key.
          const identical =
            existing.cycle === input.cycle &&
            existing.operatingDate === input.operatingDate &&
            existing.status === input.status &&
            existing.attempt === input.attempt &&
            existing.jobName === input.jobName &&
            existing.monitoringOwner === input.monitoringOwner &&
            existing.durationMs === input.durationMs &&
            existing.timedOut === input.timedOut &&
            existing.failureReason === input.failureReason &&
            existing.cycleKey === input.cycleKey;
          if (!identical) {
            throw new Error(
              "Recalculation run idempotency key already recorded a different attempt."
            );
          }
          return { ...existing };
        }

        const run: PersistedRecalculationRun = {
          ...input,
          id: createId("recalculation_run"),
          recordedBy: DEMO_USER_ID,
          correlationId: createId("recalculation_correlation"),
          recordedAt: new Date().toISOString()
        };
        state.recalculationRuns = [...(state.recalculationRuns ?? []), run];

        const activity = fromRecalculationRunActivity({ ...run, maxAttempts: 4 });
        if (activity) {
          state.activityEvents = [...(state.activityEvents ?? []), activity];
        }
        return { ...run };
      });
    },

    async listMiseActions(restaurantId, options = {}) {
      const state = await readReadyDemoState(restaurantId);
      let actions = (state.miseActions ?? []).filter((action) => action.restaurantId === restaurantId);
      if (options.status === "awaiting_decision") {
        actions = actions.filter(
          (action) => action.status === "prepared" || action.status === "waiting_for_approval"
        );
      } else if (options.status) {
        actions = actions.filter((action) => action.status === options.status);
      }
      return actions
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, options.limit ?? 100);
    },

    async decideMiseAction(restaurantId, actionId, decision) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        const action = (state.miseActions ?? []).find(
          (entry) => entry.restaurantId === restaurantId && entry.id === actionId
        );
        if (!action) throw new Error("Action not found");
        const now = new Date().toISOString();
        const next =
          decision === "approved"
            ? markApproved(action, DEMO_USER_ID, now)
            : markRejected(action, DEMO_USER_ID, now);
        state.miseActions = (state.miseActions ?? []).map((entry) =>
          entry.id === actionId ? next : entry
        );
        const decisionEvent: ActivityEvent = {
          id: createId("activity"),
          restaurantId,
          locationId: null,
          occurredAt: now,
          createdAt: now,
          activityType: decision === "approved" ? "order_approved" : "recommendation_dismissed",
          category: "approvals",
          title: decision === "approved" ? "Action approved" : "Action rejected",
          summary:
            decision === "approved"
              ? `Approved prepared action (${action.actionType}).`
              : `Rejected prepared action (${action.actionType}).`,
          triggerType: "action_decision",
          triggerReference: actionId,
          evidenceReferences: [
            {
              type: "mise_action",
              id: actionId,
              summary: action.actionType,
              observedAt: now
            }
          ],
          sourceSystems: ["mise"],
          actionId,
          recommendationId: action.recommendationId,
          autonomyLevel: action.autonomyLevel,
          confidence: null,
          status: decision === "approved" ? "confirmed" : "cancelled",
          requiresAttention: false,
          attentionDeadline: null,
          relatedEntityType: "mise_action",
          relatedEntityId: actionId,
          parentActivityId: null,
          sequenceId: `mise-action:${actionId}`,
          metadata: { decision, actionType: action.actionType },
          errorCode: null,
          errorMessage: null,
          resolvedAt: now,
          resolvedBy: DEMO_USER_ID
        };
        state.activityEvents = [...(state.activityEvents ?? []), decisionEvent];
        return next;
      });
    },

    async listRestaurantMemories(restaurantId, options = {}) {
      const state = await readReadyDemoState(restaurantId);
      let memories = (state.restaurantMemories ?? []).filter(
        (memory) => memory.restaurantId === restaurantId
      );
      if (options.status === "actionable") {
        memories = memories.filter(
          (memory) =>
            memory.status === "active" ||
            memory.status === "confirmed" ||
            memory.status === "corrected"
        );
      } else if (options.status) {
        memories = memories.filter((memory) => memory.status === options.status);
      }
      return memories
        .sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt))
        .slice(0, options.limit ?? 100);
    },

    async updateRestaurantMemoryDecision(restaurantId, memoryId, decision, correction) {
      return mutateDemoState((state) => {
        const memory = (state.restaurantMemories ?? []).find(
          (entry) => entry.restaurantId === restaurantId && entry.id === memoryId
        );
        if (!memory) throw new Error("Memory not found");
        const now = new Date().toISOString();
        let next = memory;
        switch (decision as RestaurantMemoryStatus) {
          case "confirmed":
            next = confirmMemory(memory, now);
            break;
          case "corrected":
            next = correctMemory(memory, correction ?? memory.statement, now);
            break;
          case "dismissed":
            next = dismissMemory(memory, now);
            break;
          case "forgotten":
            next = forgetMemory(memory, now);
            break;
          case "disabled":
            next = temporarilyDisableMemory(memory, now);
            break;
          default:
            throw new Error("Unsupported memory decision");
        }
        state.restaurantMemories = (state.restaurantMemories ?? []).map((entry) =>
          entry.id === memoryId ? next : entry
        );
        return next;
      });
    },

    async listAutonomyRules(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      return (state.autonomyRules ?? []).filter((rule) => rule.restaurantId === restaurantId);
    },

    async upsertAutonomyRule(restaurantId, input) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        const now = new Date().toISOString();
        const existing = (state.autonomyRules ?? []).find(
          (rule) =>
            rule.restaurantId === restaurantId &&
            rule.actionType === input.actionType &&
            (rule.supplierName ?? null) === (input.supplierName ?? null) &&
            (rule.communicationType ?? null) === (input.communicationType ?? null)
        );
        if (existing) {
          const updated: RestaurantAutonomyRule = {
            ...existing,
            operationalCategory: input.operationalCategory,
            maximumAutonomyLevel: input.maximumAutonomyLevel,
            requiresApproval: input.requiresApproval,
            enabled: input.enabled,
            spendLimitCents: input.spendLimitCents ?? null,
            supplierName: input.supplierName ?? null,
            communicationType: input.communicationType ?? null,
            allowedStartTime: input.allowedStartTime ?? existing.allowedStartTime,
            allowedEndTime: input.allowedEndTime ?? existing.allowedEndTime,
            updatedAt: now
          };
          state.autonomyRules = (state.autonomyRules ?? []).map((rule) =>
            rule.id === existing.id ? updated : rule
          );
          return updated;
        }
        const created: RestaurantAutonomyRule = {
          id: createId("autonomy"),
          restaurantId,
          locationId: null,
          actionType: input.actionType,
          operationalCategory: input.operationalCategory,
          maximumAutonomyLevel: input.maximumAutonomyLevel,
          requiresApproval: input.requiresApproval,
          enabled: input.enabled,
          spendLimitCents: input.spendLimitCents ?? null,
          supplierName: input.supplierName ?? null,
          communicationType: input.communicationType ?? null,
          allowedStartTime: input.allowedStartTime ?? null,
          allowedEndTime: input.allowedEndTime ?? null,
          createdAt: now,
          updatedAt: now
        };
        state.autonomyRules = [...(state.autonomyRules ?? []), created];
        return created;
      });
    },

    async recordSupplierOrderDelivery(restaurantId, input): Promise<SupplierDeliveryRecordResult> {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        const existingDelivery = (state.supplierDeliveries ?? []).find(
          (entry) =>
            entry.restaurant_id === restaurantId &&
            entry.client_delivery_id === input.clientDeliveryId
        );
        if (existingDelivery) {
          if (existingDelivery.supplier_order_id !== input.supplierOrderId) {
            throw new Error("Delivery id belongs to another order");
          }
          const priorOutcome = (state.actionOutcomes ?? []).find(
            (entry) => entry.actualResult.deliveryId === existingDelivery.id
          );
          return {
            outcome: "already_applied",
            status: existingDelivery.status as SupplierDeliveryRecordResult["status"],
            deliveryId: existingDelivery.id,
            supplierOrderId: existingDelivery.supplier_order_id,
            outcomeId: priorOutcome?.id ?? null
          };
        }
        const order = state.supplierOrders.find(
          (entry) => entry.restaurant_id === restaurantId && entry.id === input.supplierOrderId
        );
        if (!order) throw new Error("Supplier order not found");
        if (order.status !== "sent" && order.status !== "completed") {
          throw new Error("Only sent orders can be received");
        }

        const deliveryId = createId("delivery");
        const hasDiscrepancy = input.lines.some(
          (line) =>
            (line.damagedQuantity ?? 0) > 0 ||
            (line.missingQuantity ?? 0) > 0 ||
            Boolean(line.discrepancyReason)
        );
        const status = hasDiscrepancy ? "discrepancy" : "received";
        if (status === "received") order.status = "completed";

        const actionKey = miseActionIdempotencyKey(restaurantId, "send_supplier_order", order.id);
        let action = (state.miseActions ?? []).find((entry) => entry.idempotencyKey === actionKey);
        if (!action) {
          action = createPreparedAction({
            restaurantId,
            actionType: "send_supplier_order",
            idempotencyKey: actionKey,
            expectedImpact: { supplierName: order.supplier_name, orderId: order.id },
            now: order.created_at
          });
          state.miseActions = [...(state.miseActions ?? []), action];
        }
        if (action.status === "waiting_for_approval" || action.status === "prepared") {
          action = markApproved(action, DEMO_USER_ID, input.receivedAt);
        }
        if (action.status !== "executed") {
          action = markExecuted(action, { deliveryId, status }, input.receivedAt);
        }
        state.miseActions = (state.miseActions ?? []).map((entry) =>
          entry.idempotencyKey === actionKey ? action! : entry
        );

        const outcome = measureOutcome({
          restaurantId,
          actionId: action.id,
          expectedResult: { deliveryStatus: "received" },
          actualResult: { deliveryStatus: status, deliveryId, lineCount: input.lines.length },
          measuredAt: input.receivedAt,
          lesson:
            status === "received"
              ? "The supplier order was received as expected."
              : "Review this supplier outcome before adjusting reliability."
        });
        state.actionOutcomes = [...(state.actionOutcomes ?? []), outcome];
        state.supplierDeliveries = [
          ...(state.supplierDeliveries ?? []),
          {
            id: deliveryId,
            restaurant_id: restaurantId,
            supplier_order_id: order.id,
            status,
            received_at: input.receivedAt,
            client_delivery_id: input.clientDeliveryId,
            notes: input.notes ?? null,
            created_at: input.receivedAt
          }
        ];
        state.supplierDeliveryItems = [
          ...(state.supplierDeliveryItems ?? []),
          ...input.lines.map((line, index) => ({
            id: `${deliveryId}:${index + 1}`,
            restaurant_id: restaurantId,
            delivery_id: deliveryId,
            inventory_item_id: line.inventoryItemId,
            ordered_quantity: line.orderedQuantity ?? null,
            received_quantity: line.receivedQuantity,
            damaged_quantity: line.damagedQuantity ?? 0,
            missing_quantity: line.missingQuantity ?? 0,
            canonical_unit: line.canonicalUnit
          }))
        ];

        const deliveryEvent: ActivityEvent = {
          id: createId("activity"),
          restaurantId,
          locationId: null,
          occurredAt: input.receivedAt,
          createdAt: input.receivedAt,
          activityType: status === "discrepancy" ? "invoice_discrepancy_detected" : "delivery_logged",
          category: "orders",
          title: status === "discrepancy" ? "Delivery discrepancy recorded" : "Delivery logged",
          summary: `${order.supplier_name} delivery recorded with ${input.lines.length} line${
            input.lines.length === 1 ? "" : "s"
          }.`,
          triggerType: "supplier_delivery",
          triggerReference: deliveryId,
          evidenceReferences: [
            {
              type: "supplier_order",
              id: order.id,
              summary: order.supplier_name,
              observedAt: input.receivedAt
            }
          ],
          sourceSystems: ["mise", "orders", "inventory"],
          actionId: action.id,
          recommendationId: null,
          autonomyLevel: 5,
          confidence: null,
          status: status === "received" ? "confirmed" : "partially_completed",
          requiresAttention: status !== "received",
          attentionDeadline: null,
          relatedEntityType: "supplier_order",
          relatedEntityId: order.id,
          parentActivityId: null,
          sequenceId: `supplier-order:${order.id}`,
          metadata: {
            deliveryId,
            outcomeId: outcome.id,
            status,
            idempotencyKey: `supplier_delivery:${deliveryId}:${status}`
          },
          errorCode: null,
          errorMessage: null,
          resolvedAt: null,
          resolvedBy: null
        };
        state.activityEvents = [...(state.activityEvents ?? []), deliveryEvent];

        const memoryEvidence = {
          type: "supplier_delivery_outcome",
          id: deliveryId,
          summary:
            status === "received"
              ? `${order.supplier_name} delivery matched the recorded order.`
              : `${order.supplier_name} delivery had a recorded discrepancy.`,
          observedAt: input.receivedAt
        };
        const priorMemory = (state.restaurantMemories ?? []).find(
          (entry) =>
            entry.restaurantId === restaurantId &&
            entry.memoryType === "supplier_reliability" &&
            entry.source === "supplier_delivery_outcomes" &&
            entry.statement.startsWith(order.supplier_name)
        );
        let learnedMemory = priorMemory ?? null;
        if (
          !priorMemory ||
          !["dismissed", "forgotten", "disabled"].includes(priorMemory.status)
        ) {
          const evidence = [...(priorMemory?.evidence ?? []), memoryEvidence].slice(-20);
          const matched = evidence.filter((entry) => entry.summary.includes("matched")).length;
          const statement =
            matched === evidence.length
              ? `${order.supplier_name} matched all ${evidence.length} logged deliver${
                  evidence.length === 1 ? "y" : "ies"
                }.`
              : `${order.supplier_name} had discrepancies on ${
                  evidence.length - matched
                } of ${evidence.length} logged deliver${evidence.length === 1 ? "y" : "ies"}.`;
          learnedMemory = priorMemory
            ? {
                ...priorMemory,
                statement: priorMemory.status === "corrected" ? priorMemory.statement : statement,
                evidence,
                confidence: confidenceFromEvidence(evidence, {
                  now: input.receivedAt,
                  base: 0.11
                }),
                lastUpdatedAt: input.receivedAt
              }
            : createMemory({
                restaurantId,
                memoryType: "supplier_reliability",
                statement,
                evidence,
                scope: "supplier",
                source: "supplier_delivery_outcomes",
                affectsRecommendations: true,
                affectsAutomation: false,
                now: input.receivedAt
              });
          state.restaurantMemories = priorMemory
            ? (state.restaurantMemories ?? []).map((entry) =>
                entry.id === priorMemory.id ? learnedMemory! : entry
              )
            : [...(state.restaurantMemories ?? []), learnedMemory];

          const memoryEvent: ActivityEvent = {
            id: createId("activity"),
            restaurantId,
            locationId: null,
            occurredAt: input.receivedAt,
            createdAt: input.receivedAt,
            activityType: "restaurant_memory_updated",
            category: "memory",
            title: "Supplier reliability memory updated",
            summary: learnedMemory.statement,
            triggerType: "supplier_delivery_outcome",
            triggerReference: deliveryId,
            evidenceReferences: [memoryEvidence],
            sourceSystems: ["mise", "orders", "memory"],
            actionId: action.id,
            recommendationId: null,
            autonomyLevel: 5,
            confidence: learnedMemory.confidence,
            status: "completed",
            requiresAttention: false,
            attentionDeadline: null,
            relatedEntityType: "memory",
            relatedEntityId: learnedMemory.id,
            parentActivityId: null,
            sequenceId: `supplier-order:${order.id}`,
            metadata: {
              supplierName: order.supplier_name,
              sampleCount: learnedMemory.evidence.length,
              deliveryId,
              idempotencyKey: `supplier_delivery_memory:${deliveryId}`
            },
            errorCode: null,
            errorMessage: null,
            resolvedAt: null,
            resolvedBy: null
          };
          state.activityEvents = [...(state.activityEvents ?? []), memoryEvent];
        }

        for (const line of input.lines) {
          const item = state.inventoryItems.find(
            (entry) => entry.restaurant_id === restaurantId && entry.id === line.inventoryItemId
          );
          if (!item) continue;
          const receivedNet = Math.max(0, line.receivedQuantity - (line.damagedQuantity ?? 0));
          item.current_quantity = Math.round((item.current_quantity + receivedNet) * 1000) / 1000;
          item.last_updated = input.receivedAt;
        }

        appendDemoAuditLog(state, {
          restaurant_id: restaurantId,
          action: "supplier_delivery_recorded",
          entity_table: "supplier_deliveries",
          entity_id: deliveryId,
          metadata: {
            supplier_order_id: order.id,
            status,
            line_count: input.lines.length,
            outcome_id: outcome.id
          }
        });

        return {
          outcome: "applied",
          status,
          deliveryId,
          supplierOrderId: order.id,
          outcomeId: outcome.id
        };
      });
    }
  };
}

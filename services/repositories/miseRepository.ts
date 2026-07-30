import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import type {
  AppUser,
  AiInsight,
  AuditLog,
  Insight,
  InventoryItem,
  InventoryItemPatch,
  InventoryMovement,
  MenuItemIngredient,
  MenuItemIngredientInput,
  PosIntegration,
  PosProvider,
  PosSale,
  PurchaseRecommendation,
  RecommendationStatus,
  Restaurant,
  RestaurantEmailConnection,
  RestaurantMembership,
  RestaurantOpsProfile,
  SetupAttachment,
  SupplierItem,
  SupplierOrder,
  SupplierRecipient
} from "../../types/mise";
import { isTenantAuthorizationError, throwRepositoryError } from "../tenantAuthorizationEvents";
import { DEMO_RESTAURANT_ID, DEMO_USER_ID, type DemoSetupProfile, type DemoState } from "../demoData";
import {
  approveRecommendationInDemoState,
  buildInsightsFromData,
  buildSupplierOrderMessage,
  createId,
  dismissRecommendationInDemoState,
  markSupplierOrderSentInDemoState,
  rebuildInsights,
  rebuildPurchaseRecommendations,
  severityRank,
  severityRankForUrgency,
  undoRecommendationInDemoState,
  type RecommendationWorkflowResult,
  type SupplierOrderSentWorkflowResult
} from "../domain/miseDomain";
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
  normalizeInventoryMovement,
  normalizeMenuItemIngredient,
  normalizePosIntegration,
  normalizePosSale,
  normalizePurchaseRecommendation,
  normalizeRestaurant,
  normalizeRestaurantMembership,
  normalizeSetupAttachment,
  normalizeSupplierItem,
  normalizeSupplierOrder,
  normalizeSupplierRecipient
} from "../miseValidation";
import { toDateKeyInTimeZone } from "../../utils/format";

export type PurchaseRecommendationInput = Omit<PurchaseRecommendation, "id" | "created_at">;
export type SupplierOrderDraft = SupplierOrder;
export type AuditLogInput = Pick<AuditLog, "restaurant_id" | "action" | "entity_table"> &
  Partial<Pick<AuditLog, "entity_id" | "metadata">>;
export type InventoryItemInput = Omit<InventoryItem, "id" | "last_updated">;
export type PosSaleInput = Omit<PosSale, "id" | "created_at">;
export type SupplierRecipientInput = Omit<SupplierRecipient, "id" | "created_at" | "updated_at">;
export type SetupAttachmentInput = Omit<SetupAttachment, "id" | "created_at" | "updated_at" | "created_by">;

export type GmailIntegrationErrorStatus =
  | "delivery_requires_review"
  | "gmail_not_connected"
  | "in_progress"
  | "live_sending_disabled"
  | "needs_reauth"
  | "provider_rejected"
  | "provider_unavailable"
  | "request_blocked"
  | "server_configuration_missing"
  | "supplier_email_invalid"
  | "supplier_email_missing"
  | "unknown";

export class GmailIntegrationError extends Error {
  readonly status: GmailIntegrationErrorStatus;

  constructor(status: GmailIntegrationErrorStatus, message: string) {
    super(message);
    this.name = "GmailIntegrationError";
    this.status = status;
  }
}

export type GmailConnectionWorkflowResult =
  | {
      status: "authorization_required";
      authorizationUrl: string;
      expiresAt: string | null;
    }
  | {
      status: "connected";
      outcome: "demo_connected";
      connection: RestaurantEmailConnection;
    };

export interface GmailDisconnectWorkflowResult {
  status: "not_connected";
  outcome: "disconnected" | "already_disconnected";
}

export interface SupplierOrderEmailSendResult {
  status: "sent";
  outcome: "applied" | "already_applied" | "already_sent";
  providerMessageId: string | null;
  order: SupplierOrder;
  orderedRecommendations: PurchaseRecommendation[];
}

export interface RestaurantSetupSnapshotInput {
  inventoryItems: InventoryItemInput[];
  suppliers: SupplierRecipientInput[];
  recipeMappings: Array<{
    menu_item_name: string;
    inventory_item_name: string;
    quantity_used_per_sale: number;
    unit: string;
  }>;
  posSales: PosSaleInput[];
  attachments: Array<{
    client_reference_id: string;
    kind: SetupAttachment["kind"];
    label: string;
    status: SetupAttachment["status"];
  }>;
  skippedRecipeIngredients: number;
}

export interface RestaurantSetupSnapshotSummary {
  inventoryItemsSaved: number;
  supplierRecipientsSaved: number;
  recipeMappingsSaved: number;
  posSalesRowsSaved: number;
  attachmentMetadataSaved: number;
  skippedRecipeIngredients: number;
}

export interface RecipeMappingSignalInput {
  restaurantId: string;
  mappingId: string | null;
  menuItemName: string;
  inventoryItemId: string;
  quantityUsedPerSale: number;
  unit: string;
  expectedQuantity: number | null;
  recommendations: PurchaseRecommendationInput[];
  insights: Insight[];
}

export interface RestaurantData {
  restaurant: Restaurant;
  sales: PosSale[];
  inventoryItems: InventoryItem[];
  purchaseRecommendations: PurchaseRecommendation[];
  insights: Insight[];
  menuItemIngredients: MenuItemIngredient[];
}

export interface PlanningData {
  inventoryItems: InventoryItem[];
  sales: PosSale[];
  menuItemIngredients: MenuItemIngredient[];
  operatingDate: string;
}

export interface MiseRepository {
  fetchMembershipsForAuthUser(userId: string): Promise<RestaurantMembership[]>;
  addRestaurantMember(restaurantId: string, targetUserId: string, role: RestaurantMembership["role"]): Promise<RestaurantMembership>;
  updateRestaurantMember(
    restaurantId: string,
    targetUserId: string,
    patch: Partial<Pick<RestaurantMembership, "role" | "status">>
  ): Promise<RestaurantMembership>;
  removeRestaurantMember(restaurantId: string, targetUserId: string): Promise<RestaurantMembership>;
  updateMyProfile(name: string): Promise<AppUser>;
  createRestaurantWithOwner(name: string, cuisineType?: string | null): Promise<Restaurant>;
  fetchRestaurant(restaurantId: string): Promise<Restaurant>;
  updateRestaurantProfile(
    restaurantId: string,
    patch: Partial<
      Pick<
        Restaurant,
        | "name"
        | "address"
        | "cuisine_type"
        | "brand_color"
        | "accent_color"
        | "logo_url"
        | "service_style"
        | "timezone"
        | "currency"
        | "operational_profile"
      >
    >
  ): Promise<Restaurant>;
  fetchRestaurantOpsProfile(restaurantId: string): Promise<RestaurantOpsProfile>;
  fetchPosIntegrations(restaurantId: string): Promise<PosIntegration[]>;
  fetchAiInsights(restaurantId: string): Promise<AiInsight[]>;
  createAiInsight(input: Omit<AiInsight, "id" | "created_at">): Promise<AiInsight>;
  recordAuditLog(input: AuditLogInput): Promise<void>;
  fetchRestaurantData(restaurantId: string): Promise<RestaurantData>;
  fetchInventoryItems(restaurantId: string): Promise<InventoryItem[]>;
  fetchPlanningData(restaurantId: string): Promise<PlanningData>;
  saveRestaurantSetupSnapshot(
    restaurantId: string,
    input: RestaurantSetupSnapshotInput
  ): Promise<RestaurantSetupSnapshotSummary>;
  importManualPosSalesCsv(
    restaurantId: string,
    sales: Array<{
      source_record_id: string;
      sale_date: string;
      item_name: string;
      category: string;
      quantity_sold: number;
      gross_sales: number;
      net_sales: number;
      source_pos: "Manual CSV Upload";
    }>,
    sourceFileName?: string | null
  ): Promise<{ posSalesRowsSaved: number; salesImportId?: string }>;
  upsertInventoryItem(input: InventoryItemInput): Promise<InventoryItem>;
  createPosSale(input: PosSaleInput): Promise<PosSale>;
  updateInventoryItem(restaurantId: string, itemId: string, patch: InventoryItemPatch): Promise<InventoryItem>;
  updateInventoryItemAndSignals(
    restaurantId: string,
    itemId: string,
    expectedLastUpdated: string,
    patch: InventoryItemPatch,
    recommendations: PurchaseRecommendationInput[],
    insights: Insight[]
  ): Promise<InventoryItem>;
  fetchInventoryMovements(restaurantId: string, itemId: string, limit?: number): Promise<InventoryMovement[]>;
  requestAccountDeletion(confirmation: string): Promise<{ status: string; requestId?: string }>;
  updateMenuItemIngredientQuantity(
    restaurantId: string,
    mappingId: string,
    quantityUsedPerSale: number
  ): Promise<MenuItemIngredient>;
  upsertMenuItemIngredient(input: MenuItemIngredientInput): Promise<MenuItemIngredient>;
  saveRecipeMappingAndSignals(input: RecipeMappingSignalInput): Promise<MenuItemIngredient>;
  findPendingRecommendation(restaurantId: string, itemId: string): Promise<PurchaseRecommendation | null>;
  createPurchaseRecommendation(input: PurchaseRecommendationInput): Promise<PurchaseRecommendation>;
  fetchPurchaseRecommendations(
    restaurantId: string,
    status?: RecommendationStatus | "all"
  ): Promise<PurchaseRecommendation[]>;
  updatePurchaseRecommendation(
    restaurantId: string,
    recommendationId: string,
    patch: Partial<Pick<PurchaseRecommendation, "status" | "recommended_quantity" | "supplier_order_id">>
  ): Promise<PurchaseRecommendation>;
  approvePurchaseRecommendation(
    restaurantId: string,
    recommendationId: string,
    recommendedQuantity?: number
  ): Promise<RecommendationWorkflowResult>;
  dismissPurchaseRecommendation(
    restaurantId: string,
    recommendationId: string
  ): Promise<RecommendationWorkflowResult>;
  undoPurchaseRecommendationAction(
    restaurantId: string,
    recommendationId: string
  ): Promise<RecommendationWorkflowResult>;
  replacePendingRecommendations(restaurantId: string, inserts: PurchaseRecommendationInput[]): Promise<void>;
  fetchApprovedRecommendations(restaurantId: string, supplierName?: string): Promise<PurchaseRecommendation[]>;
  markApprovedRecommendationsOrdered(restaurantId: string, supplierName: string): Promise<PurchaseRecommendation[]>;
  upsertSupplierOrderDraft(draft: SupplierOrderDraft): Promise<SupplierOrder>;
  deleteSupplierOrderDraft(restaurantId: string, supplierName: string): Promise<void>;
  fetchSupplierOrders(restaurantId: string): Promise<SupplierOrder[]>;
  fetchSupplierOrder(restaurantId: string, orderId: string): Promise<SupplierOrder>;
  updateSupplierOrder(
    restaurantId: string,
    orderId: string,
    patch: Partial<Pick<SupplierOrder, "operator_note" | "delivery_date">>
  ): Promise<SupplierOrder>;
  markSupplierOrderSent(restaurantId: string, orderId: string): Promise<SupplierOrderSentWorkflowResult>;
  connectRestaurantGmail(restaurantId: string): Promise<GmailConnectionWorkflowResult>;
  disconnectRestaurantGmail(restaurantId: string): Promise<GmailDisconnectWorkflowResult>;
  sendSupplierOrderEmail(restaurantId: string, orderId: string): Promise<SupplierOrderEmailSendResult>;
  fetchInsights(restaurantId: string): Promise<Insight[]>;
  replaceInsights(restaurantId: string, insights: Insight[]): Promise<void>;
  replaceOperationalSignals(
    restaurantId: string,
    recommendations: PurchaseRecommendationInput[],
    insights: Insight[]
  ): Promise<void>;
  fetchEmailConnectionState(restaurantId: string): Promise<RestaurantEmailConnection | null>;
  fetchSupplierRecipients(restaurantId: string): Promise<SupplierRecipient[]>;
  upsertSupplierRecipient(input: SupplierRecipientInput): Promise<SupplierRecipient>;
  createSetupAttachment(input: SetupAttachmentInput): Promise<SetupAttachment>;
  loadDemoPOSData(provider: PosProvider, setupProfile?: DemoSetupProfile): Promise<Restaurant>;
  resetDemoData(provider: PosProvider | null, setupProfile?: DemoSetupProfile): Promise<Restaurant>;
  fetchPOSStatus(restaurantId?: string | null): Promise<{ provider: PosProvider | null; connectedAt: string | null; label: string }>;
}

export function createMiseRepository(): MiseRepository {
  return isSupabaseConfigured && supabase ? createSupabaseRepository() : createLocalDemoRepository();
}

function normalizeRestaurantData(
  restaurant: Restaurant,
  sales: PosSale[],
  inventoryItems: InventoryItem[],
  purchaseRecommendations: PurchaseRecommendation[],
  insights: Insight[],
  menuItemIngredients: MenuItemIngredient[]
): RestaurantData {
  return {
    restaurant: normalizeRestaurant(restaurant),
    sales: sales.map(normalizePosSale),
    inventoryItems: inventoryItems.map(normalizeInventoryItem),
    purchaseRecommendations: purchaseRecommendations.map(normalizePurchaseRecommendation),
    insights: insights.map(normalizeInsight),
    menuItemIngredients: menuItemIngredients.map(normalizeMenuItemIngredient)
  };
}

async function readReadyDemoState(restaurantId: string = DEMO_RESTAURANT_ID) {
  return mutateDemoState((state) => {
    refreshLocalDemoSalesDate(state, restaurantId);
    rebuildPurchaseRecommendations(state, restaurantId);
    rebuildInsights(state, restaurantId);
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

function isRollingDemoCurrentDaySale(saleId: string) {
  const suffix = Number.parseInt(saleId.slice(-12), 10);
  return Number.isFinite(suffix) && suffix >= 301 && suffix < 400;
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

function appendDemoInventoryMovement(
  state: DemoState,
  input: {
    restaurantId: string;
    itemId: string;
    quantityBefore: number;
    quantityAfter: number;
  }
) {
  const movement: InventoryMovement = {
    id: createId("movement"),
    restaurant_id: input.restaurantId,
    inventory_item_id: input.itemId,
    actor_user_id: DEMO_USER_ID,
    reason: "manual_count",
    quantity_before: input.quantityBefore,
    quantity_after: input.quantityAfter,
    delta: input.quantityAfter - input.quantityBefore,
    source_workflow: "update_inventory",
    metadata: {},
    created_at: new Date().toISOString()
  };
  state.inventoryMovements = [normalizeInventoryMovement(movement), ...(state.inventoryMovements ?? [])].slice(0, 200);
}

function prepareResetDemoState(state: DemoState) {
  rebuildPurchaseRecommendations(state, state.currentRestaurantId);
  rebuildInsights(state, state.currentRestaurantId);
}

function parseRecommendationWorkflowResponse(data: unknown): RecommendationWorkflowResult {
  const payload = (Array.isArray(data) ? data[0] : data) as {
    outcome?: RecommendationWorkflowResult["outcome"];
    recommendation?: PurchaseRecommendation;
    order?: SupplierOrder | null;
    previous_status?: RecommendationStatus;
  } | null;
  if (!payload?.recommendation || !payload.outcome) {
    throw new Error("Order workflow returned an invalid response.");
  }
  return {
    outcome: payload.outcome,
    recommendation: normalizePurchaseRecommendation(payload.recommendation),
    order: payload.order ? normalizeSupplierOrder(payload.order) : null,
    previousStatus: payload.previous_status ?? payload.recommendation.status
  };
}

function parseSupplierOrderSentWorkflowResponse(data: unknown): SupplierOrderSentWorkflowResult {
  const payload = (Array.isArray(data) ? data[0] : data) as {
    outcome?: SupplierOrderSentWorkflowResult["outcome"];
    order?: SupplierOrder;
    ordered_recommendations?: PurchaseRecommendation[];
  } | null;
  if (!payload?.order || !payload.outcome) {
    throw new Error("Order workflow returned an invalid response.");
  }
  return {
    outcome: payload.outcome,
    order: normalizeSupplierOrder(payload.order),
    orderedRecommendations: (payload.ordered_recommendations ?? []).map(normalizePurchaseRecommendation)
  };
}

const gmailIntegrationErrorStatuses = new Set<GmailIntegrationErrorStatus>([
  "delivery_requires_review",
  "gmail_not_connected",
  "in_progress",
  "live_sending_disabled",
  "needs_reauth",
  "provider_rejected",
  "provider_unavailable",
  "request_blocked",
  "server_configuration_missing",
  "supplier_email_invalid",
  "supplier_email_missing",
  "unknown"
]);

function parseGmailConnectionWorkflowResponse(data: unknown): GmailConnectionWorkflowResult {
  const payload = asUnknownRecord(data);
  if (payload.status !== "authorization_required") {
    throw new GmailIntegrationError("unknown", "Gmail authorization returned an invalid response.");
  }
  const authorizationUrl = requireGoogleAuthorizationUrl(payload.authorizationUrl);
  const expiresAt =
    typeof payload.expiresAt === "string" && Number.isFinite(Date.parse(payload.expiresAt))
      ? payload.expiresAt
      : null;
  return { status: "authorization_required", authorizationUrl, expiresAt };
}

function parseGmailDisconnectWorkflowResponse(data: unknown): GmailDisconnectWorkflowResult {
  const payload = asUnknownRecord(data);
  if (
    payload.status !== "not_connected" ||
    (payload.outcome !== "disconnected" && payload.outcome !== "already_disconnected")
  ) {
    throw new GmailIntegrationError("unknown", "Gmail disconnection returned an invalid response.");
  }
  return { status: "not_connected", outcome: payload.outcome };
}

function parseSupplierEmailSendResponse(
  data: unknown,
  restaurantId: string,
  orderId: string,
  fallbackOrder: SupplierOrder | null = null
): SupplierOrderEmailSendResult {
  const payload = asUnknownRecord(data);
  if (
    payload.status !== "sent" ||
    (payload.outcome !== "applied" && payload.outcome !== "already_applied" && payload.outcome !== "already_sent")
  ) {
    throw new GmailIntegrationError("unknown", "Gmail delivery returned an invalid response.");
  }
  const rawOrder = payload.order && typeof payload.order === "object" ? payload.order as SupplierOrder : fallbackOrder;
  if (!rawOrder) throw new GmailIntegrationError("unknown", "Gmail delivery did not return the supplier order.");
  const order = normalizeSupplierOrder(rawOrder);
  if (order.id !== orderId || order.restaurant_id !== restaurantId || order.status === "draft") {
    throw new GmailIntegrationError("unknown", "Gmail delivery returned an invalid supplier order.");
  }
  const rawRecommendations = Array.isArray(payload.orderedRecommendations) ? payload.orderedRecommendations : [];
  const orderedRecommendations = rawRecommendations.map((entry) => normalizePurchaseRecommendation(entry as PurchaseRecommendation));
  if (orderedRecommendations.some((entry) => entry.restaurant_id !== restaurantId || entry.supplier_order_id !== orderId)) {
    throw new GmailIntegrationError("unknown", "Gmail delivery returned invalid order items.");
  }
  const providerMessageId =
    typeof payload.providerMessageId === "string" && payload.providerMessageId.length > 0 && payload.providerMessageId.length <= 1024
      ? payload.providerMessageId
      : null;
  return {
    status: "sent",
    outcome: payload.outcome,
    providerMessageId,
    order,
    orderedRecommendations
  };
}

function asUnknownRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function requireGoogleAuthorizationUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 4096) {
    throw new GmailIntegrationError("unknown", "Gmail authorization returned an invalid URL.");
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "accounts.google.com" || url.username || url.password) throw new Error();
    return url.toString();
  } catch {
    throw new GmailIntegrationError("unknown", "Gmail authorization returned an invalid URL.");
  }
}

async function gmailIntegrationErrorFrom(error: unknown, fallbackMessage: string) {
  const payload = await readFunctionErrorPayload(error);
  const candidateStatus = typeof payload.status === "string" ? payload.status : "unknown";
  const status = gmailIntegrationErrorStatuses.has(candidateStatus as GmailIntegrationErrorStatus)
    ? candidateStatus as GmailIntegrationErrorStatus
    : "unknown";
  const candidateMessage = typeof payload.message === "string"
    ? payload.message
    : typeof payload.error === "string"
      ? payload.error
      : "";
  const message = candidateMessage.trim().slice(0, 320) || fallbackMessage;
  return new GmailIntegrationError(status, message);
}

async function readFunctionErrorPayload(error: unknown) {
  if (!error || typeof error !== "object") return {};
  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== "object") return {};
  const response = context as { clone?: () => unknown; json?: () => Promise<unknown> };
  try {
    const reader = (typeof response.clone === "function" ? response.clone() : response) as { json?: () => Promise<unknown> };
    if (typeof reader.json !== "function") return {};
    return asUnknownRecord(await reader.json());
  } catch {
    return {};
  }
}

function parseSetupSnapshotSummary(data: unknown): RestaurantSetupSnapshotSummary {
  const payload = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  const count = (key: string) => {
    const value = Number(payload?.[key]);
    if (!Number.isFinite(value) || value < 0) throw new Error("Setup workflow returned an invalid response.");
    return Math.floor(value);
  };
  return {
    inventoryItemsSaved: count("inventory_items_saved"),
    supplierRecipientsSaved: count("supplier_recipients_saved"),
    recipeMappingsSaved: count("recipe_mappings_saved"),
    posSalesRowsSaved: count("pos_sales_rows_saved"),
    attachmentMetadataSaved: count("attachment_metadata_saved"),
    skippedRecipeIngredients: count("skipped_recipe_ingredients")
  };
}

function createLocalDemoRepository(): MiseRepository {
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

    async fetchInventoryItems(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      return state.inventoryItems
        .filter((item) => item.restaurant_id === restaurantId)
        .map(normalizeInventoryItem)
        .sort((a, b) => a.item_name.localeCompare(b.item_name));
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

    async importManualPosSalesCsv(restaurantId, sales, sourceFileName = null) {
      return mutateDemoState((state) => {
        const now = new Date().toISOString();
        const keptSales = state.posSales.filter(
          (sale) => sale.restaurant_id !== restaurantId || sale.source_pos !== "Manual CSV Upload"
        );
        const importedSales = sales.map((saleInput) => ({
          ...saleInput,
          id: createId("sale"),
          restaurant_id: restaurantId,
          created_at: now
        }));
        state.posSales = [...keptSales, ...importedSales];
        state.posProvider = "Manual CSV Upload";
        state.posConnectedAt = now;

        const existingIntegration = state.posIntegrations.find(
          (entry) => entry.restaurant_id === restaurantId && entry.provider === "manual_csv"
        );
        const integrationId = existingIntegration?.id ?? createId("pos_integration");
        if (existingIntegration) {
          existingIntegration.status = "connected";
          existingIntegration.last_sync_at = now;
          existingIntegration.updated_at = now;
          existingIntegration.settings = {
            mode: "manual_csv",
            importsSales: true,
            storesCredentials: false
          };
        } else {
          state.posIntegrations.push({
            id: integrationId,
            restaurant_id: restaurantId,
            provider: "manual_csv",
            status: "connected",
            external_location_id: null,
            last_sync_at: now,
            sync_cursor: null,
            settings: {
              mode: "manual_csv",
              importsSales: true,
              storesCredentials: false
            },
            created_at: now,
            updated_at: now
          });
        }

        const salesImportId = createId("sales_import");
        state.salesImports.unshift({
          id: salesImportId,
          restaurant_id: restaurantId,
          pos_integration_id: integrationId,
          import_type: "csv_upload",
          status: "completed",
          source_file_name: sourceFileName,
          records_processed: importedSales.length,
          error_message: null,
          metadata: {
            source: "manual_csv_ingest",
            storage_status: "rows_only",
            raw_file_stored: false
          },
          imported_at: now
        });

        appendDemoAuditLog(state, {
          restaurant_id: restaurantId,
          action: "manual_pos_csv_ingested",
          entity_table: "sales_imports",
          entity_id: salesImportId,
          metadata: {
            pos_sales_rows_saved: importedSales.length,
            pos_integration_id: integrationId,
            source_file_name: sourceFileName
          }
        });

        return { posSalesRowsSaved: importedSales.length, salesImportId };
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
        const quantityBefore = item.current_quantity;
        Object.assign(item, payload);
        if (patch.current_quantity !== undefined && patch.current_quantity !== quantityBefore) {
          appendDemoInventoryMovement(state, {
            restaurantId,
            itemId,
            quantityBefore,
            quantityAfter: item.current_quantity
          });
        }
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
        const quantityBefore = item.current_quantity;
        Object.assign(item, patch, { last_updated: new Date().toISOString() });
        if (patch.current_quantity !== undefined && item.current_quantity !== quantityBefore) {
          appendDemoInventoryMovement(state, {
            restaurantId,
            itemId,
            quantityBefore,
            quantityAfter: item.current_quantity
          });
        }
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

    async fetchInventoryMovements(restaurantId, itemId, limit = 8) {
      const state = await readReadyDemoState(restaurantId);
      return state.inventoryMovements
        .filter((movement) => movement.restaurant_id === restaurantId && movement.inventory_item_id === itemId)
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .slice(0, Math.max(1, Math.min(limit, 50)))
        .map(normalizeInventoryMovement);
    },

    async requestAccountDeletion(confirmation) {
      if (confirmation.trim().toUpperCase() !== "DELETE") {
        throw new Error("Type DELETE to confirm account deletion.");
      }
      await resetDemoStore();
      return { status: "completed", requestId: createId("account_deletion") };
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
        state.purchaseRecommendations = [
          ...state.purchaseRecommendations.filter(
            (recommendation) => recommendation.restaurant_id !== restaurantId || recommendation.status !== "pending"
          ),
          ...inserts.map((insert) => ({
            ...insert,
            id: createId("rec"),
            created_at: new Date().toISOString()
          }))
        ];
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

        const wasAlreadySent = order.status === "sent" || order.status === "completed";
        const result = markSupplierOrderSentInDemoState(state, restaurantId, orderId);
        const providerMessageId = `demo-gmail:${orderId}`;
        if (!wasAlreadySent) {
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
    }
  };
}

function createSupabaseRepository(): MiseRepository {
  const client = supabase;
  if (!client) throw new Error("Supabase is not configured");

  async function fetchBoundedPlanningSales(restaurantId: string) {
    const { data, error } = await client!.rpc("fetch_planning_sales", {
      p_restaurant_id: restaurantId,
      p_service_days: 28
    });
    if (error) throw error;
    return ((data ?? []) as PosSale[]).map(normalizePosSale);
  }

  async function invokeOperationalWorkflow(body: Record<string, unknown>) {
    const { data, error } = await client!.functions.invoke("operational-workflows", { body });
    if (error) {
      throwRepositoryError(error, typeof body.restaurantId === "string" ? body.restaurantId : null);
    }
    if (!data || data.status !== "completed") throw new Error("Operational workflow did not complete.");
    return data as { status: "completed"; result: unknown; setupSummary: unknown };
  }

  async function invokeGmailFunction(
    functionName: "link-gmail" | "send-supplier-email",
    body: Record<string, unknown>,
    restaurantId: string,
    fallbackMessage: string
  ) {
    const { data, error } = await client!.functions.invoke(functionName, { body });
    if (error) {
      if (isTenantAuthorizationError(error)) throwRepositoryError(error, restaurantId);
      throw await gmailIntegrationErrorFrom(error, fallbackMessage);
    }
    return data as unknown;
  }

  return {
    async fetchMembershipsForAuthUser(userId) {
      const { data, error } = await client
        .from("restaurant_memberships")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: true });
      if (error) throwRepositoryError(error);
      return ((data ?? []) as RestaurantMembership[]).map(normalizeRestaurantMembership);
    },

    async addRestaurantMember(restaurantId, targetUserId, role) {
      const { data, error } = await client.rpc("add_restaurant_member", {
        p_restaurant_id: restaurantId,
        p_target_user_id: targetUserId,
        p_role: role
      });
      if (error) throwRepositoryError(error, restaurantId);
      return normalizeRestaurantMembership(data as RestaurantMembership);
    },

    async updateRestaurantMember(restaurantId, targetUserId, patch) {
      const { data, error } = await client.rpc("update_restaurant_member", {
        p_restaurant_id: restaurantId,
        p_target_user_id: targetUserId,
        p_role: patch.role ?? null,
        p_status: patch.status ?? null
      });
      if (error) throwRepositoryError(error, restaurantId);
      return normalizeRestaurantMembership(data as RestaurantMembership);
    },

    async removeRestaurantMember(restaurantId, targetUserId) {
      const { data, error } = await client.rpc("remove_restaurant_member", {
        p_restaurant_id: restaurantId,
        p_target_user_id: targetUserId
      });
      if (error) throwRepositoryError(error, restaurantId);
      return normalizeRestaurantMembership(data as RestaurantMembership);
    },

    async updateMyProfile(name) {
      const { data, error } = await client.rpc("update_my_profile", { p_name: name });
      if (error) throwRepositoryError(error);
      return normalizeAppUser(data as AppUser);
    },

    async createRestaurantWithOwner(name, cuisineType) {
      const { data, error } = await client.rpc("create_restaurant_with_owner", {
        restaurant_name: name,
        restaurant_cuisine_type: cuisineType ?? null
      });
      if (error) throw error;
      return normalizeRestaurant(data as Restaurant);
    },

    async fetchRestaurant(restaurantId) {
      const { data, error } = await client.from("restaurants").select("*").eq("id", restaurantId).single();
      if (error) throwRepositoryError(error, restaurantId);
      return normalizeRestaurant(data as Restaurant);
    },

    async updateRestaurantProfile(restaurantId, patch) {
      const { data, error } = await client.rpc("update_restaurant_profile", {
        p_restaurant_id: restaurantId,
        p_patch: patch
      });
      if (error) throwRepositoryError(error, restaurantId);
      return normalizeRestaurant(data as Restaurant);
    },

    async fetchRestaurantOpsProfile(restaurantId) {
      const [restaurantResult, posResult, supplierResult, aiResult] = await Promise.all([
        client.from("restaurants").select("*").eq("id", restaurantId).single(),
        client.from("pos_integrations").select("*").eq("restaurant_id", restaurantId).order("updated_at", { ascending: false }),
        client.from("supplier_items").select("*").eq("restaurant_id", restaurantId).order("supplier_name"),
        client
          .from("ai_insights")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false })
          .limit(5)
      ]);
      if (restaurantResult.error) throw restaurantResult.error;
      if (posResult.error) throw posResult.error;
      if (supplierResult.error) throw supplierResult.error;
      if (aiResult.error) throw aiResult.error;
      return {
        restaurant: normalizeRestaurant(restaurantResult.data as Restaurant),
        posIntegrations: ((posResult.data ?? []) as PosIntegration[]).map(normalizePosIntegration),
        supplierItems: ((supplierResult.data ?? []) as SupplierItem[]).map(normalizeSupplierItem),
        recentAiInsights: ((aiResult.data ?? []) as AiInsight[]).map(normalizeAiInsight)
      };
    },

    async fetchPosIntegrations(restaurantId) {
      const { data, error } = await client
        .from("pos_integrations")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as PosIntegration[]).map(normalizePosIntegration);
    },

    async fetchAiInsights(restaurantId) {
      const { data, error } = await client
        .from("ai_insights")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as AiInsight[]).map(normalizeAiInsight);
    },

    async createAiInsight(input) {
      const { data, error } = await client.functions.invoke("generate-ai-insights", {
        body: { restaurantId: input.restaurant_id }
      });
      if (error) throw error;
      const insight = (data as { insight?: unknown } | null)?.insight;
      if (!insight || typeof insight !== "object") throw new Error("AI insight workflow returned an invalid response.");
      return normalizeAiInsight(insight as AiInsight);
    },

    async recordAuditLog(input) {
      if (
        input.action !== "setup_completed" ||
        input.entity_table !== "restaurants" ||
        input.entity_id !== input.restaurant_id
      ) {
        throw new Error("This client audit event must be recorded by a server-owned workflow.");
      }
      const { error } = await client.rpc("record_setup_completion_audit", {
        p_restaurant_id: input.restaurant_id,
        p_metadata: input.metadata ?? {}
      });
      if (error) throw error;
    },

    async fetchRestaurantData(restaurantId) {
      const [restaurantResult, sales, inventoryResult, recommendationsResult, insightsResult, mappingResult] =
        await Promise.all([
          client.from("restaurants").select("*").eq("id", restaurantId).single(),
          fetchBoundedPlanningSales(restaurantId),
          client.from("inventory_items").select("*").eq("restaurant_id", restaurantId),
          client.from("purchase_recommendations").select("*").eq("restaurant_id", restaurantId),
          client.from("insights").select("*").eq("restaurant_id", restaurantId),
          client.from("menu_item_ingredients").select("*").eq("restaurant_id", restaurantId)
        ]);

      if (restaurantResult.error) throw restaurantResult.error;
      if (inventoryResult.error) throw inventoryResult.error;
      if (recommendationsResult.error) throw recommendationsResult.error;
      if (insightsResult.error) throw insightsResult.error;
      if (mappingResult.error) throw mappingResult.error;

      return normalizeRestaurantData(
        restaurantResult.data as Restaurant,
        sales,
        (inventoryResult.data ?? []) as InventoryItem[],
        (recommendationsResult.data ?? []) as PurchaseRecommendation[],
        (insightsResult.data ?? []) as Insight[],
        (mappingResult.data ?? []) as MenuItemIngredient[]
      );
    },

    async fetchInventoryItems(restaurantId) {
      const { data, error } = await client
        .from("inventory_items")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("item_name");
      if (error) throw error;
      return ((data ?? []) as InventoryItem[]).map(normalizeInventoryItem);
    },

    async fetchPlanningData(restaurantId) {
      const [inventoryResult, sales, mappingResult, restaurantResult] = await Promise.all([
        client.from("inventory_items").select("*").eq("restaurant_id", restaurantId).order("item_name"),
        fetchBoundedPlanningSales(restaurantId),
        client.from("menu_item_ingredients").select("*").eq("restaurant_id", restaurantId),
        client.from("restaurants").select("timezone").eq("id", restaurantId).single()
      ]);
      if (inventoryResult.error) throw inventoryResult.error;
      if (mappingResult.error) throw mappingResult.error;
      if (restaurantResult.error) throw restaurantResult.error;
      return {
        inventoryItems: ((inventoryResult.data ?? []) as InventoryItem[]).map(normalizeInventoryItem),
        sales,
        menuItemIngredients: ((mappingResult.data ?? []) as MenuItemIngredient[]).map(normalizeMenuItemIngredient),
        operatingDate: toDateKeyInTimeZone(
          new Date(),
          (restaurantResult.data as Pick<Restaurant, "timezone">).timezone
        )
      };
    },

    async saveRestaurantSetupSnapshot(restaurantId, input) {
      const response = await invokeOperationalWorkflow({
        action: "save_setup",
        restaurantId,
        setup: {
          inventoryItems: input.inventoryItems.map(({ restaurant_id: _restaurantId, ...item }) => item),
          suppliers: input.suppliers.map(({ restaurant_id: _restaurantId, ...supplier }) => supplier),
          recipeMappings: input.recipeMappings,
          posSales: input.posSales.map(({ restaurant_id: _restaurantId, ...sale }) => sale),
          attachments: input.attachments,
          skippedRecipeIngredients: input.skippedRecipeIngredients
        }
      });
      return parseSetupSnapshotSummary(response.setupSummary);
    },

    async importManualPosSalesCsv(restaurantId, sales, sourceFileName = null) {
      const response = await invokeOperationalWorkflow({
        action: "ingest_pos_csv",
        restaurantId,
        sales,
        sourceFileName
      });
      const summary = (response.ingestSummary ?? response.result ?? {}) as {
        pos_sales_rows_saved?: number;
        sales_import_id?: string;
      };
      return {
        posSalesRowsSaved: Number(summary.pos_sales_rows_saved ?? sales.length),
        salesImportId: typeof summary.sales_import_id === "string" ? summary.sales_import_id : undefined
      };
    },

    async upsertInventoryItem(input) {
      const existing = await client
        .from("inventory_items")
        .select("*")
        .eq("restaurant_id", input.restaurant_id)
        .eq("item_name", input.item_name)
        .maybeSingle();
      if (existing.error) throw existing.error;

      if (existing.data) {
        const { data, error } = await client
          .from("inventory_items")
          .update({ ...input, last_updated: new Date().toISOString() })
          .eq("restaurant_id", input.restaurant_id)
          .eq("id", existing.data.id)
          .select("*")
          .single();
        if (error) throw error;
        return normalizeInventoryItem(data as InventoryItem);
      }

      const { data, error } = await client
        .from("inventory_items")
        .insert(input)
        .select("*")
        .single();
      if (error) throw error;
      return normalizeInventoryItem(data as InventoryItem);
    },

    async createPosSale(input) {
      const { data, error } = await client
        .from("pos_sales")
        .insert(input)
        .select("*")
        .single();
      if (error) throw error;
      return normalizePosSale(data as PosSale);
    },

    async updateInventoryItem(restaurantId, itemId, patch) {
      const payload = { ...patch, last_updated: new Date().toISOString() };
      const { data, error } = await client
        .from("inventory_items")
        .update(payload)
        .eq("restaurant_id", restaurantId)
        .eq("id", itemId)
        .select("*")
        .single();
      if (error) throw error;
      return normalizeInventoryItem(data as InventoryItem);
    },

    async updateInventoryItemAndSignals(
      restaurantId,
      itemId,
      _expectedLastUpdated,
      patch,
      _recommendations,
      _insights
    ) {
      const response = await invokeOperationalWorkflow({
        action: "update_inventory",
        restaurantId,
        itemId,
        patch
      });
      return normalizeInventoryItem(response.result as InventoryItem);
    },

    async fetchInventoryMovements(restaurantId, itemId, limit = 8) {
      const { data, error } = await client
        .from("inventory_movements")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("inventory_item_id", itemId)
        .order("created_at", { ascending: false })
        .limit(Math.max(1, Math.min(limit ?? 8, 50)));
      if (error) throw error;
      return ((data ?? []) as InventoryMovement[]).map(normalizeInventoryMovement);
    },

    async requestAccountDeletion(confirmation) {
      if (!client) throw new Error("Supabase is not configured.");
      const { data, error } = await client.functions.invoke("request-account-deletion", {
        body: { confirmation }
      });
      if (error) throw error;
      const payload = data as { status?: string; requestId?: string; message?: string } | null;
      if (!payload?.status) {
        throw new Error(payload?.message ?? "Account deletion could not be completed.");
      }
      return { status: payload.status, requestId: payload.requestId };
    },

    async updateMenuItemIngredientQuantity(restaurantId, mappingId, quantityUsedPerSale) {
      const { data, error } = await client
        .from("menu_item_ingredients")
        .update({ quantity_used_per_sale: quantityUsedPerSale })
        .eq("restaurant_id", restaurantId)
        .eq("id", mappingId)
        .select("*")
        .single();
      if (error) throw error;
      return normalizeMenuItemIngredient(data as MenuItemIngredient);
    },

    async upsertMenuItemIngredient(input) {
      const { data, error } = await client
        .from("menu_item_ingredients")
        .upsert(input, { onConflict: "restaurant_id,menu_item_name,inventory_item_id" })
        .select("*")
        .single();
      if (error) throw error;
      return normalizeMenuItemIngredient(data as MenuItemIngredient);
    },

    async saveRecipeMappingAndSignals(input) {
      const response = await invokeOperationalWorkflow({
        action: "upsert_recipe",
        restaurantId: input.restaurantId,
        mappingId: input.mappingId,
        menuItemName: input.menuItemName,
        inventoryItemId: input.inventoryItemId,
        quantityUsedPerSale: input.quantityUsedPerSale,
        unit: input.unit
      });
      return normalizeMenuItemIngredient(response.result as MenuItemIngredient);
    },

    async findPendingRecommendation(restaurantId, itemId) {
      const existing = await client
        .from("purchase_recommendations")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("inventory_item_id", itemId)
        .eq("status", "pending")
        .maybeSingle();
      if (existing.error) throw existing.error;
      return existing.data ? normalizePurchaseRecommendation(existing.data as PurchaseRecommendation) : null;
    },

    async createPurchaseRecommendation(input) {
      const { data, error } = await client.rpc("create_pending_purchase_recommendation", {
        p_restaurant_id: input.restaurant_id,
        p_inventory_item_id: input.inventory_item_id,
        p_recommended_quantity: input.recommended_quantity,
        p_reason: input.reason,
        p_urgency: input.urgency
      });
      if (error) throw error;
      return normalizePurchaseRecommendation(data as PurchaseRecommendation);
    },

    async fetchPurchaseRecommendations(restaurantId, status = "pending") {
      let query = client
        .from("purchase_recommendations")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as PurchaseRecommendation[]).map(normalizePurchaseRecommendation);
    },

    async updatePurchaseRecommendation(restaurantId, recommendationId, patch) {
      const { data, error } = await client
        .from("purchase_recommendations")
        .update(patch)
        .eq("restaurant_id", restaurantId)
        .eq("id", recommendationId)
        .select("*")
        .single();
      if (error) throw error;
      return normalizePurchaseRecommendation(data as PurchaseRecommendation);
    },

    async approvePurchaseRecommendation(restaurantId, recommendationId, recommendedQuantity) {
      const { data, error } = await client.rpc("approve_purchase_recommendation", {
        p_restaurant_id: restaurantId,
        p_recommendation_id: recommendationId,
        p_recommended_quantity: recommendedQuantity ?? null
      });
      if (error) throw error;
      return parseRecommendationWorkflowResponse(data);
    },

    async dismissPurchaseRecommendation(restaurantId, recommendationId) {
      const { data, error } = await client.rpc("dismiss_purchase_recommendation", {
        p_restaurant_id: restaurantId,
        p_recommendation_id: recommendationId
      });
      if (error) throw error;
      return parseRecommendationWorkflowResponse(data);
    },

    async undoPurchaseRecommendationAction(restaurantId, recommendationId) {
      const { data, error } = await client.rpc("undo_purchase_recommendation_action", {
        p_restaurant_id: restaurantId,
        p_recommendation_id: recommendationId
      });
      if (error) throw error;
      return parseRecommendationWorkflowResponse(data);
    },

    async replacePendingRecommendations(restaurantId, _inserts) {
      await invokeOperationalWorkflow({ action: "refresh_signals", restaurantId });
    },

    async fetchApprovedRecommendations(restaurantId, supplierName) {
      let query = client
        .from("purchase_recommendations")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("status", "approved");
      if (supplierName) query = query.eq("supplier_name", supplierName);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as PurchaseRecommendation[]).map(normalizePurchaseRecommendation);
    },

    async markApprovedRecommendationsOrdered(restaurantId, supplierName) {
      const { data, error } = await client
        .from("purchase_recommendations")
        .update({ status: "ordered" })
        .eq("restaurant_id", restaurantId)
        .eq("supplier_name", supplierName)
        .eq("status", "approved")
        .select("*");
      if (error) throw error;
      return ((data ?? []) as PurchaseRecommendation[]).map(normalizePurchaseRecommendation);
    },

    async upsertSupplierOrderDraft(draft) {
      const existing = await client
        .from("supplier_orders")
        .select("*")
        .eq("restaurant_id", draft.restaurant_id)
        .eq("supplier_name", draft.supplier_name)
        .eq("status", "draft")
        .maybeSingle();
      if (existing.error) throw existing.error;

      const payload = {
        restaurant_id: draft.restaurant_id,
        supplier_name: draft.supplier_name,
        order_message: draft.order_message,
        operator_note: draft.operator_note,
        status: draft.status,
        delivery_date: draft.delivery_date
      };

      if (existing.data) {
        const { data, error } = await client
          .from("supplier_orders")
          .update(payload)
          .eq("restaurant_id", draft.restaurant_id)
          .eq("id", existing.data.id)
          .select("*")
          .single();
        if (error) throw error;
        return normalizeSupplierOrder(data as SupplierOrder);
      }
      const inserted = await client.from("supplier_orders").insert(payload).select("*").single();
      if (inserted.error?.code === "23505") {
        const concurrent = await client
          .from("supplier_orders")
          .update(payload)
          .eq("restaurant_id", draft.restaurant_id)
          .eq("supplier_name", draft.supplier_name)
          .eq("status", "draft")
          .select("*")
          .single();
        if (concurrent.error) throw concurrent.error;
        return normalizeSupplierOrder(concurrent.data as SupplierOrder);
      }
      if (inserted.error) throw inserted.error;
      return normalizeSupplierOrder(inserted.data as SupplierOrder);
    },

    async deleteSupplierOrderDraft(restaurantId, supplierName) {
      const { error } = await client
        .from("supplier_orders")
        .delete()
        .eq("restaurant_id", restaurantId)
        .eq("supplier_name", supplierName)
        .eq("status", "draft");
      if (error) throw error;
    },

    async fetchSupplierOrders(restaurantId) {
      const { data, error } = await client
        .from("supplier_orders")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as SupplierOrder[]).map(normalizeSupplierOrder);
    },

    async fetchSupplierOrder(restaurantId, orderId) {
      const { data, error } = await client
        .from("supplier_orders")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("id", orderId)
        .single();
      if (error) throw error;
      return normalizeSupplierOrder(data as SupplierOrder);
    },

    async updateSupplierOrder(restaurantId, orderId, patch) {
      const { data, error } = await client.rpc("update_supplier_order_draft", {
        p_restaurant_id: restaurantId,
        p_order_id: orderId,
        p_operator_note: patch.operator_note ?? null,
        p_set_operator_note: Object.prototype.hasOwnProperty.call(patch, "operator_note"),
        p_delivery_date: patch.delivery_date ?? null,
        p_set_delivery_date: Object.prototype.hasOwnProperty.call(patch, "delivery_date")
      });
      if (error) throw error;
      return normalizeSupplierOrder(data as SupplierOrder);
    },

    async markSupplierOrderSent(restaurantId, orderId) {
      const { data, error } = await client.rpc("mark_supplier_order_sent", {
        p_restaurant_id: restaurantId,
        p_order_id: orderId
      });
      if (error) throw error;
      return parseSupplierOrderSentWorkflowResponse(data);
    },

    async connectRestaurantGmail(restaurantId) {
      const data = await invokeGmailFunction(
        "link-gmail",
        { restaurantId, action: "connect" },
        restaurantId,
        "Could not start Gmail authorization."
      );
      return parseGmailConnectionWorkflowResponse(data);
    },

    async disconnectRestaurantGmail(restaurantId) {
      const data = await invokeGmailFunction(
        "link-gmail",
        { restaurantId, action: "disconnect" },
        restaurantId,
        "Could not disconnect Gmail."
      );
      return parseGmailDisconnectWorkflowResponse(data);
    },

    async sendSupplierOrderEmail(restaurantId, orderId) {
      const data = await invokeGmailFunction(
        "send-supplier-email",
        { restaurantId, orderId },
        restaurantId,
        "Could not send this supplier order through Gmail."
      );
      const payload = asUnknownRecord(data);
      let fallbackOrder: SupplierOrder | null = null;
      if (payload.status === "sent" && (!payload.order || typeof payload.order !== "object")) {
        const { data: orderData, error } = await client
          .from("supplier_orders")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .eq("id", orderId)
          .single();
        if (error) throwRepositoryError(error, restaurantId);
        fallbackOrder = normalizeSupplierOrder(orderData as SupplierOrder);
      }
      return parseSupplierEmailSendResponse(data, restaurantId, orderId, fallbackOrder);
    },

    async fetchInsights(restaurantId) {
      const { data, error } = await client
        .from("insights")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Insight[]).map(normalizeInsight);
    },

    async replaceInsights(restaurantId, _insights) {
      await invokeOperationalWorkflow({ action: "refresh_signals", restaurantId });
    },

    async replaceOperationalSignals(restaurantId, _recommendations, _insights) {
      await invokeOperationalWorkflow({ action: "refresh_signals", restaurantId });
    },

    async fetchEmailConnectionState(restaurantId) {
      const { data, error } = await client
        .from("restaurant_email_connections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("provider", "gmail")
        .maybeSingle();
      if (error) throw error;
      return data ? normalizeRestaurantEmailConnection(data as RestaurantEmailConnection) : null;
    },

    async fetchSupplierRecipients(restaurantId) {
      const { data, error } = await client
        .from("supplier_recipients")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("supplier_name");
      if (error) throwRepositoryError(error, restaurantId);
      return ((data ?? []) as SupplierRecipient[]).map(normalizeSupplierRecipient);
    },

    async upsertSupplierRecipient(input) {
      const { data, error } = await client.rpc("upsert_supplier_recipient", {
        p_restaurant_id: input.restaurant_id,
        p_supplier_name: input.supplier_name,
        p_email: input.email
      });
      if (error) throwRepositoryError(error, input.restaurant_id);
      const recipient = Array.isArray(data) ? data[0] : data;
      if (!recipient || typeof recipient !== "object") {
        throw new Error("Supplier recipient workflow returned an invalid response.");
      }
      return normalizeSupplierRecipient(recipient as SupplierRecipient);
    },

    async createSetupAttachment(input) {
      const { data, error } = await client
        .from("setup_attachments")
        .insert(input)
        .select("*")
        .single();
      if (error) throw error;
      return normalizeSetupAttachment(data as SetupAttachment);
    },

    async loadDemoPOSData(_provider, _setupProfile) {
      throw new Error("Demo POS seeding is local-only. Hosted Supabase restaurant data cannot be reset from the client.");
    },

    async resetDemoData(_provider, _setupProfile) {
      throw new Error("Demo reset is local-only. Hosted Supabase restaurant data cannot be reset from the client.");
    },

    async fetchPOSStatus(restaurantId) {
      if (!restaurantId) {
        return {
          provider: null,
          connectedAt: null,
          label: "Not connected"
        };
      }

      const integration = await client
        .from("pos_integrations")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (integration.error) throw integration.error;
      if (integration.data) {
        const normalized = normalizePosIntegration(integration.data as PosIntegration);
        const provider = normalizePosProviderFromIntegration(normalized.provider);
        return {
          provider,
          connectedAt: normalized.last_sync_at ?? normalized.updated_at,
          label: provider && normalized.status === "connected" ? `${provider} connected` : "Not connected"
        };
      }

      const { data, error } = await client
        .from("pos_sales")
        .select("source_pos, created_at")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      const provider = normalizePosProvider(data?.source_pos);
      return {
        provider,
        connectedAt: typeof data?.created_at === "string" ? data.created_at : null,
        label: provider ? `${provider} demo connected` : "Not connected"
      };
    }
  };
}

function normalizePosProviderFromIntegration(value: unknown): PosProvider | null {
  if (value === "toast") return "Toast";
  if (value === "square") return "Square";
  if (value === "clover") return "Clover";
  if (value === "lightspeed") return "Lightspeed";
  if (value === "manual_csv") return "Manual CSV Upload";
  return null;
}

function normalizePosProvider(value: unknown): PosProvider | null {
  if (
    value === "Toast" ||
    value === "Square" ||
    value === "Clover" ||
    value === "Lightspeed" ||
    value === "Manual CSV Upload"
  ) {
    return value;
  }
  return null;
}

export function buildLocalInsightsForTest(data: PlanningData & { restaurantId: string }) {
  return buildInsightsFromData(data.restaurantId, data.inventoryItems, data.sales, data.menuItemIngredients);
}

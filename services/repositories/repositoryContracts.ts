import type {
  AppUser,
  AiInsight,
  AuditLog,
  Insight,
  InventoryItem,
  InventoryItemPatch,
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
  RestaurantTeamMember,
  SetupAttachment,
  SupplierOrder,
  SupplierRecipient
} from "../../types/mise";
import type { DemoSetupProfile } from "../demoData";
import type {
  InventoryEventAcceptance,
  InventoryEventInput
} from "../domain/inventoryLedger";
import type {
  OperationalFindingDecision,
  OperationalFindingDecisionInput
} from "../domain/operationalFindingDecisions";
import type { RecommendationWorkflowResult, SupplierOrderSentWorkflowResult } from "../domain/miseDomain";
import {
  normalizeInsight,
  normalizeInventoryItem,
  normalizeMenuItemIngredient,
  normalizePosSale,
  normalizePurchaseRecommendation,
  normalizeRestaurant,
  normalizeRestaurantTeamMember
} from "../miseValidation";

export type PurchaseRecommendationInput = Omit<PurchaseRecommendation, "id" | "created_at">;
export type SupplierOrderDraft = SupplierOrder;
export type AuditLogInput = Pick<AuditLog, "restaurant_id" | "action" | "entity_table"> &
  Partial<Pick<AuditLog, "entity_id" | "metadata">>;
export type InventoryItemInput = Omit<InventoryItem, "id" | "last_updated">;
export type PosSaleInput = Omit<PosSale, "id" | "created_at">;
export type SupplierRecipientInput = Omit<SupplierRecipient, "id" | "created_at" | "updated_at">;
export type SetupAttachmentInput = Omit<SetupAttachment, "id" | "created_at" | "updated_at" | "created_by">;

/**
 * Recommendation history is only consumed by learned-quantity and suppression
 * logic, which never looks further back than this window (see
 * buildLearnedOrderQuantities in services/domain/miseDomain.ts). Fetches are
 * bounded to it so recompute paths do not scale with a tenant's full history.
 */
export const RECOMMENDATION_HISTORY_DAYS = 180;
export const OPERATIONAL_DECISION_HISTORY_DAYS = 180;

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

export const RESTAURANT_EXPORT_DATASETS = [
  "pos_sales",
  "inventory_items",
  "inventory_events",
  "menu_item_ingredients",
  "purchase_recommendations",
  "supplier_orders",
  "pos_integrations",
  "sales_imports",
  "insights",
  "supplier_items",
  "purchase_orders",
  "ai_insights",
  "restaurant_email_connections",
  "supplier_recipients",
  "setup_attachments",
  "restaurant_operational_controls",
  "pos_locations",
  "pos_catalog_item_mappings",
  "menu_items",
  "recipe_versions",
  "recipe_ingredients",
  "modifier_recipe_adjustments",
  "ingredient_substitutions",
  "operational_finding_decisions",
  "audit_logs"
] as const;

export type RestaurantExportDatasetName = (typeof RESTAURANT_EXPORT_DATASETS)[number];
export type RestaurantExportRow = Record<string, unknown> & { restaurant_id: string };

export interface RestaurantDataExport {
  schemaVersion: 1;
  generatedAt: string;
  restaurantId: string;
  restaurant: Restaurant;
  team: RestaurantTeamMember[];
  datasets: Record<RestaurantExportDatasetName, RestaurantExportRow[]>;
  counts: Record<RestaurantExportDatasetName | "team", number>;
  retention: {
    scope: "restaurant_operational_data";
    credentialsExcluded: true;
    privateSecurityLogsExcluded: true;
    backupDeletion: string;
  };
}

const restaurantExportProtectedKeyPattern =
  /(?:^|_)(?:access_token|refresh_token|oauth_token|client_secret|api_key|password|authorization|pkce_verifier|claim_token|credential_id|secret_id)(?:$|_)/i;

function assertRestaurantExportProtectedDataAbsent(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertRestaurantExportProtectedDataAbsent);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (restaurantExportProtectedKeyPattern.test(key)) {
      throw new Error("Restaurant export contained protected provider data.");
    }
    assertRestaurantExportProtectedDataAbsent(nested);
  }
}

export interface PlanningData {
  inventoryItems: InventoryItem[];
  sales: PosSale[];
  menuItemIngredients: MenuItemIngredient[];
  operatingDate: string;
}

export interface MiseRepository {
  fetchMembershipsForAuthUser(userId: string): Promise<RestaurantMembership[]>;
  /** Membership rows joined with member names and emails for the team screen. */
  fetchRestaurantTeam(restaurantId: string): Promise<RestaurantTeamMember[]>;
  /**
   * Adds an existing Mise account to the restaurant by email. Throws
   * TeamMembershipError("account_not_found") when no account uses the email —
   * there is no pending-invite system.
   */
  addRestaurantMemberByEmail(
    restaurantId: string,
    email: string,
    role: Exclude<RestaurantMembership["role"], "owner">
  ): Promise<RestaurantTeamMember>;
  addRestaurantMember(restaurantId: string, targetUserId: string, role: RestaurantMembership["role"]): Promise<RestaurantMembership>;
  updateRestaurantMember(
    restaurantId: string,
    targetUserId: string,
    patch: Partial<Pick<RestaurantMembership, "role" | "status">>
  ): Promise<RestaurantMembership>;
  removeRestaurantMember(restaurantId: string, targetUserId: string): Promise<RestaurantMembership>;
  updateMyProfile(name: string): Promise<AppUser>;
  /**
   * Permanently deletes the signed-in operator's account. Hosted mode invokes
   * the delete-account Edge Function with the active restaurant for firewall /
   * audit reservation (sole-owner restaurants cascade away and the auth user
   * is removed); demo mode resets the on-device demo store.
   */
  deleteAccount(restaurantId: string): Promise<void>;
  exportRestaurantData(restaurantId: string): Promise<RestaurantDataExport>;
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
  recordOperationalFindingDecision(
    input: OperationalFindingDecisionInput
  ): Promise<OperationalFindingDecision>;
  fetchOperationalFindingDecisions(
    restaurantId: string
  ): Promise<OperationalFindingDecision[]>;
  fetchInventoryItems(restaurantId: string): Promise<InventoryItem[]>;
  /**
   * Records an append-only, server-authoritative inventory event. Hosted mode
   * must use record_inventory_event; clients never insert into the ledger.
   */
  recordInventoryEvent(input: InventoryEventInput): Promise<InventoryEventAcceptance>;
  verifyInventoryItemCanonicalUnit(
    restaurantId: string,
    itemId: string,
    canonicalUnit: "g" | "ml" | "each",
    canonicalQuantityPerUnit: number
  ): Promise<InventoryItem>;
  fetchPlanningData(restaurantId: string): Promise<PlanningData>;
  saveRestaurantSetupSnapshot(
    restaurantId: string,
    input: RestaurantSetupSnapshotInput
  ): Promise<RestaurantSetupSnapshotSummary>;
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
  /**
   * Recommendations from the last RECOMMENDATION_HISTORY_DAYS, newest first.
   * Use this (not fetchPurchaseRecommendations(..., "all")) when recomputing
   * learned quantities or suppression so reads stay bounded per tenant.
   */
  fetchRecommendationHistory(restaurantId: string): Promise<PurchaseRecommendation[]>;
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

export function recommendationHistoryCutoffIso(now = Date.now()): string {
  return new Date(now - RECOMMENDATION_HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function operationalDecisionHistoryCutoffIso(now = Date.now()): string {
  return new Date(now - OPERATIONAL_DECISION_HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function normalizeRestaurantData(
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

export function normalizeRestaurantDataExport(
  value: unknown,
  expectedRestaurantId: string
): RestaurantDataExport {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Restaurant export returned an invalid response.");
  }
  const payload = value as Record<string, unknown>;
  const serializedBytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  if (serializedBytes > 6 * 1024 * 1024) {
    throw new Error("Restaurant export exceeded the supported in-app size.");
  }
  if (
    payload.schemaVersion !== 1 ||
    payload.restaurantId !== expectedRestaurantId ||
    typeof payload.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(payload.generatedAt))
  ) {
    throw new Error("Restaurant export returned an invalid response.");
  }
  assertRestaurantExportProtectedDataAbsent(payload);

  const restaurant = normalizeRestaurant(payload.restaurant as Restaurant);
  if (restaurant.id !== expectedRestaurantId) {
    throw new Error("Restaurant export failed restaurant scope validation.");
  }
  if (!Array.isArray(payload.team)) {
    throw new Error("Restaurant export returned an invalid team directory.");
  }
  const team = payload.team.map(normalizeRestaurantTeamMember);
  if (team.some((member) => member.restaurant_id !== expectedRestaurantId)) {
    throw new Error("Restaurant export failed restaurant scope validation.");
  }

  if (!payload.datasets || typeof payload.datasets !== "object" || Array.isArray(payload.datasets)) {
    throw new Error("Restaurant export returned invalid datasets.");
  }
  if (!payload.counts || typeof payload.counts !== "object" || Array.isArray(payload.counts)) {
    throw new Error("Restaurant export returned invalid counts.");
  }
  const sourceDatasets = payload.datasets as Record<string, unknown>;
  const sourceCounts = payload.counts as Record<string, unknown>;
  const datasets = {} as Record<RestaurantExportDatasetName, RestaurantExportRow[]>;
  const counts = {} as Record<RestaurantExportDatasetName | "team", number>;
  counts.team = team.length;
  if (sourceCounts.team !== team.length) {
    throw new Error("Restaurant export returned an incomplete team directory.");
  }

  for (const name of RESTAURANT_EXPORT_DATASETS) {
    const rows = sourceDatasets[name];
    if (!Array.isArray(rows) || rows.length > 5_000 || sourceCounts[name] !== rows.length) {
      throw new Error(`Restaurant export returned an incomplete ${name} dataset.`);
    }
    const normalizedRows = rows.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error(`Restaurant export returned an invalid ${name} row.`);
      }
      const record = row as RestaurantExportRow;
      if (record.restaurant_id !== expectedRestaurantId) {
        throw new Error("Restaurant export failed restaurant scope validation.");
      }
      return record;
    });
    datasets[name] = normalizedRows;
    counts[name] = normalizedRows.length;
  }

  const retention = payload.retention as Partial<RestaurantDataExport["retention"]> | null;
  if (
    !retention ||
    retention.scope !== "restaurant_operational_data" ||
    retention.credentialsExcluded !== true ||
    retention.privateSecurityLogsExcluded !== true ||
    typeof retention.backupDeletion !== "string"
  ) {
    throw new Error("Restaurant export returned an invalid retention statement.");
  }

  return {
    schemaVersion: 1,
    generatedAt: payload.generatedAt,
    restaurantId: expectedRestaurantId,
    restaurant,
    team,
    datasets,
    counts,
    retention: {
      scope: "restaurant_operational_data",
      credentialsExcluded: true,
      privateSecurityLogsExcluded: true,
      backupDeletion: retention.backupDeletion.slice(0, 500)
    }
  };
}

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
import type { RecommendationWorkflowResult, SupplierOrderSentWorkflowResult } from "../domain/miseDomain";
import {
  normalizeInsight,
  normalizeInventoryItem,
  normalizeMenuItemIngredient,
  normalizePosSale,
  normalizePurchaseRecommendation,
  normalizeRestaurant
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

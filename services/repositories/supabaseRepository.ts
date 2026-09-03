import { supabase } from "../../lib/supabase";
import type {
  AppUser,
  AiInsight,
  Insight,
  InventoryItem,
  InventoryCountLine,
  InventoryCountSessionDetail,
  MenuItemIngredient,
  PosIntegration,
  PosProvider,
  PosSale,
  PurchaseRecommendation,
  RecommendationStatus,
  Restaurant,
  RestaurantEmailConnection,
  RecipeAuthorityState,
  RestaurantMembership,
  RestaurantTeamMember,
  SetupAttachment,
  Supplier,
  SupplierItem,
  SupplierOrder,
  SupplierRecipient
} from "../../types/mise";
import { SUPPLIER_SEND_CONTENT_VERSION } from "../../types/mise";
import { isTenantAuthorizationError, throwRepositoryError } from "../tenantAuthorizationEvents";
import type { RecommendationWorkflowResult, SupplierOrderSentWorkflowResult } from "../domain/miseDomain";
import { normalizePurchaseAuthorityResult } from "../domain/purchaseAuthority";
import { TeamMembershipError, teamMembershipErrorFrom } from "../domain/teamMembership";
import {
  activityEventFromPersistedRow,
  filterActivities,
  type ActivityFeedFilter,
  type PersistedActivityEventRow
} from "../domain/activityEvents";
import {
  miseActionFromPersistedRow,
  type PersistedMiseActionRow
} from "../domain/miseActions";
import {
  restaurantMemoryFromPersistedRow,
  type PersistedRestaurantMemoryRow,
  type RestaurantMemoryStatus
} from "../domain/restaurantMemory";
import {
  autonomyRuleFromPersistedRow,
  type PersistedAutonomyRuleRow
} from "../domain/restaurantAutonomy";
import {
  completeRestaurantTaskRpcArguments,
  createRestaurantTaskRpcArguments,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../domain/restaurantTasks";
import {
  recalculationRunFromPersistedRow,
  recordRecalculationRunRpcArguments,
  type PersistedRecalculationRunRow
} from "../domain/recalculationRunTransport";
import type { SupplierDeliveryRecordResult } from "./repositoryContracts";
import type {
  SupplierDeliveryItemRecord,
  SupplierDeliveryRecord
} from "../domain/supplierReliability";
import {
  inventoryEventRejectionFromRpcError,
  inventoryEventRpcArguments,
  normalizeInventoryEventRecord
} from "../domain/inventoryEventTransport";
import {
  normalizeOperationalFindingDecision,
  operationalFindingDecisionRpcArguments
} from "../domain/operationalFindingDecisions";
import {
  normalizePurchaseDecisionEvent,
  normalizePurchaseDecisionPattern,
} from "../domain/purchaseDecisionMemory";
import {
  normalizeAppUser,
  normalizeInsight,
  normalizeAiInsight,
  normalizeRestaurantEmailConnection,
  normalizeInventoryItem,
  normalizeInventoryCountSessionDetail,
  normalizeMenuItemIngredient,
  normalizePosIntegration,
  normalizePosSale,
  normalizePurchaseRecommendation,
  normalizeRestaurant,
  normalizeRestaurantMembership,
  normalizeRestaurantTeamMember,
  normalizeSetupAttachment,
  normalizeSupplier,
  normalizeSupplierItem,
  normalizeSupplierOrder,
  normalizeSupplierDeliveryItemRecord,
  normalizeSupplierDeliveryRecord,
  normalizeSupplierRecipient,
  normalizeSupplierSendContentPreview,
  requireSupplierDisplayName,
  requireSupplierSendContentFingerprint
} from "../miseValidation";
import { toDateKeyInTimeZone } from "../../utils/format";
import {
  GmailIntegrationError,
  SUPPLIER_SEND_BLOCKER_CODES,
  normalizeRestaurantDataExport,
  normalizeRestaurantData,
  operationalDecisionHistoryCutoffIso,
  recommendationHistoryCutoffIso,
  SquareIntegrationError,
  type GmailConnectionWorkflowResult,
  type SquareConnectionWorkflowResult,
  type SquareDisconnectWorkflowResult,
  type SquareIntegrationErrorStatus,
  type PosMappingMenuItemChoice,
  type PosMappingReviewItem,
  type PosMappingReviewQueue,
  type PosMappingReviewResult,
  type SquareSyncWorkflowResult,
  type GmailDisconnectWorkflowResult,
  type GmailIntegrationErrorStatus,
  type MiseRepository,
  type RestaurantDataExport,
  type RestaurantSetupSnapshotSummary,
  type SupplierSendBlockerCode,
  type SupplierSendContentApprovalResult,
  type SupplierOrderEmailSendResult
} from "./repositoryContracts";

const hostedUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireHostedUuid(value: string, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!hostedUuidPattern.test(normalized)) {
    throw new Error(`Invalid ${label} identity.`);
  }
  return normalized.toLowerCase();
}

function normalizeHostedSupplier(value: Supplier, expectedRestaurantId: string) {
  const supplier = normalizeSupplier(value);
  const restaurantId = requireHostedUuid(supplier.restaurant_id, "restaurant");
  if (restaurantId !== requireHostedUuid(expectedRestaurantId, "restaurant")) {
    throw new Error("Supplier returned a mismatched restaurant identity.");
  }
  return {
    ...supplier,
    id: requireHostedUuid(supplier.id, "supplier"),
    restaurant_id: restaurantId
  };
}

function withCurrentSupplierDisplay(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} returned an invalid supplier relationship.`);
  }
  const row = value as Record<string, unknown>;
  const joinedCandidate = Array.isArray(row.supplier) ? row.supplier[0] : row.supplier;
  if (!joinedCandidate || typeof joinedCandidate !== "object" || Array.isArray(joinedCandidate)) {
    throw new Error(`${label} is missing durable supplier identity.`);
  }
  const supplier = joinedCandidate as Record<string, unknown>;
  const rowSupplierId = requireHostedUuid(String(row.supplier_id ?? ""), "supplier");
  const joinedSupplierId = requireHostedUuid(String(supplier.id ?? ""), "supplier");
  if (
    joinedSupplierId !== rowSupplierId ||
    supplier.restaurant_id !== row.restaurant_id ||
    typeof supplier.display_name !== "string" ||
    !supplier.display_name.trim()
  ) {
    throw new Error(`${label} returned a mismatched supplier identity.`);
  }
  const { supplier: _supplier, ...record } = row;
  return { ...record, supplier_id: rowSupplierId, supplier_name: supplier.display_name };
}

const inventorySupplierSelect =
  "*,supplier:suppliers!inventory_items_supplier_tenant_fkey(id,restaurant_id,display_name)";
const recommendationSupplierSelect =
  "*,supplier:suppliers!purchase_recommendations_supplier_tenant_fkey(id,restaurant_id,display_name)";
const recipientSupplierSelect =
  "*,supplier:suppliers!supplier_recipients_supplier_tenant_fkey(id,restaurant_id,display_name)";

function parseRecommendationWorkflowResponse(data: unknown): RecommendationWorkflowResult {
  const payload = (Array.isArray(data) ? data[0] : data) as {
    outcome?: RecommendationWorkflowResult["outcome"];
    recommendation?: PurchaseRecommendation;
    order?: SupplierOrder | null;
    previous_status?: RecommendationStatus;
    authority?: unknown;
  } | null;
  if (!payload?.recommendation || !payload.outcome) {
    throw new Error("Order workflow returned an invalid response.");
  }
  return {
    outcome: payload.outcome,
    recommendation: normalizePurchaseRecommendation(payload.recommendation),
    order: payload.order ? normalizeSupplierOrder(payload.order) : null,
    previousStatus: payload.previous_status ?? payload.recommendation.status,
    authority: payload.authority ? normalizePurchaseAuthorityResult(payload.authority) : null
  };
}

function parseRecipeAuthorityState(value: unknown): RecipeAuthorityState {
  const payload = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const menuItemId = typeof payload.menuItemId === "string" ? payload.menuItemId : "";
  const menuItemName = typeof payload.menuItemName === "string" ? payload.menuItemName.trim() : "";
  const recipeRevision = Number(payload.recipeRevision);
  const confirmedRevision = payload.confirmedRevision === null || payload.confirmedRevision === undefined
    ? null
    : Number(payload.confirmedRevision);
  if (!menuItemId || !menuItemName || !Number.isSafeInteger(recipeRevision) || recipeRevision < 0) {
    throw new Error("Recipe authority returned an invalid response.");
  }
  return {
    menuItemId,
    menuItemName,
    active: payload.active === true,
    recipeRevision,
    confirmedRevision: Number.isSafeInteger(confirmedRevision) && Number(confirmedRevision) >= 0
      ? confirmedRevision
      : null,
    confirmedAt: typeof payload.confirmedAt === "string" ? payload.confirmedAt : null,
    ready: payload.ready === true
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
  "approval_required",
  "delivery_requires_review",
  "draft_authority_incomplete",
  "gmail_not_connected",
  "in_progress",
  "live_sending_disabled",
  "needs_reauth",
  "provider_not_enabled",
  "provider_rejected",
  "provider_unavailable",
  "purchase_authority_stale",
  "request_blocked",
  "send_content_changed",
  "send_content_unapproved",
  "send_in_progress",
  "server_configuration_missing",
  "supplier_email_invalid",
  "supplier_email_missing",
  "unknown"
]);

const supplierSendBlockerCodes = new Set<string>(SUPPLIER_SEND_BLOCKER_CODES);

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

function parseSupplierSendContentApprovalResponse(
  data: unknown,
  restaurantId: string,
  actionId: string,
  reviewedFingerprint: string
): SupplierSendContentApprovalResult {
  const candidate = Array.isArray(data)
    ? data.length === 1 ? data[0] : null
    : data;
  const payload = asUnknownRecord(candidate);
  const outcome = payload.outcome;
  if (outcome === "applied" || outcome === "already_applied") {
    if (
      payload.contentVersion !== SUPPLIER_SEND_CONTENT_VERSION ||
      payload.contentFingerprint !== reviewedFingerprint ||
      !payload.action ||
      typeof payload.action !== "object" ||
      Array.isArray(payload.action)
    ) {
      throw new Error("Supplier send approval returned an invalid response.");
    }
    const action = miseActionFromPersistedRow(payload.action as PersistedMiseActionRow);
    const approvedSendContent = asUnknownRecord(
      asUnknownRecord(action.expectedImpact).approvedSendContent
    );
    if (
      action.restaurantId !== restaurantId ||
      action.id !== actionId ||
      action.actionType !== "send_supplier_order" ||
      action.status !== "approved" ||
      approvedSendContent.version !== SUPPLIER_SEND_CONTENT_VERSION ||
      approvedSendContent.fingerprint !== reviewedFingerprint
    ) {
      throw new Error("Supplier send approval failed restaurant scope validation.");
    }
    return {
      outcome,
      action,
      contentVersion: SUPPLIER_SEND_CONTENT_VERSION,
      contentFingerprint: reviewedFingerprint,
      blockerCodes: []
    };
  }

  if (
    outcome !== "send_content_changed" &&
    outcome !== "send_content_unapproved" &&
    outcome !== "send_in_progress" &&
    outcome !== "delivery_requires_review"
  ) {
    throw new Error("Supplier send approval returned an invalid response.");
  }
  const blockerCodes = parseSupplierSendBlockerCodes(payload.blockerCodes, true);
  if (outcome !== "send_content_unapproved" && !blockerCodes.includes(outcome)) {
    throw new Error("Supplier send approval returned inconsistent blockers.");
  }
  return {
    outcome,
    action: null,
    contentVersion: null,
    contentFingerprint: null,
    blockerCodes
  };
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
  if (
    rawRecommendations.length > 250 ||
    (payload.outcome !== "already_sent" && rawRecommendations.length === 0)
  ) {
    throw new GmailIntegrationError("unknown", "Gmail delivery returned an invalid line set.");
  }
  const orderedRecommendations = rawRecommendations.map((entry) => normalizePurchaseRecommendation(entry as PurchaseRecommendation));
  const orderedRecommendationIds = orderedRecommendations.map((entry) => entry.id);
  if (
    new Set(orderedRecommendationIds).size !== orderedRecommendationIds.length ||
    orderedRecommendations.some(
      (entry) =>
        entry.restaurant_id !== restaurantId ||
        entry.supplier_order_id !== orderId ||
        entry.status !== "ordered"
    )
  ) {
    throw new GmailIntegrationError("unknown", "Gmail delivery returned invalid order items.");
  }
  const providerMessageId =
    typeof payload.providerMessageId === "string" && payload.providerMessageId.length > 0 && payload.providerMessageId.length <= 1024
      ? payload.providerMessageId
      : null;
  if (typeof payload.sentToPreviouslyClaimedRecipient !== "boolean") {
    throw new GmailIntegrationError("unknown", "Gmail delivery returned invalid claim identity evidence.");
  }
  return {
    status: "sent",
    outcome: payload.outcome,
    providerMessageId,
    sentToPreviouslyClaimedRecipient: payload.sentToPreviouslyClaimedRecipient,
    order,
    orderedRecommendations
  };
}

function asUnknownRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseSupplierSendBlockerCodes(
  value: unknown,
  requireNonEmpty = false
): SupplierSendBlockerCode[] {
  if ((value === null || value === undefined) && !requireNonEmpty) return [];
  if (!Array.isArray(value) || value.length > 20 || (requireNonEmpty && value.length === 0)) {
    throw new Error("Supplier send workflow returned invalid blockers.");
  }
  const codes = value.map((entry) => {
    if (
      typeof entry !== "string" ||
      entry.length > 80 ||
      !supplierSendBlockerCodes.has(entry)
    ) {
      throw new Error("Supplier send workflow returned an invalid blocker.");
    }
    return entry as SupplierSendBlockerCode;
  });
  if (new Set(codes).size !== codes.length) {
    throw new Error("Supplier send workflow returned duplicate blockers.");
  }
  return codes;
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

const squareIntegrationErrorStatuses = new Set<SquareIntegrationErrorStatus>([
  "authorization_required",
  "not_connected",
  "needs_reauth",
  "provider_not_enabled",
  "server_configuration_missing",
  "request_blocked",
  "unknown"
]);

function parseSquareConnectionWorkflowResponse(data: unknown): SquareConnectionWorkflowResult {
  const payload = asUnknownRecord(data);
  if (payload.status !== "authorization_required") {
    throw new SquareIntegrationError("unknown", "Square authorization returned an invalid response.");
  }
  const authorizationUrl = requireSquareAuthorizationUrl(payload.authorizationUrl);
  const expiresAt =
    typeof payload.expiresAt === "string" && Number.isFinite(Date.parse(payload.expiresAt))
      ? payload.expiresAt
      : null;
  return { status: "authorization_required", authorizationUrl, expiresAt };
}

function parseSquareDisconnectWorkflowResponse(data: unknown): SquareDisconnectWorkflowResult {
  const payload = asUnknownRecord(data);
  if (
    payload.status !== "not_connected" ||
    (payload.outcome !== "disconnected" && payload.outcome !== "already_disconnected")
  ) {
    throw new SquareIntegrationError("unknown", "Square disconnection returned an invalid response.");
  }
  return { status: "not_connected", outcome: payload.outcome };
}

function parseSquareSyncWorkflowResponse(data: unknown): SquareSyncWorkflowResult {
  const payload = asUnknownRecord(data);
  if (payload.status !== "completed") {
    throw new SquareIntegrationError("unknown", "Square sync returned an invalid response.");
  }
  const recordsProcessed = Number(payload.recordsProcessed ?? 0);
  const catalogProcessed = Number(payload.catalogProcessed ?? 0);
  const nonItemizedRefundOrderCount = Number(payload.nonItemizedRefundOrderCount ?? 0);
  const nonItemizedRefundAmountTotal = Number(payload.nonItemizedRefundAmountTotal ?? 0);
  if (!Number.isFinite(recordsProcessed) || recordsProcessed < 0 || !Number.isFinite(catalogProcessed) || catalogProcessed < 0) {
    throw new SquareIntegrationError("unknown", "Square sync returned invalid counts.");
  }
  if (
    !Number.isFinite(nonItemizedRefundOrderCount) ||
    nonItemizedRefundOrderCount < 0 ||
    nonItemizedRefundOrderCount > 100000 ||
    !Number.isFinite(nonItemizedRefundAmountTotal) ||
    nonItemizedRefundAmountTotal < 0 ||
    nonItemizedRefundAmountTotal > 10_000_000
  ) {
    throw new SquareIntegrationError("unknown", "Square sync returned invalid refund diagnostics.");
  }
  const sampleIdsRaw = Array.isArray(payload.nonItemizedRefundSampleOrderIds)
    ? payload.nonItemizedRefundSampleOrderIds
    : [];
  const nonItemizedRefundSampleOrderIds: string[] = [];
  for (const entry of sampleIdsRaw) {
    if (typeof entry !== "string" || entry.length < 1 || entry.length > 128) continue;
    nonItemizedRefundSampleOrderIds.push(entry);
    if (nonItemizedRefundSampleOrderIds.length >= 5) break;
  }
  return {
    status: "completed",
    importId: typeof payload.importId === "string" ? payload.importId : null,
    recordsProcessed: Math.floor(recordsProcessed),
    catalogProcessed: Math.floor(catalogProcessed),
    nonItemizedRefundOrderCount: Math.floor(nonItemizedRefundOrderCount),
    nonItemizedRefundAmountTotal: Math.round(nonItemizedRefundAmountTotal * 100) / 100,
    nonItemizedRefundSampleOrderIds
  };
}

function requiredPosMappingString(
  payload: Record<string, unknown>,
  key: string,
  maximumLength = 256
) {
  const value = payload[key];
  if (typeof value !== "string" || value.length < 1 || value.length > maximumLength) {
    throw new SquareIntegrationError("unknown", "Square mapping review returned an invalid response.");
  }
  return value;
}

function optionalPosMappingString(
  payload: Record<string, unknown>,
  key: string,
  maximumLength = 256
) {
  const value = payload[key];
  if (value === null) return null;
  if (typeof value !== "string" || value.length < 1 || value.length > maximumLength) {
    throw new SquareIntegrationError("unknown", "Square mapping review returned an invalid response.");
  }
  return value;
}

function parsePosMappingReviewQueue(
  data: unknown,
  expectedRestaurantId: string
): PosMappingReviewQueue {
  const payload = asUnknownRecord(data);
  if (
    payload.restaurantId !== expectedRestaurantId ||
    !Array.isArray(payload.mappings) ||
    !Array.isArray(payload.menuItems) ||
    payload.mappings.length > 100 ||
    payload.menuItems.length > 200
  ) {
    throw new SquareIntegrationError("unknown", "Square mapping review returned an invalid response.");
  }

  const menuItems = payload.menuItems.map((value): PosMappingMenuItemChoice => {
    const row = asUnknownRecord(value);
    if (row.restaurantId !== expectedRestaurantId) {
      throw new SquareIntegrationError("unknown", "Square mapping review crossed restaurant scope.");
    }
    return {
      id: requiredPosMappingString(row, "id", 64),
      restaurantId: expectedRestaurantId,
      name: requiredPosMappingString(row, "name", 160),
      category: optionalPosMappingString(row, "category", 120)
    };
  });

  const mappings = payload.mappings.map((value): PosMappingReviewItem => {
    const row = asUnknownRecord(value);
    if (
      row.restaurantId !== expectedRestaurantId ||
      row.provider !== "square" ||
      row.verificationStatus !== "draft"
    ) {
      throw new SquareIntegrationError("unknown", "Square mapping review crossed restaurant scope.");
    }
    const updatedAt = requiredPosMappingString(row, "updatedAt", 64);
    if (!Number.isFinite(Date.parse(updatedAt))) {
      throw new SquareIntegrationError("unknown", "Square mapping review returned an invalid response.");
    }
    return {
      id: requiredPosMappingString(row, "id", 64),
      restaurantId: expectedRestaurantId,
      provider: "square",
      locationId: requiredPosMappingString(row, "locationId", 64),
      providerLocationId: requiredPosMappingString(row, "providerLocationId", 128),
      locationName: requiredPosMappingString(row, "locationName", 160),
      externalCatalogItemId: requiredPosMappingString(row, "externalCatalogItemId", 128),
      externalVariationId: requiredPosMappingString(row, "externalVariationId", 128),
      externalName: requiredPosMappingString(row, "externalName", 240),
      suggestedMenuItemId: optionalPosMappingString(row, "suggestedMenuItemId", 64),
      suggestedMenuItemName: optionalPosMappingString(row, "suggestedMenuItemName", 160),
      suggestedMenuItemCategory: optionalPosMappingString(row, "suggestedMenuItemCategory", 120),
      verificationStatus: "draft",
      updatedAt
    };
  });

  if (
    typeof payload.pendingCount !== "number" ||
    !Number.isFinite(payload.pendingCount) ||
    !Number.isInteger(payload.pendingCount) ||
    payload.pendingCount < 0 ||
    payload.pendingCount < mappings.length
  ) {
    throw new SquareIntegrationError("unknown", "Square mapping review returned an invalid response.");
  }

  return {
    restaurantId: expectedRestaurantId,
    pendingCount: payload.pendingCount,
    mappings,
    menuItems
  };
}

function parsePosMappingReviewResult(
  data: unknown,
  expectedRestaurantId: string,
  expectedMappingId: string
): PosMappingReviewResult {
  const payload = asUnknownRecord(data);
  const validOutcomes = new Set(["verified", "already_verified", "rejected", "already_rejected"]);
  if (
    payload.restaurantId !== expectedRestaurantId ||
    payload.mappingId !== expectedMappingId ||
    typeof payload.outcome !== "string" ||
    !validOutcomes.has(payload.outcome) ||
    (payload.verificationStatus !== "verified" && payload.verificationStatus !== "rejected")
  ) {
    throw new SquareIntegrationError("unknown", "Square mapping review returned an invalid response.");
  }
  return {
    outcome: payload.outcome as PosMappingReviewResult["outcome"],
    mappingId: expectedMappingId,
    restaurantId: expectedRestaurantId,
    menuItemId: optionalPosMappingString(payload, "menuItemId", 64),
    verificationStatus: payload.verificationStatus,
    verifiedAt: optionalPosMappingString(payload, "verifiedAt", 64),
    verifiedBy: optionalPosMappingString(payload, "verifiedBy", 64)
  };
}

function requireSquareAuthorizationUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 4096) {
    throw new SquareIntegrationError("unknown", "Square authorization returned an invalid URL.");
  }
  try {
    const url = new URL(value);
    const allowedHosts = new Set(["connect.squareup.com", "connect.squareupsandbox.com"]);
    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname) || url.username || url.password) {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new SquareIntegrationError("unknown", "Square authorization returned an invalid URL.");
  }
}

async function squareIntegrationErrorFrom(error: unknown, fallbackMessage: string) {
  const payload = await readFunctionErrorPayload(error);
  const candidateStatus = typeof payload.status === "string" ? payload.status : "unknown";
  const status = squareIntegrationErrorStatuses.has(candidateStatus as SquareIntegrationErrorStatus)
    ? (candidateStatus as SquareIntegrationErrorStatus)
    : "unknown";
  const candidateMessage =
    typeof payload.message === "string"
      ? payload.message
      : typeof payload.error === "string"
        ? payload.error
        : "";
  const message = candidateMessage.trim().slice(0, 320) || fallbackMessage;
  return new SquareIntegrationError(status, message);
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
  let blockerCodes: SupplierSendBlockerCode[] = [];
  try {
    blockerCodes = parseSupplierSendBlockerCodes(payload.blockerCodes);
  } catch {
    return new GmailIntegrationError(
      "unknown",
      "Supplier send workflow returned invalid blockers."
    );
  }
  return new GmailIntegrationError(status, message, blockerCodes);
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
export function createSupabaseRepository(): MiseRepository {
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

  async function fetchVerifiedProviderMappings(restaurantId: string) {
    const { data, error } = await client!
      .from("pos_catalog_item_mappings")
      .select(`
        restaurant_id,
        external_catalog_item_id,
        external_variation_id,
        menu_item_id,
        verification_status,
        effective_from,
        effective_to,
        pos_locations!inner(
          external_location_id,
          status,
          pos_integrations!inner(provider, status)
        ),
        menu_items!inner(active)
      `)
      .eq("restaurant_id", restaurantId);
    if (error) throw error;
    const nowIso = new Date().toISOString();
    return ((data ?? []) as Array<{
      restaurant_id: string;
      external_catalog_item_id: string;
      external_variation_id: string;
      menu_item_id: string;
      verification_status: string;
      effective_from: string;
      effective_to: string | null;
      pos_locations?: {
        external_location_id?: string;
        status?: string;
        pos_integrations?: { provider?: string; status?: string };
      };
      menu_items?: { active?: boolean };
    }>).filter((row) => {
      const location = row.pos_locations;
      return (
        row.verification_status === "verified" &&
        row.effective_from <= nowIso &&
        (!row.effective_to || row.effective_to > nowIso) &&
        Boolean(location?.external_location_id) &&
        location?.status === "active" &&
        location?.pos_integrations?.provider === "square" &&
        location?.pos_integrations?.status === "connected" &&
        row.menu_items?.active === true
      );
    }).map((row) => ({
      restaurantId: row.restaurant_id,
      sourcePos: String(row.pos_locations?.pos_integrations?.provider ?? "").trim(),
      providerLocationId: String(row.pos_locations?.external_location_id ?? "").trim(),
      externalCatalogItemId: row.external_catalog_item_id,
      externalVariationId: row.external_variation_id,
      menuItemId: row.menu_item_id
    })).filter((row) => row.sourcePos && row.providerLocationId);
  }

  async function loadRestaurantTaskDependencyIds(restaurantId: string, taskId: string) {
    const { data, error } = await client!
      .from("restaurant_task_dependencies")
      .select("restaurant_id, task_id, depends_on_task_id")
      .eq("restaurant_id", restaurantId)
      .eq("task_id", taskId);
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      restaurant_id: string;
      task_id: string;
      depends_on_task_id: string;
    }>;
    if (rows.some((row) => row.restaurant_id !== restaurantId || row.task_id !== taskId)) {
      throw new Error("Restaurant task dependencies failed restaurant scope validation.");
    }
    return rows.map((row) => row.depends_on_task_id);
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

  async function invokeSquareFunction(
    functionName: "link-square" | "sync-pos-sales",
    body: Record<string, unknown>,
    restaurantId: string,
    fallbackMessage: string
  ) {
    const { data, error } = await client!.functions.invoke(functionName, { body });
    if (error) {
      if (isTenantAuthorizationError(error)) throwRepositoryError(error, restaurantId);
      throw await squareIntegrationErrorFrom(error, fallbackMessage);
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

    async fetchRestaurantTeam(restaurantId) {
      const { data, error } = await client.rpc("list_restaurant_members", {
        p_restaurant_id: restaurantId
      });
      if (error) throwRepositoryError(error, restaurantId);
      return ((data ?? []) as RestaurantTeamMember[]).map(normalizeRestaurantTeamMember);
    },

    async addRestaurantMemberByEmail(restaurantId, email, role) {
      const { data: candidateUserId, error: lookupError } = await client.rpc("find_restaurant_member_candidate", {
        p_restaurant_id: restaurantId,
        p_email: email
      });
      if (lookupError) {
        if (isTenantAuthorizationError(lookupError)) throwRepositoryError(lookupError, restaurantId);
        throw teamMembershipErrorFrom(lookupError);
      }
      if (typeof candidateUserId !== "string" || candidateUserId.length === 0) {
        throw new TeamMembershipError("account_not_found", "No Mise account uses this email.");
      }

      const { data, error } = await client.rpc("add_restaurant_member", {
        p_restaurant_id: restaurantId,
        p_target_user_id: candidateUserId,
        p_role: role
      });
      if (error) {
        if (isTenantAuthorizationError(error)) throwRepositoryError(error, restaurantId);
        throw teamMembershipErrorFrom(error);
      }
      const membership = normalizeRestaurantMembership(data as RestaurantMembership);
      return normalizeRestaurantTeamMember({
        restaurant_id: membership.restaurant_id,
        user_id: membership.user_id,
        role: membership.role,
        status: membership.status,
        name: null,
        email: email.trim().toLowerCase(),
        created_at: membership.created_at,
        updated_at: membership.updated_at
      });
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

    async deleteAccount(restaurantId) {
      const { data, error } = await client.functions.invoke("delete-account", {
        body: {
          confirmation: "delete_my_account",
          restaurantId
        }
      });
      if (error) {
        const payload = await readFunctionErrorPayload(error);
        const message = typeof payload.error === "string" && payload.error.trim().length > 0
          ? payload.error.trim().slice(0, 320)
          : "Your account could not be deleted. Try again.";
        const deletionReference =
          typeof payload.deletionReference === "string"
            ? payload.deletionReference.trim().slice(0, 80)
            : "";
        throw new Error(
          deletionReference
            ? `${message} Reference: ${deletionReference}`
            : message
        );
      }
      if (!data || (data as { status?: unknown }).status !== "deleted") {
        throw new Error("Account deletion did not complete.");
      }
    },

    async exportRestaurantData(restaurantId): Promise<RestaurantDataExport> {
      const { data, error } = await client.functions.invoke("export-restaurant-data", {
        body: { restaurantId }
      });
      if (error) {
        const payload = await readFunctionErrorPayload(error);
        const message =
          typeof payload.error === "string" && payload.error.trim().length > 0
            ? payload.error.trim().slice(0, 320)
            : "Restaurant data could not be exported. Try again.";
        throw new Error(message);
      }
      return normalizeRestaurantDataExport(data, restaurantId);
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
          client.from("inventory_items").select(inventorySupplierSelect).eq("restaurant_id", restaurantId),
          client.from("purchase_recommendations").select(recommendationSupplierSelect).eq("restaurant_id", restaurantId),
          client.from("insights").select("*").eq("restaurant_id", restaurantId),
          client.from("menu_item_ingredients").select("*").eq("restaurant_id", restaurantId)
        ]);

      if (restaurantResult.error) throw restaurantResult.error;
      if (inventoryResult.error) throw inventoryResult.error;
      if (recommendationsResult.error) throw recommendationsResult.error;
      if (insightsResult.error) throw insightsResult.error;
      if (mappingResult.error) throw mappingResult.error;
      const providerMappings = await fetchVerifiedProviderMappings(restaurantId);

      return normalizeRestaurantData(
        restaurantResult.data as Restaurant,
        sales,
        (inventoryResult.data ?? []).map((row) =>
          normalizeInventoryItem(withCurrentSupplierDisplay(row, "Inventory item") as unknown as InventoryItem)
        ),
        (recommendationsResult.data ?? []).map((row) =>
          normalizePurchaseRecommendation(
            withCurrentSupplierDisplay(row, "Purchase recommendation") as unknown as PurchaseRecommendation
          )
        ),
        (insightsResult.data ?? []) as Insight[],
        (mappingResult.data ?? []) as MenuItemIngredient[],
        providerMappings
      );
    },

    async recordOperationalFindingDecision(input) {
      const { data, error } = await client.rpc(
        "record_operational_finding_decision",
        operationalFindingDecisionRpcArguments(input)
      );
      if (error) throwRepositoryError(error, input.restaurantId);
      return normalizeOperationalFindingDecision(data, input.restaurantId);
    },

    async fetchOperationalFindingDecisions(restaurantId) {
      const { data, error } = await client
        .from("operational_finding_decisions")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .gte("recorded_at", operationalDecisionHistoryCutoffIso())
        .order("recorded_at", { ascending: false });
      if (error) throwRepositoryError(error, restaurantId);
      return (data ?? []).map((entry) =>
        normalizeOperationalFindingDecision(entry, restaurantId)
      );
    },

    async fetchInventoryItems(restaurantId) {
      const { data, error } = await client
        .from("inventory_items")
        .select(inventorySupplierSelect)
        .eq("restaurant_id", restaurantId)
        .order("item_name");
      if (error) throw error;
      return (data ?? []).map((row) =>
        normalizeInventoryItem(withCurrentSupplierDisplay(row, "Inventory item") as unknown as InventoryItem)
      );
    },

    async fetchSuppliers(restaurantId) {
      const expectedRestaurantId = requireHostedUuid(restaurantId, "restaurant");
      const { data, error } = await client
        .from("suppliers")
        .select("*")
        .eq("restaurant_id", expectedRestaurantId)
        .order("display_name")
        .order("id");
      if (error) throwRepositoryError(error, restaurantId);
      return ((data ?? []) as Supplier[]).map((supplier) =>
        normalizeHostedSupplier(supplier, expectedRestaurantId)
      );
    },

    async createSupplier(restaurantId, displayName) {
      const { data, error } = await client.rpc("create_supplier", {
        p_restaurant_id: requireHostedUuid(restaurantId, "restaurant"),
        p_display_name: requireSupplierDisplayName(displayName)
      });
      if (error) throwRepositoryError(error, restaurantId);
      const supplier = Array.isArray(data) ? data[0] : data;
      if (!supplier || typeof supplier !== "object") {
        throw new Error("Supplier creation returned an invalid response.");
      }
      return normalizeHostedSupplier(supplier as Supplier, restaurantId);
    },

    async renameSupplier(restaurantId, supplierId, displayName) {
      const expectedSupplierId = requireHostedUuid(supplierId, "supplier");
      const { data, error } = await client.rpc("rename_supplier", {
        p_restaurant_id: requireHostedUuid(restaurantId, "restaurant"),
        p_supplier_id: expectedSupplierId,
        p_display_name: requireSupplierDisplayName(displayName)
      });
      if (error) throwRepositoryError(error, restaurantId);
      const supplier = Array.isArray(data) ? data[0] : data;
      if (!supplier || typeof supplier !== "object") {
        throw new Error("Supplier rename returned an invalid response.");
      }
      const normalizedSupplier = normalizeHostedSupplier(supplier as Supplier, restaurantId);
      if (normalizedSupplier.id !== expectedSupplierId) {
        throw new Error("Supplier rename returned mismatched authority.");
      }
      return normalizedSupplier;
    },

    async reassignInventoryItemSupplier(restaurantId, itemId, supplierId) {
      const expectedRestaurantId = requireHostedUuid(restaurantId, "restaurant");
      const expectedItemId = requireHostedUuid(itemId, "inventory item");
      const expectedSupplierId = requireHostedUuid(supplierId, "supplier");
      const { data, error } = await client.rpc("reassign_inventory_item_supplier", {
        p_restaurant_id: expectedRestaurantId,
        p_inventory_item_id: expectedItemId,
        p_supplier_id: expectedSupplierId
      });
      if (error) throwRepositoryError(error, restaurantId);
      const item = Array.isArray(data) ? data[0] : data;
      if (!item || typeof item !== "object") {
        throw new Error("Supplier reassignment returned an invalid response.");
      }
      const normalizedItem = normalizeInventoryItem(item as InventoryItem);
      if (
        normalizedItem.restaurant_id !== expectedRestaurantId ||
        normalizedItem.id !== expectedItemId ||
        normalizedItem.supplier_id !== expectedSupplierId
      ) {
        throw new Error("Supplier reassignment returned mismatched authority.");
      }
      return normalizedItem;
    },

    async listInventoryEvents(restaurantId, options) {
      let query = client
        .from("inventory_events")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("recorded_at", { ascending: false })
        .order("sequence", { ascending: false });

      if (options?.eventTypes?.length) {
        query = query.in("event_type", options.eventTypes);
      }
      if (options?.since) {
        query = query.gte("recorded_at", options.since);
      }
      if (options?.sinceSequence != null && Number.isFinite(options.sinceSequence)) {
        query = query.gt("sequence", options.sinceSequence);
      }
      if (options?.limit != null && Number.isFinite(options.limit) && options.limit >= 0) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throwRepositoryError(error, restaurantId);
      return (data ?? []).map((entry) => normalizeInventoryEventRecord(entry));
    },

    async recordInventoryEvent(input) {
      const { data, error } = await client.rpc(
        "record_inventory_event",
        inventoryEventRpcArguments(input)
      );
      if (error) {
        const terminal = inventoryEventRejectionFromRpcError(error);
        if (terminal) return terminal;
        throwRepositoryError(error, input.restaurantId);
      }
      return {
        status: "accepted",
        event: normalizeInventoryEventRecord(data)
      };
    },

    async verifyInventoryItemCanonicalUnit(
      restaurantId,
      itemId,
      canonicalUnit,
      canonicalQuantityPerUnit
    ) {
      const { data, error } = await client.rpc(
        "verify_inventory_item_canonical_unit",
        {
          p_restaurant_id: restaurantId,
          p_inventory_item_id: itemId,
          p_canonical_unit: canonicalUnit,
          p_canonical_quantity_per_unit: canonicalQuantityPerUnit
        }
      );
      if (error) throwRepositoryError(error, restaurantId);
      const item = Array.isArray(data) ? data[0] : data;
      if (!item || typeof item !== "object") {
        throw new Error("Canonical unit verification returned an invalid response.");
      }
      return normalizeInventoryItem(item as InventoryItem);
    },

    async fetchPlanningData(restaurantId) {
      const [inventoryResult, sales, mappingResult, restaurantResult] = await Promise.all([
        client.from("inventory_items").select(inventorySupplierSelect).eq("restaurant_id", restaurantId).order("item_name"),
        fetchBoundedPlanningSales(restaurantId),
        client.from("menu_item_ingredients").select("*").eq("restaurant_id", restaurantId),
        client.from("restaurants").select("timezone").eq("id", restaurantId).single()
      ]);
      if (inventoryResult.error) throw inventoryResult.error;
      if (mappingResult.error) throw mappingResult.error;
      if (restaurantResult.error) throw restaurantResult.error;
      const timeZone = (restaurantResult.data as Pick<Restaurant, "timezone">).timezone;
      const providerMappings = await fetchVerifiedProviderMappings(restaurantId);
      return {
        inventoryItems: (inventoryResult.data ?? []).map((row) =>
          normalizeInventoryItem(withCurrentSupplierDisplay(row, "Inventory item") as unknown as InventoryItem)
        ),
        sales,
        menuItemIngredients: ((mappingResult.data ?? []) as MenuItemIngredient[]).map(normalizeMenuItemIngredient),
        providerMappings,
        operatingDate: toDateKeyInTimeZone(new Date(), timeZone),
        timeZone
      };
    },

    async fetchVerifiedProviderMappings(restaurantId) {
      return fetchVerifiedProviderMappings(restaurantId);
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

    async fetchRecipeAuthorities(restaurantId) {
      const { data, error } = await client.rpc("list_recipe_authorities", {
        p_restaurant_id: restaurantId
      });
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Recipe authority returned an invalid response.");
      return data.map(parseRecipeAuthorityState);
    },

    async confirmRecipeComplete(restaurantId, menuItemId, expectedRevision) {
      const { data, error } = await client.rpc("confirm_recipe_complete", {
        p_restaurant_id: restaurantId,
        p_menu_item_id: menuItemId,
        p_expected_revision: expectedRevision
      });
      if (error) throw error;
      return parseRecipeAuthorityState(data);
    },

    async findPendingRecommendation(restaurantId, itemId) {
      const existing = await client
        .from("purchase_recommendations")
        .select(recommendationSupplierSelect)
        .eq("restaurant_id", restaurantId)
        .eq("inventory_item_id", itemId)
        .eq("status", "pending")
        .maybeSingle();
      if (existing.error) throw existing.error;
      return existing.data
        ? normalizePurchaseRecommendation(
          withCurrentSupplierDisplay(existing.data, "Purchase recommendation") as unknown as PurchaseRecommendation
        )
        : null;
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
        .select(recommendationSupplierSelect)
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) =>
        normalizePurchaseRecommendation(
          withCurrentSupplierDisplay(row, "Purchase recommendation") as unknown as PurchaseRecommendation
        )
      );
    },

    async fetchPurchaseRecommendationAuthorities(restaurantId) {
      const { data, error } = await client.rpc("list_purchase_recommendation_authority", {
        p_restaurant_id: restaurantId
      });
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Purchase authority returned an invalid response.");
      }
      return Object.fromEntries(
        Object.entries(data as Record<string, unknown>).map(([recommendationId, authority]) => [
          recommendationId,
          normalizePurchaseAuthorityResult(authority)
        ])
      );
    },

    async fetchRecommendationHistory(restaurantId) {
      const { data, error } = await client
        .from("purchase_recommendations")
        .select(recommendationSupplierSelect)
        .eq("restaurant_id", restaurantId)
        .gte("created_at", recommendationHistoryCutoffIso())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) =>
        normalizePurchaseRecommendation(
          withCurrentSupplierDisplay(row, "Purchase recommendation") as unknown as PurchaseRecommendation
        )
      );
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

    async fetchPurchaseDecisionPatterns(restaurantId) {
      const { data, error } = await client.rpc("list_purchase_decision_patterns", {
        p_restaurant_id: restaurantId
      });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(normalizePurchaseDecisionPattern);
    },

    async excludePurchaseDecisionEvent(restaurantId, eventId) {
      const { data, error } = await client.rpc("exclude_purchase_decision_event", {
        p_restaurant_id: restaurantId,
        p_event_id: eventId
      });
      if (error) throw error;
      return normalizePurchaseDecisionEvent(data as Record<string, unknown>);
    },

    async replacePendingRecommendations(restaurantId, _inserts) {
      await invokeOperationalWorkflow({ action: "refresh_signals", restaurantId });
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

    async fetchSupplierDeliveryHistory(restaurantId) {
      const { data: deliveryRows, error: deliveryError } = await client
        .from("supplier_deliveries")
        .select("id,restaurant_id,supplier_order_id,status,received_at,notes,created_at")
        .eq("restaurant_id", restaurantId)
        .order("received_at", { ascending: false })
        .limit(100);
      if (deliveryError) throw deliveryError;

      const deliveries = ((deliveryRows ?? []) as SupplierDeliveryRecord[]).map(
        normalizeSupplierDeliveryRecord
      );
      if (deliveries.length === 0) return { deliveries: [], items: [] };

      const { data: itemRows, error: itemError } = await client
        .from("supplier_delivery_items")
        .select(
          "id,restaurant_id,delivery_id,inventory_item_id,ordered_quantity,received_quantity,damaged_quantity,missing_quantity,canonical_unit,discrepancy_reason"
        )
        .eq("restaurant_id", restaurantId)
        .in("delivery_id", deliveries.map((delivery) => delivery.id))
        .limit(1000);
      if (itemError) throw itemError;

      return {
        deliveries,
        items: ((itemRows ?? []) as SupplierDeliveryItemRecord[]).map(
          normalizeSupplierDeliveryItemRecord
        )
      };
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

    async connectRestaurantSquare(restaurantId) {
      const data = await invokeSquareFunction(
        "link-square",
        { restaurantId, action: "connect" },
        restaurantId,
        "Could not start Square authorization."
      );
      return parseSquareConnectionWorkflowResponse(data);
    },

    async disconnectRestaurantSquare(restaurantId) {
      const data = await invokeSquareFunction(
        "link-square",
        { restaurantId, action: "disconnect" },
        restaurantId,
        "Could not disconnect Square."
      );
      return parseSquareDisconnectWorkflowResponse(data);
    },

    async syncSquarePosSales(restaurantId, from, to) {
      const data = await invokeSquareFunction(
        "sync-pos-sales",
        { restaurantId, provider: "square", from, to },
        restaurantId,
        "Could not sync Square sales."
      );
      return parseSquareSyncWorkflowResponse(data);
    },

    async fetchSquarePosIntegration(restaurantId) {
      const { data, error } = await client
        .from("pos_integrations")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("provider", "square")
        .maybeSingle();
      if (error) throw error;
      return data ? normalizePosIntegration(data as PosIntegration) : null;
    },

    async fetchPosMappingReviewQueue(restaurantId) {
      const { data, error } = await client.rpc("list_pos_catalog_mapping_reviews", {
        p_restaurant_id: restaurantId
      });
      if (error) throw error;
      return parsePosMappingReviewQueue(data, restaurantId);
    },

    async reviewPosCatalogMapping(restaurantId, mappingId, menuItemId, decision) {
      const { data, error } = await client.rpc("review_pos_catalog_mapping", {
        p_restaurant_id: restaurantId,
        p_mapping_id: mappingId,
        p_menu_item_id: menuItemId,
        p_decision: decision
      });
      if (error) throw error;
      return parsePosMappingReviewResult(data, restaurantId, mappingId);
    },

    async previewSupplierSendContent(restaurantId, orderId) {
      const { data, error } = await client.rpc("preview_supplier_send_content", {
        p_restaurant_id: restaurantId,
        p_order_id: orderId
      });
      if (error) throwRepositoryError(error, restaurantId);
      return normalizeSupplierSendContentPreview(data, restaurantId, orderId);
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
        .select(recipientSupplierSelect)
        .eq("restaurant_id", restaurantId)
        .order("supplier_id");
      if (error) throwRepositoryError(error, restaurantId);
      return (data ?? []).map((row) =>
        normalizeSupplierRecipient(
          withCurrentSupplierDisplay(row, "Supplier recipient") as unknown as SupplierRecipient
        )
      );
    },

    async upsertSupplierRecipient(input) {
      const expectedRestaurantId = requireHostedUuid(input.restaurant_id, "restaurant");
      const expectedSupplierId = requireHostedUuid(input.supplier_id, "supplier");
      const { data, error } = await client.rpc("upsert_supplier_recipient", {
        p_restaurant_id: expectedRestaurantId,
        p_supplier_id: expectedSupplierId,
        p_email: input.email
      });
      if (error) throwRepositoryError(error, input.restaurant_id);
      const recipient = Array.isArray(data) ? data[0] : data;
      if (!recipient || typeof recipient !== "object") {
        throw new Error("Supplier recipient workflow returned an invalid response.");
      }
      const normalizedRecipient = normalizeSupplierRecipient(recipient as SupplierRecipient);
      if (
        normalizedRecipient.restaurant_id !== expectedRestaurantId ||
        normalizedRecipient.supplier_id !== expectedSupplierId
      ) {
        throw new Error("Supplier recipient workflow returned mismatched authority.");
      }
      return normalizedRecipient;
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
    },

    async listActivityEvents(restaurantId, options = {}) {
      let query = client
        .from("activity_events")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("occurred_at", { ascending: false })
        .limit(options.limit ?? 100);
      if (options.since) query = query.gte("occurred_at", options.since);
      if (options.until) query = query.lte("occurred_at", options.until);
      if (options.attentionOnly) query = query.eq("requires_attention", true);
      const { data, error } = await query;
      if (error) throw error;
      let events = ((data ?? []) as PersistedActivityEventRow[]).map(activityEventFromPersistedRow);
      if (events.some((event) => event.restaurantId !== restaurantId)) {
        throw new Error("Activity events failed restaurant scope validation.");
      }
      if (options.filter && options.filter !== "all") {
        events = filterActivities(events, options.filter as ActivityFeedFilter);
      }
      return events;
    },

    async listRestaurantTasks(restaurantId) {
      const [tasksResult, dependenciesResult] = await Promise.all([
        client
          .from("restaurant_tasks")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false }),
        client
          .from("restaurant_task_dependencies")
          .select("restaurant_id, task_id, depends_on_task_id")
          .eq("restaurant_id", restaurantId)
      ]);
      if (tasksResult.error) throw tasksResult.error;
      if (dependenciesResult.error) throw dependenciesResult.error;
      const dependenciesByTask = new Map<string, string[]>();
      for (const row of (dependenciesResult.data ?? []) as Array<{
        restaurant_id: string;
        task_id: string;
        depends_on_task_id: string;
      }>) {
        if (row.restaurant_id !== restaurantId) {
          throw new Error("Restaurant task dependencies failed restaurant scope validation.");
        }
        dependenciesByTask.set(row.task_id, [
          ...(dependenciesByTask.get(row.task_id) ?? []),
          row.depends_on_task_id
        ]);
      }
      const tasks = ((tasksResult.data ?? []) as PersistedRestaurantTaskRow[]).map((row) =>
        restaurantTaskFromPersistedRow(row, dependenciesByTask.get(row.id) ?? [])
      );
      if (tasks.some((task) => task.restaurantId !== restaurantId)) {
        throw new Error("Restaurant tasks failed restaurant scope validation.");
      }
      return tasks;
    },

    async createRestaurantTask(input) {
      const { data, error } = await client.rpc(
        "create_restaurant_task",
        createRestaurantTaskRpcArguments(input)
      );
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as PersistedRestaurantTaskRow | null;
      if (!row) throw new Error("Task creation returned an empty response.");
      const dependencyIds = await loadRestaurantTaskDependencyIds(input.restaurantId.trim(), row.id);
      const task = restaurantTaskFromPersistedRow(row, dependencyIds);
      if (task.restaurantId !== input.restaurantId.trim()) {
        throw new Error("Restaurant task failed restaurant scope validation.");
      }
      return task;
    },

    async completeRestaurantTask(input) {
      const { data, error } = await client.rpc(
        "complete_restaurant_task",
        completeRestaurantTaskRpcArguments(input)
      );
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as PersistedRestaurantTaskRow | null;
      if (!row) throw new Error("Task completion returned an empty response.");
      const dependencyIds = await loadRestaurantTaskDependencyIds(input.restaurantId.trim(), row.id);
      const task = restaurantTaskFromPersistedRow(row, dependencyIds);
      if (task.restaurantId !== input.restaurantId.trim()) {
        throw new Error("Restaurant task failed restaurant scope validation.");
      }
      return task;
    },

    async reopenRestaurantTask(restaurantId, taskId) {
      const { data, error } = await client.rpc("reopen_restaurant_task", {
        p_restaurant_id: restaurantId,
        p_task_id: taskId
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as PersistedRestaurantTaskRow | null;
      if (!row) throw new Error("Task reopen returned an empty response.");
      const dependencyIds = await loadRestaurantTaskDependencyIds(restaurantId, row.id);
      const task = restaurantTaskFromPersistedRow(row, dependencyIds);
      if (task.restaurantId !== restaurantId) {
        throw new Error("Restaurant task failed restaurant scope validation.");
      }
      return task;
    },

    async listRecalculationRuns(restaurantId, options = {}) {
      let query = client
        .from("recalculation_runs")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("operating_date", { ascending: false })
        .order("attempt", { ascending: true })
        .limit(options.limit ?? 64);
      if (options.sinceOperatingDate) {
        query = query.gte("operating_date", options.sinceOperatingDate);
      }
      const { data, error } = await query;
      if (error) throw error;
      const runs = ((data ?? []) as PersistedRecalculationRunRow[]).map(
        recalculationRunFromPersistedRow
      );
      if (runs.some((run) => run.restaurantId !== restaurantId)) {
        throw new Error("Recalculation runs failed restaurant scope validation.");
      }
      return runs;
    },

    async recordRecalculationRun(input) {
      const { data, error } = await client.rpc(
        "record_recalculation_run",
        recordRecalculationRunRpcArguments(input)
      );
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as PersistedRecalculationRunRow | null;
      if (!row) throw new Error("Recalculation run recording returned an empty response.");
      const run = recalculationRunFromPersistedRow(row);
      if (run.restaurantId !== input.restaurantId.trim()) {
        throw new Error("Recalculation run failed restaurant scope validation.");
      }
      return run;
    },

    async listMiseActions(restaurantId, options = {}) {
      let query = client
        .from("mise_actions")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(options.limit ?? 100);
      if (options.status === "awaiting_decision") {
        query = query.in("status", ["prepared", "waiting_for_approval"]);
      } else if (options.status) {
        query = query.eq("status", options.status);
      }
      const { data, error } = await query;
      if (error) throw error;
      const actions = ((data ?? []) as PersistedMiseActionRow[]).map(miseActionFromPersistedRow);
      if (actions.some((action) => action.restaurantId !== restaurantId)) {
        throw new Error("Mise actions failed restaurant scope validation.");
      }
      return actions;
    },

    async fetchSupplierSendAction(restaurantId, orderId) {
      const { data, error } = await client
        .from("mise_actions")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("action_type", "send_supplier_order")
        .eq("idempotency_key", `send_supplier_order:${orderId}`)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const action = miseActionFromPersistedRow(data as PersistedMiseActionRow);
      if (action.restaurantId !== restaurantId) {
        throw new Error("Supplier send action failed restaurant scope validation.");
      }
      return action;
    },

    async decideMiseAction(restaurantId, actionId, decision) {
      const { data, error } = await client.rpc("decide_mise_action", {
        p_restaurant_id: restaurantId,
        p_action_id: actionId,
        p_decision: decision
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as PersistedMiseActionRow | null;
      if (!row) throw new Error("Action decision returned an empty response.");
      const action = miseActionFromPersistedRow(row);
      if (action.restaurantId !== restaurantId) {
        throw new Error("Mise action failed restaurant scope validation.");
      }
      return action;
    },

    async approveSupplierSendContent(restaurantId, actionId, orderId, contentFingerprint) {
      const reviewedFingerprint = requireSupplierSendContentFingerprint(contentFingerprint);
      const { data, error } = await client.rpc("approve_supplier_send_content", {
        p_restaurant_id: restaurantId,
        p_action_id: actionId,
        p_order_id: orderId,
        p_reviewed_content_fingerprint: reviewedFingerprint
      });
      if (error) throwRepositoryError(error, restaurantId);
      return parseSupplierSendContentApprovalResponse(
        data,
        restaurantId,
        actionId,
        reviewedFingerprint
      );
    },

    async listRestaurantMemories(restaurantId, options = {}) {
      let query = client
        .from("restaurant_memories")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("last_updated_at", { ascending: false })
        .limit(options.limit ?? 100);
      if (options.status === "actionable") {
        query = query.in("status", ["active", "confirmed", "corrected"]);
      } else if (options.status) {
        query = query.eq("status", options.status);
      }
      const { data, error } = await query;
      if (error) throw error;
      const memories = ((data ?? []) as PersistedRestaurantMemoryRow[]).map(
        restaurantMemoryFromPersistedRow
      );
      if (memories.some((memory) => memory.restaurantId !== restaurantId)) {
        throw new Error("Restaurant memories failed restaurant scope validation.");
      }
      return memories;
    },

    async updateRestaurantMemoryDecision(restaurantId, memoryId, decision, correction) {
      const allowed: Array<Exclude<RestaurantMemoryStatus, "active">> = [
        "confirmed",
        "corrected",
        "dismissed",
        "forgotten",
        "disabled"
      ];
      if (!allowed.includes(decision)) {
        throw new Error("Unsupported memory decision");
      }
      const { data, error } = await client.rpc("update_restaurant_memory", {
        p_restaurant_id: restaurantId,
        p_memory_id: memoryId,
        p_decision: decision,
        p_correction: correction ?? null
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as PersistedRestaurantMemoryRow | null;
      if (!row) throw new Error("Memory decision returned an empty response.");
      const memory = restaurantMemoryFromPersistedRow(row);
      if (memory.restaurantId !== restaurantId) {
        throw new Error("Restaurant memory failed restaurant scope validation.");
      }
      return memory;
    },

    async listAutonomyRules(restaurantId) {
      const { data, error } = await client
        .from("restaurant_autonomy_rules")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const rules = ((data ?? []) as PersistedAutonomyRuleRow[]).map(autonomyRuleFromPersistedRow);
      if (rules.some((rule) => rule.restaurantId !== restaurantId)) {
        throw new Error("Autonomy rules failed restaurant scope validation.");
      }
      return rules;
    },

    async upsertAutonomyRule(restaurantId, input) {
      const { data, error } = await client.rpc("upsert_restaurant_autonomy_rule", {
        p_restaurant_id: restaurantId,
        p_action_type: input.actionType,
        p_operational_category: input.operationalCategory,
        p_maximum_autonomy_level: input.maximumAutonomyLevel,
        p_requires_approval: input.requiresApproval,
        p_enabled: input.enabled,
        p_spend_limit_cents: input.spendLimitCents ?? null,
        p_supplier_id: input.supplierId
          ? requireHostedUuid(input.supplierId, "supplier")
          : null,
        p_communication_type: input.communicationType ?? null,
        p_allowed_start_time: input.allowedStartTime ?? null,
        p_allowed_end_time: input.allowedEndTime ?? null
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as PersistedAutonomyRuleRow | null;
      if (!row) throw new Error("Autonomy rule upsert returned an empty response.");
      const rule = autonomyRuleFromPersistedRow(row);
      if (rule.restaurantId !== restaurantId) {
        throw new Error("Autonomy rule failed restaurant scope validation.");
      }
      return rule;
    },

    async recordSupplierOrderDelivery(restaurantId, input): Promise<SupplierDeliveryRecordResult> {
      const { data, error } = await client.rpc("record_supplier_delivery", {
        p_restaurant_id: restaurantId,
        p_supplier_order_id: input.supplierOrderId,
        p_client_delivery_id: input.clientDeliveryId,
        p_received_at: input.receivedAt,
        p_lines: input.lines.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          orderedQuantity: line.orderedQuantity ?? null,
          receivedQuantity: line.receivedQuantity,
          damagedQuantity: line.damagedQuantity ?? 0,
          missingQuantity: line.missingQuantity ?? 0,
          canonicalUnit: line.canonicalUnit,
          substitutionInventoryItemId: line.substitutionInventoryItemId ?? null,
          unitPrice: line.unitPrice ?? null,
          discrepancyReason: line.discrepancyReason ?? null
        })),
        p_invoice_total: input.invoiceTotal ?? null,
        p_notes: input.notes ?? null
      });
      if (error) throw error;
      const payload = (Array.isArray(data) ? data[0] : data) as {
        outcome?: "applied" | "already_applied";
        status?: SupplierDeliveryRecordResult["status"];
        delivery?: { id?: string };
        supplierOrderId?: string;
        outcomeId?: string | null;
      } | null;
      const deliveryId = payload?.delivery?.id;
      if (!payload?.outcome || !deliveryId) {
        throw new Error("Supplier delivery returned an invalid response.");
      }
      return {
        outcome: payload.outcome,
        status: payload.status ?? "unverified",
        deliveryId,
        supplierOrderId: input.supplierOrderId,
        outcomeId: payload.outcomeId ?? null
      };
    },

    async fetchOpenInventoryCountSession(restaurantId) {
      const { data: session, error } = await client
        .from("inventory_count_sessions")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .in("status", ["in_progress", "submitted"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!session) return null;
      const { data: lines, error: linesError } = await client
        .from("inventory_count_lines")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("session_id", session.id)
        .order("item_name", { ascending: true });
      if (linesError) throw linesError;
      return normalizeInventoryCountSessionDetail({
        session: session as InventoryCountSessionDetail["session"],
        lines: (lines ?? []) as InventoryCountLine[]
      });
    },

    async fetchInventoryCountSession(restaurantId, sessionId) {
      const { data: session, error } = await client
        .from("inventory_count_sessions")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("id", sessionId)
        .maybeSingle();
      if (error) throw error;
      if (!session) throw new Error("Count session not found");
      const { data: lines, error: linesError } = await client
        .from("inventory_count_lines")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("session_id", sessionId)
        .order("item_name", { ascending: true });
      if (linesError) throw linesError;
      return normalizeInventoryCountSessionDetail({
        session: session as InventoryCountSessionDetail["session"],
        lines: (lines ?? []) as InventoryCountLine[]
      });
    },

    async beginInventoryCountSession(restaurantId, note) {
      const response = await invokeOperationalWorkflow({
        action: "begin_count_session",
        restaurantId,
        note
      });
      return parseCountSessionWorkflowResult(response.result);
    },

    async saveInventoryCountLines(restaurantId, sessionId, lines) {
      const response = await invokeOperationalWorkflow({
        action: "save_count_lines",
        restaurantId,
        sessionId,
        lines
      });
      return parseCountSessionWorkflowResult(response.result);
    },

    async submitInventoryCountSession(restaurantId, sessionId) {
      const response = await invokeOperationalWorkflow({
        action: "submit_count_session",
        restaurantId,
        sessionId
      });
      return parseCountSessionWorkflowResult(response.result);
    },

    async cancelInventoryCountSession(restaurantId, sessionId) {
      const response = await invokeOperationalWorkflow({
        action: "cancel_count_session",
        restaurantId,
        sessionId
      });
      return parseCountSessionWorkflowResult(response.result);
    },

    async approveInventoryCountSession(restaurantId, sessionId, _recommendations, _insights) {
      const response = await invokeOperationalWorkflow({
        action: "approve_count_session",
        restaurantId,
        sessionId
      });
      return parseCountSessionWorkflowResult(response.result);
    }
  };
}

function parseCountSessionWorkflowResult(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new Error("Count session workflow returned an invalid response.");
  }
  const payload = value as { session?: unknown; lines?: unknown };
  if (!payload.session) {
    throw new Error("Count session workflow returned an invalid response.");
  }
  return normalizeInventoryCountSessionDetail({
    session: payload.session as InventoryCountSessionDetail["session"],
    lines: (payload.lines ?? []) as InventoryCountLine[]
  });
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

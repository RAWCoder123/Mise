import type {
  AppUser,
  AiInsight,
  AuditLog,
  Insight,
  EmailConnectionStatus,
  IntegrationStatus,
  InventoryCountLine,
  InventoryCountSession,
  InventoryCountSessionDetail,
  InventoryItem,
  InventoryItemPatch,
  MenuItemIngredient,
  PosSale,
  PosIntegration,
  PurchaseOrder,
  PurchaseRecommendation,
  RestaurantMembership,
  RestaurantMembershipStatus,
  RestaurantRole,
  RestaurantTeamMember,
  RestaurantEmailConnection,
  Restaurant,
  RestaurantOperationalProfile,
  RestaurantServiceStyle,
  SalesImport,
  SetupAttachment,
  SetupAttachmentStatus,
  Supplier,
  SupplierEmailPayload,
  SupplierItem,
  SupplierOrder,
  SupplierRecipient,
  SupplierSendContentBlockerCode,
  SupplierSendContentLine
} from "../types/mise";
import {
  SUPPLIER_SEND_CONTENT_BLOCKER_CODES,
  SUPPLIER_SEND_CONTENT_VERSION
} from "../types/mise";
import {
  ORDER_MESSAGE_MAX_BYTES,
  RESTAURANT_ADDRESS_MAX_CHARACTERS,
  RESTAURANT_CUISINE_MAX_CHARACTERS,
  RESTAURANT_LOGO_URL_MAX_CHARACTERS,
  RESTAURANT_NAME_MAX_CHARACTERS,
  RESTAURANT_OPERATIONAL_PROFILE_MAX_BYTES,
  RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS,
  RESTAURANT_PROFILE_ARRAY_MAX_ITEMS,
  RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS,
  SUPPLIER_NOTE_MAX_CHARACTERS,
  utf8ByteLength
} from "./domain/securityLimits";
import type {
  InventoryEventInput,
  InventoryEventType
} from "./domain/inventoryLedger";
import { normalizeOperationalQuantity } from "./domain/operationalMapping";
import type {
  SupplierDeliveryItemRecord,
  SupplierDeliveryRecord,
  SupplierDeliveryStatus
} from "./domain/supplierReliability";

export { RESTAURANT_NAME_MAX_CHARACTERS, SUPPLIER_NOTE_MAX_CHARACTERS } from "./domain/securityLimits";

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNonNegativeNumber(value: unknown, fallback = 0) {
  return Math.max(0, asNumber(value, fallback));
}

export const operatingLimits = {
  inventoryQuantity: 1_000_000,
  recipeQuantityPerSale: 10_000,
  posQuantitySold: 100_000,
  posSalesAmount: 10_000_000,
  recommendationQuantity: 1_000_000
} as const;

const operatorInventoryEventTypes = new Set<InventoryEventType>([
  "receipt",
  "count",
  "waste",
  "stockout"
]);

export interface InventoryOperationClientInput {
  restaurantId: unknown;
  inventoryItemId: unknown;
  eventType: unknown;
  quantity: unknown;
  canonicalUnit: unknown;
  effectiveAt: unknown;
  sourceReference?: unknown;
  reasonCode?: unknown;
  note?: unknown;
}

export type ValidatedInventoryOperation = Omit<
  InventoryEventInput,
  "clientEventId" | "idempotencyKey"
>;

/**
 * The operator-facing inventory boundary accepts only bounded evidence fields.
 * Actor, sequence, arbitrary metadata, and correction links are intentionally
 * absent; those require server authority or a dedicated reconciliation flow.
 */
export function requireInventoryOperation(
  input: InventoryOperationClientInput
): ValidatedInventoryOperation {
  const restaurantId = requireBoundedText(input.restaurantId, "restaurant", 200);
  const inventoryItemId = requireBoundedText(input.inventoryItemId, "inventory item", 200);
  const eventType = requireOperatorInventoryEventType(input.eventType);
  const canonicalUnit = requireCanonicalUnit(input.canonicalUnit);
  const effectiveAt = requireInventoryTimestamp(input.effectiveAt);
  const quantity = requireInventoryQuantity(input.quantity);
  if (eventType === "stockout" && quantity !== 0) {
    throw new Error("A stockout quantity must be zero.");
  }
  if ((eventType === "receipt" || eventType === "waste") && quantity === 0) {
    throw new Error("Enter a quantity greater than zero.");
  }

  const sourceReference = optionalBoundedText(input.sourceReference, "reference", 200);
  const reasonCode = optionalBoundedText(input.reasonCode, "reason", 80);
  const note = optionalBoundedText(input.note, "note", 500);
  return {
    restaurantId,
    inventoryItemId,
    eventType,
    quantity,
    canonicalUnit,
    effectiveAt,
    source: `operator_${eventType}`,
    sourceReference,
    reasonCode,
    supersedesEventId: null,
    metadata: note ? { note } : {}
  };
}

export interface ReceiptCorrectionClientInput {
  restaurantId: unknown;
  receiptEventId: unknown;
  note: unknown;
  effectiveAt?: unknown;
}

/**
 * Dedicated manager reconciliation boundary for mistaken Log Delivery receipts.
 * Generic inventory ops still cannot set supersedesEventId; this path alone may.
 */
export function requireReceiptCorrectionInput(input: ReceiptCorrectionClientInput): {
  restaurantId: string;
  receiptEventId: string;
  note: string;
  effectiveAt: string;
} {
  return {
    restaurantId: requireBoundedText(input.restaurantId, "restaurant", 200),
    receiptEventId: requireBoundedText(input.receiptEventId, "receipt record", 200),
    note: requireBoundedText(input.note, "correction note", 500),
    effectiveAt: requireInventoryTimestamp(input.effectiveAt ?? new Date().toISOString())
  };
}

function requireOperatorInventoryEventType(value: unknown) {
  if (typeof value !== "string" || !operatorInventoryEventTypes.has(value as InventoryEventType)) {
    throw new Error("Choose a supported inventory operation.");
  }
  return value as "receipt" | "count" | "waste" | "stockout";
}

function requireCanonicalUnit(value: unknown) {
  if (value !== "g" && value !== "ml" && value !== "each") {
    throw new Error("Choose grams, milliliters, or each.");
  }
  return value;
}

function requireInventoryTimestamp(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error("Enter a valid inventory time.");
  }
  return new Date(value).toISOString();
}

function requireInventoryQuantity(value: unknown) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new Error("Enter a valid inventory quantity.");
  }
  const quantity = Number(value);
  if (
    !Number.isFinite(quantity) ||
    quantity < 0 ||
    quantity > operatingLimits.inventoryQuantity
  ) {
    throw new Error("Enter a valid inventory quantity.");
  }
  return quantity;
}

function requireBoundedText(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string") throw new Error(`Enter a valid ${label}.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`Enter a valid ${label}.`);
  }
  return normalized;
}

function optionalBoundedText(value: unknown, label: string, maximum: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error(`Enter a valid ${label}.`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maximum) throw new Error(`Enter a shorter ${label}.`);
  return normalized;
}

function asBoundedNonNegativeNumber(value: unknown, maximum: number, fallback = 0) {
  const parsed = asNumber(value, fallback);
  if (parsed <= 0) return 0;
  return Math.min(parsed, maximum);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function normalizeHexColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function normalizeServiceStyle(value: unknown): RestaurantServiceStyle {
  if (
    value === "quick_service" ||
    value === "fast_casual" ||
    value === "full_service" ||
    value === "bar" ||
    value === "cafe" ||
    value === "ghost_kitchen"
  ) {
    return value;
  }
  return "fast_casual";
}

export function normalizeRestaurantOperationalProfile(value: unknown): RestaurantOperationalProfile {
  const profile = asRecord(value);
  return {
    serviceStyle: normalizeServiceStyle(profile.serviceStyle),
    orderCadence: asStringArray(profile.orderCadence),
    prepWindows: asStringArray(profile.prepWindows),
    primarySuppliers: asStringArray(profile.primarySuppliers),
    inventoryReviewDays: asStringArray(profile.inventoryReviewDays),
    notes: asNullableString(profile.notes)
  };
}

export function normalizeRestaurant(value: Restaurant): Restaurant {
  return {
    ...value,
    name: asString(value.name, "Restaurant"),
    address: asNullableString(value.address),
    cuisine_type: asNullableString(value.cuisine_type),
    brand_color: normalizeHexColor(value.brand_color, "#EF3F27"),
    accent_color: normalizeHexColor(value.accent_color, "#EF3F27"),
    logo_url: asNullableString(value.logo_url),
    service_style: normalizeServiceStyle(value.service_style),
    timezone: asString(value.timezone, "America/New_York"),
    currency: asString(value.currency, "USD"),
    operational_profile: normalizeRestaurantOperationalProfile(value.operational_profile)
  };
}

export function normalizeAppUser(value: AppUser): AppUser {
  return {
    ...value,
    name: asString(value.name, "Operator"),
    email: asString(value.email),
    role: asString(value.role, "owner")
  };
}

export function normalizeRestaurantMembership(value: RestaurantMembership): RestaurantMembership {
  return {
    ...value,
    role: value.role,
    status: value.status,
    updated_at: value.updated_at ?? value.created_at
  };
}

function normalizeMembershipRole(value: unknown): RestaurantRole {
  return value === "owner" || value === "admin" || value === "manager" || value === "staff"
    ? value
    : "staff";
}

function normalizeMembershipStatus(value: unknown): RestaurantMembershipStatus {
  return value === "active" || value === "invited" || value === "disabled" ? value : "active";
}

export function normalizeRestaurantTeamMember(value: RestaurantTeamMember): RestaurantTeamMember {
  return {
    ...value,
    role: normalizeMembershipRole(value.role),
    status: normalizeMembershipStatus(value.status),
    name: asNullableString(value.name),
    email: asNullableString(value.email),
    updated_at: value.updated_at ?? value.created_at
  };
}

export function normalizePosSale(value: PosSale): PosSale {
  return {
    ...value,
    quantity_sold: asBoundedNonNegativeNumber(value.quantity_sold, operatingLimits.posQuantitySold),
    gross_sales: asBoundedNonNegativeNumber(value.gross_sales, operatingLimits.posSalesAmount),
    net_sales: asBoundedNonNegativeNumber(value.net_sales, operatingLimits.posSalesAmount)
  };
}

export function normalizeInventoryItem(value: InventoryItem): InventoryItem {
  const normalizedLegacyUnit = normalizeOperationalQuantity({
    quantity: 1,
    unit: value.unit
  });
  const inferredCanonicalUnit =
    normalizedLegacyUnit.ok ? normalizedLegacyUnit.unit : null;
  const canonicalUnit =
    value.canonical_unit === "g" ||
    value.canonical_unit === "ml" ||
    value.canonical_unit === "each"
      ? value.canonical_unit
      : inferredCanonicalUnit;
  const canonicalQuantityPerUnit =
    Number.isFinite(value.canonical_quantity_per_unit) &&
    Number(value.canonical_quantity_per_unit) > 0
      ? Number(value.canonical_quantity_per_unit)
      : normalizedLegacyUnit.ok
        ? normalizedLegacyUnit.quantity
        : null;
  const declaredVerificationStatus =
    value.canonical_unit_verification_status === "draft" ||
    value.canonical_unit_verification_status === "verified" ||
    value.canonical_unit_verification_status === "rejected" ||
    value.canonical_unit_verification_status === "expired"
      ? value.canonical_unit_verification_status
      : canonicalUnit
        ? "verified"
        : "draft";
  const verificationStatus =
    declaredVerificationStatus === "verified" &&
    (
      !canonicalUnit ||
      canonicalQuantityPerUnit === null
    )
      ? "draft"
      : declaredVerificationStatus;
  return {
    ...value,
    supplier_id: requireSupplierAuthorityId(value.supplier_id),
    supplier_name: requireSupplierDisplayName(value.supplier_name),
    current_quantity: asBoundedNonNegativeNumber(value.current_quantity, operatingLimits.inventoryQuantity),
    par_level: asBoundedNonNegativeNumber(value.par_level, operatingLimits.inventoryQuantity),
    reorder_threshold: asBoundedNonNegativeNumber(value.reorder_threshold, operatingLimits.inventoryQuantity),
    estimated_unit_cost: asNonNegativeNumber(value.estimated_unit_cost),
    canonical_unit: canonicalUnit,
    canonical_quantity_per_unit: canonicalQuantityPerUnit,
    canonical_unit_verification_status: verificationStatus,
    canonical_unit_verified_at:
      asNullableString(value.canonical_unit_verified_at) ??
      (verificationStatus === "verified" ? value.last_updated : null),
    canonical_unit_verified_by: asNullableString(value.canonical_unit_verified_by)
  };
}

export function normalizeMenuItemIngredient(value: MenuItemIngredient): MenuItemIngredient {
  return {
    ...value,
    quantity_used_per_sale: asBoundedNonNegativeNumber(
      value.quantity_used_per_sale,
      operatingLimits.recipeQuantityPerSale
    )
  };
}

export function normalizePurchaseRecommendation(value: PurchaseRecommendation): PurchaseRecommendation {
  return {
    ...value,
    supplier_id: requireSupplierAuthorityId(value.supplier_id),
    supplier_name: requireSupplierDisplayName(value.supplier_name),
    recommended_quantity: normalizeRecommendedQuantity(value.recommended_quantity)
  };
}

export function normalizeRecommendedQuantity(value: unknown) {
  return asBoundedNonNegativeNumber(value, operatingLimits.recommendationQuantity);
}

export function requireRecommendationApprovalQuantity(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > operatingLimits.recommendationQuantity
  ) {
    throw new Error(
      `Enter a quantity from 1 to ${operatingLimits.recommendationQuantity.toLocaleString()}.`
    );
  }
  return value;
}

export function requireRecipeBaselineQuantity(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > operatingLimits.recipeQuantityPerSale
  ) {
    throw new Error(
      `Enter a baseline quantity greater than zero and no more than ${operatingLimits.recipeQuantityPerSale.toLocaleString()}.`
    );
  }
  return value;
}

export function requireInventoryItemPatch(patch: InventoryItemPatch): InventoryItemPatch {
  if (patch.current_quantity !== undefined) {
    throw new Error(
      "Record a count, receipt, waste, or stockout so on-hand changes remain auditable."
    );
  }
  const validated: InventoryItemPatch = { ...patch };
  for (const [field, label] of [
    ["par_level", "Par level"],
    ["reorder_threshold", "Reorder threshold"]
  ] as const) {
    const value = validated[field];
    if (value === undefined) continue;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > operatingLimits.inventoryQuantity
    ) {
      throw new Error(
        `${label} must be between 0 and ${operatingLimits.inventoryQuantity.toLocaleString()}.`
      );
    }
  }
  return validated;
}

const inventoryCountSessionStatuses = new Set([
  "in_progress",
  "submitted",
  "approved",
  "cancelled"
]);

export function normalizeInventoryCountSession(value: InventoryCountSession): InventoryCountSession {
  const status = inventoryCountSessionStatuses.has(value.status)
    ? value.status
    : "cancelled";
  return {
    id: asString(value.id),
    restaurant_id: asString(value.restaurant_id),
    status,
    started_by: asNullableString(value.started_by),
    submitted_by: asNullableString(value.submitted_by),
    approved_by: asNullableString(value.approved_by),
    cancelled_by: asNullableString(value.cancelled_by),
    started_at: asString(value.started_at),
    submitted_at: asNullableString(value.submitted_at),
    approved_at: asNullableString(value.approved_at),
    cancelled_at: asNullableString(value.cancelled_at),
    note: asNullableString(value.note),
    created_at: asString(value.created_at),
    updated_at: asString(value.updated_at)
  };
}

export function normalizeInventoryCountLine(value: InventoryCountLine): InventoryCountLine {
  return {
    id: asString(value.id),
    restaurant_id: asString(value.restaurant_id),
    session_id: asString(value.session_id),
    inventory_item_id: asString(value.inventory_item_id),
    item_name: asString(value.item_name),
    unit: asString(value.unit),
    system_quantity_at_start: asBoundedNonNegativeNumber(
      value.system_quantity_at_start,
      operatingLimits.inventoryQuantity
    ),
    counted_quantity:
      value.counted_quantity == null
        ? null
        : asBoundedNonNegativeNumber(value.counted_quantity, operatingLimits.inventoryQuantity),
    note: asNullableString(value.note),
    created_at: asString(value.created_at),
    updated_at: asString(value.updated_at)
  };
}

export function normalizeInventoryCountSessionDetail(value: InventoryCountSessionDetail): InventoryCountSessionDetail {
  return {
    session: normalizeInventoryCountSession(value.session),
    lines: (value.lines ?? []).map(normalizeInventoryCountLine)
  };
}

export function requireInventoryCountSessionNote(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Count session note must be text.");
  const normalized = value.trim();
  if (normalized.length > 240) {
    throw new Error("Count session note is limited to 240 characters.");
  }
  return normalized || null;
}

export function requireInventoryCountLineNote(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Count line note must be text.");
  const normalized = value.trim();
  if (normalized.length > 240) {
    throw new Error("Count line note is limited to 240 characters.");
  }
  return normalized || null;
}

export function requireInventoryCountLineUpdates(
  value: unknown
): Array<{ inventoryItemId: string; countedQuantity: number; note: string | null }> {
  if (!Array.isArray(value) || value.length < 1 || value.length > 250) {
    throw new Error("Provide between 1 and 250 count lines to save.");
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Count line ${index + 1} is invalid.`);
    }
    const row = entry as Record<string, unknown>;
    const inventoryItemId = String(row.inventoryItemId ?? row.inventory_item_id ?? "").trim();
    if (!inventoryItemId) {
      throw new Error(`Count line ${index + 1} is missing an inventory item.`);
    }
    if (seen.has(inventoryItemId)) {
      throw new Error(`Count line ${index + 1} duplicates an inventory item.`);
    }
    seen.add(inventoryItemId);
    const countedQuantity = Number(row.countedQuantity ?? row.counted_quantity);
    if (
      typeof countedQuantity !== "number" ||
      !Number.isFinite(countedQuantity) ||
      countedQuantity < 0 ||
      countedQuantity > operatingLimits.inventoryQuantity
    ) {
      throw new Error(
        `Counted quantity must be between 0 and ${operatingLimits.inventoryQuantity.toLocaleString()}.`
      );
    }
    const note = requireInventoryCountLineNote(
      row.note === undefined || row.note === null ? null : String(row.note)
    );
    return { inventoryItemId, countedQuantity, note };
  });
}

export function requireSupplierOperatorNote(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Supplier note must be text.");
  const normalized = value.trim();
  if (normalized.length > SUPPLIER_NOTE_MAX_CHARACTERS) {
    throw new Error(`Supplier note is limited to ${SUPPLIER_NOTE_MAX_CHARACTERS.toLocaleString()} characters.`);
  }
  return normalized || null;
}

const supplierSendContentBlockerCodes = new Set<string>(
  SUPPLIER_SEND_CONTENT_BLOCKER_CODES
);
const supplierSendUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const unsafeSupplierSendMultilineControlPattern =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function requireSupplierSendContentFingerprint(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error("Supplier send content fingerprint is invalid.");
  }
  return value;
}

/**
 * Fail-closed parser for the safe flattened response from
 * `preview_supplier_send_content`. Both PostgREST's scalar JSON response and
 * its one-row array representation are accepted; no partial preview is
 * treated as ready.
 */
export function normalizeSupplierSendContentPreview(
  value: unknown,
  expectedRestaurantId: string,
  expectedOrderId: string
): SupplierEmailPayload {
  const candidate = Array.isArray(value)
    ? value.length === 1 ? value[0] : null
    : value;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("Supplier send preview returned an invalid response.");
  }
  const payload = candidate as Record<string, unknown>;
  const restaurantId = requireExactSupplierSendId(
    payload.restaurantId,
    expectedRestaurantId,
    "restaurant"
  );
  const orderId = requireExactSupplierSendId(payload.orderId, expectedOrderId, "order");
  if (payload.contentVersion !== SUPPLIER_SEND_CONTENT_VERSION) {
    throw new Error("Supplier send preview returned an unsupported content version.");
  }
  const contentRevision = requirePositiveSafeInteger(payload.contentRevision, "content revision");
  const supplierId = requireSupplierSendUuid(payload.supplierId, "supplier");
  const supplierName = requireExactSupplierSendText(payload.supplierName, "supplier", 160);
  const from = requireNullableSupplierSendEmail(payload.from, "sender");
  const to = requireNullableSupplierSendEmail(payload.to, "recipient");
  const subject = requireNullableSupplierSendText(payload.subject, "subject", 500);
  const body = requireSupplierSendBody(payload.body);
  const deliveryDate = requireSupplierSendDeliveryDate(payload.deliveryDate);
  const operatorNote = requireNullableSupplierSendText(
    payload.operatorNote,
    "operator note",
    SUPPLIER_NOTE_MAX_CHARACTERS,
    true
  );
  const lines = requireSupplierSendLines(payload.lines, supplierId, supplierName);
  const lineCount = requireNonNegativeSafeInteger(payload.lineCount, "line count");
  if (lineCount > 250 || lineCount !== lines.length) {
    throw new Error("Supplier send preview returned an invalid line count.");
  }
  const blockerCodes = requireSupplierSendContentBlockerCodes(payload.blockerCodes);
  if (typeof payload.ready !== "boolean") {
    throw new Error("Supplier send preview returned an invalid readiness state.");
  }
  const ready = payload.ready;
  const contentFingerprint = payload.contentFingerprint === null
    ? null
    : requireSupplierSendContentFingerprint(payload.contentFingerprint);

  if (
    ready
      ? blockerCodes.length !== 0 || lineCount === 0 || !from || !to || !subject || !contentFingerprint
      : blockerCodes.length === 0 || contentFingerprint !== null
  ) {
    throw new Error("Supplier send preview returned inconsistent authority.");
  }

  return {
    contentVersion: SUPPLIER_SEND_CONTENT_VERSION,
    contentFingerprint,
    contentRevision,
    restaurantId,
    orderId,
    supplierId,
    supplierName,
    from,
    to,
    subject,
    body,
    deliveryDate,
    operatorNote,
    lines,
    lineCount,
    ready,
    blockerCodes,
    canSend: ready,
    blockedReason: ready ? null : supplierSendBlockerDescription(blockerCodes[0]!)
  };
}

function requireExactSupplierSendId(value: unknown, expected: string, label: string) {
  const normalizedExpected = typeof expected === "string" ? expected.trim() : "";
  if (
    typeof value !== "string" ||
    !normalizedExpected ||
    value !== normalizedExpected ||
    value.length > 128 ||
    hasControlCharacters(value)
  ) {
    throw new Error(`Supplier send preview returned an invalid ${label} identity.`);
  }
  return value;
}

function requireExactSupplierSendText(
  value: unknown,
  label: string,
  maximum: number,
  allowLineBreaks = false
) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    value !== value.trim() ||
    (
      allowLineBreaks
        ? unsafeSupplierSendMultilineControlPattern.test(value)
        : hasControlCharacters(value)
    )
  ) {
    throw new Error(`Supplier send preview returned an invalid ${label}.`);
  }
  return value;
}

function requireNullableSupplierSendText(
  value: unknown,
  label: string,
  maximum: number,
  allowLineBreaks = false
) {
  if (value === null) return null;
  return requireExactSupplierSendText(value, label, maximum, allowLineBreaks);
}

function requireNullableSupplierSendEmail(value: unknown, label: string) {
  if (value === null) return null;
  const email = requireExactSupplierSendText(value, label, 254);
  if (email !== email.toLowerCase() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Supplier send preview returned an invalid ${label}.`);
  }
  return email;
}

function requireSupplierSendBody(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    utf8ByteLength(value) > ORDER_MESSAGE_MAX_BYTES ||
    unsafeSupplierSendMultilineControlPattern.test(value)
  ) {
    throw new Error("Supplier send preview returned an invalid body.");
  }
  return value;
}

function requireSupplierSendDeliveryDate(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Supplier send preview returned an invalid delivery date.");
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Supplier send preview returned an invalid delivery date.");
  }
  return value;
}

function requireSupplierSendLines(
  value: unknown,
  supplierId: string,
  supplierName: string
): SupplierSendContentLine[] {
  if (!Array.isArray(value) || value.length > 250) {
    throw new Error("Supplier send preview returned invalid lines.");
  }
  let previousRecommendationId = "";
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Supplier send preview returned an invalid line.");
    }
    const line = entry as Record<string, unknown>;
    const recommendationId = requireSupplierSendUuid(line.recommendationId, "recommendation");
    const inventoryItemId = requireSupplierSendUuid(line.inventoryItemId, "inventory item");
    if (previousRecommendationId && recommendationId <= previousRecommendationId) {
      throw new Error("Supplier send preview lines are not canonical.");
    }
    previousRecommendationId = recommendationId;
    const itemName = requireExactSupplierSendText(line.itemName, "item name", 160);
    const unit = requireExactSupplierSendText(line.unit, "unit", 40);
    const lineSupplierId = requireSupplierSendUuid(line.supplierId, "line supplier");
    const lineSupplierName = requireExactSupplierSendText(line.supplierName, "line supplier", 160);
    if (lineSupplierId !== supplierId || lineSupplierName !== supplierName) {
      throw new Error("Supplier send preview returned a mismatched line supplier.");
    }
    if (
      typeof line.quantity !== "number" ||
      !Number.isFinite(line.quantity) ||
      line.quantity <= 0 ||
      line.quantity > operatingLimits.recommendationQuantity
    ) {
      throw new Error("Supplier send preview returned an invalid line quantity.");
    }
    return {
      recommendationId,
      inventoryItemId,
      itemName,
      quantity: line.quantity,
      unit,
      supplierId: lineSupplierId,
      supplierName: lineSupplierName
    };
  });
}

function requireSupplierSendUuid(value: unknown, label: string) {
  if (typeof value !== "string" || !supplierSendUuidPattern.test(value)) {
    throw new Error(`Supplier send preview returned an invalid ${label} identity.`);
  }
  return value;
}

function requirePositiveSafeInteger(value: unknown, label: string) {
  const numeric = requireNonNegativeSafeInteger(value, label);
  if (numeric < 1) throw new Error(`Supplier send preview returned an invalid ${label}.`);
  return numeric;
}

function requireNonNegativeSafeInteger(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Supplier send preview returned an invalid ${label}.`);
  }
  return value;
}

function requireSupplierSendContentBlockerCodes(value: unknown): SupplierSendContentBlockerCode[] {
  if (!Array.isArray(value) || value.length > SUPPLIER_SEND_CONTENT_BLOCKER_CODES.length) {
    throw new Error("Supplier send preview returned invalid blockers.");
  }
  const codes = value.map((entry) => {
    if (typeof entry !== "string" || !supplierSendContentBlockerCodes.has(entry)) {
      throw new Error("Supplier send preview returned an invalid blocker.");
    }
    return entry as SupplierSendContentBlockerCode;
  });
  const canonical = [...new Set(codes)].sort();
  if (canonical.length !== codes.length || canonical.some((code, index) => code !== codes[index])) {
    throw new Error("Supplier send preview blockers are not canonical.");
  }
  return codes;
}

function supplierSendBlockerDescription(code: SupplierSendContentBlockerCode) {
  switch (code) {
    case "gmail_not_connected":
      return "Connect and verify the restaurant Gmail sender before sending.";
    case "supplier_email_missing":
    case "supplier_email_invalid":
      return "Add a valid supplier email before sending.";
    case "order_not_draft":
      return "Only a current supplier draft can be sent.";
    case "order_lines_missing":
      return "This supplier draft has no approved order lines.";
    case "send_subject_invalid":
    case "send_content_invalid":
    case "send_content_too_large":
      return "The current supplier email content is not ready for review.";
  }
}

export const SUPPLIER_RECIPIENT_NAME_MAX_CHARACTERS = 160;
export const SUPPLIER_RECIPIENT_EMAIL_MAX_CHARACTERS = 254;

export function requireSupplierAuthorityId(value: unknown, label = "supplier") {
  const supplierId = typeof value === "string" ? value.trim() : "";
  if (
    !supplierId ||
    supplierId.length > 128 ||
    hasControlCharacters(supplierId) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(supplierId)
  ) {
    throw new Error(`Missing ${label} identity.`);
  }
  return supplierId;
}

export function requireSupplierDisplayName(value: unknown) {
  const rawName = typeof value === "string" ? value : "";
  const displayName = rawName.trim().replace(/\s+/g, " ");
  if (
    displayName.length < 1 ||
    displayName.length > SUPPLIER_RECIPIENT_NAME_MAX_CHARACTERS ||
    hasControlCharacters(rawName)
  ) {
    throw new Error(
      `Supplier name must be between 1 and ${SUPPLIER_RECIPIENT_NAME_MAX_CHARACTERS} characters.`
    );
  }
  return displayName;
}

function requireSupplierDisplaySnapshot(value: unknown) {
  if (
    typeof value !== "string" ||
    value.trim().length < 1 ||
    value.length > SUPPLIER_RECIPIENT_NAME_MAX_CHARACTERS ||
    hasControlCharacters(value)
  ) {
    throw new Error("Supplier display snapshot is invalid.");
  }
  return value;
}

export function normalizeSupplier(value: Supplier): Supplier {
  const displayName = requireSupplierDisplayName(value.display_name);
  const normalizedName = typeof value.normalized_name === "string"
    ? value.normalized_name
    : "";
  if (
    !normalizedName ||
    normalizedName.length > SUPPLIER_RECIPIENT_NAME_MAX_CHARACTERS ||
    hasControlCharacters(normalizedName)
  ) {
    throw new Error("Supplier identity returned an invalid normalized name.");
  }
  if (value.display_name !== displayName) {
    throw new Error("Supplier identity returned a non-canonical display name.");
  }
  return {
    ...value,
    id: requireSupplierAuthorityId(value.id),
    restaurant_id: requireSupplierAuthorityId(value.restaurant_id, "restaurant"),
    display_name: displayName,
    normalized_name: normalizedName,
    created_at: asString(value.created_at),
    updated_at: asString(value.updated_at, value.created_at)
  };
}

export function requireSupplierRecipientInput(input: {
  restaurant_id: unknown;
  supplier_id: unknown;
  email: unknown;
}): {
  restaurant_id: string;
  supplier_id: string;
  email: string;
} {
  const restaurantId = typeof input.restaurant_id === "string" ? input.restaurant_id.trim() : "";
  if (!restaurantId || restaurantId.length > 128 || hasControlCharacters(restaurantId)) {
    throw new Error("Missing restaurant workspace.");
  }

  const supplierId = requireSupplierAuthorityId(input.supplier_id);

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (
    email.length < 3 ||
    email.length > SUPPLIER_RECIPIENT_EMAIL_MAX_CHARACTERS ||
    hasControlCharacters(email) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("Enter a valid supplier email address.");
  }

  return { restaurant_id: restaurantId, supplier_id: supplierId, email };
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

export function requireRestaurantName(value: unknown) {
  if (typeof value !== "string") throw new Error("Restaurant name is required.");
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > RESTAURANT_NAME_MAX_CHARACTERS) {
    throw new Error(`Restaurant name must be between 1 and ${RESTAURANT_NAME_MAX_CHARACTERS} characters.`);
  }
  return normalized;
}

export type RestaurantProfilePatch = Partial<
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
>;

const restaurantProfilePatchKeys = new Set([
  "name",
  "address",
  "cuisine_type",
  "brand_color",
  "accent_color",
  "logo_url",
  "service_style",
  "timezone",
  "currency",
  "operational_profile"
]);
const operationalProfileKeys = new Set([
  "serviceStyle",
  "orderCadence",
  "prepWindows",
  "primarySuppliers",
  "inventoryReviewDays",
  "notes"
]);

export function requireRestaurantCuisineType(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Cuisine type must be text or empty.");
  const normalized = value.trim();
  if (normalized.length > RESTAURANT_CUISINE_MAX_CHARACTERS) {
    throw new Error(`Cuisine type is limited to ${RESTAURANT_CUISINE_MAX_CHARACTERS} characters.`);
  }
  return normalized || null;
}

export function requireRestaurantProfilePatch(value: RestaurantProfilePatch): RestaurantProfilePatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Restaurant profile changes must be an object.");
  }
  const unknownKey = Object.keys(value).find((key) => !restaurantProfilePatchKeys.has(key));
  if (unknownKey) throw new Error(`Restaurant profile field is not supported: ${unknownKey}.`);
  if (Object.keys(value).length === 0) throw new Error("Choose at least one restaurant profile field to update.");

  const patch: RestaurantProfilePatch = { ...value };
  if (patch.name !== undefined) patch.name = requireRestaurantName(patch.name);
  if (patch.address !== undefined) {
    patch.address = requireNullableBoundedText(
      patch.address,
      "Restaurant address",
      RESTAURANT_ADDRESS_MAX_CHARACTERS
    );
  }
  if (patch.cuisine_type !== undefined) patch.cuisine_type = requireRestaurantCuisineType(patch.cuisine_type);
  if (patch.brand_color !== undefined) patch.brand_color = requireHexColor(patch.brand_color, "Brand color");
  if (patch.accent_color !== undefined) patch.accent_color = requireHexColor(patch.accent_color, "Accent color");
  if (patch.logo_url !== undefined) patch.logo_url = requireHttpsLogoUrl(patch.logo_url);
  if (patch.service_style !== undefined) patch.service_style = requireServiceStyle(patch.service_style);
  if (patch.timezone !== undefined) patch.timezone = requireIanaTimezone(patch.timezone);
  if (patch.currency !== undefined) {
    if (typeof patch.currency !== "string" || !/^[A-Z]{3}$/.test(patch.currency)) {
      throw new Error("Currency must be a three-letter uppercase code.");
    }
  }
  if (patch.operational_profile !== undefined) {
    patch.operational_profile = requireRestaurantOperationalProfile(patch.operational_profile);
    if (
      patch.service_style !== undefined &&
      patch.operational_profile.serviceStyle !== patch.service_style
    ) {
      throw new Error("Profile service style must match the restaurant service style.");
    }
  }
  if (patch.service_style !== undefined && patch.operational_profile === undefined) {
    // The database mirrors this value into an existing operational profile.
    patch.service_style = requireServiceStyle(patch.service_style);
  }
  return patch;
}

function requireRestaurantOperationalProfile(value: unknown): RestaurantOperationalProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Operational profile must be an object.");
  }
  const profile = value as Record<string, unknown>;
  const unknownKey = Object.keys(profile).find((key) => !operationalProfileKeys.has(key));
  if (unknownKey) throw new Error(`Operational profile field is not supported: ${unknownKey}.`);

  const normalized: RestaurantOperationalProfile = {
    serviceStyle: requireServiceStyle(profile.serviceStyle),
    orderCadence: requireBoundedStringArray(profile.orderCadence, "Order cadence"),
    prepWindows: requireBoundedStringArray(profile.prepWindows, "Prep windows"),
    primarySuppliers: requireBoundedStringArray(profile.primarySuppliers, "Primary suppliers"),
    inventoryReviewDays: requireBoundedStringArray(profile.inventoryReviewDays, "Inventory review days"),
    notes: requireNullableBoundedText(
      profile.notes,
      "Operational profile notes",
      RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS
    )
  };
  if (utf8ByteLength(JSON.stringify(normalized)) > RESTAURANT_OPERATIONAL_PROFILE_MAX_BYTES) {
    throw new Error(`Operational profile is limited to ${RESTAURANT_OPERATIONAL_PROFILE_MAX_BYTES} bytes.`);
  }
  return normalized;
}

function requireBoundedStringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length > RESTAURANT_PROFILE_ARRAY_MAX_ITEMS) {
    throw new Error(`${label} is limited to ${RESTAURANT_PROFILE_ARRAY_MAX_ITEMS} entries.`);
  }
  return value.map((entry) => {
    if (typeof entry !== "string") throw new Error(`${label} entries must be text.`);
    const normalized = entry.trim();
    if (
      normalized.length < 1 ||
      normalized.length > RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS
    ) {
      throw new Error(
        `${label} entries must be between 1 and ${RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS} characters.`
      );
    }
    return normalized;
  });
}

function requireNullableBoundedText(value: unknown, label: string, maximum: number) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`${label} must be text or empty.`);
  const normalized = value.trim();
  if (normalized.length > maximum) throw new Error(`${label} is limited to ${maximum} characters.`);
  return normalized || null;
}

function requireHexColor(value: unknown, label: string) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${label} must be a six-digit hex color.`);
  }
  return value;
}

function requireHttpsLogoUrl(value: unknown) {
  const normalized = requireNullableBoundedText(value, "Logo URL", RESTAURANT_LOGO_URL_MAX_CHARACTERS);
  if (normalized === null) return null;
  try {
    const url = new URL(normalized);
    if (
      url.protocol !== "https:" ||
      Boolean(url.username || url.password) ||
      !/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/i.test(url.hostname)
    ) {
      throw new Error();
    }
  } catch {
    throw new Error("Logo URL must be a valid HTTPS URL.");
  }
  return normalized;
}

function requireServiceStyle(value: unknown): RestaurantServiceStyle {
  if (
    value !== "quick_service" &&
    value !== "fast_casual" &&
    value !== "full_service" &&
    value !== "bar" &&
    value !== "cafe" &&
    value !== "ghost_kitchen"
  ) {
    throw new Error("Service style is not supported.");
  }
  return value;
}

function requireIanaTimezone(value: unknown) {
  if (typeof value !== "string" || value.length < 1 || value.length > 64) {
    throw new Error("Timezone must be a supported IANA timezone.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error("Timezone must be a supported IANA timezone.");
  }
  return value;
}

export function normalizeRecipeBaselineQuantity(value: unknown) {
  return asBoundedNonNegativeNumber(value, operatingLimits.recipeQuantityPerSale);
}

export function normalizeInventoryItemPatch(patch: InventoryItemPatch): InventoryItemPatch {
  const normalized: InventoryItemPatch = { ...patch };
  if (normalized.current_quantity !== undefined) {
    normalized.current_quantity = asBoundedNonNegativeNumber(
      normalized.current_quantity,
      operatingLimits.inventoryQuantity
    );
  }
  if (normalized.par_level !== undefined) {
    normalized.par_level = asBoundedNonNegativeNumber(normalized.par_level, operatingLimits.inventoryQuantity);
  }
  if (normalized.reorder_threshold !== undefined) {
    normalized.reorder_threshold = asBoundedNonNegativeNumber(
      normalized.reorder_threshold,
      operatingLimits.inventoryQuantity
    );
  }
  return normalized;
}

export function normalizeSupplierOrder(value: SupplierOrder): SupplierOrder {
  return {
    ...value,
    supplier_id: requireSupplierAuthorityId(value.supplier_id),
    supplier_name: requireSupplierDisplaySnapshot(value.supplier_name),
    delivery_date: asNullableString(value.delivery_date)
  };
}

export function normalizeSupplierDeliveryRecord(
  value: Omit<SupplierDeliveryRecord, "status"> & { status: unknown }
): SupplierDeliveryRecord {
  return {
    ...value,
    status: normalizeSupplierDeliveryStatus(value.status),
    notes: asNullableString(value.notes),
    received_at: asString(value.received_at),
    created_at: asString(value.created_at, value.received_at)
  };
}

export function normalizeSupplierDeliveryItemRecord(
  value: SupplierDeliveryItemRecord
): SupplierDeliveryItemRecord {
  return {
    ...value,
    ordered_quantity:
      value.ordered_quantity == null ? null : asNonNegativeNumber(value.ordered_quantity),
    received_quantity: asNonNegativeNumber(value.received_quantity),
    damaged_quantity: asNonNegativeNumber(value.damaged_quantity),
    missing_quantity: asNonNegativeNumber(value.missing_quantity),
    discrepancy_reason: asNullableString(value.discrepancy_reason)
  };
}

function normalizeSupplierDeliveryStatus(value: unknown): SupplierDeliveryStatus {
  if (
    value === "unverified" ||
    value === "partially_received" ||
    value === "received" ||
    value === "discrepancy" ||
    value === "failed"
  ) {
    return value;
  }
  return "unverified";
}

export function normalizeInsight(value: Insight): Insight {
  return {
    ...value,
    why_it_matters: value.why_it_matters ?? null
  };
}

export function normalizeIntegrationStatus(value: unknown): IntegrationStatus {
  if (value === "connected" || value === "paused" || value === "error" || value === "not_connected") {
    return value;
  }
  return "not_connected";
}

export function normalizeEmailConnectionStatus(value: unknown): EmailConnectionStatus {
  if (
    value === "not_connected" ||
    value === "connected" ||
    value === "needs_reauth" ||
    value === "restricted"
  ) {
    return value;
  }
  return "not_connected";
}

export function normalizeRestaurantEmailConnection(value: RestaurantEmailConnection): RestaurantEmailConnection {
  return {
    ...value,
    provider: "gmail",
    status: normalizeEmailConnectionStatus(value.status),
    sender_email: asNullableString(value.sender_email),
    last_verified_at: asNullableString(value.last_verified_at),
    updated_at: value.updated_at ?? value.created_at
  };
}

export function normalizeSupplierRecipient(value: SupplierRecipient): SupplierRecipient {
  return {
    ...value,
    supplier_id: requireSupplierAuthorityId(value.supplier_id),
    supplier_name: requireSupplierDisplayName(value.supplier_name),
    email: asNullableString(value.email),
    updated_at: value.updated_at ?? value.created_at
  };
}

function normalizeSetupAttachmentStatus(value: unknown): SetupAttachmentStatus {
  if (value === "queued" || value === "review_needed" || value === "processed" || value === "dismissed") {
    return value;
  }
  return "queued";
}

export function normalizeSetupAttachment(value: SetupAttachment): SetupAttachment {
  return {
    ...value,
    kind: value.kind === "screenshot" ? "screenshot" : "csv",
    label: asString(value.label, "Setup reference"),
    status: normalizeSetupAttachmentStatus(value.status),
    metadata: asRecord(value.metadata),
    created_by: asNullableString(value.created_by),
    updated_at: value.updated_at ?? value.created_at
  };
}

export function normalizePosIntegration(value: PosIntegration): PosIntegration {
  return {
    ...value,
    status: normalizeIntegrationStatus(value.status),
    external_location_id: asNullableString(value.external_location_id),
    last_sync_at: asNullableString(value.last_sync_at),
    sync_cursor: asNullableString(value.sync_cursor),
    settings: asRecord(value.settings),
    updated_at: value.updated_at ?? value.created_at
  };
}

export function normalizeSalesImport(value: SalesImport): SalesImport {
  return {
    ...value,
    records_processed: asNonNegativeNumber(value.records_processed),
    source_file_name: asNullableString(value.source_file_name),
    error_message: asNullableString(value.error_message),
    metadata: asRecord(value.metadata)
  };
}

export function normalizeSupplierItem(value: SupplierItem): SupplierItem {
  return {
    ...value,
    supplier_id: value.supplier_id === null || value.supplier_id === undefined
      ? null
      : requireSupplierAuthorityId(value.supplier_id),
    supplier_name: asString(value.supplier_name, "Supplier"),
    supplier_sku: asNullableString(value.supplier_sku),
    item_name: asString(value.item_name, "Item"),
    unit: asString(value.unit, "unit"),
    pack_size: asNullableString(value.pack_size),
    estimated_unit_cost: asNonNegativeNumber(value.estimated_unit_cost),
    preferred: Boolean(value.preferred),
    updated_at: value.updated_at ?? value.created_at
  };
}

export function normalizePurchaseOrder(value: PurchaseOrder): PurchaseOrder {
  return {
    ...value,
    supplier_id: value.supplier_id === null || value.supplier_id === undefined
      ? null
      : requireSupplierAuthorityId(value.supplier_id),
    order_payload: asRecord(value.order_payload),
    subtotal_estimate: asNonNegativeNumber(value.subtotal_estimate),
    expected_delivery_date: asNullableString(value.expected_delivery_date),
    submitted_at: asNullableString(value.submitted_at),
    updated_at: value.updated_at ?? value.created_at
  };
}

export function normalizeAiInsight(value: AiInsight): AiInsight {
  return {
    ...value,
    output: asRecord(value.output),
    confidence: Math.min(1, Math.max(0, asNumber(value.confidence))),
    generated_by: asNullableString(value.generated_by)
  };
}

export function normalizeAuditLog(value: AuditLog): AuditLog {
  return {
    ...value,
    actor_user_id: asNullableString(value.actor_user_id),
    entity_id: asNullableString(value.entity_id),
    action: asString(value.action, "unknown"),
    entity_table: asString(value.entity_table, "unknown"),
    metadata: asRecord(value.metadata)
  };
}

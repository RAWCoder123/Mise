import {
  SUPPLIER_SEND_CONTENT_VERSION,
  type PurchaseRecommendation,
  type Restaurant,
  type RestaurantEmailConnection,
  type SupplierOrder,
  type SupplierRecipient,
  type SupplierSendContentBlockerCode,
  type SupplierSendContentLine
} from "../../types/mise";
import { buildSupplierOrderMessage } from "./miseDomain";
import { utf8ByteLength } from "./securityLimits";

export { SUPPLIER_SEND_CONTENT_VERSION } from "../../types/mise";

export type DemoSupplierSendBlockerCode = SupplierSendContentBlockerCode;

export type CanonicalSupplierSendLine = SupplierSendContentLine;

export interface CanonicalSupplierSendSnapshot {
  version: typeof SUPPLIER_SEND_CONTENT_VERSION;
  contentRevision: number;
  restaurantId: string;
  orderId: string;
  supplierId: string;
  supplierName: string;
  from: string | null;
  to: string | null;
  subject: string | null;
  body: string;
  deliveryDate: string | null;
  operatorNote: string | null;
  lines: CanonicalSupplierSendLine[];
}

export interface BuiltSupplierSendContent {
  ready: boolean;
  blockerCodes: DemoSupplierSendBlockerCode[];
  lineCount: number;
  contentVersion: typeof SUPPLIER_SEND_CONTENT_VERSION;
  contentFingerprint: string | null;
  content: CanonicalSupplierSendSnapshot;
}

interface BuildSupplierSendContentInput {
  restaurant: Restaurant;
  order: SupplierOrder;
  contentRevision: number;
  emailConnection: RestaurantEmailConnection | null;
  recipients: readonly SupplierRecipient[];
  recommendations: readonly PurchaseRecommendation[];
}

/**
 * ASCII C mailbox shape — mirrors SQL
 * `^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$` under COLLATE "C"
 * (MISE-005KM; complements open MISE-005JL / #681 and MISE-005IU / #663).
 * Uses an explicit ASCII whitespace class instead of Unicode `\s`.
 */
const ASCII_C_MAILBOX_SHAPE =
  /^[^ \t\n\r\f\v@]+@[^ \t\n\r\f\v@]+\.[^ \t\n\r\f\v@]+$/;
const CONTENT_MAX_BYTES = 65_536;
const CONTENT_MAX_LINES = 250;

/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005KM). Only ASCII A-Z is folded; Unicode-aware `toLowerCase`
 * would map Kelvin sign `K` → `k` and invent a From/To mailbox the
 * hosted COLLATE C supplier-send path would not treat as identical.
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * Trim only ASCII whitespace so demo supplier-send From/To addresses stay
 * aligned with server helpers that btrim under COLLATE "C".
 */
function asciiCTrim(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Normalize one demo supplier-send mailbox identity to ASCII C case fold +
 * ASCII-only end trim + ASCII mailbox shape. Returns null when the value is
 * missing or not a durable mailbox under those rules. Kelvin lookalikes must
 * not invent ordinary ASCII addresses that change the reviewed send fingerprint.
 */
export function normalizeSupplierSendEmail(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") return null;
  const normalized = asciiCTrim(asciiCLower(value));
  if (
    normalized.length < 3 ||
    normalized.length > 254 ||
    /[\u0000-\u001f\u007f]/.test(normalized) ||
    !ASCII_C_MAILBOX_SHAPE.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function normalizedSubject(restaurantName: string, supplierName: string) {
  const subject = `${restaurantName} order for ${supplierName}`
    .replace(/[\r\n]+/g, " ")
    .trim();
  if (
    subject.length < 1 ||
    subject.length > 500 ||
    /[\u0000-\u001f\u007f]/.test(subject)
  ) {
    return null;
  }
  return subject;
}

/**
 * Demo-only compatibility serializer. Hosted review and approval never use a
 * client-computed fingerprint: `preview_supplier_send_content` returns the
 * server fingerprint that `approve_supplier_send_content` compares. Demo mode
 * mirrors PostgreSQL jsonb text so its local approval behavior stays faithful.
 *
 * PostgreSQL jsonb emits object keys by UTF-8 byte length and then byte value,
 * with one space after separators. The send snapshot uses ASCII field names,
 * so this deterministic serializer matches `snapshot::text` without relying
 * on engine insertion order.
 */
export function serializeSupplierSendSnapshot(
  value: CanonicalSupplierSendSnapshot
): string {
  const serialize = (candidate: unknown): string => {
    if (candidate === null) return "null";
    if (typeof candidate === "string" || typeof candidate === "boolean") {
      return JSON.stringify(candidate);
    }
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) throw new Error("Supplier send content contains an invalid number.");
      return JSON.stringify(candidate);
    }
    if (Array.isArray(candidate)) {
      return `[${candidate.map(serialize).join(", ")}]`;
    }
    if (typeof candidate === "object") {
      return `{${Object.entries(candidate as Record<string, unknown>)
        .sort(([left], [right]) => left.length - right.length || (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => `${JSON.stringify(key)}: ${serialize(entry)}`)
        .join(", ")}}`;
    }
    throw new Error("Supplier send content contains an unsupported value.");
  };
  return serialize(value);
}

async function sha256Hex(value: string) {
  try {
    const expoCrypto = await import("expo-crypto");
    return (await expoCrypto.digestStringAsync(
      expoCrypto.CryptoDigestAlgorithm.SHA256,
      value,
      { encoding: expoCrypto.CryptoEncoding.HEX }
    )).toLowerCase();
  } catch (error) {
    // The Node test harness does not resolve Expo's native module peer from
    // expo-crypto's package root. Web Crypto is the equivalent standards-based
    // implementation used only for that non-Expo runtime.
    if (!globalThis.crypto?.subtle) throw error;
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value)
    );
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
}

export async function fingerprintSupplierSendSnapshot(
  snapshot: CanonicalSupplierSendSnapshot
) {
  const canonical = serializeSupplierSendSnapshot(snapshot);
  return sha256Hex(`${SUPPLIER_SEND_CONTENT_VERSION}\n${canonical}`);
}

export async function buildCanonicalSupplierSendContent(
  input: BuildSupplierSendContentInput
): Promise<BuiltSupplierSendContent> {
  const blockers = new Set<DemoSupplierSendBlockerCode>();
  if (input.order.status !== "draft") blockers.add("order_not_draft");

  const from = input.emailConnection?.status === "connected"
    ? normalizeSupplierSendEmail(input.emailConnection.sender_email)
    : null;
  if (!from) blockers.add("gmail_not_connected");

  const matchingRecipients = input.recipients.filter(
    (recipient) =>
      recipient.restaurant_id === input.restaurant.id &&
      recipient.supplier_id === input.order.supplier_id
  );
  const to = matchingRecipients.length === 1
    ? normalizeSupplierSendEmail(matchingRecipients[0]?.email)
    : null;
  if (matchingRecipients.length === 0 || !matchingRecipients[0]?.email) {
    blockers.add("supplier_email_missing");
  } else if (!to || matchingRecipients.length !== 1) {
    blockers.add("supplier_email_invalid");
  }

  const subject = normalizedSubject(input.restaurant.name, input.order.supplier_name);
  if (!subject) blockers.add("send_subject_invalid");

  const linked = input.recommendations
    .filter(
      (recommendation) =>
        recommendation.restaurant_id === input.restaurant.id &&
        recommendation.supplier_order_id === input.order.id &&
        recommendation.status === "approved"
    )
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
  if (linked.length === 0) blockers.add("order_lines_missing");
  if (linked.length > CONTENT_MAX_LINES) blockers.add("send_content_too_large");
  if (
    linked.some(
      (recommendation) =>
        recommendation.supplier_id !== input.order.supplier_id ||
        recommendation.supplier_name !== input.order.supplier_name
    )
  ) {
    blockers.add("send_content_invalid");
  }

  const expectedBody = buildSupplierOrderMessage(
    input.order.supplier_name,
    linked,
    input.order.operator_note
  );
  if (utf8ByteLength(input.order.order_message) > CONTENT_MAX_BYTES) {
    blockers.add("send_content_too_large");
  } else if (input.order.order_message !== expectedBody) {
    blockers.add("send_content_invalid");
  }

  const snapshot: CanonicalSupplierSendSnapshot = {
    version: SUPPLIER_SEND_CONTENT_VERSION,
    contentRevision: input.contentRevision,
    restaurantId: input.restaurant.id,
    orderId: input.order.id,
    supplierId: input.order.supplier_id,
    supplierName: input.order.supplier_name,
    from,
    to,
    subject,
    body: input.order.order_message,
    deliveryDate: input.order.delivery_date,
    operatorNote: input.order.operator_note,
    lines: linked.map((recommendation) => ({
      recommendationId: recommendation.id,
      inventoryItemId: recommendation.inventory_item_id,
      supplierId: recommendation.supplier_id,
      itemName: recommendation.item_name,
      quantity: recommendation.recommended_quantity,
      unit: recommendation.unit,
      supplierName: recommendation.supplier_name
    }))
  };
  const blockerCodes = [...blockers].sort();
  const ready = blockerCodes.length === 0;
  return {
    ready,
    blockerCodes,
    lineCount: linked.length,
    contentVersion: SUPPLIER_SEND_CONTENT_VERSION,
    contentFingerprint: ready ? await fingerprintSupplierSendSnapshot(snapshot) : null,
    content: snapshot
  };
}

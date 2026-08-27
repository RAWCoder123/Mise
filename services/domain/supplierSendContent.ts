import {
  SUPPLIER_SEND_CONTENT_VERSION,
  type Restaurant,
  type RestaurantEmailConnection,
  type SupplierOrder,
  type SupplierOrderLine,
  type SupplierRecipient,
  type SupplierSendContentBlockerCode,
  type SupplierSendContentLine
} from "../../types/mise";
import { formatQuantity } from "../../utils/format";
import { ORDER_MESSAGE_MAX_BYTES, truncateUtf8, utf8ByteLength } from "./securityLimits";

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
  /** Durable approve/send snapshots; never live recommendation rebuilds. */
  orderLines: readonly SupplierOrderLine[];
}

/**
 * Builds the expected order_message body from durable supplier order lines so
 * send fingerprint validation cannot silently follow later recommendation edits.
 */
export function buildSupplierOrderMessageFromOrderLines(
  supplierName: string,
  orderLines: readonly SupplierOrderLine[],
  operatorNote: string | null = null
) {
  const lines = orderLines
    .slice()
    .sort(
      (left, right) =>
        left.item_name.localeCompare(right.item_name) ||
        (left.purchase_recommendation_id ?? "").localeCompare(
          right.purchase_recommendation_id ?? ""
        )
    )
    .map(
      (line) =>
        `${line.item_name} - ${formatQuantity(line.ordered_quantity)} ${line.unit}`
    );
  const base = `Order draft for ${supplierName}\n\n${lines.join("\n")}\n\nDelivery requested: Tomorrow morning`;
  const note = operatorNote?.trim();
  return truncateUtf8(note ? `${base}\n\nNotes:\n${note}` : base, ORDER_MESSAGE_MAX_BYTES);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTENT_MAX_BYTES = 65_536;
const CONTENT_MAX_LINES = 250;

function normalizedEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (
    normalized.length < 3 ||
    normalized.length > 254 ||
    /[\u0000-\u001f\u007f]/.test(normalized) ||
    !EMAIL_PATTERN.test(normalized)
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
    ? normalizedEmail(input.emailConnection.sender_email)
    : null;
  if (!from) blockers.add("gmail_not_connected");

  const matchingRecipients = input.recipients.filter(
    (recipient) =>
      recipient.restaurant_id === input.restaurant.id &&
      recipient.supplier_id === input.order.supplier_id
  );
  const to = matchingRecipients.length === 1
    ? normalizedEmail(matchingRecipients[0]?.email)
    : null;
  if (matchingRecipients.length === 0 || !matchingRecipients[0]?.email) {
    blockers.add("supplier_email_missing");
  } else if (!to || matchingRecipients.length !== 1) {
    blockers.add("supplier_email_invalid");
  }

  const subject = normalizedSubject(input.restaurant.name, input.order.supplier_name);
  if (!subject) blockers.add("send_subject_invalid");

  const linked = input.orderLines
    .filter(
      (line) =>
        line.restaurant_id === input.restaurant.id &&
        line.supplier_order_id === input.order.id
    )
    .slice()
    .sort((left, right) =>
      (left.purchase_recommendation_id ?? "").localeCompare(
        right.purchase_recommendation_id ?? ""
      )
    );
  if (linked.length === 0) {
    blockers.add("order_lines_missing");
  } else if (linked.length > CONTENT_MAX_LINES) {
    blockers.add("send_content_too_large");
  } else {
    if (
      linked.some(
        (line) =>
          !line.purchase_recommendation_id ||
          !Number.isFinite(line.ordered_quantity) ||
          line.ordered_quantity <= 0 ||
          !line.item_name.trim() ||
          !line.unit.trim()
      )
    ) {
      blockers.add("send_content_invalid");
    }

    const expectedBody = buildSupplierOrderMessageFromOrderLines(
      input.order.supplier_name,
      linked,
      input.order.operator_note
    );
    if (utf8ByteLength(input.order.order_message) > CONTENT_MAX_BYTES) {
      blockers.add("send_content_too_large");
    } else if (input.order.order_message !== expectedBody) {
      blockers.add("send_content_invalid");
    }
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
    lines: linked.map((line) => ({
      recommendationId: line.purchase_recommendation_id ?? "",
      inventoryItemId: line.inventory_item_id,
      supplierId: input.order.supplier_id,
      itemName: line.item_name,
      quantity: line.ordered_quantity,
      unit: line.unit,
      supplierName: input.order.supplier_name
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

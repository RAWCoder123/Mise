/**
 * Inventory detail outbox queue resolutionReason presentation (MISE-005ABS).
 *
 * Inventory detail previously always interpolated raw `entry.resolutionReason`
 * into `inventory.ops.queue.reason` (`Reason: {reason}`). Operators saw
 * machine tokens such as `network_retry` / `idempotency_payload_mismatch`
 * instead of localized copy. Separately, a Unicode-only-space reason is
 * truthy so blank-looking reason chrome could bypass the attempts fallback,
 * and Unicode `.trim()` on padded tokens would invent a clean reason code.
 *
 * This helper:
 * 1. Soft-nulls empty / Unicode-padded / control-bearing tokens under ASCII C
 *    single-line prep (end trim only; preserve NBSP; full C0/DEL reject).
 * 2. Allows only the deterministic snake_case vocabulary produced by the
 *    inventory outbox / ledger / transport paths.
 * 3. Maps allowlisted tokens to localized MessageKey copy; unknown or unsafe
 *    non-empty tokens fall through to `inventory.ops.queue.reasonCode.unknown`
 *    rather than inventing raw-token display.
 *
 * Null / undefined / empty string keep the attempts-count fallback path.
 * Not finding-decision outbox reasons, not Autonomy evidence.type leave-alone
 * surfaces, and not inventory.ops.queue.status badges.
 */

import type { MessageKey } from "../../i18n/catalog";

const REASON_MESSAGE_KEYS = {
  network_retry: "inventory.ops.queue.reasonCode.network_retry",
  server_deduplicated: "inventory.ops.queue.reasonCode.server_deduplicated",
  idempotency_payload_mismatch: "inventory.ops.queue.reasonCode.idempotency_payload_mismatch",
  only_corrections_can_supersede: "inventory.ops.queue.reasonCode.only_corrections_can_supersede",
  superseded_event_not_found: "inventory.ops.queue.reasonCode.superseded_event_not_found",
  event_already_superseded: "inventory.ops.queue.reasonCode.event_already_superseded",
  inventory_item_not_found: "inventory.ops.queue.reasonCode.inventory_item_not_found",
  invalid_canonical_unit: "inventory.ops.queue.reasonCode.invalid_canonical_unit",
  invalid_quantity: "inventory.ops.queue.reasonCode.invalid_quantity",
  unsupported_event_type: "inventory.ops.queue.reasonCode.unsupported_event_type",
  incomplete_evidence: "inventory.ops.queue.reasonCode.incomplete_evidence",
  invalid_inventory_event: "inventory.ops.queue.reasonCode.invalid_inventory_event",
  missing_scope: "inventory.ops.queue.reasonCode.missing_scope",
  missing_idempotency: "inventory.ops.queue.reasonCode.missing_idempotency",
  missing_source: "inventory.ops.queue.reasonCode.missing_source",
  invalid_effective_at: "inventory.ops.queue.reasonCode.invalid_effective_at",
  future_dated_count: "inventory.ops.queue.reasonCode.future_dated_count",
  invalid_stockout_quantity: "inventory.ops.queue.reasonCode.invalid_stockout_quantity"
} as const satisfies Record<string, MessageKey>;

export type InventoryOutboxResolutionReasonCode = keyof typeof REASON_MESSAGE_KEYS;

const ALLOWED_REASON = new RegExp(
  `^(?:${Object.keys(REASON_MESSAGE_KEYS).join("|")})$`
);

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized outbox reason token before localization.
 */
export function asciiTrimInventoryOutboxResolutionReason(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an inventory outbox resolutionReason under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, containing
 * ASCII controls, or outside the allowlisted snake_case vocabulary.
 */
export function canonicalizeInventoryOutboxResolutionReason(
  value: string
): InventoryOutboxResolutionReasonCode | null {
  const trimmed = asciiTrimInventoryOutboxResolutionReason(value);
  if (!trimmed) return null;
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  if (!ALLOWED_REASON.test(trimmed)) return null;
  return trimmed as InventoryOutboxResolutionReasonCode;
}

/**
 * Soft normalize for inventory outbox resolutionReason tokens.
 * Soft empty / Unicode-only space → null. Does not throw.
 */
export function normalizeInventoryOutboxResolutionReason(
  value: string | null | undefined
): InventoryOutboxResolutionReasonCode | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  if (!value.trim()) return null;
  return canonicalizeInventoryOutboxResolutionReason(value);
}

/**
 * Resolve the MessageKey for inventory detail queue reason chrome.
 *
 * - null / undefined / empty → null (UI keeps attempts-count fallback)
 * - allowlisted token → localized reasonCode key
 * - non-empty unsafe / unknown token → unknown localized copy (never raw)
 */
export function resolveInventoryOutboxResolutionReasonMessageKey(
  value: string | null | undefined
): MessageKey | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    return "inventory.ops.queue.reasonCode.unknown";
  }
  // Non-empty after raw presence: Unicode-only space / padded / unknown must
  // not fall through to attempts and must not invent raw-token display.
  if (!value.trim()) return "inventory.ops.queue.reasonCode.unknown";
  const token = canonicalizeInventoryOutboxResolutionReason(value);
  if (!token) return "inventory.ops.queue.reasonCode.unknown";
  return REASON_MESSAGE_KEYS[token];
}

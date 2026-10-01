/**
 * Stable operator-facing reasons for inventory detail / Log Delivery
 * queue-or-flush catch paths. Screens must never assign raw Error.message.
 */

export type InventoryOperatorMutationFailureReason =
  | "permission_denied"
  | "network"
  | "invalid_quantity"
  | "quantity_must_be_positive"
  | "stockout_quantity_nonzero"
  | "unsupported_operation"
  | "invalid_canonical_unit"
  | "invalid_timestamp"
  | "invalid_identifier"
  | "note_too_long"
  | "unknown";

function extractMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "";
}

function extractCode(error: unknown): string {
  if (error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return "";
}

function extractStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as {
    status?: unknown;
    context?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.context?.status;
  return typeof status === "number" ? status : null;
}

/** Maps validation, auth, and transport failures onto stable reason codes. */
export function inventoryOperatorMutationFailureReasonFrom(
  error: unknown
): InventoryOperatorMutationFailureReason {
  const code = extractCode(error);
  const message = extractMessage(error);
  const status = extractStatus(error);

  if (
    status === 401 ||
    status === 403 ||
    code === "42501" ||
    code === "PGRST301" ||
    /permission denied|access denied|not authenticated|not authorized|invalid or expired user session|forbidden/i.test(
      message
    )
  ) {
    return "permission_denied";
  }

  if (
    error instanceof TypeError ||
    /network request failed|failed to fetch|fetch failed|networkerror|econnrefused|enotfound|etimedout|offline|asyncstorage|quotaexceeded/i.test(
      message
    )
  ) {
    return "network";
  }

  if (/stockout quantity must be zero/i.test(message)) return "stockout_quantity_nonzero";
  if (/quantity greater than zero/i.test(message)) return "quantity_must_be_positive";
  if (/supported inventory operation/i.test(message)) return "unsupported_operation";
  if (/grams, milliliters, or each/i.test(message)) return "invalid_canonical_unit";
  if (/valid inventory time/i.test(message)) return "invalid_timestamp";
  if (/valid inventory quantity/i.test(message)) return "invalid_quantity";
  if (/shorter note/i.test(message)) return "note_too_long";
  if (/valid (restaurant|inventory item|reference|reason)/i.test(message)) {
    return "invalid_identifier";
  }

  return "unknown";
}

/** Catalog key for a localized operator mutation failure. */
export function inventoryOperatorMutationFailureMessageKey(
  reason: InventoryOperatorMutationFailureReason
) {
  switch (reason) {
    case "permission_denied":
      return "inventory.ops.failure.permissionDenied" as const;
    case "network":
      return "inventory.ops.failure.network" as const;
    case "invalid_quantity":
      return "inventory.ops.quantityInvalid" as const;
    case "quantity_must_be_positive":
      return "inventory.ops.failure.quantityPositive" as const;
    case "stockout_quantity_nonzero":
      return "inventory.ops.failure.stockoutQuantity" as const;
    case "unsupported_operation":
      return "inventory.ops.failure.unsupportedOperation" as const;
    case "invalid_canonical_unit":
      return "inventory.ops.failure.canonicalUnit" as const;
    case "invalid_timestamp":
      return "inventory.ops.failure.timestamp" as const;
    case "invalid_identifier":
      return "inventory.ops.failure.invalidIdentifier" as const;
    case "note_too_long":
      return "inventory.ops.failure.noteTooLong" as const;
    case "unknown":
    default:
      return "inventory.ops.submitError" as const;
  }
}

import type { AuditLog, RestaurantRole } from "../../types/mise";

/**
 * Read-model helpers for the owner/admin audit_logs browse screen.
 *
 * Hosted SELECT is already RLS-limited to owner/admin. This module never invents
 * audit rows; it only filters, sorts, and sanitizes what is safe to show.
 */

export const AUDIT_LOG_HISTORY_FILTERS = [
  "all",
  "purchasing",
  "inventory",
  "integrations",
  "setup"
] as const;

export type AuditLogHistoryFilter = (typeof AUDIT_LOG_HISTORY_FILTERS)[number];

const OWNER_ADMIN_ROLES: readonly RestaurantRole[] = ["owner", "admin"];

/** Matches the hosted RLS policy: owners and admins may read audit logs. */
export function canBrowseAuditLogs(role: RestaurantRole | null | undefined): boolean {
  return Boolean(role && OWNER_ADMIN_ROLES.includes(role));
}

export function assertAuditLogsTenantScoped(
  logs: readonly AuditLog[],
  restaurantId: string
): void {
  const normalized = restaurantId.trim();
  if (!normalized) throw new Error("Missing restaurant workspace.");
  if (logs.some((entry) => entry.restaurant_id !== normalized)) {
    throw new Error("Audit logs failed restaurant scope validation.");
  }
}

export function sortAuditLogHistory(logs: readonly AuditLog[]): AuditLog[] {
  return [...logs].sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export function auditLogHistoryCategory(action: string): AuditLogHistoryFilter | "other" {
  const normalized = action.trim().toLowerCase();
  if (!normalized) return "other";

  if (
    normalized.startsWith("setup_") ||
    normalized === "demo_seeded" ||
    normalized.includes("setup_completion")
  ) {
    return "setup";
  }

  if (
    normalized.startsWith("square_") ||
    normalized.startsWith("gmail_") ||
    normalized.startsWith("pos_") ||
    normalized.includes("sync_") ||
    normalized.includes("_oauth") ||
    normalized.includes("provider_")
  ) {
    return "integrations";
  }

  if (
    normalized.startsWith("inventory_") ||
    normalized.startsWith("count_") ||
    normalized.includes("_count_") ||
    normalized.startsWith("waste_") ||
    normalized.includes("waste_") ||
    normalized.includes("stock_") ||
    normalized.includes("ledger_") ||
    normalized.includes("recipe_")
  ) {
    return "inventory";
  }

  if (
    normalized.startsWith("recommendation_") ||
    normalized.startsWith("purchase_") ||
    normalized.startsWith("supplier_") ||
    normalized.includes("supplier_") ||
    normalized.includes("order_") ||
    normalized.includes("delivery_")
  ) {
    return "purchasing";
  }

  return "other";
}

export function filterAuditLogHistory(
  logs: readonly AuditLog[],
  filter: AuditLogHistoryFilter
): AuditLog[] {
  if (filter === "all") return [...logs];
  return logs.filter((entry) => auditLogHistoryCategory(entry.action) === filter);
}

const SENSITIVE_METADATA_KEY =
  /(email|token|secret|password|authorization|cookie|payload|message|body|content|raw|header|credential|api[_-]?key)/i;

const SAFE_METADATA_KEY = /^[a-z][a-z0-9_]{0,63}$/i;
const MAX_METADATA_ENTRIES = 8;
const MAX_METADATA_STRING = 120;

/**
 * Audit metadata is intentionally sparse on write, but still may contain keys
 * that should never render in the client. Keep only bounded primitives with
 * non-sensitive key names.
 */
export function sanitizeAuditLogMetadata(
  metadata: Record<string, unknown> | null | undefined
): Record<string, string | number | boolean> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (Object.keys(sanitized).length >= MAX_METADATA_ENTRIES) break;
    if (!SAFE_METADATA_KEY.test(key) || SENSITIVE_METADATA_KEY.test(key)) continue;

    if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
      sanitized[key] = value;
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || trimmed.length > MAX_METADATA_STRING) continue;
      if (trimmed.includes("@") && trimmed.includes(".")) continue;
      sanitized[key] = trimmed;
    }
  }

  return sanitized;
}

export function auditLogFromPersisted(row: AuditLog): AuditLog {
  return {
    ...row,
    metadata: sanitizeAuditLogMetadata(row.metadata)
  };
}

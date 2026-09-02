import type { MessageKey } from "../../i18n/catalog";
import {
  auditLogHistoryCategory,
  sanitizeAuditLogMetadata,
  type AuditLogHistoryFilter
} from "../domain/auditLogHistory";
import type { AuditLog } from "../../types/mise";

export type AuditLogHistoryBadgeTone = "warning" | "neutral" | "success" | "caution";

export interface AuditLogHistoryRowView {
  id: string;
  actionKey: MessageKey | null;
  actionFallback: string;
  categoryKey: MessageKey;
  categoryTone: AuditLogHistoryBadgeTone;
  entityTable: string;
  entityId: string | null;
  actorUserId: string | null;
  createdAt: string;
  metadataEntries: ReadonlyArray<{ key: string; value: string }>;
}

const KNOWN_ACTION_KEYS = {
  demo_seeded: "auditLogs.action.demo_seeded",
  setup_completed: "auditLogs.action.setup_completed",
  setup_saved: "auditLogs.action.setup_saved",
  recommendation_approved: "auditLogs.action.recommendation_approved",
  recommendation_dismissed: "auditLogs.action.recommendation_dismissed",
  recommendation_undo: "auditLogs.action.recommendation_undo",
  purchase_decision_excluded_from_learning:
    "auditLogs.action.purchase_decision_excluded_from_learning",
  purchase_approval_blocked: "auditLogs.action.purchase_approval_blocked",
  supplier_order_sent: "auditLogs.action.supplier_order_sent",
  supplier_email_sent: "auditLogs.action.supplier_email_sent",
  supplier_send_content_approved: "auditLogs.action.supplier_send_content_approved",
  supplier_created: "auditLogs.action.supplier_created",
  supplier_renamed: "auditLogs.action.supplier_renamed",
  supplier_recipient_updated: "auditLogs.action.supplier_recipient_updated",
  supplier_delivery_recorded: "auditLogs.action.supplier_delivery_recorded",
  inventory_supplier_reassigned: "auditLogs.action.inventory_supplier_reassigned",
  pos_mapping_verified: "auditLogs.action.pos_mapping_verified",
  pos_mapping_rejected: "auditLogs.action.pos_mapping_rejected",
  square_sync_completed: "auditLogs.action.square_sync_completed",
  square_demo_connected: "auditLogs.action.square_demo_connected",
  square_demo_disconnected: "auditLogs.action.square_demo_disconnected",
  gmail_demo_connected: "auditLogs.action.gmail_demo_connected",
  gmail_demo_disconnected: "auditLogs.action.gmail_demo_disconnected",
  gmail_link_started: "auditLogs.action.gmail_link_started",
  pos_sync_requested: "auditLogs.action.pos_sync_requested",
  ai_insight_generation_requested: "auditLogs.action.ai_insight_generation_requested",
  supplier_email_prepare_requested: "auditLogs.action.supplier_email_prepare_requested"
} as const satisfies Record<string, MessageKey>;

export function presentAuditLogHistoryRow(log: AuditLog): AuditLogHistoryRowView {
  const action = log.action.trim();
  const category = auditLogHistoryCategory(action);
  const knownKey =
    action in KNOWN_ACTION_KEYS
      ? KNOWN_ACTION_KEYS[action as keyof typeof KNOWN_ACTION_KEYS]
      : null;
  const sanitized = sanitizeAuditLogMetadata(log.metadata);

  return {
    id: log.id,
    actionKey: knownKey,
    actionFallback: humanizeAuditAction(action),
    categoryKey:
      category === "other"
        ? "auditLogs.filter.other"
        : auditLogHistoryCategoryMessageKey(category),
    categoryTone: auditLogCategoryTone(category),
    entityTable: log.entity_table,
    entityId: log.entity_id,
    actorUserId: log.actor_user_id,
    createdAt: log.created_at,
    metadataEntries: Object.entries(sanitized).map(([key, value]) => ({
      key,
      value: String(value)
    }))
  };
}

export function auditLogHistoryFilterMessageKey(filter: AuditLogHistoryFilter): MessageKey {
  if (filter === "purchasing") return "auditLogs.filter.purchasing";
  if (filter === "inventory") return "auditLogs.filter.inventory";
  if (filter === "integrations") return "auditLogs.filter.integrations";
  if (filter === "setup") return "auditLogs.filter.setup";
  return "auditLogs.filter.all";
}

export function auditLogHistoryCategoryMessageKey(
  filter: Exclude<AuditLogHistoryFilter, never>
): MessageKey {
  return auditLogHistoryFilterMessageKey(filter);
}

function auditLogCategoryTone(
  category: ReturnType<typeof auditLogHistoryCategory>
): AuditLogHistoryBadgeTone {
  if (category === "purchasing") return "caution";
  if (category === "inventory") return "warning";
  if (category === "integrations") return "success";
  if (category === "setup") return "neutral";
  return "neutral";
}

function humanizeAuditAction(action: string): string {
  const trimmed = action.trim();
  if (!trimmed) return "unknown";
  return trimmed.replace(/_/g, " ");
}

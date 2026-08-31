import type { InventoryCountSession, InventoryCountSessionStatus } from "../../types/mise";
import type { MessageKey } from "../../i18n/catalog";

export type CountSessionStatusBadgeTone = "neutral" | "success" | "caution" | "warning";

export function presentCountSessionStatusMessageKey(
  status: InventoryCountSessionStatus
): MessageKey {
  switch (status) {
    case "in_progress":
      return "inventory.count.status.inProgress";
    case "submitted":
      return "inventory.count.status.submitted";
    case "approved":
      return "inventory.count.status.approved";
    case "cancelled":
      return "inventory.count.status.cancelled";
  }
}

export function presentCountSessionStatusBadgeTone(
  status: InventoryCountSessionStatus
): CountSessionStatusBadgeTone {
  switch (status) {
    case "approved":
      return "success";
    case "cancelled":
      return "neutral";
    case "submitted":
      return "caution";
    case "in_progress":
      return "warning";
  }
}

/** Prefer the authoritative closed timestamp for history rows. */
export function presentCountSessionHistoryAt(session: InventoryCountSession): string {
  if (session.status === "approved" && session.approved_at) return session.approved_at;
  if (session.status === "cancelled" && session.cancelled_at) return session.cancelled_at;
  if (session.submitted_at) return session.submitted_at;
  return session.updated_at || session.started_at;
}

import type { InventoryItem, InventoryStatus } from "../types/mise";

export function getInventoryStatus(item: InventoryItem): InventoryStatus {
  return getInventoryStatusForQuantity(item, item.current_quantity);
}

export function getInventoryStatusForQuantity(item: InventoryItem, quantity: number): InventoryStatus {
  if (quantity <= item.reorder_threshold * 0.75) return "Critical";
  if (quantity > item.par_level) return "Good";
  if (quantity > item.reorder_threshold) return "Watch";
  return "Low";
}

export function statusTone(status: InventoryStatus) {
  if (status === "Good") return "success";
  if (status === "Watch") return "caution";
  if (status === "Low") return "warning";
  if (status === "Critical") return "danger";
  return "neutral";
}

export function urgencyTone(urgency: "low" | "medium" | "high") {
  if (urgency === "high") return "danger";
  if (urgency === "medium") return "warning";
  return "neutral";
}

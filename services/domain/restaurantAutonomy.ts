import { createId } from "./miseDomain";
import type { AutonomyLevel } from "./operationalStatus";
import type { MiseActionType } from "./miseActions";

export type AutonomyOperationalCategory =
  | "inventory"
  | "orders"
  | "sales"
  | "team"
  | "waste"
  | "tasks"
  | "integrations"
  | "settings";

export interface RestaurantAutonomyRule {
  id: string;
  restaurantId: string;
  locationId: string | null;
  actionType: MiseActionType | string;
  operationalCategory: AutonomyOperationalCategory;
  maximumAutonomyLevel: AutonomyLevel;
  requiresApproval: boolean;
  enabled: boolean;
  spendLimitCents: number | null;
  supplierId: string | null;
  /** Presentation snapshot; scope authority uses `supplierId`. */
  supplierName: string | null;
  communicationType: string | null;
  allowedStartTime: string | null;
  allowedEndTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedAutonomyRuleRow {
  id: string;
  restaurant_id: string;
  location_id?: string | null;
  action_type: string;
  operational_category: AutonomyOperationalCategory;
  maximum_autonomy_level: number;
  requires_approval: boolean;
  enabled: boolean;
  spend_limit_cents?: number | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  communication_type?: string | null;
  allowed_start_time?: string | null;
  allowed_end_time?: string | null;
  created_at: string;
  updated_at: string;
}

export function autonomyRuleFromPersistedRow(row: PersistedAutonomyRuleRow): RestaurantAutonomyRule {
  const level = Number(row.maximum_autonomy_level);
  if (![1, 2, 3, 4, 5].includes(level)) {
    throw new Error("Autonomy level is invalid.");
  }
  return {
    id: row.id,
    restaurantId: row.restaurant_id.trim(),
    locationId: row.location_id ?? null,
    actionType: row.action_type,
    operationalCategory: row.operational_category,
    maximumAutonomyLevel: level as AutonomyLevel,
    requiresApproval: Boolean(row.requires_approval),
    enabled: Boolean(row.enabled),
    spendLimitCents:
      row.spend_limit_cents === null || row.spend_limit_cents === undefined
        ? null
        : Number(row.spend_limit_cents),
    supplierId: row.supplier_id ?? null,
    supplierName: row.supplier_name ?? null,
    communicationType: row.communication_type ?? null,
    allowedStartTime: row.allowed_start_time ?? null,
    allowedEndTime: row.allowed_end_time ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

export function defaultAutonomyRules(restaurantId: string, now = new Date().toISOString()): RestaurantAutonomyRule[] {
  return [
    {
      id: createId("autonomy"),
      restaurantId,
      locationId: null,
      actionType: "prepare_supplier_order_draft",
      operationalCategory: "orders",
      maximumAutonomyLevel: 3,
      requiresApproval: true,
      enabled: true,
      spendLimitCents: 50000,
      supplierId: null,
      supplierName: null,
      communicationType: null,
      allowedStartTime: null,
      allowedEndTime: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: createId("autonomy"),
      restaurantId,
      locationId: null,
      actionType: "send_supplier_order",
      operationalCategory: "orders",
      maximumAutonomyLevel: 3,
      requiresApproval: true,
      enabled: false,
      spendLimitCents: 25000,
      supplierId: null,
      supplierName: null,
      communicationType: "email",
      allowedStartTime: null,
      allowedEndTime: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: createId("autonomy"),
      restaurantId,
      locationId: null,
      actionType: "create_internal_task",
      operationalCategory: "tasks",
      maximumAutonomyLevel: 4,
      requiresApproval: false,
      enabled: true,
      spendLimitCents: null,
      supplierId: null,
      supplierName: null,
      communicationType: null,
      allowedStartTime: null,
      allowedEndTime: null,
      createdAt: now,
      updatedAt: now
    }
  ];
}

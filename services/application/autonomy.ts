import { defaultAutonomyRules } from "../domain/restaurantAutonomy";
import type {
  AutonomyOperationalCategory,
  RestaurantAutonomyRule
} from "../domain/restaurantAutonomy";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export type AutonomyRuleInput = {
  actionType: string;
  operationalCategory: AutonomyOperationalCategory;
  maximumAutonomyLevel: 1 | 2 | 3 | 4 | 5;
  requiresApproval: boolean;
  enabled: boolean;
  spendLimitCents?: number | null;
  supplierId?: string | null;
  /** Presentation only; the server resolves the current name from supplierId. */
  supplierName?: string | null;
  communicationType?: string | null;
  allowedStartTime?: string | null;
  allowedEndTime?: string | null;
};

export async function fetchAutonomyRules(restaurantId: string): Promise<RestaurantAutonomyRule[]> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  const rules = await repository.listAutonomyRules(normalizedRestaurantId);
  if (rules.some((rule) => rule.restaurantId !== normalizedRestaurantId)) {
    throw new Error("Autonomy rules failed restaurant scope validation.");
  }
  return rules;
}

export async function saveAutonomyRule(restaurantId: string, input: AutonomyRuleInput) {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (input.supplierName?.trim() && !input.supplierId?.trim()) {
    throw new Error("Supplier-scoped autonomy requires a durable supplier identity.");
  }
  const isExternalSend = input.actionType === "send_supplier_order";
  const rule = await repository.upsertAutonomyRule(normalizedRestaurantId, {
    ...input,
    // External supplier sending always keeps an approval gate.
    requiresApproval: isExternalSend ? true : input.requiresApproval
  });
  if (rule.restaurantId !== normalizedRestaurantId) {
    throw new Error("Autonomy rule failed restaurant scope validation.");
  }
  return rule;
}

/**
 * Owner/admin explicit action for empty hosted tenants. Creates safe defaults
 * and never enables external sending.
 */
export async function createSafeDefaultAutonomyRules(
  restaurantId: string
): Promise<RestaurantAutonomyRule[]> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const existing = await fetchAutonomyRules(normalizedRestaurantId);
  if (existing.length > 0) return existing;

  const defaults = defaultAutonomyRules(normalizedRestaurantId).map((rule) => ({
    actionType: String(rule.actionType),
    operationalCategory: rule.operationalCategory,
    maximumAutonomyLevel: rule.maximumAutonomyLevel,
    requiresApproval: true,
    enabled: rule.actionType === "send_supplier_order" ? false : rule.enabled,
    spendLimitCents: rule.spendLimitCents,
    supplierId: rule.supplierId,
    supplierName: rule.supplierName,
    communicationType: rule.communicationType,
    allowedStartTime: rule.allowedStartTime,
    allowedEndTime: rule.allowedEndTime
  }));

  const created: RestaurantAutonomyRule[] = [];
  for (const draft of defaults) {
    created.push(await saveAutonomyRule(normalizedRestaurantId, draft));
  }
  return created;
}

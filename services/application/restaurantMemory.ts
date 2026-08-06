import {
  convertMemoryToRule,
  type RestaurantMemory,
  type RestaurantMemoryStatus
} from "../domain/restaurantMemory";
import type { AutonomyOperationalCategory } from "../domain/restaurantAutonomy";
import { saveAutonomyRule } from "./autonomy";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export async function fetchRestaurantMemories(
  restaurantId: string,
  options: { status?: RestaurantMemoryStatus | "actionable"; limit?: number } = {}
): Promise<RestaurantMemory[]> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  const memories = await repository.listRestaurantMemories(normalizedRestaurantId, options);
  if (memories.some((memory) => memory.restaurantId !== normalizedRestaurantId)) {
    throw new Error("Restaurant memories failed restaurant scope validation.");
  }
  return memories;
}

export async function updateRestaurantMemoryDecision(
  restaurantId: string,
  memoryId: string,
  decision: Exclude<RestaurantMemoryStatus, "active">,
  correction?: string | null
): Promise<RestaurantMemory> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  const memory = await repository.updateRestaurantMemoryDecision(
    normalizedRestaurantId,
    memoryId,
    decision,
    correction
  );
  if (memory.restaurantId !== normalizedRestaurantId) {
    throw new Error("Restaurant memory failed restaurant scope validation.");
  }
  return memory;
}

/**
 * Converts a memory into a disabled autonomy draft rule. Never enables external
 * sending; always requires approval.
 */
export async function convertRestaurantMemoryToSafeRule(
  restaurantId: string,
  memoryId: string
) {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  const memories = await fetchRestaurantMemories(normalizedRestaurantId, { limit: 200 });
  const memory = memories.find((entry) => entry.id === memoryId);
  if (!memory || memory.restaurantId !== normalizedRestaurantId) {
    throw new Error("Memory not found");
  }
  const draft = convertMemoryToRule(memory);
  const mapped = mapMemoryToSafeAutonomyDraft(memory);
  const rule = await saveAutonomyRule(normalizedRestaurantId, {
    ...mapped,
    enabled: false,
    requiresApproval: true
  });
  return { draft, rule };
}

function mapMemoryToSafeAutonomyDraft(memory: RestaurantMemory): {
  actionType: string;
  operationalCategory: AutonomyOperationalCategory;
  maximumAutonomyLevel: 1 | 2 | 3 | 4 | 5;
  spendLimitCents: number | null;
  supplierName: string | null;
  communicationType: string | null;
} {
  switch (memory.memoryType) {
    case "supplier_reliability":
      return {
        actionType: "prepare_supplier_order_draft",
        operationalCategory: "orders",
        maximumAutonomyLevel: 3,
        spendLimitCents: 25000,
        supplierName: null,
        communicationType: null
      };
    case "approval_preference":
    case "edited_quantity":
    case "rejected_recommendation":
      return {
        actionType: "prepare_supplier_order_draft",
        operationalCategory: "orders",
        maximumAutonomyLevel: 3,
        spendLimitCents: 50000,
        supplierName: null,
        communicationType: null
      };
    case "prep_habit":
    case "staff_timing":
      return {
        actionType: "create_internal_task",
        operationalCategory: "tasks",
        maximumAutonomyLevel: 3,
        spendLimitCents: null,
        supplierName: null,
        communicationType: null
      };
    case "waste_pattern":
      return {
        actionType: "create_internal_task",
        operationalCategory: "waste",
        maximumAutonomyLevel: 3,
        spendLimitCents: null,
        supplierName: null,
        communicationType: null
      };
    default:
      return {
        actionType: "create_internal_task",
        operationalCategory: "settings",
        maximumAutonomyLevel: 2,
        spendLimitCents: null,
        supplierName: null,
        communicationType: null
      };
  }
}

import {
  SquareIntegrationError,
  type SquareConnectionWorkflowResult,
  type SquareDisconnectWorkflowResult,
  type PosMappingReviewQueue,
  type PosMappingReviewResult,
  type SquareModifierSyncSummary,
  type SquareSyncWorkflowResult
} from "../repositories/miseRepository";
import { getMiseRepository } from "./repository";

export { SquareIntegrationError };
export type {
  SquareConnectionWorkflowResult,
  SquareDisconnectWorkflowResult,
  PosMappingReviewQueue,
  PosMappingReviewResult,
  SquareModifierSyncSummary,
  SquareSyncWorkflowResult
};

const repository = getMiseRepository();

export async function fetchSquarePosIntegration(restaurantId: string) {
  return repository.fetchSquarePosIntegration(requireWorkflowId(restaurantId, "restaurant"));
}

export async function fetchLatestSquareModifierSyncSummary(
  restaurantId: string
): Promise<SquareModifierSyncSummary | null> {
  return repository.fetchLatestSquareModifierSyncSummary(
    requireWorkflowId(restaurantId, "restaurant")
  );
}

export async function fetchPosMappingReviewQueue(
  restaurantId: string
): Promise<PosMappingReviewQueue> {
  return repository.fetchPosMappingReviewQueue(requireWorkflowId(restaurantId, "restaurant"));
}

export async function reviewPosCatalogMapping(
  restaurantId: string,
  mappingId: string,
  menuItemId: string | null,
  decision: "verify" | "reject"
): Promise<PosMappingReviewResult> {
  return repository.reviewPosCatalogMapping(
    requireWorkflowId(restaurantId, "restaurant"),
    requireWorkflowId(mappingId, "mapping"),
    menuItemId === null ? null : requireWorkflowId(menuItemId, "menu item"),
    decision
  );
}

export async function connectRestaurantSquare(
  restaurantId: string
): Promise<SquareConnectionWorkflowResult> {
  return repository.connectRestaurantSquare(requireWorkflowId(restaurantId, "restaurant"));
}

export async function disconnectRestaurantSquare(
  restaurantId: string
): Promise<SquareDisconnectWorkflowResult> {
  return repository.disconnectRestaurantSquare(requireWorkflowId(restaurantId, "restaurant"));
}

export async function syncSquarePosSales(
  restaurantId: string,
  from: string,
  to: string
): Promise<SquareSyncWorkflowResult> {
  return repository.syncSquarePosSales(
    requireWorkflowId(restaurantId, "restaurant"),
    from,
    to
  );
}

export function isSquareIntegrationError(error: unknown): error is SquareIntegrationError {
  return error instanceof SquareIntegrationError;
}

function requireWorkflowId(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`A valid ${label} id is required.`);
  return normalized;
}

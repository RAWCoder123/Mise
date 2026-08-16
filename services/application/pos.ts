import {
  SquareIntegrationError,
  type SquareConnectionWorkflowResult,
  type SquareDisconnectWorkflowResult,
  type SquareSyncWorkflowResult
} from "../repositories/miseRepository";
import { getMiseRepository } from "./repository";

export { SquareIntegrationError };
export type {
  SquareConnectionWorkflowResult,
  SquareDisconnectWorkflowResult,
  SquareSyncWorkflowResult
};

const repository = getMiseRepository();

export async function fetchSquarePosIntegration(restaurantId: string) {
  return repository.fetchSquarePosIntegration(requireWorkflowId(restaurantId, "restaurant"));
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

export async function selectPosLocation(restaurantId: string, locationId: string) {
  return repository.selectPosLocation(
    requireWorkflowId(restaurantId, "restaurant"),
    requireWorkflowId(locationId, "POS location")
  );
}

export async function reviewPosCatalogMapping(
  restaurantId: string,
  mappingId: string,
  decision: "verified" | "rejected"
) {
  if (decision !== "verified" && decision !== "rejected") {
    throw new Error("Choose a valid catalog mapping decision.");
  }
  return repository.reviewPosCatalogMapping(
    requireWorkflowId(restaurantId, "restaurant"),
    requireWorkflowId(mappingId, "catalog mapping"),
    decision
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

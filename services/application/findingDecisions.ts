import type { OperationalFindingDecisionInput } from "../domain/operationalFindingDecisions";
import { normalizeOperationalFindingDecisionInput } from "../domain/operationalFindingDecisions";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export async function recordOperationalFindingDecision(
  input: OperationalFindingDecisionInput
) {
  return repository.recordOperationalFindingDecision(
    normalizeOperationalFindingDecisionInput(input)
  );
}

export async function fetchOperationalFindingDecisions(restaurantId: string) {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  return repository.fetchOperationalFindingDecisions(normalizedRestaurantId);
}

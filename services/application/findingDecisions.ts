import type { OperationalFindingDecisionInput } from "../domain/operationalFindingDecisions";
import { normalizeOperationalFindingDecisionInput } from "../domain/operationalFindingDecisions";
import { requireCanonicalFindingDecisionsWorkspaceId } from "../domain/findingDecisionsRestaurantIdentity";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

/** MISE-005LS: ASCII-C restaurant workspace identity for finding-decisions entry points. */
function requireRestaurantId(restaurantId: string) {
  return requireCanonicalFindingDecisionsWorkspaceId(restaurantId);
}

export async function recordOperationalFindingDecision(
  input: OperationalFindingDecisionInput
) {
  return repository.recordOperationalFindingDecision(
    normalizeOperationalFindingDecisionInput(input)
  );
}

export async function fetchOperationalFindingDecisions(restaurantId: string) {
  const normalizedRestaurantId = requireRestaurantId(restaurantId);
  return repository.fetchOperationalFindingDecisions(normalizedRestaurantId);
}

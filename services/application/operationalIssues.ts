import {
  assertOperationalIssuesTenantScoped,
  filterOperationalIssues,
  sortOperationalIssues,
  type OperationalIssue,
  type OperationalIssueStatusFilter
} from "../domain/operationalIssues";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export async function fetchOperationalIssues(
  restaurantId: string,
  options: {
    status?: OperationalIssueStatusFilter;
    limit?: number;
  } = {}
): Promise<OperationalIssue[]> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  const issues = await repository.listOperationalIssues(normalizedRestaurantId, {
    status: options.status ?? "open",
    limit: options.limit ?? 80
  });
  assertOperationalIssuesTenantScoped(issues, normalizedRestaurantId);
  return sortOperationalIssues(
    filterOperationalIssues(issues, options.status ?? "open")
  ).slice(0, options.limit ?? 80);
}

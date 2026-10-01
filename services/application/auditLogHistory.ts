import {
  assertAuditLogsTenantScoped,
  auditLogFromPersisted,
  sortAuditLogHistory
} from "../domain/auditLogHistory";
import type { AuditLog } from "../../types/mise";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

/**
 * Read-only audit log history for owners and admins.
 * Filtering stays in the domain helper so the screen can switch categories
 * without another round trip. Hosted RLS still enforces role scope.
 */
export async function fetchAuditLogs(
  restaurantId: string,
  options: {
    limit?: number;
    since?: string;
  } = {}
): Promise<AuditLog[]> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const logs = await repository.listAuditLogs(normalizedRestaurantId, {
    since: options.since,
    limit
  });
  assertAuditLogsTenantScoped(logs, normalizedRestaurantId);
  return sortAuditLogHistory(logs.map(auditLogFromPersisted)).slice(0, limit);
}

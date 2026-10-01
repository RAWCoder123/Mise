import { addDaysToDateKey, toDateKeyInTimeZone } from "../../utils/format";
import { createId } from "../domain/miseDomain";
import {
  buildWasteCorrectionCandidate,
  findCorrectableWasteEvent
} from "../domain/wasteCorrection";
import {
  buildWasteAnalysis,
  type WasteAnalysisSummary
} from "../domain/wasteAnalysis";
import {
  requireWasteCorrectionInput,
  type WasteCorrectionClientInput
} from "../miseValidation";
import type { MiseRepository } from "../repositories/repositoryContracts";
import {
  flushQueuedInventoryEvents,
  queueInventoryEventForSubmission
} from "./deviceInventoryOutbox";
import type { InventoryOutboxFlushSummary } from "./inventoryOutbox";
import { getMiseRepository } from "./repository";

export type { WasteAnalysisSummary } from "../domain/wasteAnalysis";

const WASTE_ANALYSIS_WINDOW_DAYS = 7;
const WASTE_HISTORY_LIMIT = 500;

/**
 * Screen-safe waste intelligence boundary. Hosted and demo evidence both come
 * from the append-only inventory ledger; only verified item conversions are
 * permitted to produce a dollar estimate.
 */
export async function fetchWasteAnalysis(
  restaurantId: string,
  options: { operatingDate?: string; now?: Date } = {}
): Promise<WasteAnalysisSummary> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const repository = getMiseRepository();
  const [restaurant, inventoryItems] = await Promise.all([
    repository.fetchRestaurant(normalizedRestaurantId),
    repository.fetchInventoryItems(normalizedRestaurantId)
  ]);
  if (restaurant.id !== normalizedRestaurantId) {
    throw new Error("Waste analysis restaurant identity did not match.");
  }

  const operatingDate =
    options.operatingDate ??
    toDateKeyInTimeZone(options.now ?? new Date(), restaurant.timezone);
  const events = await listWasteCorrectionEvidence(
    repository,
    normalizedRestaurantId,
    operatingDate
  );

  return buildWasteAnalysis({
    restaurantId: normalizedRestaurantId,
    operatingDate,
    restaurantTimeZone: restaurant.timezone,
    inventoryItems,
    events,
    windowDays: WASTE_ANALYSIS_WINDOW_DAYS,
    historyTruncated: events.length === WASTE_HISTORY_LIMIT
  });
}

/**
 * Manager reconciliation for a mistaken waste row. Appends a signed
 * `correction` that supersedes the waste once; on-hand restores by the waste
 * quantity. Staff cannot reach this path through the generic inventory ops
 * allowlist; hosted RPC still enforces manager membership.
 */
export async function correctWasteEvent(
  input: WasteCorrectionClientInput
): Promise<InventoryOutboxFlushSummary> {
  const validated = requireWasteCorrectionInput(input);
  const repository = getMiseRepository();
  const restaurant = await repository.fetchRestaurant(validated.restaurantId);
  if (restaurant.id !== validated.restaurantId) {
    throw new Error("Waste correction restaurant identity did not match.");
  }

  const operatingDate = toDateKeyInTimeZone(new Date(validated.effectiveAt), restaurant.timezone);
  const events = await listWasteCorrectionEvidence(
    repository,
    validated.restaurantId,
    operatingDate
  );
  const wasteEvent = findCorrectableWasteEvent({
    restaurantId: validated.restaurantId,
    wasteEventId: validated.wasteEventId,
    events
  });
  const candidate = buildWasteCorrectionCandidate({
    wasteEvent,
    restaurantId: validated.restaurantId,
    note: validated.note,
    effectiveAt: validated.effectiveAt
  });
  const clientEventId = createId("inventory_event");
  await queueInventoryEventForSubmission({
    outboxId: createId("inventory_outbox"),
    event: {
      ...candidate,
      clientEventId,
      idempotencyKey: `waste_correction:${wasteEvent.id}:${clientEventId}`
    },
    now: validated.effectiveAt
  });
  return flushQueuedInventoryEvents(validated.restaurantId);
}

async function listWasteCorrectionEvidence(
  repository: MiseRepository,
  normalizedRestaurantId: string,
  operatingDate: string
) {
  const historyStart = addDaysToDateKey(
    operatingDate,
    -(WASTE_ANALYSIS_WINDOW_DAYS * 2)
  );
  return repository.listInventoryEvents(normalizedRestaurantId, {
    eventTypes: ["waste", "correction"],
    // Include a UTC guard day so restaurants east of UTC do not lose evidence
    // from the first local hours of the bounded analysis window.
    since: `${addDaysToDateKey(historyStart, -1)}T00:00:00.000Z`,
    limit: WASTE_HISTORY_LIMIT
  });
}

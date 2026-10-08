import { runDueRecalculationCycles } from "./recalculationCycles";
import { createRecalculationPorts } from "./recalculationPorts";
import { regenerateOperationalSignals } from "./recalculations";
import { getMiseRepository } from "./repository";
import {
  summarizeRecalculationAttention,
  type RecalculationAttentionSummary
} from "../presentation/recalculationPresentation";

const repository = getMiseRepository();

/**
 * Dispatches whichever recalculation cycles are due for this restaurant and
 * reports back only what an operator needs to see.
 *
 * Interactive path: called from an authenticated operator session (Today/Home).
 * Unattended path: `supabase/functions/run-scheduled-recalculations` uses a
 * dedicated runner secret and service-role machine ledger writes. Keep this
 * member-session entry point for immediate operator-driven refresh.
 *
 * Never throws. A background loop that breaks the screen it is trying to keep
 * accurate is worse than one that quietly defers.
 */
export async function runScheduledRecalculations(input: {
  restaurantId: string;
  restaurantTimeZone: string;
  now?: Date;
}): Promise<RecalculationAttentionSummary | null> {
  const restaurantId = input.restaurantId.trim();
  const restaurantTimeZone = input.restaurantTimeZone.trim();
  if (!restaurantId || !restaurantTimeZone) return null;

  try {
    const report = await runDueRecalculationCycles({
      restaurantId,
      restaurantTimeZone,
      ports: createRecalculationPorts({
        ledger: repository,
        runCycleWork: regenerateOperationalSignals
      }),
      now: input.now
    });
    return summarizeRecalculationAttention(report);
  } catch {
    // runDueRecalculationCycles already fails closed on an unreadable ledger;
    // anything reaching here is unexpected and must not break the screen.
    return { state: "unavailable", deadLetteredCount: 0, cycles: [], owner: null };
  }
}

import type { FindingDecisionOutboxEntry } from "../../services/domain/findingDecisionOutbox";
import type { OperationalFinding } from "../../services/domain/operationalFindings";

/**
 * Queue badges must bind to the exact finding snapshot that was queued.
 * A newer brief with changed evidence, action, policy, or identity must not
 * inherit an older pending/accepted status for the same finding id.
 */
export function queuedFindingMatchesCurrent(
  current: OperationalFinding,
  queuedFinding: OperationalFinding
): boolean {
  return (
    current.restaurantId === queuedFinding.restaurantId &&
    current.id === queuedFinding.id &&
    current.policyVersion === queuedFinding.policyVersion &&
    current.category === queuedFinding.category &&
    current.severity === queuedFinding.severity &&
    current.confidence.score === queuedFinding.confidence.score &&
    current.recommendedAction === queuedFinding.recommendedAction &&
    current.sourceWindow.start === queuedFinding.sourceWindow.start &&
    current.sourceWindow.end === queuedFinding.sourceWindow.end &&
    JSON.stringify(current.evidence) === JSON.stringify(queuedFinding.evidence)
  );
}

export function latestMatchingQueueEntry(
  finding: OperationalFinding,
  queue: readonly FindingDecisionOutboxEntry[]
): FindingDecisionOutboxEntry | null {
  let latest: FindingDecisionOutboxEntry | null = null;
  for (const entry of queue) {
    if (entry.decision.restaurantId !== finding.restaurantId) continue;
    if (!queuedFindingMatchesCurrent(finding, entry.decision.finding)) continue;
    if (!latest || entry.updatedAt > latest.updatedAt) latest = entry;
  }
  return latest;
}

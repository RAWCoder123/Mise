import { runDueRecalculationCycles, type RecalculationCycleReport } from "./recalculationCycles";
import { createRecalculationPorts, type RecalculationLedger } from "./recalculationPorts";
import type { RecalculationRunInput } from "../repositories/repositoryContracts";

/**
 * Unattended recalculation dispatch for restaurants that nobody has opened.
 *
 * Authority: the Edge Function authenticates with a dedicated runner secret and
 * uses service-role RPCs. Signal refresh still goes through the mature
 * actor-bound planning path by resolving an active owner/admin/manager; the
 * ledger records machine-sourced attempts so Mise never invents a human actor.
 */

export const RECALCULATION_MACHINE_RUNNER_MAX_TARGETS = 25;

export interface RecalculationRunnerTarget {
  restaurantId: string;
  timeZone: string;
}

export interface MachineRecalculationPorts {
  listTargets(limit: number): Promise<readonly RecalculationRunnerTarget[]>;
  resolveSignalActor(restaurantId: string): Promise<string | null>;
  listRuns: RecalculationLedger["listRecalculationRuns"];
  recordMachineRun(input: RecalculationRunInput): Promise<unknown>;
  refreshSignals(restaurantId: string, signalActorUserId: string): Promise<void>;
}

export interface MachineRecalculationRestaurantResult {
  restaurantId: string;
  timeZone: string;
  status: "completed" | "skipped" | "failed";
  reason: string | null;
  report: RecalculationCycleReport | null;
}

export interface MachineRecalculationPassReport {
  evaluatedAt: string;
  targetCount: number;
  results: MachineRecalculationRestaurantResult[];
}

export async function runMachineRecalculationPass(input: {
  ports: MachineRecalculationPorts;
  restaurantId?: string | null;
  limit?: number;
  now?: Date;
}): Promise<MachineRecalculationPassReport> {
  const now =
    input.now instanceof Date && Number.isFinite(input.now.getTime()) ? input.now : new Date();
  const limit = normalizeLimit(input.limit);
  const requestedRestaurantId =
    typeof input.restaurantId === "string" ? input.restaurantId.trim() : "";

  const targets = requestedRestaurantId
    ? (await input.ports.listTargets(RECALCULATION_MACHINE_RUNNER_MAX_TARGETS)).filter(
        (target) => target.restaurantId === requestedRestaurantId
      )
    : await input.ports.listTargets(limit);

  const results: MachineRecalculationRestaurantResult[] = [];
  for (const target of targets) {
    results.push(await runOneRestaurant(input.ports, target, now));
  }

  if (requestedRestaurantId && results.length === 0) {
    results.push({
      restaurantId: requestedRestaurantId,
      timeZone: "",
      status: "skipped",
      reason: "Restaurant is not an eligible recalculation runner target.",
      report: null
    });
  }

  return {
    evaluatedAt: now.toISOString(),
    targetCount: targets.length,
    results
  };
}

async function runOneRestaurant(
  ports: MachineRecalculationPorts,
  target: RecalculationRunnerTarget,
  now: Date
): Promise<MachineRecalculationRestaurantResult> {
  const restaurantId = target.restaurantId.trim();
  const timeZone = target.timeZone.trim();
  if (!restaurantId || !timeZone) {
    return {
      restaurantId,
      timeZone,
      status: "skipped",
      reason: "Restaurant target is missing an id or timezone.",
      report: null
    };
  }

  const signalActorUserId = await ports.resolveSignalActor(restaurantId);
  if (!signalActorUserId) {
    return {
      restaurantId,
      timeZone,
      status: "skipped",
      reason: "No active owner, admin, or manager can authorize signal refresh.",
      report: null
    };
  }

  try {
    const report = await runDueRecalculationCycles({
      restaurantId,
      restaurantTimeZone: timeZone,
      now,
      ports: createRecalculationPorts({
        ledger: {
          listRecalculationRuns: ports.listRuns,
          recordRecalculationRun: async (runInput) => {
            await ports.recordMachineRun(runInput);
            return {
              ...runInput,
              id: runInput.idempotencyKey,
              recordedBy: null,
              recordedAt: now.toISOString(),
              correlationId: runInput.idempotencyKey
            };
          }
        },
        runCycleWork: (id) => ports.refreshSignals(id, signalActorUserId),
        now: () => now
      })
    });

    if (report.scheduleError) {
      return {
        restaurantId,
        timeZone,
        status: "failed",
        reason: report.scheduleError,
        report
      };
    }

    return {
      restaurantId,
      timeZone,
      status: "completed",
      reason: null,
      report
    };
  } catch (error) {
    return {
      restaurantId,
      timeZone,
      status: "failed",
      reason: describeError(error),
      report: null
    };
  }
}

export function normalizeLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return RECALCULATION_MACHINE_RUNNER_MAX_TARGETS;
  return Math.min(
    RECALCULATION_MACHINE_RUNNER_MAX_TARGETS,
    Math.max(1, Math.floor(limit))
  );
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim().slice(0, 200);
  return "Unknown recalculation runner failure";
}

import {
  buildRecalculationSchedule,
  type RecalculationCycle,
  type RecalculationDecision,
  type RecalculationRunRecord,
  type RecalculationSchedule
} from "../domain/recalculationSchedule";

/**
 * Executes the recalculation cycles that `recalculationSchedule` reports as due.
 *
 * Ports are injected rather than resolved from the repository singleton so the
 * cycle runner can be proven without a database and so the run ledger can be
 * backed by whichever store the deployment target provides. Nothing here
 * decides *whether* a cycle should run; that stays in the domain module.
 */
export interface RecalculationPorts {
  /** Run ledger for the restaurant. Only current-service-day rows are used. */
  loadRuns(restaurantId: string): Promise<readonly RecalculationRunRecord[]>;
  /** Durable record of one finished attempt, written before the report returns. */
  recordRun(record: RecalculationRunRecord): Promise<void>;
  /** The actual recalculation work for one cycle. */
  runCycle(cycle: RecalculationCycle, context: RecalculationRunContext): Promise<void>;
}

export interface RecalculationRunContext {
  restaurantId: string;
  operatingDate: string;
  attempt: number;
  /** Stable across retries; safe to use as a provider-side dedupe key. */
  idempotencyKey: string;
}

export interface RecalculationExecution {
  cycle: RecalculationCycle;
  attempt: number;
  idempotencyKey: string;
  status: "succeeded" | "failed";
  durationMs: number;
  failureReason: string | null;
  timedOut: boolean;
}

export interface RecalculationCycleReport {
  restaurantId: string;
  operatingDate: string;
  evaluatedAt: string;
  /** Present unless the ledger could not be read. */
  schedule: RecalculationSchedule | null;
  executions: RecalculationExecution[];
  /** Dead-lettered cycles the application must show rather than swallow. */
  needsOperatorAttention: RecalculationDecision[];
  /** Set when scheduling itself failed; no cycle was dispatched. */
  scheduleError: string | null;
}

export async function runDueRecalculationCycles(input: {
  restaurantId: string;
  restaurantTimeZone: string;
  ports: RecalculationPorts;
  now?: Date;
  /** Injectable clock so attempt completion times are deterministic in tests. */
  clock?: () => Date;
}): Promise<RecalculationCycleReport> {
  const clock = input.clock ?? (() => new Date());
  const now = input.now instanceof Date && Number.isFinite(input.now.getTime()) ? input.now : clock();

  let schedule: RecalculationSchedule;
  try {
    const runs = await input.ports.loadRuns(input.restaurantId);
    schedule = buildRecalculationSchedule({
      restaurantId: input.restaurantId,
      restaurantTimeZone: input.restaurantTimeZone,
      runs: runs ?? [],
      now
    });
  } catch (error) {
    // Fail closed: an unreadable ledger must never be treated as "nothing due".
    return {
      restaurantId: input.restaurantId,
      operatingDate: "",
      evaluatedAt: now.toISOString(),
      schedule: null,
      executions: [],
      needsOperatorAttention: [],
      scheduleError: describeError(error)
    };
  }

  const executions: RecalculationExecution[] = [];
  // Cycles run in schedule order and are isolated: one failure never cancels
  // the cycles behind it.
  for (const decision of schedule.decisions) {
    if (decision.state !== "due" || !decision.attemptKey) continue;

    const startedAt = clock().getTime();
    let failureReason: string | null = null;
    let timedOut = false;

    try {
      await withTimeout(
        input.ports.runCycle(decision.cycle, {
          restaurantId: schedule.restaurantId,
          operatingDate: schedule.operatingDate,
          attempt: decision.attempt,
          idempotencyKey: decision.idempotencyKey
        }),
        decision.timeoutMs,
        `${decision.jobName} exceeded its ${decision.timeoutMs}ms timeout`
      );
    } catch (error) {
      failureReason = describeError(error);
      timedOut = error instanceof RecalculationTimeoutError;
    }

    const finishedAt = clock();
    const execution: RecalculationExecution = {
      cycle: decision.cycle,
      attempt: decision.attempt,
      idempotencyKey: decision.idempotencyKey,
      status: failureReason === null ? "succeeded" : "failed",
      durationMs: Math.max(0, finishedAt.getTime() - startedAt),
      failureReason,
      timedOut
    };
    executions.push(execution);

    try {
      await input.ports.recordRun({
        restaurantId: schedule.restaurantId,
        cycle: decision.cycle,
        operatingDate: schedule.operatingDate,
        status: execution.status,
        attempt: decision.attempt,
        completedAt: finishedAt.toISOString(),
        failureReason
      });
    } catch (error) {
      // A ledger write failure is itself operationally relevant. Surface it on
      // the execution instead of throwing away the attempt that already ran.
      execution.failureReason = execution.failureReason
        ? `${execution.failureReason}; run ledger write failed: ${describeError(error)}`
        : `Run ledger write failed: ${describeError(error)}`;
    }
  }

  return {
    restaurantId: schedule.restaurantId,
    operatingDate: schedule.operatingDate,
    evaluatedAt: schedule.evaluatedAt,
    schedule,
    executions,
    needsOperatorAttention: schedule.needsOperatorAttention,
    scheduleError: null
  };
}

/** Raised when a cycle outruns its budget, so the caller never guesses from text. */
export class RecalculationTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecalculationTimeoutError";
  }
}

export function withTimeout<T>(work: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return work;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RecalculationTimeoutError(message)), timeoutMs);
    // Never let a pending recalculation hold the process open.
    timer.unref?.();
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim().slice(0, 200);
  const text = typeof error === "string" ? error.trim() : "";
  return text.length > 0 ? text.slice(0, 200) : "Unknown recalculation failure";
}

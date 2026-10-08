import type { RestaurantTaskRequiredRole } from "./restaurantTasks";

/**
 * Section 26 "Background Jobs" scheduling brain for the three recalculation
 * cycles the operating loop depends on.
 *
 * This module is deliberately storage-agnostic and pure: it receives the run
 * ledger that has already been read for the restaurant and returns what should
 * happen now. That keeps idempotency, retry, backoff, dead-lettering, and
 * monitoring ownership decidable in one audited place instead of being spread
 * across callers.
 *
 * It never invents a run. A cycle that has no ledger evidence is reported as
 * never attempted rather than assumed healthy, and a dead-lettered cycle is
 * always surfaced to an operator instead of failing silently.
 */

export type RecalculationCycle = "daily_open" | "mid_shift" | "close";

export type RecalculationRunStatus = "succeeded" | "failed";

export type RecalculationDecisionState =
  | "due"
  | "waiting"
  | "satisfied"
  | "backoff"
  | "dead_lettered";

/** One previously recorded dispatch of a cycle. */
export interface RecalculationRunRecord {
  restaurantId: string;
  cycle: RecalculationCycle;
  /** Restaurant-local service day the run belonged to (YYYY-MM-DD). */
  operatingDate: string;
  status: RecalculationRunStatus;
  /** 1-based attempt number within the operating date. */
  attempt: number;
  /** ISO-8601 UTC instant the attempt finished. */
  completedAt: string;
  failureReason?: string | null;
}

export interface RecalculationDecision {
  cycle: RecalculationCycle;
  operatingDate: string;
  state: RecalculationDecisionState;
  /**
   * Stable identity of the unit of work. Retries reuse the same key so a
   * duplicate dispatch is deduplicated rather than recalculating twice.
   */
  idempotencyKey: string;
  /** Unique per dispatch, for at-most-once delivery of a single attempt. */
  attemptKey: string | null;
  /** Attempt number a dispatch right now would take. */
  attempt: number;
  maxAttempts: number;
  /** ISO instant the cycle window opens for this operating date. */
  windowOpensAt: string;
  /** ISO instant a dispatch becomes allowed, or null when it never will. */
  nextEligibleAt: string | null;
  timeoutMs: number;
  monitoringOwner: RestaurantTaskRequiredRole;
  jobName: string;
  /** True only when a human needs to intervene. */
  surfaceToOperator: boolean;
  reason: string;
  lastFailureReason: string | null;
}

export interface RecalculationSchedule {
  restaurantId: string;
  restaurantTimeZone: string;
  /** Restaurant-local service day, rolled at the 04:00 boundary. */
  operatingDate: string;
  evaluatedAt: string;
  decisions: RecalculationDecision[];
  dueCycles: RecalculationCycle[];
  needsOperatorAttention: RecalculationDecision[];
}

interface CycleDefinition {
  cycle: RecalculationCycle;
  /** Restaurant-local hour the window opens. */
  opensAtHour: number;
  monitoringOwner: RestaurantTaskRequiredRole;
  jobName: string;
  timeoutMs: number;
  label: string;
}

/**
 * Window hours mirror `phaseForHour` in `dailyPhaseBrief` so a cycle and the
 * narrative it feeds never disagree about which part of the day it is.
 */
const CYCLE_DEFINITIONS: readonly CycleDefinition[] = [
  {
    cycle: "daily_open",
    opensAtHour: 4,
    // The opening manager owns morning readiness, so they own its recalculation.
    monitoringOwner: "manager",
    jobName: "recalculation.daily_open",
    timeoutMs: 120_000,
    label: "the opening recalculation"
  },
  {
    cycle: "mid_shift",
    opensAtHour: 10,
    monitoringOwner: "manager",
    jobName: "recalculation.mid_shift",
    timeoutMs: 90_000,
    label: "the mid-shift recalculation"
  },
  {
    cycle: "close",
    opensAtHour: 17,
    // Closing reconciles spend, waste, and variance via differentiated close work.
    monitoringOwner: "owner_admin",
    jobName: "recalculation.close",
    timeoutMs: 180_000,
    label: "the closing recalculation"
  }
];

export const RECALCULATION_MAX_ATTEMPTS = 4;
const BACKOFF_BASE_MS = 120_000;
const BACKOFF_CEILING_MS = 1_800_000;
/** Local hour the service day rolls over; 00:00–03:59 belongs to the prior day. */
const SERVICE_DAY_ROLLOVER_HOUR = 4;

export function recalculationCycles(): readonly RecalculationCycle[] {
  return CYCLE_DEFINITIONS.map((definition) => definition.cycle);
}

/**
 * Ownership and budget for one cycle, so callers recording a run never
 * re-invent the mapping the scheduler already owns.
 */
export function recalculationCycleDefinition(cycle: RecalculationCycle): {
  cycle: RecalculationCycle;
  monitoringOwner: RestaurantTaskRequiredRole;
  jobName: string;
  timeoutMs: number;
} {
  const definition = CYCLE_DEFINITIONS.find((entry) => entry.cycle === cycle);
  if (!definition) throw new Error("Unknown recalculation cycle.");
  return {
    cycle: definition.cycle,
    monitoringOwner: definition.monitoringOwner,
    jobName: definition.jobName,
    timeoutMs: definition.timeoutMs
  };
}

/**
 * Exponential backoff after a failed attempt, capped so a struggling cycle is
 * still retried within the same service day.
 */
export function recalculationBackoffMs(failedAttempt: number): number {
  const normalized = Number.isFinite(failedAttempt) ? Math.max(1, Math.floor(failedAttempt)) : 1;
  return Math.min(BACKOFF_CEILING_MS, BACKOFF_BASE_MS * 2 ** (normalized - 1));
}

export function buildRecalculationSchedule(input: {
  restaurantId: string;
  restaurantTimeZone: string;
  runs: readonly RecalculationRunRecord[];
  now?: Date;
}): RecalculationSchedule {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("Recalculation scheduling requires a restaurant.");
  const timeZone = input.restaurantTimeZone.trim();
  if (!timeZone) throw new Error("Recalculation scheduling requires a restaurant timezone.");
  for (const run of input.runs) {
    if (run.restaurantId !== restaurantId) {
      throw new Error("Recalculation scheduling received a cross-restaurant run record.");
    }
  }

  const now =
    input.now instanceof Date && Number.isFinite(input.now.getTime()) ? input.now : new Date();
  const operatingDate = serviceDayInTimeZone(now, timeZone);

  // History from other service days is retained upstream but never decides today.
  const todaysRuns = input.runs.filter((run) => run.operatingDate === operatingDate);

  const decisions = CYCLE_DEFINITIONS.map((definition) =>
    decideCycle(definition, {
      restaurantId,
      timeZone,
      operatingDate,
      now,
      runs: todaysRuns.filter((run) => run.cycle === definition.cycle)
    })
  );

  return {
    restaurantId,
    restaurantTimeZone: timeZone,
    operatingDate,
    evaluatedAt: now.toISOString(),
    decisions,
    dueCycles: decisions
      .filter((decision) => decision.state === "due")
      .map((decision) => decision.cycle),
    needsOperatorAttention: decisions.filter((decision) => decision.surfaceToOperator)
  };
}

function decideCycle(
  definition: CycleDefinition,
  context: {
    restaurantId: string;
    timeZone: string;
    operatingDate: string;
    now: Date;
    runs: readonly RecalculationRunRecord[];
  }
): RecalculationDecision {
  const { operatingDate, now, timeZone } = context;
  const idempotencyKey = `recalc:${context.restaurantId}:${operatingDate}:${definition.cycle}`;
  const windowOpensAt = zonedHourToInstant(operatingDate, definition.opensAtHour, timeZone);
  const base = {
    cycle: definition.cycle,
    operatingDate,
    idempotencyKey,
    maxAttempts: RECALCULATION_MAX_ATTEMPTS,
    windowOpensAt,
    timeoutMs: definition.timeoutMs,
    monitoringOwner: definition.monitoringOwner,
    jobName: definition.jobName
  };

  const succeeded = context.runs.find((run) => run.status === "succeeded") ?? null;
  const failures = context.runs
    .filter((run) => run.status === "failed")
    .slice()
    .sort((left, right) => left.attempt - right.attempt);
  const lastFailure = failures.length > 0 ? failures[failures.length - 1] : null;
  const lastFailureReason = normalizeFailureReason(lastFailure?.failureReason);
  const attemptsUsed = context.runs.reduce(
    (highest, run) => Math.max(highest, Number.isFinite(run.attempt) ? Math.floor(run.attempt) : 0),
    0
  );
  const nextAttempt = attemptsUsed + 1;

  // A completed cycle is never recalculated for the same service day.
  if (succeeded) {
    return {
      ...base,
      state: "satisfied",
      attemptKey: null,
      attempt: attemptsUsed,
      nextEligibleAt: null,
      surfaceToOperator: false,
      reason: `${capitalize(definition.label)} already succeeded for this operating day on attempt ${succeeded.attempt}.`,
      lastFailureReason
    };
  }

  if (attemptsUsed >= RECALCULATION_MAX_ATTEMPTS) {
    return {
      ...base,
      state: "dead_lettered",
      attemptKey: null,
      attempt: attemptsUsed,
      nextEligibleAt: null,
      // Section 26: never hide a background-job failure from the operator.
      surfaceToOperator: true,
      reason: `${capitalize(definition.label)} failed ${attemptsUsed} times and stopped retrying. ${
        lastFailureReason ?? "No failure reason was recorded."
      } A ${ownerLabel(definition.monitoringOwner)} needs to review it.`,
      lastFailureReason
    };
  }

  if (now.getTime() < Date.parse(windowOpensAt)) {
    return {
      ...base,
      state: "waiting",
      attemptKey: null,
      attempt: nextAttempt,
      nextEligibleAt: windowOpensAt,
      surfaceToOperator: false,
      reason: `${capitalize(definition.label)} opens at ${formatLocalHour(definition.opensAtHour)} restaurant time.`,
      lastFailureReason
    };
  }

  if (lastFailure) {
    const failedAt = Date.parse(lastFailure.completedAt);
    const retryAt = Number.isFinite(failedAt)
      ? new Date(failedAt + recalculationBackoffMs(lastFailure.attempt)).toISOString()
      : windowOpensAt;
    if (now.getTime() < Date.parse(retryAt)) {
      return {
        ...base,
        state: "backoff",
        attemptKey: null,
        attempt: nextAttempt,
        nextEligibleAt: retryAt,
        surfaceToOperator: false,
        reason: `Attempt ${lastFailure.attempt} of ${definition.label} failed and the next retry is held until backoff elapses. ${
          lastFailureReason ?? "No failure reason was recorded."
        }`,
        lastFailureReason
      };
    }
  }

  return {
    ...base,
    state: "due",
    attemptKey: `${idempotencyKey}:attempt-${nextAttempt}`,
    attempt: nextAttempt,
    nextEligibleAt: now.toISOString(),
    surfaceToOperator: false,
    reason: lastFailure
      ? `Retrying ${definition.label} as attempt ${nextAttempt} of ${RECALCULATION_MAX_ATTEMPTS}.`
      : `${capitalize(definition.label)} is due for this operating day.`,
    lastFailureReason
  };
}

/**
 * Restaurant-local service day. The 04:00 rollover keeps a late close recorded
 * against the day it belongs to instead of the calendar day after midnight.
 */
export function serviceDayInTimeZone(now: Date, timeZone: string): string {
  const shifted = new Date(now.getTime() - SERVICE_DAY_ROLLOVER_HOUR * 3_600_000);
  return localDateInTimeZone(shifted, timeZone);
}

function localDateInTimeZone(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  if (!parts) return date.toISOString().slice(0, 10);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Converts an operating date plus a restaurant-local hour into a UTC instant. */
function zonedHourToInstant(operatingDate: string, hour: number, timeZone: string): string {
  const naive = Date.parse(`${operatingDate}T${pad(hour)}:00:00.000Z`);
  if (!Number.isFinite(naive)) return new Date(0).toISOString();
  // Resolve the offset twice so a DST transition on the target day converges.
  const firstPass = naive - zoneOffsetMs(new Date(naive), timeZone);
  const corrected = naive - zoneOffsetMs(new Date(firstPass), timeZone);
  return new Date(corrected).toISOString();
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  if (!parts) return 0;
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - date.getTime();
}

function zonedParts(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).formatToParts(date);
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const resolved = {
      year: read("year"),
      month: read("month"),
      day: read("day"),
      hour: read("hour"),
      minute: read("minute"),
      second: read("second")
    };
    if (Object.values(resolved).some((value) => !Number.isFinite(value))) return null;
    return resolved;
  } catch {
    // Invalid timezones fall back to UTC rather than throwing mid-schedule.
    return null;
  }
}

function normalizeFailureReason(reason: string | null | undefined): string | null {
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  return trimmed.length > 0 ? trimmed.slice(0, 200) : null;
}

function ownerLabel(role: RestaurantTaskRequiredRole): string {
  if (role === "owner_admin") return "owner or admin";
  if (role === "manager") return "manager";
  return "team member";
}

function formatLocalHour(hour: number): string {
  return `${pad(hour)}:00`;
}

function pad(value: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(2, "0");
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

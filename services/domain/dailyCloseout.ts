import { hourInTimeZone } from "./operatingPlan";

export type DailyCloseoutPhase = "progress" | "closing" | "complete";

export interface DailyCloseoutInput {
  operatingDate: string;
  restaurantTimeZone: string;
  completedTasks: number;
  openTasks: number;
  operatorTasksOpen?: number;
  inventoryAlerts?: number;
  pendingRecommendations?: number;
  now?: Date;
  closingHour?: number;
  rolloverHour?: number;
}

export interface DailyCloseoutSummary {
  operatingDate: string;
  phase: DailyCloseoutPhase;
  shouldShow: boolean;
  completedTasks: number;
  remainingTasks: number;
  totalTasks: number;
  completionRate: number;
  attentionItems: number;
}

/**
 * Pure restaurant-local closeout policy. It never invents outcomes: praise is
 * shown only after evidenced completion or during the restaurant's closeout
 * window, and every displayed count comes from tenant-scoped report inputs.
 */
export function buildDailyCloseoutSummary(input: DailyCloseoutInput): DailyCloseoutSummary {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.operatingDate)) {
    throw new Error("Daily closeout requires a valid operating date.");
  }
  if (!input.restaurantTimeZone.trim()) {
    throw new Error("Daily closeout requires a restaurant timezone.");
  }

  const completedTasks = boundedCount(input.completedTasks);
  const remainingTasks =
    boundedCount(input.openTasks) + boundedCount(input.operatorTasksOpen ?? 0);
  const totalTasks = completedTasks + remainingTasks;
  const attentionItems =
    boundedCount(input.inventoryAlerts ?? 0) +
    boundedCount(input.pendingRecommendations ?? 0);
  const completionRate = totalTasks === 0 ? 0 : completedTasks / totalTasks;

  const now = input.now instanceof Date && Number.isFinite(input.now.getTime())
    ? input.now
    : new Date();
  const closingHour = boundedHour(input.closingHour, 20);
  const rolloverHour = boundedHour(input.rolloverHour, 4);
  const localHour = hourInTimeZone(now, input.restaurantTimeZone);
  const isClosingWindow = localHour >= closingHour || localHour < rolloverHour;
  const phase: DailyCloseoutPhase =
    totalTasks > 0 && completedTasks > 0 && remainingTasks === 0
      ? "complete"
      : isClosingWindow
        ? "closing"
        : "progress";

  return {
    operatingDate: input.operatingDate,
    phase,
    shouldShow: completedTasks > 0 || phase !== "progress",
    completedTasks,
    remainingTasks,
    totalTasks,
    completionRate,
    attentionItems
  };
}

function boundedCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function boundedHour(value: number | undefined, fallback: number) {
  return Number.isInteger(value) && value! >= 0 && value! <= 23 ? value! : fallback;
}

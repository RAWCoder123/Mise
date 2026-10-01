import type { MessageKey } from "../../i18n/catalog";

/**
 * Known Daily Report manager-advice title/detail templates emitted by
 * `rankManagerActions` / `buildTodaySummary`. Only these exact English forms
 * are localized; anything else is shown as-is so the UI never invents facts.
 */

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

const STOCK_RISK_TITLE_RE = /^(\d+) stock items? need attention$/;
const PENDING_ORDERS_TITLE_RE = /^(\d+) order recommendations? waiting$/;
const OPEN_WORK_TITLE_RE = /^(\d+) open tasks? still on the board$/;
const INVENTORY_ALERTS_TITLE_RE = /^(\d+) inventory alerts need review$/;
const STABLE_TITLE_RE = /^(.+) looks stable$/;
const PREPARED_ITEMS_DETAIL_RE = /^Mise prepared (\d+) items? for supplier review\.$/;

const EXACT_TITLES = {
  "Closeout looks clear": "dailyReport.advice.allClear.title",
  "Suggested order is ready to approve": "dailyReport.advice.suggestedOrder.title"
} as const satisfies Record<string, MessageKey>;

const EXACT_DETAILS = {
  "Review critical and low projected coverage before the next service.":
    "dailyReport.advice.stockRisk.detail",
  "Approve or dismiss pending purchase recommendations.":
    "dailyReport.advice.pendingOrders.detail",
  "Close out workflow and operator tasks before leaving.":
    "dailyReport.advice.openWork.detail",
  "No urgent stock, order, or task blockers for this operating day.":
    "dailyReport.advice.allClear.detail",
  "Mise found stock counts that may need a count update or supplier order.":
    "dailyReport.advice.inventoryAlerts.detail",
  "Approve only what you want sent or copied today.":
    "dailyReport.advice.suggestedOrder.detail",
  "No supplier action needed right now.": "dailyReport.advice.stable.detail",
  "Coverage is based on current counts and recent sales.":
    "dailyReport.advice.inventoryAlerts.context"
} as const satisfies Record<string, MessageKey>;

function parseCountMatch(re: RegExp, value: string): number | null {
  const match = re.exec(value.trim());
  if (!match) return null;
  const count = Number(match[1]);
  if (!Number.isFinite(count) || count < 0 || !Number.isInteger(count)) return null;
  return count;
}

function pluralKey(base: string, count: number): MessageKey {
  return (count === 1 ? `${base}.one` : `${base}.other`) as MessageKey;
}

export function presentManagerAdviceTitle(title: string, t: Translate): string {
  const trimmed = title.trim();
  if (!trimmed) return "—";

  const stockRisk = parseCountMatch(STOCK_RISK_TITLE_RE, trimmed);
  if (stockRisk != null) {
    return t(pluralKey("dailyReport.advice.stockRisk.title", stockRisk), { count: stockRisk });
  }

  const pendingOrders = parseCountMatch(PENDING_ORDERS_TITLE_RE, trimmed);
  if (pendingOrders != null) {
    return t(pluralKey("dailyReport.advice.pendingOrders.title", pendingOrders), {
      count: pendingOrders
    });
  }

  const openWork = parseCountMatch(OPEN_WORK_TITLE_RE, trimmed);
  if (openWork != null) {
    return t(pluralKey("dailyReport.advice.openWork.title", openWork), { count: openWork });
  }

  const inventoryAlerts = parseCountMatch(INVENTORY_ALERTS_TITLE_RE, trimmed);
  if (inventoryAlerts != null) {
    return t(pluralKey("dailyReport.advice.inventoryAlerts.title", inventoryAlerts), {
      count: inventoryAlerts
    });
  }

  if (Object.prototype.hasOwnProperty.call(EXACT_TITLES, trimmed)) {
    return t(EXACT_TITLES[trimmed as keyof typeof EXACT_TITLES]);
  }

  const stable = STABLE_TITLE_RE.exec(trimmed);
  if (stable?.[1]) {
    return t("dailyReport.advice.stable.title", { item: stable[1] });
  }

  return trimmed;
}

export function presentManagerAdviceDetail(detail: string, t: Translate): string {
  const trimmed = detail.trim();
  if (!trimmed) return "—";

  const prepared = parseCountMatch(PREPARED_ITEMS_DETAIL_RE, trimmed);
  if (prepared != null) {
    return t(pluralKey("dailyReport.advice.suggestedOrder.prepared", prepared), {
      count: prepared
    });
  }

  if (Object.prototype.hasOwnProperty.call(EXACT_DETAILS, trimmed)) {
    return t(EXACT_DETAILS[trimmed as keyof typeof EXACT_DETAILS]);
  }

  return trimmed;
}

import type { AppLocale, MessageKey, MessageValues } from "../../i18n/catalog";
import type { AttentionCard, Insight, PosSale, Restaurant } from "../../types/mise";
import type { OperationalTodayTask } from "../domain/todayTasks";
import { presentInsight, presentOperationalTodayTask } from "../presentation/operationsPresentation";

export type AskMiseIntent = "priorities" | "stock" | "orders" | "sales" | "briefing" | "prep" | "waste" | "general";

type Translator = (key: MessageKey, values?: MessageValues) => string;

export interface AskMiseHelpers {
  formatCompactCurrency: (value: number, currency?: string) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  locale: AppLocale;
  t: Translator;
}

/** Restaurant command-center facts Ask Mise reasons over. */
export interface AskMiseRestaurantContext {
  restaurantName: string;
  miseStatus: string;
  salesToday: number;
  itemsSold: number;
  topItems: readonly Pick<PosSale, "item_name">[];
  pendingRecommendations: number;
  importantInsight: Insight | null;
  attentionCards: readonly AttentionCard[];
  inventoryHealth: {
    low: number;
    critical: number;
  };
  operationalTasks: readonly OperationalTodayTask[];
  restaurantCurrency: string;
}

export interface AskMiseInput {
  question: string;
  restaurant: Pick<Restaurant, "name" | "cuisine_type" | "service_style" | "timezone" | "currency">;
  summary: AskMiseRestaurantContext;
  insights: readonly Insight[];
  helpers: AskMiseHelpers;
}

export interface AskMiseReply {
  intent: AskMiseIntent;
  /** Localized analysis steps shown while Mise “thinks.” */
  thinkingSteps: string[];
  answer: string;
  showPriorities: boolean;
  priorities: OperationalTodayTask[];
}

const stockKeywords = /stock|low|inventory|inventario|existencias|bajo|par|count|库存|盘点|短缺/;
const orderKeywords = /order|supplier|pedido|proveedor|draft|reorder|订货|订单|供应商/;
const salesKeywords = /sales|revenue|venta|ingreso|sold|cover|销售|营收|营业额/;
const priorityKeywords = /priorit|prioridad|focus|urgent|today|hoy|优先|今天|今日/;
const briefingKeywords = /brief|status|overview|summary|how.*(we|we'?re|restaurant)|resumen|estado|概况|简报/;
const prepKeywords = /prep|mise en place|line|batch|prep list|preparaci[oó]n|备餐|开餐前/;
const wasteKeywords = /waste|spoil|overstock|excess|desperdicio|exceso|损耗|积压|过期/;

const PREP_BLOCKING_ACTION_INTENTS = new Set<OperationalTodayTask["action"]["intent"]>([
  "begin_inventory_count_session",
  "continue_inventory_count_session",
  "update_inventory_count"
]);

/**
 * Today count and low-stock count tasks that must be finished before Mise can
 * honestly claim prep is clear from sellers/stock alone.
 */
export function isPrepBlockingTodayTask(task: OperationalTodayTask): boolean {
  if (task.status !== "open") return false;
  if (PREP_BLOCKING_ACTION_INTENTS.has(task.action.intent)) return true;
  if (task.action.intent === "review_insight" && task.presentation?.code === "today.insight.review") {
    const insightType = task.presentation.values.insightType;
    return insightType === "prep" || insightType === "sales";
  }
  return false;
}

/** Classify a manager question against operational intents. */
export function classifyAskMiseIntent(question: string): AskMiseIntent {
  const normalized = question.trim().toLowerCase();
  if (!normalized) return "general";
  if (prepKeywords.test(normalized)) return "prep";
  if (wasteKeywords.test(normalized)) return "waste";
  if (stockKeywords.test(normalized)) return "stock";
  if (orderKeywords.test(normalized)) return "orders";
  if (salesKeywords.test(normalized)) return "sales";
  if (priorityKeywords.test(normalized)) return "priorities";
  if (briefingKeywords.test(normalized)) return "briefing";
  return "general";
}

/**
 * Reason over the restaurant’s live command-center context and produce a
 * grounded reply plus the analysis steps used to reach it.
 */
export function answerAskMise(input: AskMiseInput): AskMiseReply {
  const { helpers, restaurant, summary, insights } = input;
  const { t } = helpers;
  const intent = classifyAskMiseIntent(input.question);
  const openTasks = summary.operationalTasks.filter((task) => task.status === "open");
  const priorities = openTasks.slice(0, 3);
  const stockRisk = summary.inventoryHealth.low + summary.inventoryHealth.critical;
  const topInsight = insights[0] ?? summary.importantInsight;
  const presentedInsight = topInsight ? presentInsight(helpers.locale, topInsight) : null;
  const prepInsights = insights.filter((insight) => insight.insight_type === "prep" || insight.insight_type === "sales");
  const wasteInsights = insights.filter((insight) => insight.insight_type === "waste");
  const attentionTitles = summary.attentionCards.slice(0, 3).map((card) => card.title);
  const topTaskTitles = priorities.map((task) => presentOperationalTodayTask(helpers.locale, task).title);
  const topSale = summary.topItems[0]?.item_name?.trim() || null;

  const prepBlockingTasks = openTasks.filter(isPrepBlockingTodayTask);
  const thinkingSteps = buildThinkingSteps({
    intent,
    restaurantName: restaurant.name,
    openTaskCount: openTasks.length,
    prepBlockingTaskCount: prepBlockingTasks.length,
    stockRisk,
    pendingRecommendations: summary.pendingRecommendations,
    salesToday: summary.salesToday,
    currency: summary.restaurantCurrency,
    helpers
  });

  switch (intent) {
    case "stock": {
      const answer =
        stockRisk > 0
          ? [
              t(stockRisk === 1 ? "ask.answer.stock.one" : "ask.answer.stock.other", {
                count: helpers.formatNumber(stockRisk)
              }),
              attentionTitles.length > 0
                ? t("ask.answer.stock.named", { items: attentionTitles.join("; ") })
                : null,
              summary.pendingRecommendations > 0
                ? t(
                    summary.pendingRecommendations === 1
                      ? "ask.answer.stock.orders.one"
                      : "ask.answer.stock.orders.other",
                    { count: helpers.formatNumber(summary.pendingRecommendations) }
                  )
                : t("ask.answer.stock.next")
            ]
              .filter(Boolean)
              .join(" ")
          : t("ask.answer.stockClear");
      return {
        intent,
        thinkingSteps,
        answer,
        showPriorities: false,
        priorities: []
      };
    }
    case "orders": {
      const answer =
        summary.pendingRecommendations > 0
          ? [
              t(
                summary.pendingRecommendations === 1 ? "ask.answer.orders.one" : "ask.answer.orders.other",
                { count: helpers.formatNumber(summary.pendingRecommendations) }
              ),
              attentionTitles.length > 0
                ? t("ask.answer.orders.named", { items: attentionTitles.join("; ") })
                : null
            ]
              .filter(Boolean)
              .join(" ")
          : t("ask.answer.ordersClear");
      return {
        intent,
        thinkingSteps,
        answer,
        showPriorities: false,
        priorities: []
      };
    }
    case "sales": {
      const answer = [
        t("ask.answer.sales", {
          sales: helpers.formatCompactCurrency(summary.salesToday, summary.restaurantCurrency),
          count: helpers.formatNumber(summary.itemsSold)
        }),
        topSale ? t("ask.answer.sales.topItem", { item: topSale }) : null,
        presentedInsight && presentedInsight.title
          ? t("ask.answer.sales.insight", { insight: presentedInsight.title })
          : null
      ]
        .filter(Boolean)
        .join(" ");
      return {
        intent,
        thinkingSteps,
        answer,
        showPriorities: false,
        priorities: []
      };
    }
    case "priorities": {
      if (priorities.length === 0) {
        return {
          intent,
          thinkingSteps,
          answer: t("ask.answer.fallback"),
          showPriorities: false,
          priorities: []
        };
      }
      const insightTail = presentedInsight
        ? t("ask.answer.prioritiesInsight", { insight: presentedInsight.title })
        : t("ask.answer.prioritiesNoInsight");
      return {
        intent,
        thinkingSteps,
        answer: `${t("ask.answer.prioritiesLead")} ${insightTail}`,
        showPriorities: true,
        priorities
      };
    }
    case "briefing": {
      const answer = [
        t("ask.answer.briefing.lead", {
          restaurant: restaurant.name,
          status: summary.miseStatus
        }),
        t("ask.answer.briefing.board", {
          tasks: helpers.formatNumber(openTasks.length),
          stock: helpers.formatNumber(stockRisk),
          orders: helpers.formatNumber(summary.pendingRecommendations),
          sales: helpers.formatCompactCurrency(summary.salesToday, summary.restaurantCurrency)
        }),
        topTaskTitles.length > 0
          ? t("ask.answer.briefing.focus", { tasks: topTaskTitles.join("; ") })
          : t("ask.answer.fallback"),
        presentedInsight
          ? t("ask.answer.prioritiesInsight", { insight: presentedInsight.title })
          : null
      ]
        .filter(Boolean)
        .join(" ");
      return {
        intent,
        thinkingSteps,
        answer,
        showPriorities: priorities.length > 0,
        priorities
      };
    }
    case "prep": {
      const prepTitles = prepInsights
        .slice(0, 3)
        .map((insight) => presentInsight(helpers.locale, insight).title);
      const prepTaskPriorities = prepBlockingTasks.slice(0, 3);
      const prepTaskTitles = prepTaskPriorities.map(
        (task) => presentOperationalTodayTask(helpers.locale, task).title
      );
      const answerParts: string[] = [];
      if (prepTaskTitles.length > 0) {
        answerParts.push(
          t("ask.answer.prep.tasks.lead"),
          t("ask.answer.prep.tasks.named", { items: prepTaskTitles.join("; ") }),
          t("ask.answer.prep.tasks.next")
        );
      }
      if (prepTitles.length > 0) {
        if (answerParts.length === 0) {
          answerParts.push(t("ask.answer.prep.lead"));
        }
        answerParts.push(t("ask.answer.prep.named", { items: prepTitles.join("; ") }));
        if (prepTaskTitles.length === 0) {
          answerParts.push(t("ask.answer.prep.next"));
        }
      }
      const answer =
        answerParts.length > 0 ? answerParts.join(" ") : t("ask.answer.prep.clear");
      const replyPriorities =
        prepTaskPriorities.length > 0 ? prepTaskPriorities : priorities;
      return {
        intent,
        thinkingSteps,
        answer,
        showPriorities: replyPriorities.length > 0,
        priorities: replyPriorities
      };
    }
    case "waste": {
      const wasteTitles = wasteInsights
        .slice(0, 3)
        .map((insight) => presentInsight(helpers.locale, insight).title);
      const answer =
        wasteTitles.length > 0
          ? [
              t("ask.answer.waste.lead"),
              t("ask.answer.waste.named", { items: wasteTitles.join("; ") }),
              t("ask.answer.waste.next")
            ].join(" ")
          : t("ask.answer.waste.clear");
      return {
        intent,
        thinkingSteps,
        answer,
        showPriorities: false,
        priorities: []
      };
    }
    case "general":
    default: {
      if (openTasks.length > 0 || stockRisk > 0 || summary.pendingRecommendations > 0) {
        const lead =
          openTasks.length > 0
            ? t("ask.answer.general.tasks", {
                count: helpers.formatNumber(openTasks.length),
                tasks: topTaskTitles.slice(0, 2).join("; ") || t("ask.answer.general.tasksFallback")
              })
            : stockRisk > 0
              ? t(stockRisk === 1 ? "ask.answer.stock.one" : "ask.answer.stock.other", {
                  count: helpers.formatNumber(stockRisk)
                })
              : t(
                  summary.pendingRecommendations === 1 ? "ask.answer.orders.one" : "ask.answer.orders.other",
                  { count: helpers.formatNumber(summary.pendingRecommendations) }
                );
        return {
          intent: "general",
          thinkingSteps,
          answer: `${lead} ${t("ask.answer.general.steer")}`,
          showPriorities: priorities.length > 0,
          priorities
        };
      }
      return {
        intent: "general",
        thinkingSteps,
        answer: t("ask.answer.fallback"),
        showPriorities: false,
        priorities: []
      };
    }
  }
}

function buildThinkingSteps(input: {
  intent: AskMiseIntent;
  restaurantName: string;
  openTaskCount: number;
  prepBlockingTaskCount: number;
  stockRisk: number;
  pendingRecommendations: number;
  salesToday: number;
  currency: string;
  helpers: AskMiseHelpers;
}): string[] {
  const { helpers, intent } = input;
  const { t } = helpers;
  const steps = [
    t("ask.thinking.restaurant", { restaurant: input.restaurantName }),
    t("ask.thinking.board", {
      tasks: helpers.formatNumber(input.openTaskCount),
      stock: helpers.formatNumber(input.stockRisk),
      orders: helpers.formatNumber(input.pendingRecommendations)
    })
  ];

  if (intent === "stock" || intent === "prep" || intent === "waste" || intent === "briefing" || intent === "general") {
    steps.push(
      input.stockRisk > 0
        ? t("ask.thinking.stock.risk", { count: helpers.formatNumber(input.stockRisk) })
        : t("ask.thinking.stock.clear")
    );
  }
  if (intent === "prep") {
    steps.push(
      input.prepBlockingTaskCount > 0
        ? t("ask.thinking.prep.tasks", {
            count: helpers.formatNumber(input.prepBlockingTaskCount)
          })
        : t("ask.thinking.prep.clear")
    );
  }
  if (intent === "orders" || intent === "briefing") {
    steps.push(
      input.pendingRecommendations > 0
        ? t("ask.thinking.orders.pending", {
            count: helpers.formatNumber(input.pendingRecommendations)
          })
        : t("ask.thinking.orders.clear")
    );
  }
  if (intent === "sales" || intent === "briefing") {
    steps.push(
      t("ask.thinking.sales", {
        sales: helpers.formatCompactCurrency(input.salesToday, input.currency)
      })
    );
  }
  if (intent === "priorities" || intent === "general" || intent === "briefing") {
    steps.push(
      input.openTaskCount > 0
        ? t("ask.thinking.priorities", { count: helpers.formatNumber(input.openTaskCount) })
        : t("ask.thinking.priorities.clear")
    );
  }

  steps.push(t("ask.thinking.compose"));
  return steps;
}

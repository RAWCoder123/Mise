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
    /** Optional for older fixtures; treat missing as 0. */
    watch?: number;
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
  const watchCount = summary.inventoryHealth.watch ?? 0;
  const topInsight = insights[0] ?? summary.importantInsight;
  const presentedInsight = topInsight ? presentInsight(helpers.locale, topInsight) : null;
  const prepInsights = insights.filter((insight) => insight.insight_type === "prep" || insight.insight_type === "sales");
  const wasteInsights = insights.filter((insight) => insight.insight_type === "waste");
  const attentionTitles = summary.attentionCards.slice(0, 3).map((card) => card.title);
  const topTaskTitles = priorities.map((task) => presentOperationalTodayTask(helpers.locale, task).title);
  const topSale = summary.topItems[0]?.item_name?.trim() || null;
  const watchCountTasks = openTasks.filter(isOpenWatchCountTask);
  const posSalesTasks = openTasks.filter(isOpenPosSalesTask);

  const thinkingSteps = buildThinkingSteps({
    intent,
    restaurantName: restaurant.name,
    openTaskCount: openTasks.length,
    stockRisk,
    watchCount,
    pendingRecommendations: summary.pendingRecommendations,
    salesToday: summary.salesToday,
    currency: summary.restaurantCurrency,
    posSalesTaskCount: posSalesTasks.length,
    helpers
  });

  switch (intent) {
    case "stock": {
      if (stockRisk > 0) {
        const answer = [
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
          .join(" ");
        return {
          intent,
          thinkingSteps,
          answer,
          showPriorities: false,
          priorities: []
        };
      }

      if (watchCount > 0) {
        const watchPriorities = preferWatchCountTasks(openTasks, watchCountTasks).slice(0, 3);
        const watchTitles = watchCountTasks
          .slice(0, 3)
          .map((task) => presentOperationalTodayTask(helpers.locale, task).title);
        const namedItems =
          watchTitles.length > 0
            ? watchTitles.join("; ")
            : attentionTitles.length > 0
              ? attentionTitles.join("; ")
              : null;
        const answer = [
          t(watchCount === 1 ? "ask.answer.stock.watch.one" : "ask.answer.stock.watch.other", {
            count: helpers.formatNumber(watchCount)
          }),
          namedItems ? t("ask.answer.stock.watch.named", { items: namedItems }) : null,
          t("ask.answer.stock.watch.next")
        ]
          .filter(Boolean)
          .join(" ");
        return {
          intent,
          thinkingSteps,
          answer,
          showPriorities: watchPriorities.length > 0,
          priorities: watchPriorities
        };
      }

      return {
        intent,
        thinkingSteps,
        answer: t("ask.answer.stockClear"),
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
      if (posSalesTasks.length > 0) {
        const posPriorities = preferPosSalesTasks(openTasks, posSalesTasks).slice(0, 3);
        const posTitles = posSalesTasks
          .slice(0, 3)
          .map((task) => presentOperationalTodayTask(helpers.locale, task).title);
        const hasObservedSales = summary.salesToday > 0 || summary.itemsSold > 0;
        const answer = [
          t(
            posSalesTasks.length === 1 ? "ask.answer.sales.pos.one" : "ask.answer.sales.pos.other",
            { count: helpers.formatNumber(posSalesTasks.length) }
          ),
          posTitles.length > 0
            ? t("ask.answer.sales.pos.named", { items: posTitles.join("; ") })
            : null,
          hasObservedSales
            ? t("ask.answer.sales.pos.provisional", {
                sales: helpers.formatCompactCurrency(summary.salesToday, summary.restaurantCurrency),
                count: helpers.formatNumber(summary.itemsSold)
              })
            : t("ask.answer.sales.pos.unavailable"),
          t("ask.answer.sales.pos.next")
        ]
          .filter(Boolean)
          .join(" ");
        return {
          intent,
          thinkingSteps,
          answer,
          showPriorities: posPriorities.length > 0,
          priorities: posPriorities
        };
      }

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
      const hasObservedSales = summary.salesToday > 0 || summary.itemsSold > 0;
      const watchOnlyStock = stockRisk === 0 && watchCount > 0;
      const salesUntrusted = posSalesTasks.length > 0;
      const useTrustedBoard = !watchOnlyStock && !salesUntrusted;

      let briefingOrdered = openTasks;
      if (watchOnlyStock) {
        briefingOrdered = preferWatchCountTasks(briefingOrdered, watchCountTasks);
      }
      if (salesUntrusted) {
        briefingOrdered = preferPosSalesTasks(briefingOrdered, posSalesTasks);
      }
      const briefingPriorities = briefingOrdered.slice(0, 3);
      const briefingFocusTitles = briefingPriorities.map(
        (task) => presentOperationalTodayTask(helpers.locale, task).title
      );

      const stockLine = stockRisk > 0
        ? t("ask.answer.briefing.stock.risk", {
            count: helpers.formatNumber(stockRisk)
          })
        : watchOnlyStock
          ? t(
              watchCount === 1
                ? "ask.answer.briefing.stock.watch.one"
                : "ask.answer.briefing.stock.watch.other",
              { count: helpers.formatNumber(watchCount) }
            )
          : t("ask.answer.briefing.stock.clear");

      const salesLine = salesUntrusted
        ? hasObservedSales
          ? t("ask.answer.briefing.sales.pos.provisional", {
              sales: helpers.formatCompactCurrency(summary.salesToday, summary.restaurantCurrency),
              count: helpers.formatNumber(summary.itemsSold)
            })
          : t("ask.answer.briefing.sales.pos.unavailable")
        : t("ask.answer.briefing.sales", {
            sales: helpers.formatCompactCurrency(summary.salesToday, summary.restaurantCurrency)
          });

      const board = useTrustedBoard
        ? t("ask.answer.briefing.board", {
            tasks: helpers.formatNumber(openTasks.length),
            stock: helpers.formatNumber(stockRisk),
            orders: helpers.formatNumber(summary.pendingRecommendations),
            sales: helpers.formatCompactCurrency(summary.salesToday, summary.restaurantCurrency)
          })
        : [
            t("ask.answer.briefing.board.core", {
              tasks: helpers.formatNumber(openTasks.length),
              orders: helpers.formatNumber(summary.pendingRecommendations)
            }),
            stockLine,
            salesLine
          ].join(" ");

      const answer = [
        t("ask.answer.briefing.lead", {
          restaurant: restaurant.name,
          status: summary.miseStatus
        }),
        board,
        briefingFocusTitles.length > 0
          ? t("ask.answer.briefing.focus", { tasks: briefingFocusTitles.join("; ") })
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
        showPriorities: briefingPriorities.length > 0,
        priorities: briefingPriorities
      };
    }
    case "prep": {
      const prepTitles = prepInsights
        .slice(0, 3)
        .map((insight) => presentInsight(helpers.locale, insight).title);
      const answer =
        prepTitles.length > 0
          ? [
              t("ask.answer.prep.lead"),
              t("ask.answer.prep.named", { items: prepTitles.join("; ") }),
              t("ask.answer.prep.next")
            ].join(" ")
          : t("ask.answer.prep.clear");
      return {
        intent,
        thinkingSteps,
        answer,
        showPriorities: priorities.length > 0,
        priorities
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

function isOpenWatchCountTask(task: OperationalTodayTask): boolean {
  return (
    task.status === "open" &&
    task.source.kind === "inventory" &&
    String(task.source.status).toLowerCase() === "watch"
  );
}

function isOpenPosSalesTask(task: OperationalTodayTask): boolean {
  if (task.status !== "open") return false;
  const intent = task.action.intent;
  return (
    intent === "connect_pos" ||
    intent === "manage_pos_connection" ||
    intent === "repair_pos_connection"
  );
}

function preferWatchCountTasks(
  openTasks: readonly OperationalTodayTask[],
  watchTasks: readonly OperationalTodayTask[]
): OperationalTodayTask[] {
  if (watchTasks.length === 0) return [...openTasks];
  const preferredIds = new Set(watchTasks.map((task) => task.id));
  return [...watchTasks, ...openTasks.filter((task) => !preferredIds.has(task.id))];
}

function preferPosSalesTasks(
  openTasks: readonly OperationalTodayTask[],
  posTasks: readonly OperationalTodayTask[]
): OperationalTodayTask[] {
  if (posTasks.length === 0) return [...openTasks];
  const preferredIds = new Set(posTasks.map((task) => task.id));
  return [...posTasks, ...openTasks.filter((task) => !preferredIds.has(task.id))];
}

function buildThinkingSteps(input: {
  intent: AskMiseIntent;
  restaurantName: string;
  openTaskCount: number;
  stockRisk: number;
  watchCount: number;
  pendingRecommendations: number;
  salesToday: number;
  currency: string;
  posSalesTaskCount: number;
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
    if (input.stockRisk > 0) {
      steps.push(t("ask.thinking.stock.risk", { count: helpers.formatNumber(input.stockRisk) }));
    } else if (input.watchCount > 0) {
      steps.push(t("ask.thinking.stock.watch", { count: helpers.formatNumber(input.watchCount) }));
    } else {
      steps.push(t("ask.thinking.stock.clear"));
    }
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
    if (input.posSalesTaskCount > 0) {
      steps.push(
        t("ask.thinking.sales.pos", {
          count: helpers.formatNumber(input.posSalesTaskCount)
        })
      );
    } else {
      steps.push(
        t("ask.thinking.sales", {
          sales: helpers.formatCompactCurrency(input.salesToday, input.currency)
        })
      );
    }
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

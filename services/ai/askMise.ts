import type { AppLocale, MessageKey, MessageValues } from "../../i18n/catalog";
import type { AttentionCard, Insight, PosSale, Restaurant } from "../../types/mise";
import type {
  PilotReadiness,
  PilotReadinessArea,
  PilotReadinessAreaId
} from "../domain/pilotReadiness";
import type { OperationalTodayTask } from "../domain/todayTasks";
import { presentInsight, presentOperationalTodayTask } from "../presentation/operationsPresentation";

export type AskMiseIntent =
  | "priorities"
  | "stock"
  | "orders"
  | "sales"
  | "briefing"
  | "prep"
  | "waste"
  | "readiness"
  | "mapping"
  | "recipients"
  | "general";

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
  /**
   * Authoritative pilot readiness for the active restaurant.
   * Null means the check was unavailable — readiness answers fail closed.
   */
  pilotReadiness?: PilotReadiness | null;
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
const mappingKeywords =
  /mapping|unmapped|recipe coverage|menu map|catalog.?map|mapeo|cobertura de recetas|sin mapear|映射|配方覆盖|未映射/;
const recipientKeywords =
  /recipient|gmail|email delivery|supplier email|send.?ready|destinatario|correo|entrega por correo|收件|邮箱|邮件发送/;
const readinessKeywords =
  /readiness|ready to (recommend|order|send|draft)|operating loop|can we (recommend|send|order)|piloto|preparaci[oó]n|listos? para|ciclo operativo|就绪|准备好|运营闭环/;

const AREA_ORDER: readonly PilotReadinessAreaId[] = [
  "pos_sales",
  "inventory_counts",
  "recipe_coverage",
  "supplier_routing",
  "email_delivery"
];

/** Classify a manager question against operational intents. */
export function classifyAskMiseIntent(question: string): AskMiseIntent {
  const normalized = question.trim().toLowerCase();
  if (!normalized) return "general";
  // Readiness-family intents before stock/orders so "recipe coverage" and
  // "supplier email" do not collapse into inventory or purchasing answers.
  if (mappingKeywords.test(normalized)) return "mapping";
  if (recipientKeywords.test(normalized)) return "recipients";
  if (readinessKeywords.test(normalized)) return "readiness";
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
  const pilotReadiness = input.pilotReadiness ?? null;

  const thinkingSteps = buildThinkingSteps({
    intent,
    restaurantName: restaurant.name,
    openTaskCount: openTasks.length,
    stockRisk,
    pendingRecommendations: summary.pendingRecommendations,
    salesToday: summary.salesToday,
    currency: summary.restaurantCurrency,
    pilotReadiness,
    helpers
  });

  if (intent === "readiness" || intent === "mapping" || intent === "recipients") {
    return {
      intent,
      thinkingSteps,
      answer: answerReadinessFamily({
        intent,
        pilotReadiness,
        helpers
      }),
      showPriorities: false,
      priorities: []
    };
  }

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

function answerReadinessFamily(input: {
  intent: "readiness" | "mapping" | "recipients";
  pilotReadiness: PilotReadiness | null;
  helpers: AskMiseHelpers;
}): string {
  const { helpers, intent, pilotReadiness } = input;
  const { t } = helpers;

  if (!pilotReadiness) {
    return t("ask.answer.readiness.unavailable");
  }

  if (intent === "mapping") {
    return answerMappingReadiness(pilotReadiness, helpers);
  }
  if (intent === "recipients") {
    return answerRecipientReadiness(pilotReadiness, helpers);
  }
  return answerOverallReadiness(pilotReadiness, helpers);
}

function answerOverallReadiness(readiness: PilotReadiness, helpers: AskMiseHelpers): string {
  const { t } = helpers;
  const incomplete = incompleteAreas(readiness, AREA_ORDER);
  const capability = [
    readiness.canRecommend
      ? t("ask.answer.readiness.canRecommend")
      : t("ask.answer.readiness.cannotRecommend"),
    readiness.canDraft ? t("ask.answer.readiness.canDraft") : t("ask.answer.readiness.cannotDraft"),
    readiness.canSend ? t("ask.answer.readiness.canSend") : t("ask.answer.readiness.cannotSend")
  ].join(" ");

  if (incomplete.length === 0) {
    return `${t("ask.answer.readiness.ready")} ${capability}`;
  }

  const areaLabels = incomplete.map((id) => t(areaLabelKey(id))).join("; ");
  const evidence = firstBlockers(readiness, incomplete, 3);
  return [
    t("ask.answer.readiness.incomplete", { areas: areaLabels }),
    capability,
    evidence.length > 0 ? t("ask.answer.readiness.evidence", { evidence: evidence.join("; ") }) : null,
    t("ask.answer.readiness.next")
  ]
    .filter(Boolean)
    .join(" ");
}

function answerMappingReadiness(readiness: PilotReadiness, helpers: AskMiseHelpers): string {
  const { t } = helpers;
  const area = areaById(readiness, "recipe_coverage");
  if (!area) {
    return t("ask.answer.readiness.unavailable");
  }
  if (area.status === "ready") {
    const coverage = helpers.formatNumber(area.metrics.coveragePercent ?? 0);
    return t("ask.answer.mapping.ready", { coverage });
  }
  const evidence = area.blockers.slice(0, 3);
  return [
    t("ask.answer.mapping.incomplete", {
      coverage: helpers.formatNumber(area.metrics.coveragePercent ?? 0)
    }),
    evidence.length > 0 ? t("ask.answer.readiness.evidence", { evidence: evidence.join("; ") }) : null,
    t("ask.answer.mapping.next")
  ]
    .filter(Boolean)
    .join(" ");
}

function answerRecipientReadiness(readiness: PilotReadiness, helpers: AskMiseHelpers): string {
  const { t } = helpers;
  const email = areaById(readiness, "email_delivery");
  const routing = areaById(readiness, "supplier_routing");
  if (!email || !routing) {
    return t("ask.answer.readiness.unavailable");
  }

  const missingRecipients = Math.max(
    email.metrics.missingRecipients ?? 0,
    routing.metrics.missingRecipients ?? 0
  );
  const configured = helpers.formatNumber(email.metrics.configuredRecipients ?? 0);

  if (email.status === "ready" && missingRecipients === 0) {
    return t("ask.answer.recipients.ready", { count: configured });
  }

  const incompleteIds: PilotReadinessAreaId[] = [];
  if (routing.status !== "ready") incompleteIds.push("supplier_routing");
  if (email.status !== "ready") incompleteIds.push("email_delivery");
  const evidence = firstBlockers(readiness, incompleteIds.length > 0 ? incompleteIds : ["email_delivery"], 3);

  return [
    missingRecipients > 0
      ? t(
          missingRecipients === 1
            ? "ask.answer.recipients.missing.one"
            : "ask.answer.recipients.missing.other",
          { count: helpers.formatNumber(missingRecipients) }
        )
      : t("ask.answer.recipients.incomplete"),
    evidence.length > 0 ? t("ask.answer.readiness.evidence", { evidence: evidence.join("; ") }) : null,
    t("ask.answer.recipients.next")
  ]
    .filter(Boolean)
    .join(" ");
}

function buildThinkingSteps(input: {
  intent: AskMiseIntent;
  restaurantName: string;
  openTaskCount: number;
  stockRisk: number;
  pendingRecommendations: number;
  salesToday: number;
  currency: string;
  pilotReadiness: PilotReadiness | null;
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
  if (intent === "readiness" || intent === "mapping" || intent === "recipients") {
    steps.push(
      input.pilotReadiness
        ? t("ask.thinking.readiness.loaded", {
            status: input.pilotReadiness.status,
            recommend: input.pilotReadiness.canRecommend ? "yes" : "no",
            send: input.pilotReadiness.canSend ? "yes" : "no"
          })
        : t("ask.thinking.readiness.unavailable")
    );
  }

  steps.push(t("ask.thinking.compose"));
  return steps;
}

function areaById(readiness: PilotReadiness, id: PilotReadinessAreaId): PilotReadinessArea | undefined {
  return readiness.areas.find((area) => area.id === id);
}

function incompleteAreas(
  readiness: PilotReadiness,
  areaIds: readonly PilotReadinessAreaId[]
): PilotReadinessAreaId[] {
  const byId = new Map(readiness.areas.map((area) => [area.id, area]));
  return areaIds.filter((id) => byId.get(id)?.status !== "ready");
}

function firstBlockers(
  readiness: PilotReadiness,
  areaIds: readonly PilotReadinessAreaId[],
  limit: number
): string[] {
  const byId = new Map(readiness.areas.map((area) => [area.id, area]));
  const blockers: string[] = [];
  for (const id of areaIds) {
    const area = byId.get(id);
    if (!area) continue;
    for (const blocker of area.blockers) {
      const trimmed = blocker.trim();
      if (!trimmed) continue;
      blockers.push(trimmed);
      if (blockers.length >= limit) return blockers;
    }
  }
  return blockers;
}

function areaLabelKey(areaId: PilotReadinessAreaId): MessageKey {
  switch (areaId) {
    case "pos_sales":
      return "pos.readiness.area.posSales";
    case "inventory_counts":
      return "pos.readiness.area.inventoryCounts";
    case "recipe_coverage":
      return "pos.readiness.area.recipeCoverage";
    case "supplier_routing":
      return "pos.readiness.area.supplierRouting";
    case "email_delivery":
      return "pos.readiness.area.emailDelivery";
  }
}

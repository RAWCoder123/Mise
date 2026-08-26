import { translate } from "../../i18n/catalog";
import {
  buildDailyOpsReport,
  type DailyOpsDeliveryLine,
  type DailyOpsReport
} from "../domain/dailyOpsReport";
import { answerAskMise } from "../ai/askMise";
import { fetchDeliveryHistory } from "./deliveries";
import { listOpenOperatorTasks } from "./floorNotes";
import {
  fetchInsights,
  fetchInsightsSalesTrend,
  fetchLearningMemorySummary
} from "./insights";
import { fetchInventoryOutlookItems } from "./inventory";
import { fetchRestaurant } from "./restaurant";
import { fetchSupplierReliabilitySummary } from "./orders";
import { fetchTodaySummary } from "./today";
import { fetchWasteAnalysis } from "./waste";

export type { DailyOpsReport, DailyOpsDeliveryLine };

/**
 * Loads closeout inputs and builds a structured daily ops report.
 */
export async function fetchDailyOpsReport(restaurantId: string): Promise<DailyOpsReport> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const [
    restaurant,
    summary,
    insights,
    learningMemory,
    salesTrend,
    outlooks,
    operatorTasks,
    supplierReliability
  ] = await Promise.all([
    fetchRestaurant(normalizedRestaurantId),
    fetchTodaySummary(normalizedRestaurantId, { includeCompletedTasks: true }),
    fetchInsights(normalizedRestaurantId),
    fetchLearningMemorySummary(normalizedRestaurantId),
    fetchInsightsSalesTrend(normalizedRestaurantId),
    // Outlook, floor notes, and reliability must fail closed with the report.
    // Empty/null catches invent a clean closeout when auxiliary reads fail.
    fetchInventoryOutlookItems(normalizedRestaurantId),
    listOpenOperatorTasks(normalizedRestaurantId),
    fetchSupplierReliabilitySummary(normalizedRestaurantId)
  ]);

  const [deliveries, wasteAnalysis] = await Promise.all([
    loadDeliveriesToday(normalizedRestaurantId, summary.operatingDate),
    fetchWasteAnalysis(normalizedRestaurantId, {
      operatingDate: summary.operatingDate
    })
  ]);

  let askBriefingText: string | null = null;
  try {
    const reply = answerAskMise({
      question: "Give me a quick briefing",
      restaurant,
      summary,
      insights,
      helpers: {
        locale: "en",
        t: (key, values) => translate("en", key, values),
        formatNumber: (value) =>
          new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value),
        formatCompactCurrency: (value, currency = restaurant.currency) =>
          new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            notation: "compact",
            maximumFractionDigits: 1
          }).format(value)
      }
    });
    askBriefingText = reply.answer;
  } catch {
    askBriefingText = null;
  }

  return buildDailyOpsReport({
    restaurantName: restaurant.name,
    operatingDate: summary.operatingDate,
    restaurantTimeZone: restaurant.timezone,
    restaurantCurrency: summary.restaurantCurrency,
    summary,
    inventoryHealth: summary.inventoryHealth,
    operationalTasks: summary.operationalTasks,
    insights,
    learningMemory,
    salesTrend,
    inventoryOutlooks: outlooks,
    operatorTasksOpen: operatorTasks.length,
    supplierReliability,
    wasteAnalysis,
    deliveries,
    askBriefingText
  });
}

async function loadDeliveriesToday(
  restaurantId: string,
  operatingDate: string
): Promise<DailyOpsDeliveryLine[]> {
  const history = await fetchDeliveryHistory(restaurantId);
  return history
    .filter((entry) => entry.effectiveAt.slice(0, 10) === operatingDate)
    .map((entry) => ({
      id: entry.id,
      itemName: entry.itemName,
      quantity: entry.quantity,
      unit: entry.canonicalUnit,
      note: entry.note,
      at: entry.effectiveAt
    }));
}

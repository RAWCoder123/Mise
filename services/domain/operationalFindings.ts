import type {
  Insight,
  InventoryItem,
  MenuItemIngredient,
  PosSale,
  PurchaseRecommendation
} from "../../types/mise";
import {
  applyOperationalFindingDecisions,
  type OperationalFindingDecision
} from "./operationalFindingDecisions";
import {
  buildInventoryCountEvidence,
  type VerifiedCountCandidate
} from "./inventoryCountAuthority";

export const BETA_FINDING_POLICY_VERSION = "beta-findings-v1";
const MAX_FINDINGS = 12;
const MAX_EVIDENCE_PER_FINDING = 5;
const STALE_AFTER_MS = 48 * 60 * 60 * 1_000;

export type FindingPriority = "now" | "up_next" | "later";
export type FindingFreshnessState = "fresh" | "stale" | "incomplete";
export type FindingCategory =
  | "inventory"
  | "ordering"
  | "sales"
  | "waste"
  | "prep"
  | "cost"
  | "data_quality";

export interface FindingEvidenceReference {
  type:
    | "inventory_item"
    | "purchase_recommendation"
    | "insight"
    | "pos_sale"
    | "menu_mapping"
    | "data_gap";
  id: string;
  observedAt: string;
  summary: string;
}

export interface OperationalFinding {
  id: string;
  restaurantId: string;
  category: FindingCategory;
  severity: "info" | "warning" | "urgent";
  priority: FindingPriority;
  title: string;
  explanation: string;
  confidence: {
    score: number;
    rationale: string;
  };
  evidence: FindingEvidenceReference[];
  affectedWorkflow: string;
  recommendedAction: string;
  sourceWindow: {
    start: string;
    end: string;
  };
  generatedAt: string;
  freshness: {
    state: FindingFreshnessState;
    asOf: string;
    staleAfter: string;
    missingData: string[];
  };
  managerFeedback: {
    state: "unreviewed" | "approved" | "edited" | "dismissed";
    decisionId: string | null;
    recordedAt: string | null;
    effectiveRecommendedAction: string;
  };
  policyVersion: typeof BETA_FINDING_POLICY_VERSION;
}

export interface DailyOperationalBrief {
  restaurantId: string;
  operatingDate: string;
  generatedAt: string;
  policyVersion: typeof BETA_FINDING_POLICY_VERSION;
  findings: OperationalFinding[];
  priorities: {
    now: string[];
    upNext: string[];
    later: string[];
  };
}

export interface DailyOperationalBriefInput {
  restaurantId: string;
  operatingDate: string;
  generatedAt?: string;
  sales: readonly PosSale[];
  inventoryItems: readonly InventoryItem[];
  mappings: readonly MenuItemIngredient[];
  recommendations: readonly PurchaseRecommendation[];
  insights: readonly Insight[];
  decisions?: readonly OperationalFindingDecision[];
  /**
   * Verified physical-count evidence from the inventory ledger. Without it an item's
   * inventory evidence is treated as incomplete rather than dated from `last_updated`.
   */
  inventoryCountEvents?: readonly VerifiedCountCandidate[];
}

function normalizedKey(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function boundedText(value: string, fallback: string, max = 240) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return (normalized || fallback).slice(0, max);
}

function finiteTimestamp(value: string | null | undefined, fallback: string) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : fallback;
}

function operatingDateEvidenceAt(operatingDate: string) {
  return `${operatingDate}T00:00:00.000Z`;
}

function freshnessFor(
  asOf: string,
  generatedAt: string,
  missingData: string[] = []
): OperationalFinding["freshness"] {
  const staleAfter = new Date(Date.parse(asOf) + STALE_AFTER_MS).toISOString();
  const state: FindingFreshnessState = missingData.length > 0
    ? "incomplete"
    : Date.parse(generatedAt) > Date.parse(staleAfter)
      ? "stale"
      : "fresh";
  return {
    state,
    asOf,
    staleAfter,
    missingData: [...new Set(missingData)].slice(0, 8)
  };
}

function sourceWindow(evidence: FindingEvidenceReference[], generatedAt: string) {
  const timestamps = evidence
    .map((entry) => finiteTimestamp(entry.observedAt, generatedAt))
    .sort((left, right) => Date.parse(left) - Date.parse(right));
  return {
    start: timestamps[0] ?? generatedAt,
    end: timestamps[timestamps.length - 1] ?? generatedAt
  };
}

function boundedConfidence(score: number, rationale: string) {
  return {
    score: Math.max(0, Math.min(1, Number.isFinite(score) ? score : 0)),
    rationale: boundedText(rationale, "Confidence is limited by available restaurant evidence.", 180)
  };
}

function severityRank(value: OperationalFinding["severity"]) {
  return value === "urgent" ? 0 : value === "warning" ? 1 : 2;
}

function priorityRank(value: FindingPriority) {
  return value === "now" ? 0 : value === "up_next" ? 1 : 2;
}

function assertTenantScope(input: DailyOperationalBriefInput) {
  const collections = [
    input.sales,
    input.inventoryItems,
    input.mappings,
    input.recommendations,
    input.insights,
    input.decisions ?? [],
    input.inventoryCountEvents ?? []
  ];
  if (collections.some((collection) => collection.some((row) => {
    const restaurantId = "restaurant_id" in row ? row.restaurant_id : row.restaurantId;
    return restaurantId !== input.restaurantId;
  }))) {
    throw new Error("Finding inputs failed restaurant scope validation.");
  }
}

function unreviewedFeedback(recommendedAction: string): OperationalFinding["managerFeedback"] {
  return {
    state: "unreviewed",
    decisionId: null,
    recordedAt: null,
    effectiveRecommendedAction: recommendedAction
  };
}

export function buildDailyOperationalBrief(input: DailyOperationalBriefInput): DailyOperationalBrief {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("Missing restaurant workspace.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.operatingDate)) {
    throw new Error("Operating date must use YYYY-MM-DD.");
  }

  const generatedAt = finiteTimestamp(input.generatedAt, new Date().toISOString());
  const scopedInput = { ...input, restaurantId };
  assertTenantScope(scopedInput);

  const findings: OperationalFinding[] = [];
  const itemById = new Map(input.inventoryItems.map((item) => [item.id, item]));
  // Inventory evidence is dated from verified physical counts only. `last_updated`
  // moves for policy, cost, and supplier edits and would fake fresh count evidence.
  const countEvidence = buildInventoryCountEvidence({
    restaurantId,
    items: input.inventoryItems,
    countEvents: input.inventoryCountEvents ?? [],
    generatedAt
  });
  const mappedInventoryIds = new Set(input.mappings.map((mapping) => mapping.inventory_item_id));
  const activeRecommendations = input.recommendations
    .filter((recommendation) => recommendation.status === "pending")
    .sort((left, right) => left.id.localeCompare(right.id));

  for (const recommendation of activeRecommendations) {
    const item = itemById.get(recommendation.inventory_item_id);
    const verifiedCountedAt = item
      ? countEvidence.get(item.id)?.countedAt ?? null
      : null;
    const asOf = finiteTimestamp(verifiedCountedAt ?? recommendation.created_at, generatedAt);
    const missingData: string[] = [];
    if (!item) missingData.push("inventory_item");
    if (item && !verifiedCountedAt) missingData.push("verified_physical_count");
    if (!mappedInventoryIds.has(recommendation.inventory_item_id)) missingData.push("menu_mapping");
    if (item?.canonical_unit_verification_status !== "verified") {
      missingData.push("verified_canonical_unit");
    }
    const freshness = freshnessFor(asOf, generatedAt, missingData);
    const evidence: FindingEvidenceReference[] = [
      {
        type: "purchase_recommendation",
        id: recommendation.id,
        observedAt: finiteTimestamp(recommendation.created_at, generatedAt),
        summary: boundedText(
          `${recommendation.item_name}: ${recommendation.recommended_quantity} ${recommendation.unit} suggested`,
          "Pending purchase recommendation"
        )
      }
    ];
    if (item) {
      evidence.push({
        type: "inventory_item",
        id: item.id,
        observedAt: asOf,
        summary: boundedText(
          `${item.item_name}: ${item.current_quantity} ${item.unit} on hand; reorder at ${item.reorder_threshold}`,
          "Inventory evidence"
        )
      });
    }

    const severity = recommendation.urgency === "high"
      ? "urgent"
      : recommendation.urgency === "medium"
        ? "warning"
        : "info";
    const priority: FindingPriority = severity === "urgent" ? "now" : severity === "warning" ? "up_next" : "later";
    const confidenceScore = freshness.state === "fresh" ? 0.92 : freshness.state === "stale" ? 0.55 : 0.62;
    const recommendedAction = boundedText(
      `Review ${recommendation.recommended_quantity} ${recommendation.unit} from ${recommendation.supplier_name}; edit or dismiss the draft suggestion as needed.`,
      "Review the recommendation."
    );
    findings.push({
      id: `finding:recommendation:${recommendation.id}`,
      restaurantId,
      category: "ordering",
      severity,
      priority,
      title: boundedText(`Review ${recommendation.item_name} coverage`, "Review inventory coverage", 120),
      explanation: boundedText(recommendation.reason, "Inventory is below the restaurant's configured operating level."),
      confidence: boundedConfidence(
        confidenceScore,
        freshness.state === "fresh"
          ? "Current tenant inventory, a verified canonical unit, and a menu mapping support this quantity."
          : "The recommendation is preserved, but stale or incomplete mapping evidence lowers confidence."
      ),
      evidence: evidence.slice(0, MAX_EVIDENCE_PER_FINDING),
      affectedWorkflow: "inventory_and_ordering",
      recommendedAction,
      sourceWindow: sourceWindow(evidence, generatedAt),
      generatedAt,
      freshness,
      managerFeedback: unreviewedFeedback(recommendedAction),
      policyVersion: BETA_FINDING_POLICY_VERSION
    });
  }

  const handledLowInsightIds = new Set(
    activeRecommendations.map((recommendation) => `insight_low_${recommendation.inventory_item_id}`)
  );
  for (const insight of [...input.insights].sort((left, right) => left.id.localeCompare(right.id))) {
    if (handledLowInsightIds.has(insight.id)) continue;
    const asOf = finiteTimestamp(insight.created_at, generatedAt);
    const freshness = freshnessFor(asOf, generatedAt);
    const evidence: FindingEvidenceReference[] = [{
      type: "insight",
      id: insight.id,
      observedAt: asOf,
      summary: boundedText(insight.description, insight.title)
    }];
    const priority: FindingPriority = insight.severity === "urgent"
      ? "now"
      : insight.severity === "warning"
        ? "up_next"
        : "later";
    const recommendedAction = boundedText(insight.recommended_action, "Review the underlying restaurant evidence.");
    findings.push({
      id: `finding:insight:${insight.id}`,
      restaurantId,
      category: insight.insight_type,
      severity: insight.severity,
      priority,
      title: boundedText(insight.title, "Operational finding", 120),
      explanation: boundedText(insight.why_it_matters ?? insight.description, insight.description),
      confidence: boundedConfidence(
        freshness.state === "fresh" ? 0.78 : 0.52,
        freshness.state === "fresh"
          ? "A deterministic Mise rule generated this finding from current restaurant evidence."
          : "The deterministic finding is retained, but its source evidence is stale."
      ),
      evidence,
      affectedWorkflow: insight.insight_type,
      recommendedAction,
      sourceWindow: sourceWindow(evidence, generatedAt),
      generatedAt,
      freshness,
      managerFeedback: unreviewedFeedback(recommendedAction),
      policyVersion: BETA_FINDING_POLICY_VERSION
    });
  }

  const todaySales = input.sales.filter((sale) => sale.sale_date === input.operatingDate);
  if (todaySales.length === 0) {
    const observedAt = operatingDateEvidenceAt(input.operatingDate);
    const evidence: FindingEvidenceReference[] = [{
      type: "data_gap",
      id: `sales:${input.operatingDate}`,
      observedAt,
      summary: `No sales rows are recorded for ${input.operatingDate}.`
    }];
    const recommendedAction = "Import or enter today’s sales, then refresh the daily brief.";
    findings.push({
      id: `finding:data-gap:sales:${input.operatingDate}`,
      restaurantId,
      category: "data_quality",
      severity: "warning",
      priority: "now",
      title: "Import today’s sales",
      explanation: "Mise cannot compare demand or projected ingredient usage until today’s sales are recorded.",
      confidence: boundedConfidence(1, "The restaurant-scoped sales dataset contains no rows for this operating date."),
      evidence,
      affectedWorkflow: "daily_sales_import",
      recommendedAction,
      sourceWindow: sourceWindow(evidence, generatedAt),
      generatedAt,
      freshness: freshnessFor(generatedAt, generatedAt, ["daily_sales"]),
      managerFeedback: unreviewedFeedback(recommendedAction),
      policyVersion: BETA_FINDING_POLICY_VERSION
    });
  }

  if (input.inventoryItems.length === 0) {
    const observedAt = operatingDateEvidenceAt(input.operatingDate);
    const evidence: FindingEvidenceReference[] = [{
      type: "data_gap",
      id: `inventory:${restaurantId}`,
      observedAt,
      summary: "No inventory items are configured for this restaurant."
    }];
    const recommendedAction = "Add inventory items, canonical units, costs, and suppliers before relying on recommendations.";
    findings.push({
      id: `finding:data-gap:inventory:${restaurantId}`,
      restaurantId,
      category: "data_quality",
      severity: "warning",
      priority: "now",
      title: "Finish inventory setup",
      explanation: "Mise cannot calculate stock coverage or supplier quantities without restaurant inventory.",
      confidence: boundedConfidence(1, "The restaurant-scoped inventory dataset is empty."),
      evidence,
      affectedWorkflow: "inventory_setup",
      recommendedAction,
      sourceWindow: sourceWindow(evidence, generatedAt),
      generatedAt,
      freshness: freshnessFor(generatedAt, generatedAt, ["inventory_items"]),
      managerFeedback: unreviewedFeedback(recommendedAction),
      policyVersion: BETA_FINDING_POLICY_VERSION
    });
  }

  const mappedMenuItems = new Set(input.mappings.map((mapping) => normalizedKey(mapping.menu_item_name)));
  const unmappedSales = todaySales.filter((sale) => !mappedMenuItems.has(normalizedKey(sale.item_name)));
  if (unmappedSales.length > 0) {
    const evidence = unmappedSales.slice(0, MAX_EVIDENCE_PER_FINDING).map((sale) => ({
      type: "pos_sale" as const,
      id: sale.id,
      observedAt: finiteTimestamp(sale.created_at, generatedAt),
      summary: boundedText(`${sale.item_name}: ${sale.quantity_sold} sold without a recipe mapping`, "Unmapped sale")
    }));
    const missingNames = [...new Set(unmappedSales.map((sale) => boundedText(sale.item_name, "menu item", 80)))]
      .slice(0, 5);
    const recommendedAction = "Verify recipe and ingredient mappings for the sold items before using depletion forecasts.";
    findings.push({
      id: `finding:data-gap:mapping:${input.operatingDate}`,
      restaurantId,
      category: "data_quality",
      severity: "warning",
      priority: "up_next",
      title: "Map sold menu items to recipes",
      explanation: `${unmappedSales.length} sales row${unmappedSales.length === 1 ? "" : "s"} cannot deplete inventory because the menu item is not mapped.`,
      confidence: boundedConfidence(1, "Current restaurant sales were compared directly with restaurant-scoped menu mappings."),
      evidence,
      affectedWorkflow: "recipe_mapping",
      recommendedAction,
      sourceWindow: sourceWindow(evidence, generatedAt),
      generatedAt,
      freshness: freshnessFor(
        evidence[evidence.length - 1]?.observedAt ?? generatedAt,
        generatedAt,
        missingNames.map((name) => `menu_mapping:${name}`)
      ),
      managerFeedback: unreviewedFeedback(recommendedAction),
      policyVersion: BETA_FINDING_POLICY_VERSION
    });
  }

  const findingsWithFeedback = applyOperationalFindingDecisions(
    restaurantId,
    findings,
    input.decisions ?? []
  );
  const sorted = findingsWithFeedback
    .sort((left, right) =>
      priorityRank(left.priority) - priorityRank(right.priority) ||
      severityRank(left.severity) - severityRank(right.severity) ||
      right.confidence.score - left.confidence.score ||
      left.id.localeCompare(right.id)
    )
    .slice(0, MAX_FINDINGS);

  return {
    restaurantId,
    operatingDate: input.operatingDate,
    generatedAt,
    policyVersion: BETA_FINDING_POLICY_VERSION,
    findings: sorted,
    priorities: {
      now: sorted.filter((finding) => finding.priority === "now").map((finding) => finding.id),
      upNext: sorted.filter((finding) => finding.priority === "up_next").map((finding) => finding.id),
      later: sorted.filter((finding) => finding.priority === "later").map((finding) => finding.id)
    }
  };
}

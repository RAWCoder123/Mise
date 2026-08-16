import { canonicalInventoryUnit, inventoryUnitsAreCompatible } from "./inventoryUnits.ts";
import type { InventoryEvent } from "./inventoryLedger.ts";
import { normalizeOperationalQuantity } from "./operationalMapping.ts";
import type { InsightPresentationDescriptor } from "../../types/presentation.ts";
import type {
  ConfidenceBand,
  RecommendationSourceEvidence,
  VerifiedCountEvidence
} from "../../types/mise.ts";

export interface OperationalInventoryItem {
  id: string;
  restaurant_id: string;
  item_name: string;
  supplier_name: string;
  unit: string;
  current_quantity: number;
  par_level: number;
  reorder_threshold: number;
  last_updated?: string;
  canonical_unit?: "g" | "ml" | "each" | null;
  canonical_quantity_per_unit?: number | null;
}

export interface OperationalSale {
  restaurant_id: string;
  sale_date: string;
  item_name: string;
  quantity_sold: number;
  source_pos?: string;
  occurred_at?: string | null;
  pos_location_id?: string | null;
  external_catalog_item_id?: string | null;
  external_variation_id?: string | null;
}

export interface OperationalRecipeMapping {
  restaurant_id: string;
  menu_item_name: string;
  inventory_item_id: string;
  quantity_used_per_sale: number;
  unit: string;
}

export interface OperationalRecommendationHistory {
  inventory_item_id: string;
  recommended_quantity: number;
  unit: string;
  status: string;
  created_at: string;
}

export interface OperationalVerifiedRecipeMapping {
  restaurant_id: string;
  pos_location_id: string;
  catalog_mapping_id: string;
  recipe_version_id: string;
  external_catalog_item_id: string;
  external_variation_id: string;
  inventory_item_id: string;
  quantity_used_per_sale: number;
  unit: string;
}

export interface OperationalRecommendation {
  restaurant_id: string;
  inventory_item_id: string;
  item_name: string;
  supplier_name: string;
  recommended_quantity: number;
  unit: string;
  reason: string;
  urgency: "low" | "medium" | "high";
  status: "pending";
  supplier_order_id: null;
  confidence: ConfidenceBand;
  source_evidence: RecommendationSourceEvidence;
}

export interface OperationalInsight {
  id: string;
  restaurant_id: string;
  insight_type: "sales" | "inventory" | "waste" | "cost" | "prep" | "ordering";
  title: string;
  description: string;
  why_it_matters: string | null;
  recommended_action: string;
  severity: "info" | "warning" | "urgent";
  created_at: string;
  presentation: InsightPresentationDescriptor;
}

export interface OperationalPlanningSnapshot {
  restaurantId: string;
  operatingDate: string;
  inventoryItems: OperationalInventoryItem[];
  sales: OperationalSale[];
  menuItemIngredients: OperationalRecipeMapping[];
  recommendationHistory: OperationalRecommendationHistory[];
  inventoryEvents?: InventoryEvent[];
  verifiedRecipeMappings?: OperationalVerifiedRecipeMapping[];
  planningMode?: "demo" | "manual_csv" | "square_live";
  selectedPosLocationId?: string | null;
  planningRevision?: number | null;
  generatedAt?: string;
  correlationId?: string;
  maximumCountAgeHours?: number;
}

export function calculateOperationalSignals(snapshot: OperationalPlanningSnapshot) {
  const now = safeIso(snapshot.generatedAt) ?? new Date().toISOString();
  const mode = snapshot.planningMode ?? "manual_csv";
  const maximumCountAgeHours = boundedMaximumCountAge(snapshot.maximumCountAgeHours);
  const selectedPosLocationId = snapshot.selectedPosLocationId?.trim() || null;
  const scopedSales = snapshot.sales.filter((sale) => sale.restaurant_id === snapshot.restaurantId);
  const planningSales = mode === "square_live"
    ? scopedSales.filter((sale) => isCompleteSelectedSquareSale(sale, selectedPosLocationId))
    : scopedSales;
  const demand = historicalDailyDemand(planningSales, snapshot.operatingDate);
  const todaySales = planningSales.filter((sale) => sale.sale_date === snapshot.operatingDate);
  const verifiedMappings = (snapshot.verifiedRecipeMappings ?? []).filter(
    (mapping) =>
      mapping.restaurant_id === snapshot.restaurantId &&
      mapping.pos_location_id === selectedPosLocationId
  );
  const correlationId = validCorrelationId(snapshot.correlationId)
    ? snapshot.correlationId!
    : randomCorrelationId();
  const handled = latestHandledByItem(snapshot.recommendationHistory);
  const learned = learnedQuantities(snapshot.recommendationHistory);
  const recommendations: OperationalRecommendation[] = [];
  const insights: OperationalInsight[] = [];

  for (const item of snapshot.inventoryItems.filter((entry) => entry.restaurant_id === snapshot.restaurantId)) {
    const countEvidence = latestVerifiedCountEvidence(
      snapshot.restaurantId,
      item.id,
      snapshot.inventoryEvents ?? [],
      now
    );
    const countIsFresh = countEvidence
      ? ageHours(countEvidence.effectiveAt, now) <= maximumCountAgeHours
      : false;
    const mappings = snapshot.menuItemIngredients.filter(
      (mapping) =>
        mapping.restaurant_id === snapshot.restaurantId &&
        mapping.inventory_item_id === item.id &&
        inventoryUnitsAreCompatible(item.unit, mapping.unit)
    );
    const itemVerifiedMappings = verifiedMappings.filter(
      (mapping) =>
        mapping.inventory_item_id === item.id &&
        inventoryUnitsAreCompatible(item.unit, mapping.unit)
    );
    const applicableMappings = mode === "square_live" ? itemVerifiedMappings : mappings;
    const postCountSales = countEvidence
      ? planningSales.filter((sale) => saleFallsWithinEvidenceWindow(
          sale,
          countEvidence.effectiveAt,
          now,
          snapshot.operatingDate
        ))
      : [];
    const depletion = mode === "square_live"
      ? itemVerifiedMappings.reduce((sum, mapping) => {
          const sold = postCountSales
            .filter((sale) => saleMatchesVerifiedMapping(sale, mapping))
            .reduce((quantity, sale) => quantity + finiteNonNegative(sale.quantity_sold), 0);
          return sum + sold * finiteNonNegative(mapping.quantity_used_per_sale);
        }, 0)
      : mappings.reduce((sum, mapping) => {
          const sold = postCountSales
            .filter((sale) => normalizeKey(sale.item_name) === normalizeKey(mapping.menu_item_name))
            .reduce((quantity, sale) => quantity + finiteNonNegative(sale.quantity_sold), 0);
          return sum + sold * finiteNonNegative(mapping.quantity_used_per_sale);
        }, 0);
    const baselineUsage = mode === "square_live"
      ? itemVerifiedMappings.reduce((sum, mapping) => {
          return sum + historicalMappedDemand(planningSales, snapshot.operatingDate, mapping) *
            finiteNonNegative(mapping.quantity_used_per_sale);
        }, 0)
      : mappings.reduce((sum, mapping) => {
          return sum + (demand.get(normalizeKey(mapping.menu_item_name)) ?? 0) * finiteNonNegative(mapping.quantity_used_per_sale);
        }, 0);
    const verifiedBaseline = countEvidence
      ? verifiedInventoryBaseline(item, countEvidence, snapshot.inventoryEvents ?? [])
      : null;
    const projectedQuantity = Math.max(
      0,
      (verifiedBaseline ?? 0) - depletion
    );
    const threshold = finiteNonNegative(item.reorder_threshold);
    const isCritical = projectedQuantity <= 0;
    const isLow = !isCritical && projectedQuantity <= threshold;
    const suggested = Math.max(1, Math.ceil(finiteNonNegative(item.par_level) - projectedQuantity));
    const recentHandled = handled.get(item.id);
    const changedAfterHandling = recentHandled && countEvidence
      ? Date.parse(countEvidence.effectiveAt) > Date.parse(recentHandled.created_at)
      : false;

    if (
      !countEvidence ||
      !countIsFresh ||
      verifiedBaseline === null ||
      (mode === "square_live" && applicableMappings.length === 0)
    ) {
      if (!countEvidence || !countIsFresh || verifiedBaseline === null || projectedQuantity <= threshold) {
        const missingChain = mode === "square_live" && applicableMappings.length === 0;
        insights.push(blockedInventoryInsight({
          restaurantId: snapshot.restaurantId,
          item,
          now,
          reason: !countEvidence
            ? "No verified physical count is available."
            : !countIsFresh
              ? `The latest physical count is older than ${maximumCountAgeHours} hours.`
              : verifiedBaseline === null
                ? "The latest physical count no longer matches the item's verified unit conversion."
              : missingChain
                ? "No active verified Square catalog and recipe chain covers this item."
                : "Verified planning evidence is incomplete."
        }));
      }
      continue;
    }

    if ((isCritical || isLow) && (!recentHandled || changedAfterHandling)) {
      const learnedQuantity = boundedLearnedQuantity(
        learned.get(`${item.id}\u001f${canonicalInventoryUnit(item.unit)}`),
        suggested,
        item.par_level
      );
      const quantity = learnedQuantity ?? suggested;
      const coverage = baselineUsage > 0 ? projectedQuantity / baselineUsage : null;
      const reason = coverage === null
        ? `${item.item_name} is at or below its reorder level. Mise recommends restoring it to par.`
        : `${item.item_name} has about ${round(coverage)} service days of projected coverage based on mapped demand.`;
      recommendations.push({
        restaurant_id: snapshot.restaurantId,
        inventory_item_id: item.id,
        item_name: item.item_name,
        supplier_name: item.supplier_name,
        recommended_quantity: quantity,
        unit: item.unit,
        reason,
        urgency: isCritical ? "high" : "medium",
        status: "pending",
        supplier_order_id: null,
        confidence: mode === "manual_csv" ? "low" : "medium",
        source_evidence: recommendationSourceEvidence({
          mode,
          countEvidence,
          sales: postCountSales,
          selectedPosLocationId,
          verifiedMappings: itemVerifiedMappings,
          planningRevision: snapshot.planningRevision ?? null,
          generatedAt: now,
          correlationId
        })
      });
      insights.push({
        id: `insight_low_${item.id}`,
        restaurant_id: snapshot.restaurantId,
        insight_type: "inventory",
        title: isCritical ? `${item.item_name} may run out today` : `${item.item_name} is below its normal level`,
        description: `${item.item_name} is projected at ${round(projectedQuantity)} ${item.unit} after mapped POS demand.`,
        why_it_matters: "This can interrupt prep or force an 86 mid-service.",
        recommended_action: `Check the walk-in, then add ${quantity} ${item.unit} on the next ${item.supplier_name} ticket.`,
        severity: isCritical ? "urgent" : "warning",
        created_at: now,
        presentation: {
          code: "insight.rule.inventory.stock_risk",
          values: {
            itemName: item.item_name,
            projectedQuantity,
            unit: item.unit,
            supplierName: item.supplier_name,
            suggestedOrderQuantity: quantity,
            status: isCritical ? "Critical" : "Low"
          }
        }
      });
    } else if (baselineUsage > 0 && projectedQuantity > baselineUsage * 3) {
      insights.push({
        id: `insight_overstock_${item.id}`,
        restaurant_id: snapshot.restaurantId,
        insight_type: "waste",
        title: `${item.item_name} may be overstocked`,
        description: `${round(projectedQuantity)} ${item.unit} is more than three service days of mapped demand.`,
        why_it_matters: "Extra on hand can spoil or tie up cash before the next rush needs it.",
        recommended_action: `Skip or trim the next ${item.item_name.toLowerCase()} order unless tonight’s sales stay hot.`,
        severity: "info",
        created_at: now,
        presentation: {
          code: "insight.rule.waste.overstock",
          values: {
            itemName: item.item_name,
            quantity: projectedQuantity,
            unit: item.unit
          }
        }
      });
    }
  }

  for (const sale of todaySales) {
    const baseline = demand.get(normalizeKey(sale.item_name));
    if (!baseline || sale.quantity_sold < baseline * 1.2) continue;
    const lift = Math.round(((sale.quantity_sold - baseline) / baseline) * 100);
    insights.push({
      id: `insight_spike_${normalizeKey(sale.item_name).replace(/\s+/g, "_")}`,
      restaurant_id: snapshot.restaurantId,
      insight_type: "sales",
      title: `${sale.item_name} demand is rising`,
      description: `${sale.item_name} sold ${lift}% more than its recent service-day baseline.`,
      why_it_matters: "Pull prep forward or you may 86 linked dishes before the next order lands.",
      recommended_action: `Before the next prep window, confirm walk-in counts for ingredients tied to ${sale.item_name.toLowerCase()}.`,
      severity: "warning",
      created_at: now,
      presentation: {
        code: "insight.rule.sales.demand_rising",
        values: {
          itemName: sale.item_name,
          liftPercent: lift
        }
      }
    });
  }

  const topSale = [...todaySales].sort((a, b) => b.quantity_sold - a.quantity_sold)[0];
  if (topSale) {
    const lowLinked = snapshot.inventoryItems.find((item) => {
      if (item.restaurant_id !== snapshot.restaurantId) return false;
      const linked = mode === "square_live"
        ? verifiedMappings.some(
            (mapping) =>
              mapping.inventory_item_id === item.id &&
              saleMatchesVerifiedMapping(topSale, mapping)
          )
        : snapshot.menuItemIngredients.some(
            (mapping) =>
              mapping.restaurant_id === snapshot.restaurantId &&
              mapping.inventory_item_id === item.id &&
              normalizeKey(mapping.menu_item_name) === normalizeKey(topSale.item_name)
          );
      if (!linked) return false;
      return insights.some(
        (insight) =>
          insight.id === `insight_low_${item.id}` &&
          (insight.severity === "urgent" || insight.severity === "warning")
      );
    });
    if (lowLinked) {
      insights.push({
        id: `insight_prep_${normalizeKey(topSale.item_name).replace(/\s+/g, "_")}`,
        restaurant_id: snapshot.restaurantId,
        insight_type: "prep",
        title: `${topSale.item_name} depends on low stock`,
        description: `${topSale.item_name} is selling hard and uses ${lowLinked.item_name.toLowerCase()}, which is already below reorder.`,
        why_it_matters: "A top seller can get 86'd mid-service if this ingredient runs out.",
        recommended_action: `Before prep, put ${lowLinked.item_name.toLowerCase()} on the next ${lowLinked.supplier_name} ticket.`,
        severity: "urgent",
        created_at: now,
        presentation: {
          code: "insight.rule.prep.low_stock",
          values: {
            menuItemName: topSale.item_name,
            inventoryItemName: lowLinked.item_name,
            supplierName: lowLinked.supplier_name
          }
        }
      });
    }
  }

  return { recommendations: recommendations.slice(0, 250), insights: dedupeInsights(insights).slice(0, 8) };
}

export function latestVerifiedCountEvidence(
  restaurantId: string,
  inventoryItemId: string,
  events: readonly InventoryEvent[],
  asOf = new Date().toISOString()
): VerifiedCountEvidence | null {
  const evidenceCeiling = Date.parse(safeIso(asOf) ?? new Date().toISOString()) + 5 * 60_000;
  const superseded = new Set(
    events
      .filter((event) => event.restaurantId === restaurantId && event.supersedesEventId)
      .map((event) => event.supersedesEventId as string)
  );
  const count = events
    .filter(
      (event) =>
        event.restaurantId === restaurantId &&
        event.inventoryItemId === inventoryItemId &&
        event.eventType === "count" &&
        Number.isFinite(Date.parse(event.effectiveAt)) &&
        Date.parse(event.effectiveAt) <= evidenceCeiling &&
        !superseded.has(event.id)
    )
    .sort((left, right) => {
      const effective = Date.parse(right.effectiveAt) - Date.parse(left.effectiveAt);
      return effective || right.sequence - left.sequence;
    })[0];
  if (!count || !safeIso(count.effectiveAt) || !safeIso(count.recordedAt)) return null;
  return {
    countEventId: count.id,
    inventoryItemId,
    effectiveAt: new Date(count.effectiveAt).toISOString(),
    recordedAt: new Date(count.recordedAt).toISOString(),
    sequence: count.sequence,
    quantity: finiteNonNegative(count.quantity),
    canonicalUnit: count.canonicalUnit
  };
}

export function recommendationEvidenceIsCurrent(input: {
  restaurantId: string;
  inventoryItemId: string;
  evidence: RecommendationSourceEvidence;
  inventoryEvents: readonly InventoryEvent[];
  inventoryItem?: OperationalInventoryItem | null;
  now?: string;
  maximumCountAgeHours?: number;
  planningRevision?: number | null;
  selectedPosLocationId?: string | null;
  verifiedMappingIds?: readonly string[];
  verifiedRecipeVersionIds?: readonly string[];
}) {
  const now = safeIso(input.now) ?? new Date().toISOString();
  const latest = latestVerifiedCountEvidence(
    input.restaurantId,
    input.inventoryItemId,
    input.inventoryEvents,
    now
  );
  if (input.evidence.mode === "legacy" || !latest || !input.evidence.countEvent) return false;
  const generatedAt = safeIso(input.evidence.generatedAt);
  if (
    !generatedAt ||
    Date.parse(generatedAt) > Date.parse(now) + 5 * 60_000 ||
    !validCorrelationId(input.evidence.correlationId) ||
    input.evidence.correlationId === "00000000-0000-0000-0000-000000000000"
  ) return false;
  if (latest.countEventId !== input.evidence.countEvent.countEventId) return false;
  if (
    latest.inventoryItemId !== input.evidence.countEvent.inventoryItemId ||
    latest.effectiveAt !== input.evidence.countEvent.effectiveAt ||
    latest.recordedAt !== input.evidence.countEvent.recordedAt ||
    latest.sequence !== input.evidence.countEvent.sequence ||
    latest.quantity !== input.evidence.countEvent.quantity ||
    latest.canonicalUnit !== input.evidence.countEvent.canonicalUnit
  ) return false;
  if (ageHours(latest.effectiveAt, now) > boundedMaximumCountAge(input.maximumCountAgeHours)) return false;
  if (
    input.inventoryItem &&
    verifiedInventoryBaseline(input.inventoryItem, latest, input.inventoryEvents) === null
  ) return false;
  if (
    input.planningRevision != null &&
    input.evidence.planningRevision !== input.planningRevision
  ) return false;
  if (input.evidence.mode === "square_verified") {
    if (!input.selectedPosLocationId || input.evidence.posLocationId !== input.selectedPosLocationId) return false;
    const mappings = new Set(input.verifiedMappingIds ?? []);
    const recipes = new Set(input.verifiedRecipeVersionIds ?? []);
    if (
      input.evidence.mappingIds.length === 0 ||
      input.evidence.recipeVersionIds.length === 0 ||
      input.evidence.mappingIds.some((id) => !mappings.has(id)) ||
      input.evidence.recipeVersionIds.some((id) => !recipes.has(id))
    ) return false;
  }
  return true;
}

function verifiedInventoryBaseline(
  item: OperationalInventoryItem,
  count: VerifiedCountEvidence,
  events: readonly InventoryEvent[]
) {
  const inferred = normalizeOperationalQuantity({ quantity: 1, unit: item.unit });
  const canonicalUnit = item.canonical_unit ?? (inferred.ok ? inferred.unit : null);
  const quantityPerUnit = finitePositive(item.canonical_quantity_per_unit) ??
    (inferred.ok ? inferred.quantity : null);
  if (!canonicalUnit || !quantityPerUnit || canonicalUnit !== count.canonicalUnit) return null;

  const superseded = new Set(
    events
      .filter((event) => event.restaurantId === item.restaurant_id && event.supersedesEventId)
      .map((event) => event.supersedesEventId as string)
  );
  const laterEvents = events
    .filter(
      (event) =>
        event.restaurantId === item.restaurant_id &&
        event.inventoryItemId === item.id &&
        event.sequence > count.sequence &&
        event.eventType !== "count" &&
        event.canonicalUnit === canonicalUnit &&
        !superseded.has(event.id)
    )
    .sort((left, right) => left.sequence - right.sequence);

  let quantity = count.quantity;
  for (const event of laterEvents) {
    if (event.eventType === "stockout") quantity = 0;
    else if (event.eventType === "waste" || event.eventType === "usage") {
      quantity -= finiteNonNegative(event.quantity);
    } else {
      quantity += finiteNonNegative(event.quantity);
    }
  }
  return Math.max(0, quantity / quantityPerUnit);
}

function recommendationSourceEvidence(input: {
  mode: "demo" | "manual_csv" | "square_live";
  countEvidence: VerifiedCountEvidence;
  sales: readonly OperationalSale[];
  selectedPosLocationId: string | null;
  verifiedMappings: readonly OperationalVerifiedRecipeMapping[];
  planningRevision: number | null;
  generatedAt: string;
  correlationId: string;
}): RecommendationSourceEvidence {
  const salesThrough = input.sales
    .map((sale) => saleOccurredAt(sale))
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;
  return {
    version: 1,
    mode: input.mode === "square_live" ? "square_verified" : input.mode,
    countEvent: input.countEvidence,
    salesThrough,
    posLocationId: input.mode === "square_live" ? input.selectedPosLocationId : null,
    mappingIds: uniqueBounded(input.verifiedMappings.map((mapping) => mapping.catalog_mapping_id)),
    recipeVersionIds: uniqueBounded(input.verifiedMappings.map((mapping) => mapping.recipe_version_id)),
    planningRevision: input.planningRevision,
    generatedAt: input.generatedAt,
    correlationId: input.correlationId
  };
}

function blockedInventoryInsight(input: {
  restaurantId: string;
  item: OperationalInventoryItem;
  now: string;
  reason: string;
}): OperationalInsight {
  return {
    id: `insight_count_${input.item.id}`,
    restaurant_id: input.restaurantId,
    insight_type: "inventory",
    title: `Verify ${input.item.item_name} before ordering`,
    description: input.reason,
    why_it_matters: "Mise will not turn incomplete or stale evidence into a supplier recommendation.",
    recommended_action: `Complete a physical count for ${input.item.item_name.toLowerCase()}, then regenerate the plan.`,
    severity: "warning",
    created_at: input.now,
    presentation: {
      code: "insight.rule.inventory.stock_risk",
      values: {
        itemName: input.item.item_name,
        projectedQuantity: finiteNonNegative(input.item.current_quantity),
        unit: input.item.unit,
        supplierName: input.item.supplier_name,
        suggestedOrderQuantity: 0,
        status: "Low"
      }
    }
  };
}

function isCompleteSelectedSquareSale(sale: OperationalSale, selectedLocationId: string | null) {
  return Boolean(
    selectedLocationId &&
    sale.pos_location_id === selectedLocationId &&
    safeIso(sale.occurred_at) &&
    sale.external_catalog_item_id?.trim() &&
    sale.external_variation_id?.trim()
  );
}

function saleMatchesVerifiedMapping(
  sale: OperationalSale,
  mapping: OperationalVerifiedRecipeMapping
) {
  return sale.pos_location_id === mapping.pos_location_id &&
    sale.external_catalog_item_id === mapping.external_catalog_item_id &&
    sale.external_variation_id === mapping.external_variation_id;
}

function saleOccurredAfter(sale: OperationalSale, countEffectiveAt: string) {
  const occurredAt = saleOccurredAt(sale);
  return occurredAt ? Date.parse(occurredAt) > Date.parse(countEffectiveAt) : false;
}

function saleFallsWithinEvidenceWindow(
  sale: OperationalSale,
  countEffectiveAt: string,
  generatedAt: string,
  operatingDate: string
) {
  if (sale.sale_date > operatingDate) return false;
  const explicitOccurredAt = safeIso(sale.occurred_at);
  if (explicitOccurredAt) {
    return (
      Date.parse(explicitOccurredAt) > Date.parse(countEffectiveAt) &&
      Date.parse(explicitOccurredAt) <= Date.parse(generatedAt)
    );
  }
  return saleOccurredAfter(sale, countEffectiveAt);
}

function saleOccurredAt(sale: OperationalSale) {
  const explicit = safeIso(sale.occurred_at);
  if (explicit) return explicit;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sale.sale_date)) return null;
  return safeIso(`${sale.sale_date}T23:59:59.999Z`);
}

function historicalMappedDemand(
  sales: OperationalSale[],
  operatingDate: string,
  mapping: OperationalVerifiedRecipeMapping
) {
  const days = [...new Set(
    sales
      .filter((sale) => sale.sale_date < operatingDate && saleMatchesVerifiedMapping(sale, mapping))
      .map((sale) => sale.sale_date)
  )].sort((a, b) => b.localeCompare(a)).slice(0, 28);
  if (days.length < 7) return 0;
  const totals = new Map<string, number>();
  for (const sale of sales) {
    if (!days.includes(sale.sale_date) || !saleMatchesVerifiedMapping(sale, mapping)) continue;
    totals.set(sale.sale_date, (totals.get(sale.sale_date) ?? 0) + finiteNonNegative(sale.quantity_sold));
  }
  return robustAverage(days.map((day) => totals.get(day) ?? 0));
}

function boundedMaximumCountAge(value: number | undefined) {
  return Number.isFinite(value) ? Math.min(24 * 30, Math.max(1, value!)) : 36;
}

function ageHours(then: string, now: string) {
  const elapsed = Date.parse(now) - Date.parse(then);
  return Number.isFinite(elapsed) ? Math.max(0, elapsed / 3_600_000) : Number.POSITIVE_INFINITY;
}

function safeIso(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function validCorrelationId(value: unknown) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function randomCorrelationId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "00000000-0000-4000-8000-000000000000";
}

function uniqueBounded(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].slice(0, 100);
}

export function buildRecommendationInserts(
  restaurantId: string,
  inventoryItems: OperationalInventoryItem[],
  sales: OperationalSale[],
  menuItemIngredients: OperationalRecipeMapping[],
  recommendationHistory: OperationalRecommendationHistory[] = [],
  operatingDate = new Date().toISOString().slice(0, 10),
  context: Pick<
    OperationalPlanningSnapshot,
    | "inventoryEvents"
    | "verifiedRecipeMappings"
    | "planningMode"
    | "selectedPosLocationId"
    | "planningRevision"
    | "generatedAt"
    | "correlationId"
    | "maximumCountAgeHours"
  > = {}
) {
  return calculateOperationalSignals({
    restaurantId,
    operatingDate,
    inventoryItems,
    sales,
    menuItemIngredients,
    recommendationHistory,
    ...context
  }).recommendations;
}

export function buildInsightsFromData(
  restaurantId: string,
  inventoryItems: OperationalInventoryItem[],
  sales: OperationalSale[],
  menuItemIngredients: OperationalRecipeMapping[],
  operatingDate = new Date().toISOString().slice(0, 10),
  context: Pick<
    OperationalPlanningSnapshot,
    | "inventoryEvents"
    | "verifiedRecipeMappings"
    | "planningMode"
    | "selectedPosLocationId"
    | "planningRevision"
    | "generatedAt"
    | "correlationId"
    | "maximumCountAgeHours"
  > = {}
) {
  return calculateOperationalSignals({
    restaurantId,
    operatingDate,
    inventoryItems,
    sales,
    menuItemIngredients,
    recommendationHistory: [],
    ...context
  }).insights;
}

function historicalDailyDemand(sales: OperationalSale[], operatingDate: string) {
  const days = [...new Set(sales.filter((sale) => sale.sale_date < operatingDate).map((sale) => sale.sale_date))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 28);
  if (days.length < 7) return new Map<string, number>();
  const selectedDays = new Set(days);
  const totals = new Map<string, Map<string, number>>();
  for (const sale of sales) {
    if (!selectedDays.has(sale.sale_date) || sale.quantity_sold <= 0) continue;
    const key = normalizeKey(sale.item_name);
    const daily = totals.get(key) ?? new Map<string, number>();
    daily.set(sale.sale_date, (daily.get(sale.sale_date) ?? 0) + finiteNonNegative(sale.quantity_sold));
    totals.set(key, daily);
  }
  const result = new Map<string, number>();
  for (const [key, daily] of totals) {
    if (daily.size < 3) continue;
    result.set(key, robustAverage(days.map((day) => daily.get(day) ?? 0)));
  }
  return result;
}

function robustAverage(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const trimmed = sorted.length >= 10 ? sorted.slice(1, -1) : sorted;
  return trimmed.length ? trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length : 0;
}

function latestHandledByItem(history: OperationalRecommendationHistory[]) {
  const result = new Map<string, OperationalRecommendationHistory>();
  history
    .filter((entry) => ["approved", "dismissed", "ordered"].includes(entry.status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .forEach((entry) => {
      if (!result.has(entry.inventory_item_id)) result.set(entry.inventory_item_id, entry);
    });
  return result;
}

function learnedQuantities(history: OperationalRecommendationHistory[]) {
  const samples = new Map<string, number[]>();
  const oldest = Date.now() - 180 * 86_400_000;
  for (const entry of history.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (!["approved", "ordered"].includes(entry.status)) continue;
    const timestamp = Date.parse(entry.created_at);
    if (!Number.isFinite(timestamp) || timestamp < oldest || timestamp > Date.now() + 86_400_000) continue;
    const key = `${entry.inventory_item_id}\u001f${canonicalInventoryUnit(entry.unit)}`;
    const values = samples.get(key) ?? [];
    if (values.length < 8 && entry.recommended_quantity > 0) values.push(entry.recommended_quantity);
    samples.set(key, values);
  }
  const result = new Map<string, number>();
  for (const [key, values] of samples) {
    if (values.length < 3) continue;
    values.sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    result.set(key, values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2);
  }
  return result;
}

function boundedLearnedQuantity(learned: number | undefined, calculated: number, par: number) {
  if (!learned || !Number.isFinite(learned)) return undefined;
  const minimum = Math.max(1, calculated * 0.5);
  const maximum = Math.max(calculated * 1.75, par * 1.25, 1);
  return learned >= minimum && learned <= maximum ? Math.max(1, Math.ceil(learned)) : undefined;
}

function dedupeInsights(insights: OperationalInsight[]) {
  const seen = new Set<string>();
  return insights.filter((insight) => {
    const key = `${insight.insight_type}\u001f${insight.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function finitePositive(value: number | null | undefined) {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : null;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

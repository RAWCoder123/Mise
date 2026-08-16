import type { InventoryEvent } from "./inventoryLedger";
import { latestVerifiedCountEvidence, type OperationalVerifiedRecipeMapping } from "./operationalSignals";
import type {
  InventoryItem,
  MenuItemIngredient,
  PosIntegration,
  PosSale,
  RestaurantEmailConnection,
  SupplierRecipient
} from "../../types/mise";

export type PilotReadinessStatus = "ready" | "attention" | "blocked" | "external";
export type PilotReadinessAreaId =
  | "pos_sales"
  | "inventory_counts"
  | "recipe_coverage"
  | "supplier_routing"
  | "email_delivery";

export interface PilotReadinessArea {
  id: PilotReadinessAreaId;
  status: PilotReadinessStatus;
  summary: string;
  blockers: string[];
  metrics: Record<string, number>;
}

export interface PilotReadiness {
  restaurantId: string;
  generatedAt: string;
  status: PilotReadinessStatus;
  areas: PilotReadinessArea[];
  canRecommend: boolean;
  canDraft: boolean;
  canSend: boolean;
}

export interface PilotReadinessInput {
  restaurantId: string;
  generatedAt?: string;
  posIntegrations: readonly PosIntegration[];
  sales: readonly PosSale[];
  inventoryItems: readonly InventoryItem[];
  countEvents: readonly InventoryEvent[];
  recipeMappings: readonly MenuItemIngredient[];
  verifiedRecipeMappings?: readonly OperationalVerifiedRecipeMapping[];
  supplierRecipients: readonly SupplierRecipient[];
  emailConnection: RestaurantEmailConnection | null;
  minimumSalesDays?: number;
  minimumRecipeCoverage?: number;
  maximumCountAgeHours?: number;
}

const statusRank: Record<PilotReadinessStatus, number> = {
  ready: 0,
  attention: 1,
  external: 2,
  blocked: 3
};

export function buildPilotReadiness(input: PilotReadinessInput): PilotReadiness {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("Pilot readiness requires a restaurant id.");
  assertRestaurantScope(restaurantId, input);

  const generatedAt = new Date(input.generatedAt ?? Date.now()).toISOString();
  const minimumSalesDays = boundedThreshold(input.minimumSalesDays, 7, 1, 90);
  const minimumRecipeCoverage = boundedThreshold(input.minimumRecipeCoverage, 0.9, 0.01, 1);
  const maximumCountAgeHours = boundedThreshold(input.maximumCountAgeHours, 36, 1, 24 * 30);

  const areas = [
    assessPosSales(input.posIntegrations, input.sales, minimumSalesDays, generatedAt),
    assessInventoryCounts(input.inventoryItems, input.countEvents, maximumCountAgeHours, generatedAt),
    assessRecipeCoverage(
      input.sales,
      input.recipeMappings,
      input.verifiedRecipeMappings ?? [],
      input.posIntegrations,
      minimumRecipeCoverage
    ),
    assessSupplierRouting(input.inventoryItems, input.supplierRecipients),
    assessEmailDelivery(input.emailConnection, input.inventoryItems, input.supplierRecipients)
  ];
  const byId = new Map(areas.map((area) => [area.id, area]));
  const recommendationAreas: PilotReadinessAreaId[] = [
    "pos_sales",
    "inventory_counts",
    "recipe_coverage"
  ];
  const recommendationReady = recommendationAreas.every(
    (id) => byId.get(id)?.status === "ready"
  );
  const supplierReady = byId.get("supplier_routing")?.status === "ready";
  const emailReady = byId.get("email_delivery")?.status === "ready";

  return {
    restaurantId,
    generatedAt,
    status: areas.reduce<PilotReadinessStatus>(
      (worst, area) => statusRank[area.status] > statusRank[worst] ? area.status : worst,
      "ready"
    ),
    areas,
    canRecommend: recommendationReady,
    canDraft: recommendationReady && supplierReady,
    canSend: recommendationReady && supplierReady && emailReady
  };
}

function assessPosSales(
  integrations: readonly PosIntegration[],
  sales: readonly PosSale[],
  minimumSalesDays: number,
  generatedAt: string
): PilotReadinessArea {
  const connected = integrations.filter((integration) => integration.status === "connected");
  const square = connected.find((integration) => integration.provider === "square");
  const selectedLocations = square?.locations?.filter(
    (location) => location.status === "active" && location.selected_for_planning
  ) ?? [];
  const squareSales = square
    ? sales.filter((sale) => sale.source_pos.trim().toLowerCase() === "square")
    : [];
  const eligibleSales = square
    ? squareSales.filter(
        (sale) =>
          selectedLocations.length === 1 &&
          sale.pos_location_id === selectedLocations[0]!.id &&
          Boolean(sale.occurred_at) &&
          Boolean(sale.external_catalog_item_id?.trim()) &&
          Boolean(sale.external_variation_id?.trim())
      )
    : sales;
  const salesDays = new Set(eligibleSales.map((sale) => sale.sale_date)).size;
  const latestSync = connected
    .map((integration) => integration.last_sync_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  if (connected.length === 0) {
    return area("pos_sales", "external", "Connect a POS or import verified sales history.", [
      "No connected POS integration was found."
    ], { connectedIntegrations: 0, salesRows: sales.length, salesDays });
  }
  if (sales.length === 0) {
    return area("pos_sales", "blocked", "The POS is connected but no sales are available.", [
      "Run a historical sales sync before generating recommendations."
    ], { connectedIntegrations: connected.length, salesRows: 0, salesDays });
  }
  const blockers: string[] = [];
  if (square && selectedLocations.length !== 1) {
    blockers.push("Select exactly one active Square location for planning.");
  }
  if (square && eligibleSales.length !== squareSales.length) {
    blockers.push(`${squareSales.length - eligibleSales.length} Square sales rows are missing verified location, timestamp, or catalog identity.`);
  }
  if (salesDays < minimumSalesDays) {
    blockers.push(`Only ${salesDays} of ${minimumSalesDays} required sales days are available.`);
  }
  if (!latestSync || ageHours(latestSync, generatedAt) > 24) {
    blockers.push("The latest connected POS sync is more than 24 hours old or unverified.");
  }
  return area(
    "pos_sales",
    blockers.length === 0 ? "ready" : square ? "blocked" : "attention",
    blockers.length === 0 ? "POS history and sync freshness are ready." : "POS data needs attention.",
    blockers,
    {
      connectedIntegrations: connected.length,
      salesRows: eligibleSales.length,
      salesDays,
      selectedLocations: selectedLocations.length,
      incompleteLiveRows: square ? squareSales.length - eligibleSales.length : 0
    }
  );
}

function assessInventoryCounts(
  items: readonly InventoryItem[],
  countEvents: readonly InventoryEvent[],
  maximumCountAgeHours: number,
  generatedAt: string
): PilotReadinessArea {
  if (items.length === 0) {
    return area("inventory_counts", "blocked", "No inventory baseline exists.", [
      "Add inventory items and complete a physical count."
    ], { inventoryItems: 0, countedItems: 0, freshCountedItems: 0, verifiedCanonicalUnits: 0 });
  }
  const latestCountByItem = new Map(
    items.map((item) => [
      item.id,
      latestVerifiedCountEvidence(item.restaurant_id, item.id, countEvents, generatedAt)
    ] as const)
  );
  const missing = items.filter((item) => !latestCountByItem.get(item.id));
  const stale = items.filter((item) => {
    const evidence = latestCountByItem.get(item.id);
    return evidence ? ageHours(evidence.effectiveAt, generatedAt) > maximumCountAgeHours : false;
  });
  const unverified = items.filter(
    (item) => item.canonical_unit_verification_status !== "verified"
  );
  const blockers: string[] = [];
  if (missing.length > 0) blockers.push(`${missing.length} inventory items have no physical-count evidence.`);
  if (unverified.length > 0) blockers.push(`${unverified.length} inventory items have unverified canonical units.`);
  if (stale.length > 0) blockers.push(`${stale.length} inventory counts are older than ${maximumCountAgeHours} hours.`);
  const status: PilotReadinessStatus = missing.length > 0 || unverified.length > 0
    ? "blocked"
    : stale.length > 0
      ? "attention"
      : "ready";
  return area(
    "inventory_counts",
    status,
    status === "ready" ? "Physical counts and canonical units are ready." : "Inventory evidence is incomplete or stale.",
    blockers,
    {
      inventoryItems: items.length,
      countedItems: items.length - missing.length,
      freshCountedItems: items.length - missing.length - stale.length,
      verifiedCanonicalUnits: items.length - unverified.length
    }
  );
}

function assessRecipeCoverage(
  sales: readonly PosSale[],
  mappings: readonly MenuItemIngredient[],
  verifiedRecipeMappings: readonly OperationalVerifiedRecipeMapping[],
  integrations: readonly PosIntegration[],
  minimumCoverage: number
): PilotReadinessArea {
  const square = integrations.find(
    (integration) => integration.provider === "square" && integration.status === "connected"
  );
  const selectedLocation = square?.locations?.find(
    (location) => location.status === "active" && location.selected_for_planning
  ) ?? null;
  if (square) {
    const liveSales = sales.filter(
      (sale) =>
        sale.source_pos.trim().toLowerCase() === "square" &&
        sale.pos_location_id === selectedLocation?.id &&
        Boolean(sale.external_catalog_item_id?.trim()) &&
        Boolean(sale.external_variation_id?.trim())
    );
    const verifiedKeys = new Set(
      verifiedRecipeMappings
        .filter((mapping) => mapping.pos_location_id === selectedLocation?.id)
        .map((mapping) => `${mapping.external_catalog_item_id}\u001f${mapping.external_variation_id}`)
    );
    const totalQuantity = liveSales.reduce((sum, sale) => sum + positive(sale.quantity_sold), 0);
    const mappedQuantity = liveSales.reduce((sum, sale) => {
      const key = `${sale.external_catalog_item_id ?? ""}\u001f${sale.external_variation_id ?? ""}`;
      return sum + (verifiedKeys.has(key) ? positive(sale.quantity_sold) : 0);
    }, 0);
    const coverage = totalQuantity > 0 ? mappedQuantity / totalQuantity : 0;
    const missingNames = new Set(
      liveSales
        .filter((sale) => {
          const key = `${sale.external_catalog_item_id ?? ""}\u001f${sale.external_variation_id ?? ""}`;
          return positive(sale.quantity_sold) > 0 && !verifiedKeys.has(key);
        })
        .map((sale) => sale.item_name.trim())
    );
    const blockers = coverage >= minimumCoverage ? [] : [
      `Verified Square recipe coverage is ${Math.round(coverage * 100)}%; ${Math.round(minimumCoverage * 100)}% is required.`,
      ...[...missingNames].slice(0, 5).map((name) => `Missing verified recipe chain for ${name}.`)
    ];
    return area(
      "recipe_coverage",
      totalQuantity === 0 || mappedQuantity === 0 ? "blocked" : coverage >= minimumCoverage ? "ready" : "attention",
      coverage >= minimumCoverage
        ? "Verified Square catalog-to-recipe coverage is ready."
        : "Draft or name-only mappings cannot support live depletion.",
      blockers,
      {
        recipeMappings: new Set(verifiedRecipeMappings.map((mapping) => mapping.recipe_version_id)).size,
        mappedSalesQuantity: mappedQuantity,
        totalSalesQuantity: totalQuantity,
        coveragePercent: Math.round(coverage * 100)
      }
    );
  }
  const mappedNames = new Set(mappings.map((mapping) => normalizeName(mapping.menu_item_name)));
  const totalQuantity = sales.reduce((sum, sale) => sum + positive(sale.quantity_sold), 0);
  const mappedQuantity = sales.reduce(
    (sum, sale) => sum + (mappedNames.has(normalizeName(sale.item_name)) ? positive(sale.quantity_sold) : 0),
    0
  );
  const coverage = totalQuantity > 0 ? mappedQuantity / totalQuantity : 0;
  const missingNames = new Set(
    sales
      .filter((sale) => positive(sale.quantity_sold) > 0 && !mappedNames.has(normalizeName(sale.item_name)))
      .map((sale) => sale.item_name.trim())
  );
  const blockers = coverage >= minimumCoverage ? [] : [
    `Recipe coverage is ${Math.round(coverage * 100)}%; ${Math.round(minimumCoverage * 100)}% is required.`,
    ...[...missingNames].slice(0, 5).map((name) => `Missing recipe mapping for ${name}.`)
  ];
  return area(
    "recipe_coverage",
    totalQuantity === 0 || mappedQuantity === 0 ? "blocked" : coverage >= minimumCoverage ? "ready" : "attention",
    coverage >= minimumCoverage ? "Sales-weighted recipe coverage is ready." : "Recipe coverage cannot support a trustworthy depletion model yet.",
    blockers,
    { recipeMappings: mappings.length, mappedSalesQuantity: mappedQuantity, totalSalesQuantity: totalQuantity, coveragePercent: Math.round(coverage * 100) }
  );
}

function assessSupplierRouting(
  items: readonly InventoryItem[],
  recipients: readonly SupplierRecipient[]
): PilotReadinessArea {
  const missingSupplier = items.filter((item) => !item.supplier_name.trim());
  const missingCost = items.filter((item) => !Number.isFinite(item.estimated_unit_cost) || item.estimated_unit_cost <= 0);
  const suppliers = new Set(items.map((item) => normalizeName(item.supplier_name)).filter(Boolean));
  const recipientSuppliers = new Set(
    recipients.filter((recipient) => Boolean(recipient.email?.trim())).map((recipient) => normalizeName(recipient.supplier_name))
  );
  const missingRecipients = [...suppliers].filter((supplier) => !recipientSuppliers.has(supplier));
  const blockers: string[] = [];
  if (missingSupplier.length > 0) blockers.push(`${missingSupplier.length} inventory items have no supplier.`);
  if (missingCost.length > 0) blockers.push(`${missingCost.length} inventory items have no positive unit cost.`);
  const status: PilotReadinessStatus = missingSupplier.length > 0 || missingCost.length > 0
    ? "blocked"
    : "ready";
  return area("supplier_routing", status, status === "ready" ? "Supplier routing and costs are ready." : "Supplier routing needs attention.", blockers, {
    suppliers: suppliers.size,
    configuredRecipients: recipientSuppliers.size,
    missingRecipients: missingRecipients.length,
    missingCosts: missingCost.length
  });
}

function assessEmailDelivery(
  connection: RestaurantEmailConnection | null,
  items: readonly InventoryItem[],
  recipients: readonly SupplierRecipient[]
): PilotReadinessArea {
  const suppliers = new Set(items.map((item) => normalizeName(item.supplier_name)).filter(Boolean));
  const configured = new Set(
    recipients.filter((recipient) => Boolean(recipient.email?.trim())).map((recipient) => normalizeName(recipient.supplier_name))
  );
  const missingRecipients = [...suppliers].filter((supplier) => !configured.has(supplier)).length;
  if (connection?.status !== "connected") {
    return area("email_delivery", "external", "Connect and verify the restaurant Gmail sender.", [
      connection?.status === "needs_reauth" ? "Gmail authorization must be renewed." : "No connected Gmail sender was found."
    ], { configuredRecipients: configured.size, missingRecipients });
  }
  const blockers: string[] = [];
  if (!connection.sender_email?.trim()) blockers.push("The connected Gmail account has no verified sender address.");
  if (missingRecipients > 0) blockers.push(`${missingRecipients} suppliers have no email recipient.`);
  return area(
    "email_delivery",
    blockers.length === 0 ? "ready" : "blocked",
    blockers.length === 0 ? "Gmail sender and supplier recipients are ready." : "Email delivery is not ready.",
    blockers,
    { configuredRecipients: configured.size, missingRecipients }
  );
}

function area(
  id: PilotReadinessAreaId,
  status: PilotReadinessStatus,
  summary: string,
  blockers: string[],
  metrics: Record<string, number>
): PilotReadinessArea {
  return { id, status, summary, blockers, metrics };
}

function assertRestaurantScope(restaurantId: string, input: PilotReadinessInput) {
  const mismatched = [
    ...input.posIntegrations.map((item) => item.restaurant_id),
    ...input.sales.map((item) => item.restaurant_id),
    ...input.inventoryItems.map((item) => item.restaurant_id),
    ...input.countEvents.map((item) => item.restaurantId),
    ...input.recipeMappings.map((item) => item.restaurant_id),
    ...(input.verifiedRecipeMappings ?? []).map((item) => item.restaurant_id),
    ...input.supplierRecipients.map((item) => item.restaurant_id),
    ...(input.emailConnection ? [input.emailConnection.restaurant_id] : [])
  ].some((id) => id !== restaurantId);
  if (mismatched) throw new Error("Pilot readiness inputs failed restaurant scope validation.");
}

function boundedThreshold(value: number | undefined, fallback: number, minimum: number, maximum: number) {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function positive(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function ageHours(then: string, now: string) {
  const elapsed = new Date(now).getTime() - new Date(then).getTime();
  return Number.isFinite(elapsed) ? Math.max(0, elapsed / 3_600_000) : Number.POSITIVE_INFINITY;
}

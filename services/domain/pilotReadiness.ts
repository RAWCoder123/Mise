import type { InventoryEvent } from "./inventoryLedger";
import type {
  InventoryItem,
  MenuItemIngredient,
  PosIntegration,
  PosSale,
  RestaurantEmailConnection,
  SupplierRecipient
} from "../../types/mise";
import { saleMatchesRecipe, type VerifiedProviderSaleMapping } from "./providerSaleIdentity";

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
  providerMappings?: readonly VerifiedProviderSaleMapping[];
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
    assessRecipeCoverage(input.sales, input.recipeMappings, input.providerMappings ?? [], minimumRecipeCoverage),
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
  const salesDays = new Set(sales.map((sale) => sale.sale_date)).size;
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
  if (salesDays < minimumSalesDays) {
    blockers.push(`Only ${salesDays} of ${minimumSalesDays} required sales days are available.`);
  }
  if (!latestSync || ageHours(latestSync, generatedAt) > 24) {
    blockers.push("The latest connected POS sync is more than 24 hours old or unverified.");
  }
  return area(
    "pos_sales",
    blockers.length === 0 ? "ready" : "attention",
    blockers.length === 0 ? "POS history and sync freshness are ready." : "POS data needs attention.",
    blockers,
    { connectedIntegrations: connected.length, salesRows: sales.length, salesDays }
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
  const latestCountByItem = new Map<string, string>();
  for (const event of countEvents) {
    const current = latestCountByItem.get(event.inventoryItemId);
    if (!current || event.effectiveAt > current) latestCountByItem.set(event.inventoryItemId, event.effectiveAt);
  }
  const missing = items.filter((item) => !latestCountByItem.has(item.id));
  const stale = items.filter((item) => {
    const timestamp = latestCountByItem.get(item.id);
    return timestamp ? ageHours(timestamp, generatedAt) > maximumCountAgeHours : false;
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
  providerMappings: readonly VerifiedProviderSaleMapping[],
  minimumCoverage: number
): PilotReadinessArea {
  const totalQuantity = sales.reduce((sum, sale) => sum + positive(sale.quantity_sold), 0);
  const mappedQuantity = sales.reduce(
    (sum, sale) => sum + (mappings.some((mapping) => saleMatchesRecipe(sale, mapping, providerMappings)) ? positive(sale.quantity_sold) : 0),
    0
  );
  const coverage = totalQuantity > 0 ? mappedQuantity / totalQuantity : 0;
  const missingNames = new Set(
    sales
      .filter((sale) => positive(sale.quantity_sold) > 0 && !mappings.some((mapping) => saleMatchesRecipe(sale, mapping, providerMappings)))
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
  const missingSupplier = items.filter((item) => !item.supplier_id.trim());
  const missingCost = items.filter((item) => !Number.isFinite(item.estimated_unit_cost) || item.estimated_unit_cost <= 0);
  const suppliers = new Set(items.map((item) => item.supplier_id.trim()).filter(Boolean));
  const recipientSuppliers = new Set(
    recipients
      .filter((recipient) => Boolean(recipient.email?.trim()))
      .map((recipient) => recipient.supplier_id.trim())
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
  const suppliers = new Set(items.map((item) => item.supplier_id.trim()).filter(Boolean));
  const configured = new Set(
    recipients
      .filter((recipient) => Boolean(recipient.email?.trim()))
      .map((recipient) => recipient.supplier_id.trim())
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

function positive(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function ageHours(then: string, now: string) {
  const elapsed = new Date(now).getTime() - new Date(then).getTime();
  return Number.isFinite(elapsed) ? Math.max(0, elapsed / 3_600_000) : Number.POSITIVE_INFINITY;
}

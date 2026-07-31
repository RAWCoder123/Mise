import type {
  InsightPresentationDescriptor,
  LearningMemoryPresentationDescriptor,
  LearningMemorySignalPresentationDescriptor
} from "./presentation";

export type Urgency = "low" | "medium" | "high";
export type RecommendationStatus = "pending" | "approved" | "dismissed" | "ordered";
export type SupplierOrderStatus = "draft" | "sent" | "completed";
export type InsightType = "sales" | "inventory" | "waste" | "cost" | "prep" | "ordering";
export type InsightSeverity = "info" | "warning" | "urgent";
export type InventoryStatus = "Good" | "Watch" | "Low" | "Critical";
export type DemandTrend = "normal" | "rising" | "falling" | "learning";
export type RestaurantRole = "owner" | "admin" | "manager" | "staff";
export type RestaurantMembershipStatus = "active" | "invited" | "disabled";
export type RestaurantServiceStyle = "quick_service" | "fast_casual" | "full_service" | "bar" | "cafe" | "ghost_kitchen";
export type PosIntegrationProvider = "square" | "toast" | "clover" | "lightspeed" | "manual_csv" | "demo";
export type IntegrationStatus = "not_connected" | "connected" | "paused" | "error";
export type SalesImportStatus = "queued" | "processing" | "completed" | "failed";
export type PurchaseOrderStatus = "draft" | "submitted" | "received" | "cancelled";
export type AiInsightRiskLevel = "low" | "medium" | "high";
export type AiInsightStatus = "generated" | "reviewed" | "dismissed" | "applied";
export type EmailProvider = "gmail";
export type EmailConnectionStatus = "not_connected" | "connected" | "needs_reauth" | "restricted";
export type SetupAttachmentKind = "csv" | "screenshot";
export type SetupAttachmentStatus = "queued" | "review_needed" | "processed" | "dismissed";

export interface RestaurantOperationalProfile {
  serviceStyle: RestaurantServiceStyle;
  orderCadence: string[];
  prepWindows: string[];
  primarySuppliers: string[];
  inventoryReviewDays: string[];
  notes: string | null;
}

export interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  cuisine_type: string | null;
  brand_color: string;
  accent_color: string;
  logo_url: string | null;
  service_style: RestaurantServiceStyle;
  timezone: string;
  currency: string;
  operational_profile: RestaurantOperationalProfile;
  created_at: string;
}

export interface AppUser {
  id: string;
  restaurant_id: string | null;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface RestaurantMembership {
  id: string;
  restaurant_id: string;
  user_id: string;
  role: RestaurantRole;
  status: RestaurantMembershipStatus;
  created_at: string;
  updated_at: string;
}

export interface RestaurantTeamMember extends RestaurantMembership {
  display_name: string;
  email: string;
}

export interface PosSale {
  id: string;
  restaurant_id: string;
  source_record_id?: string | null;
  sale_date: string;
  item_name: string;
  category: string;
  quantity_sold: number;
  gross_sales: number;
  net_sales: number;
  source_pos: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  restaurant_id: string;
  item_name: string;
  category: string;
  unit: string;
  current_quantity: number;
  par_level: number;
  reorder_threshold: number;
  estimated_unit_cost: number;
  supplier_name: string;
  last_updated: string;
}

export type InventoryMovementReason =
  | "manual_count"
  | "manager_correction"
  | "receiving"
  | "waste"
  | "transfer"
  | "pos_consumption"
  | "recipe_consumption"
  | "system_adjustment";

export interface InventoryMovement {
  id: string;
  restaurant_id: string;
  inventory_item_id: string;
  actor_user_id: string | null;
  reason: InventoryMovementReason;
  quantity_before: number;
  quantity_after: number;
  delta: number;
  source_workflow: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type InventoryCountSessionStatus = "in_progress" | "submitted" | "approved" | "cancelled";

export interface InventoryCountSession {
  id: string;
  restaurant_id: string;
  status: InventoryCountSessionStatus;
  started_by: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  cancelled_by: string | null;
  started_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  cancelled_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryCountLine {
  id: string;
  restaurant_id: string;
  session_id: string;
  inventory_item_id: string;
  item_name: string;
  unit: string;
  system_quantity_at_start: number;
  counted_quantity: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryCountSessionDetail {
  session: InventoryCountSession;
  lines: InventoryCountLine[];
}

export interface MenuItemIngredient {
  id: string;
  restaurant_id: string;
  menu_item_name: string;
  inventory_item_id: string;
  quantity_used_per_sale: number;
  unit: string;
}

export interface MenuItemIngredientInput {
  restaurant_id: string;
  menu_item_name: string;
  inventory_item_id: string;
  quantity_used_per_sale: number;
  unit: string;
}

export interface PurchaseRecommendation {
  id: string;
  restaurant_id: string;
  inventory_item_id: string;
  item_name: string;
  supplier_name: string;
  recommended_quantity: number;
  unit: string;
  reason: string;
  urgency: Urgency;
  status: RecommendationStatus;
  supplier_order_id: string | null;
  created_at: string;
}

export interface SupplierOrder {
  id: string;
  restaurant_id: string;
  supplier_name: string;
  order_message: string;
  operator_note: string | null;
  status: SupplierOrderStatus;
  delivery_date: string | null;
  created_at: string;
}

export interface Insight {
  id: string;
  restaurant_id: string;
  insight_type: InsightType;
  title: string;
  description: string;
  why_it_matters?: string | null;
  recommended_action: string;
  severity: InsightSeverity;
  created_at: string;
  /** Additive locale-neutral metadata for Mise-generated rules. */
  presentation?: InsightPresentationDescriptor;
}

export interface PosIntegration {
  id: string;
  restaurant_id: string;
  provider: PosIntegrationProvider;
  status: IntegrationStatus;
  external_location_id: string | null;
  last_sync_at: string | null;
  sync_cursor: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SalesImport {
  id: string;
  restaurant_id: string;
  pos_integration_id: string | null;
  import_type: "pos_sync" | "csv_upload" | "manual_adjustment";
  status: SalesImportStatus;
  source_file_name: string | null;
  records_processed: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
  imported_at: string;
}

export interface SupplierItem {
  id: string;
  restaurant_id: string;
  supplier_name: string;
  supplier_sku: string | null;
  item_name: string;
  unit: string;
  pack_size: string | null;
  estimated_unit_cost: number;
  preferred: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  restaurant_id: string;
  supplier_name: string;
  status: PurchaseOrderStatus;
  order_payload: Record<string, unknown>;
  subtotal_estimate: number;
  expected_delivery_date: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiInsight {
  id: string;
  restaurant_id: string;
  source: "openai_structured_output" | "rules_engine" | "operator_note";
  schema_version: string;
  output: Record<string, unknown>;
  risk_level: AiInsightRiskLevel;
  confidence: number;
  status: AiInsightStatus;
  generated_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  restaurant_id: string;
  actor_user_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RestaurantEmailConnection {
  id: string;
  restaurant_id: string;
  provider: EmailProvider;
  status: EmailConnectionStatus;
  sender_email: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierRecipient {
  id: string;
  restaurant_id: string;
  supplier_name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface SetupAttachment {
  id: string;
  restaurant_id: string;
  kind: SetupAttachmentKind;
  label: string;
  status: SetupAttachmentStatus;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierEmailPayload {
  orderId: string;
  supplierName: string;
  to: string | null;
  from: string | null;
  subject: string;
  body: string;
  canSend: boolean;
  blockedReason: string | null;
}

export interface RestaurantOpsProfile {
  restaurant: Restaurant;
  posIntegrations: PosIntegration[];
  supplierItems: SupplierItem[];
  recentAiInsights: AiInsight[];
}

export interface SalesTrendPoint {
  label: string;
  sales: number;
}

export interface AttentionCard {
  id: string;
  title: string;
  detail: string;
  context?: string;
  actionLabel: string;
  route: "/inventory" | "/orders" | "/insights";
  severity: InsightSeverity;
}

export interface InventoryPrediction {
  averageDailyUsage: number;
  historySampleDays: number;
  historySource: "restaurant_history" | "demo_fallback" | "current_day" | "none";
  todayDepletion: number;
  projectedQuantity: number;
  projectedStatus: InventoryStatus;
  daysCoverage: number | null;
  coverageLabel: string;
  demandTrend: DemandTrend;
  trendLabel: string;
  suggestedOrderQuantity: number;
  suggestedAction: string;
  urgency: Urgency;
  basis: string;
  depletionCopy: string;
  confidenceCopy: string;
  recommendationCopy: string;
  whyItMatters: string;
}

export interface InventoryOutlookItem {
  item: InventoryItem;
  prediction: InventoryPrediction;
}

export interface InventoryCategorySummary {
  proteins: number;
  produce: number;
  dryGoods: number;
  dairy: number;
  other: number;
}

export interface InventoryControlSummary {
  itemCount: number;
  wellStockedPercent: number;
  needOrderCount: number;
  criticalCount: number;
  lowCount: number;
  watchCount: number;
  stableCount: number;
  categoryCounts: InventoryCategorySummary;
  readinessLabel: string;
  operatorCopy: string;
  nextStep: string;
}

export interface RecipeBaselineItem {
  menu_item_name: string;
  ingredientCount: number;
  linkedInventoryItems: string[];
  ingredients: RecipeBaselineIngredient[];
  todayQuantitySold: number;
}

export interface RecipeBaselineIngredient {
  mappingId: string;
  inventoryItemId: string;
  itemName: string;
  quantityUsedPerSale: number;
  unit: string;
}

export interface RecipeBaselineSummary {
  menuItemsTracked: number;
  ingredientMappings: number;
  inventoryItemsLinked: number;
  posItemsCovered: number;
  posItemsMissingRecipes: string[];
  coveragePercent: number;
  credibilityLabel: string;
  operatorCopy: string;
  items: RecipeBaselineItem[];
}

export interface MiseWorkflowSummary {
  posMenuItemsCovered: number;
  recipeLinks: number;
  projectedDepletedItems: number;
  pendingOrderItems: number;
}

export interface MiseCredibilitySummary {
  score: number;
  label: string;
  evidence: string[];
  nextStep: string;
}

export interface OrderQueueSummary {
  pendingItems: number;
  supplierCount: number;
  highUrgencyItems: number;
  draftCount: number;
  sentCount: number;
  readinessLabel: string;
  operatorCopy: string;
  nextStep: string;
}

export interface InsightSummary {
  signalCount: number;
  urgentCount: number;
  warningCount: number;
  learningCount: number;
  readinessLabel: string;
  operatorCopy: string;
  nextStep: string;
}

export type LearningMemoryTone = "brand" | "leaf" | "neutral" | "warning";

export interface LearningMemorySignal {
  label: string;
  value: string;
  detail: string;
  tone: LearningMemoryTone;
  /** Additive locale-neutral values; legacy/raw fields remain intact. */
  presentation?: LearningMemorySignalPresentationDescriptor;
}

export interface LearningMemorySummary {
  score: number;
  label: string;
  operatorCopy: string;
  nextStep: string;
  signals: LearningMemorySignal[];
  /** Additive locale-neutral branch codes; raw English remains available to legacy clients. */
  presentation?: LearningMemoryPresentationDescriptor;
}

export type DemoReadinessStatus = "ready" | "attention" | "missing";

export interface DemoReadinessCheck {
  id: string;
  label: string;
  detail: string;
  evidence: string;
  status: DemoReadinessStatus;
}

export interface DemoWalkthroughCheck {
  id: string;
  label: string;
  description: string;
  route: string | null;
  status: DemoReadinessStatus;
}

export interface DemoReadinessSummary {
  score: number;
  label: string;
  status: DemoReadinessStatus;
  completedCount: number;
  attentionCount: number;
  totalCount: number;
  checks: DemoReadinessCheck[];
  walkthroughChecks: DemoWalkthroughCheck[];
  nextStep: string;
}

export type SetupReadinessStepId = "profile" | "inventory" | "recipes" | "email";
export type SetupReadinessStatus = "complete" | "active" | "missing";

export interface SetupReadinessStep {
  id: SetupReadinessStepId;
  label: string;
  detail: string;
  status: SetupReadinessStatus;
  missing: string[];
}

export interface SetupReadinessSummary {
  percent: number;
  currentStep: SetupReadinessStepId;
  steps: SetupReadinessStep[];
  missingInventory: string[];
  missingRecipes: string[];
  missingSuppliers: string[];
  missingEmailSender: boolean;
  canShowSalesRhythm: boolean;
  canShowSupplierTrend: boolean;
  canShowRecipeCoverage: boolean;
  emailConnectionStatus: EmailConnectionStatus;
}

export interface SupplierOrderTrendPoint {
  label: string;
  orders: number;
}

export interface ConditionalAnalyticsSummary {
  canShowSalesRhythm: boolean;
  canShowSupplierTrend: boolean;
  canShowRecipeCoverage: boolean;
  supplierTrend: SupplierOrderTrendPoint[];
  supplierTrendLabel: string;
  emptyStates: {
    salesRhythm: string;
    supplierTrend: string;
    recipeCoverage: string;
  };
}

export interface TodaySummary {
  restaurantName: string;
  operatingSummary: string;
  miseStatus: string;
  learningNote: string;
  salesToday: number;
  netSalesToday: number;
  itemsSold: number;
  topItems: PosSale[];
  lowStockCount: number;
  inventoryAlerts: number;
  pendingRecommendations: number;
  importantInsight: Insight | null;
  attentionCards: AttentionCard[];
  salesTrend: SalesTrendPoint[];
  recipeBaseline: RecipeBaselineSummary;
  workflow: MiseWorkflowSummary;
  credibility: MiseCredibilitySummary;
}

export type InventoryItemPatch = Partial<
  Pick<InventoryItem, "current_quantity" | "par_level" | "reorder_threshold" | "supplier_name">
>;

export type InventoryItemCreateInput = Pick<
  InventoryItem,
  | "item_name"
  | "category"
  | "unit"
  | "current_quantity"
  | "par_level"
  | "reorder_threshold"
  | "estimated_unit_cost"
  | "supplier_name"
>;

export type PosProvider = "Toast" | "Square" | "Clover" | "Lightspeed" | "Manual CSV Upload";

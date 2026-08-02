import type {
  AppUser,
  AiInsight,
  AuditLog,
  Insight,
  InventoryCountSessionDetail,
  InventoryItem,
  InventoryLocationBalance,
  InventoryMovement,
  MenuItemIngredient,
  PosIntegration,
  PosProvider,
  PosSale,
  PurchaseOrder,
  PurchaseRecommendation,
  Restaurant,
  RestaurantEmailConnection,
  RestaurantMembership,
  SalesImport,
  StorageLocation,
  SupplierItem,
  SupplierOrder,
  SupplierRecipient
} from "../../types/mise";
import type { SetupPosSaleDraft } from "../domain/setupDrafts";
import {
  assertNoConsumedPosSaleCorrections,
  buildRecipeConsumptionPlan,
  collectConsumedPosSourceRecordIds,
  hasAppliedConsumptionLine
} from "../domain/posConsumption";
import { addDays, toDateKeyInTimeZone } from "../../utils/format";
import { DEMO_DATASET, type DemoDatasetId } from "./demoDataset";
import { reconcileDemoLocationBalancesToOnHand } from "./storageLocations";

const DEMO_SCHEMA_VERSION = 8 as const;
const DEMO_MAIN_STORAGE_LOCATION_ID = "00000000-0000-4000-8000-000000000701";

export const DEMO_RESTAURANT_ID = DEMO_DATASET.restaurant.id;
export const DEMO_USER_ID = DEMO_DATASET.user.id;
export const DEMO_MANAGER_USER_ID = "00000000-0000-4000-8000-000000000012";
export const DEMO_STAFF_USER_ID = "00000000-0000-4000-8000-000000000013";
export const DEMO_RESTAURANT_TIME_ZONE = DEMO_DATASET.restaurant.timezone;

const itemIds = {
  chicken: "00000000-0000-4000-8000-000000000101",
  eggs: "00000000-0000-4000-8000-000000000102",
  rice: "00000000-0000-4000-8000-000000000103",
  lettuce: "00000000-0000-4000-8000-000000000104",
  tomatoes: "00000000-0000-4000-8000-000000000105",
  beef: "00000000-0000-4000-8000-000000000106",
  pancakeMix: "00000000-0000-4000-8000-000000000107"
};

export interface DemoMemberInviteRecord {
  id: string;
  restaurant_id: string;
  email: string;
  role: Exclude<RestaurantMembership["role"], "owner">;
  status: "pending" | "claimed" | "revoked" | "expired";
  token_hash: string;
  created_by: string;
  claimed_by: string | null;
  expires_at: string;
  created_at: string;
  claimed_at: string | null;
  revoked_at: string | null;
}

export interface DemoState {
  schema_version: typeof DEMO_SCHEMA_VERSION;
  restaurants: Restaurant[];
  users: AppUser[];
  memberships: RestaurantMembership[];
  memberInvites: DemoMemberInviteRecord[];
  posSales: PosSale[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  inventoryCountSessions: InventoryCountSessionDetail[];
  storageLocations: StorageLocation[];
  inventoryLocationBalances: InventoryLocationBalance[];
  menuItemIngredients: MenuItemIngredient[];
  purchaseRecommendations: PurchaseRecommendation[];
  supplierOrders: SupplierOrder[];
  insights: Insight[];
  posIntegrations: PosIntegration[];
  salesImports: SalesImport[];
  supplierItems: SupplierItem[];
  purchaseOrders: PurchaseOrder[];
  aiInsights: AiInsight[];
  auditLogs: AuditLog[];
  emailConnections: RestaurantEmailConnection[];
  supplierRecipients: SupplierRecipient[];
  currentRestaurantId: string;
  posProvider: PosProvider | null;
  posConnectedAt: string | null;
}

export type StoredDemoState = Partial<Omit<DemoState, "schema_version">> & {
  schema_version?: number;
};

export interface DemoStateRepairResult {
  state: DemoState;
  migrated: boolean;
}

export type DemoPreset = DemoDatasetId;

export interface DemoSetupProfile {
  preset?: DemoPreset;
  supplierNames?: string[];
  inventoryItemNames?: string[];
  recipeBaselineText?: string;
  posSales?: SetupPosSaleDraft[];
}

export const salesBaselines: Record<string, number> = {
  "Chicken Bowl": 32,
  Burger: 26,
  "Fried Rice": 23,
  "Caesar Salad": 16,
  Pancakes: 18,
  "General Tso Chicken": 38,
  "Orange Chicken": 34,
  "Beef Lo Mein": 30,
  "Pork Fried Rice": 28,
  Dumplings: 24,
  "Egg Drop Soup": 18
};

export function createInitialDemoState(
  provider: PosProvider | null = DEMO_DATASET.defaultPosProvider,
  setupProfile?: DemoSetupProfile,
  nowDate = new Date()
): DemoState {
  const now = nowDate.toISOString();
  const restaurantTimeZone = DEMO_RESTAURANT_TIME_ZONE;
  const today = toDateKeyInTimeZone(nowDate, restaurantTimeZone);
  const tomorrow = toDateKeyInTimeZone(addDays(nowDate, 1), restaurantTimeZone);

  const restaurant: Restaurant = {
    id: DEMO_RESTAURANT_ID,
    name: DEMO_DATASET.restaurant.name,
    address: "125 Market Street",
    cuisine_type: DEMO_DATASET.restaurant.cuisineType,
    brand_color: "#EF3F27",
    accent_color: "#EF3F27",
    logo_url: null,
    service_style: "fast_casual",
    timezone: restaurantTimeZone,
    currency: "USD",
    operational_profile: {
      serviceStyle: "fast_casual",
      orderCadence: ["Monday", "Thursday"],
      prepWindows: ["8:00 AM prep", "4:00 PM service reset"],
      primarySuppliers: ["Fresh Poultry Supply", "Restaurant Depot", "Local Produce Co."],
      inventoryReviewDays: ["Monday", "Thursday"],
      notes: "Lunch-heavy fast casual service with produce and protein checks before dinner."
    },
    created_at: now
  };

  const user: AppUser = {
    id: DEMO_USER_ID,
    restaurant_id: DEMO_RESTAURANT_ID,
    name: DEMO_DATASET.user.name,
    email: DEMO_DATASET.user.email,
    role: "owner",
    created_at: now
  };
  const managerUser: AppUser = {
    id: DEMO_MANAGER_USER_ID,
    restaurant_id: DEMO_RESTAURANT_ID,
    name: "Alex Manager",
    email: "alex.manager@demo.mise",
    role: "manager",
    created_at: now
  };
  const staffUser: AppUser = {
    id: DEMO_STAFF_USER_ID,
    restaurant_id: DEMO_RESTAURANT_ID,
    name: "Sam Staff",
    email: "sam.staff@demo.mise",
    role: "staff",
    created_at: now
  };
  const memberships: RestaurantMembership[] = [
    {
      id: "00000000-0000-4000-8000-000000000021",
      restaurant_id: DEMO_RESTAURANT_ID,
      user_id: DEMO_USER_ID,
      role: "owner",
      status: "active",
      created_at: now,
      updated_at: now
    },
    {
      id: "00000000-0000-4000-8000-000000000022",
      restaurant_id: DEMO_RESTAURANT_ID,
      user_id: DEMO_MANAGER_USER_ID,
      role: "manager",
      status: "active",
      created_at: now,
      updated_at: now
    },
    {
      id: "00000000-0000-4000-8000-000000000023",
      restaurant_id: DEMO_RESTAURANT_ID,
      user_id: DEMO_STAFF_USER_ID,
      role: "staff",
      status: "active",
      created_at: now,
      updated_at: now
    }
  ];

  const inventoryItems: InventoryItem[] = [
    {
      id: itemIds.chicken,
      restaurant_id: DEMO_RESTAURANT_ID,
      item_name: "Chicken breast",
      category: "Protein",
      unit: "lbs",
      current_quantity: 18,
      par_level: 60,
      reorder_threshold: 25,
      estimated_unit_cost: 3.7,
      supplier_name: "Fresh Poultry Supply",
      last_updated: now
    },
    {
      id: itemIds.eggs,
      restaurant_id: DEMO_RESTAURANT_ID,
      item_name: "Eggs",
      category: "Dairy",
      unit: "units",
      current_quantity: 72,
      par_level: 240,
      reorder_threshold: 100,
      estimated_unit_cost: 0.22,
      supplier_name: "Restaurant Depot",
      last_updated: now
    },
    {
      id: itemIds.rice,
      restaurant_id: DEMO_RESTAURANT_ID,
      item_name: "Rice",
      category: "Dry goods",
      unit: "lbs",
      current_quantity: 80,
      par_level: 100,
      reorder_threshold: 40,
      estimated_unit_cost: 0.9,
      supplier_name: "Dry Goods Wholesale",
      last_updated: now
    },
    {
      id: itemIds.lettuce,
      restaurant_id: DEMO_RESTAURANT_ID,
      item_name: "Lettuce",
      category: "Produce",
      unit: "heads",
      current_quantity: 12,
      par_level: 35,
      reorder_threshold: 15,
      estimated_unit_cost: 1.4,
      supplier_name: "Local Produce Co.",
      last_updated: now
    },
    {
      id: itemIds.tomatoes,
      restaurant_id: DEMO_RESTAURANT_ID,
      item_name: "Tomatoes",
      category: "Produce",
      unit: "lbs",
      current_quantity: 10,
      par_level: 30,
      reorder_threshold: 12,
      estimated_unit_cost: 1.8,
      supplier_name: "Local Produce Co.",
      last_updated: now
    },
    {
      id: itemIds.beef,
      restaurant_id: DEMO_RESTAURANT_ID,
      item_name: "Beef patties",
      category: "Protein",
      unit: "units",
      current_quantity: 45,
      par_level: 120,
      reorder_threshold: 50,
      estimated_unit_cost: 1.65,
      supplier_name: "Restaurant Depot",
      last_updated: now
    },
    {
      id: itemIds.pancakeMix,
      restaurant_id: DEMO_RESTAURANT_ID,
      item_name: "Pancake mix",
      category: "Dry goods",
      unit: "lbs",
      current_quantity: 20,
      par_level: 50,
      reorder_threshold: 18,
      estimated_unit_cost: 1.2,
      supplier_name: "Dry Goods Wholesale",
      last_updated: now
    }
  ];

  const menuItemIngredients: MenuItemIngredient[] = [
    ingredient("00000000-0000-4000-8000-000000000201", "Chicken Bowl", itemIds.chicken, 0.5, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000202", "Chicken Bowl", itemIds.rice, 0.3, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000203", "Fried Rice", itemIds.rice, 0.4, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000204", "Fried Rice", itemIds.eggs, 2, "units"),
    ingredient("00000000-0000-4000-8000-000000000205", "Burger", itemIds.beef, 1, "units"),
    ingredient("00000000-0000-4000-8000-000000000206", "Burger", itemIds.tomatoes, 0.1, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000207", "Burger", itemIds.lettuce, 0.25, "heads"),
    ingredient("00000000-0000-4000-8000-000000000208", "Caesar Salad", itemIds.lettuce, 0.5, "heads"),
    ingredient("00000000-0000-4000-8000-000000000209", "Pancakes", itemIds.pancakeMix, 0.4, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000210", "Pancakes", itemIds.eggs, 2, "units")
  ];

  const posSales: PosSale[] = [
    sale("00000000-0000-4000-8000-000000000301", today, "Chicken Bowl", "Bowls", 42, 546, provider ?? "Demo POS", now),
    sale("00000000-0000-4000-8000-000000000302", today, "Burger", "Sandwiches", 31, 465, provider ?? "Demo POS", now),
    sale("00000000-0000-4000-8000-000000000303", today, "Fried Rice", "Bowls", 28, 336, provider ?? "Demo POS", now),
    sale("00000000-0000-4000-8000-000000000304", today, "Caesar Salad", "Salads", 19, 247, provider ?? "Demo POS", now),
    sale("00000000-0000-4000-8000-000000000305", today, "Pancakes", "Breakfast", 24, 288, provider ?? "Demo POS", now)
  ];

  const storageLocations: StorageLocation[] = [
    {
      id: DEMO_MAIN_STORAGE_LOCATION_ID,
      restaurant_id: DEMO_RESTAURANT_ID,
      name: "Main",
      sort_order: 0,
      is_active: true,
      created_at: now,
      updated_at: now
    },
    {
      id: "00000000-0000-4000-8000-000000000702",
      restaurant_id: DEMO_RESTAURANT_ID,
      name: "Walk-in",
      sort_order: 10,
      is_active: true,
      created_at: now,
      updated_at: now
    },
    {
      id: "00000000-0000-4000-8000-000000000703",
      restaurant_id: DEMO_RESTAURANT_ID,
      name: "Line",
      sort_order: 20,
      is_active: true,
      created_at: now,
      updated_at: now
    }
  ];

  const inventoryLocationBalances: InventoryLocationBalance[] = inventoryItems.map((item, index) => ({
    id: `00000000-0000-4000-8000-0000000008${String(index + 1).padStart(2, "0")}`,
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: item.id,
    storage_location_id: DEMO_MAIN_STORAGE_LOCATION_ID,
    quantity: item.current_quantity,
    created_at: now,
    updated_at: now
  }));

  const state: DemoState = {
    schema_version: DEMO_SCHEMA_VERSION,
    restaurants: [restaurant],
    users: [user, managerUser, staffUser],
    memberships,
    memberInvites: [],
    posSales,
    inventoryItems,
    inventoryMovements: [],
    inventoryCountSessions: [],
    storageLocations,
    inventoryLocationBalances,
    menuItemIngredients,
    purchaseRecommendations: [
      {
        id: "00000000-0000-4000-8000-000000000501",
        restaurant_id: DEMO_RESTAURANT_ID,
        inventory_item_id: itemIds.tomatoes,
        item_name: "Tomatoes",
        supplier_name: "Local Produce Co.",
        recommended_quantity: 20,
        original_recommended_quantity: 20,
        dismiss_reason: null,
        unit: "lbs",
        reason: "Included in the current produce draft.",
        urgency: "medium",
        status: "approved",
        supplier_order_id: "00000000-0000-4000-8000-000000000601",
        created_at: now
      },
      {
        id: "00000000-0000-4000-8000-000000000502",
        restaurant_id: DEMO_RESTAURANT_ID,
        inventory_item_id: itemIds.lettuce,
        item_name: "Lettuce",
        supplier_name: "Local Produce Co.",
        recommended_quantity: 23,
        original_recommended_quantity: 23,
        dismiss_reason: null,
        unit: "heads",
        reason: "Included in the current produce draft.",
        urgency: "medium",
        status: "approved",
        supplier_order_id: "00000000-0000-4000-8000-000000000601",
        created_at: now
      }
    ],
    supplierOrders: [
      {
        id: "00000000-0000-4000-8000-000000000601",
        restaurant_id: DEMO_RESTAURANT_ID,
        supplier_name: "Local Produce Co.",
        order_message:
          "Order draft for Local Produce Co.\n\nRoma Tomatoes - 20 lb\nRed Onions - 10 lb\nLemons - 5 lb\nCilantro - 2 bunch\nGarlic - 2 lb\n\nDelivery requested: Tomorrow morning\n\nNotes:\nRecommended based on recent sales and current inventory levels.",
        operator_note: null,
        status: "draft",
        delivery_date: tomorrow,
        created_at: now
      }
    ],
    insights: [],
    posIntegrations: [
      {
        id: "00000000-0000-4000-8000-000000000701",
        restaurant_id: DEMO_RESTAURANT_ID,
        provider: providerToIntegrationProvider(provider),
        status: provider ? "connected" : "not_connected",
        external_location_id: provider ? "demo-location" : null,
        last_sync_at: provider ? now : null,
        sync_cursor: null,
        settings: { mode: "demo", importsSales: true, storesCredentials: false },
        created_at: now,
        updated_at: now
      }
    ],
    salesImports: [
      {
        id: "00000000-0000-4000-8000-000000000711",
        restaurant_id: DEMO_RESTAURANT_ID,
        pos_integration_id: "00000000-0000-4000-8000-000000000701",
        import_type: "pos_sync",
        status: "completed",
        source_file_name: null,
        records_processed: posSales.length,
        error_message: null,
        metadata: { provider: provider ?? "Demo POS" },
        imported_at: now
      }
    ],
    supplierItems: inventoryItems.map((item, index) => ({
      id: `00000000-0000-4000-8000-0000000008${String(index).padStart(2, "0")}`,
      restaurant_id: DEMO_RESTAURANT_ID,
      supplier_name: item.supplier_name,
      supplier_sku: null,
      item_name: item.item_name,
      unit: item.unit,
      pack_size: item.unit === "lbs" ? "10 lb case" : null,
      estimated_unit_cost: item.estimated_unit_cost,
      preferred: true,
      created_at: now,
      updated_at: now
    })),
    purchaseOrders: [],
    aiInsights: [],
    emailConnections: [
      {
        id: "00000000-0000-4000-8000-000000000a01",
        restaurant_id: DEMO_RESTAURANT_ID,
        provider: "gmail",
        status: "not_connected",
        sender_email: null,
        last_verified_at: null,
        created_at: now,
        updated_at: now
      }
    ],
    supplierRecipients: [
      {
        id: "00000000-0000-4000-8000-000000000b01",
        restaurant_id: DEMO_RESTAURANT_ID,
        supplier_name: "Fresh Poultry Supply",
        email: "orders@freshpoultry.example",
        created_at: now,
        updated_at: now
      },
      {
        id: "00000000-0000-4000-8000-000000000b02",
        restaurant_id: DEMO_RESTAURANT_ID,
        supplier_name: "Local Produce Co.",
        email: "produce@local.example",
        created_at: now,
        updated_at: now
      },
      {
        id: "00000000-0000-4000-8000-000000000b03",
        restaurant_id: DEMO_RESTAURANT_ID,
        supplier_name: "Restaurant Depot",
        email: null,
        created_at: now,
        updated_at: now
      }
    ],
    auditLogs: [
      {
        id: "00000000-0000-4000-8000-000000000901",
        restaurant_id: DEMO_RESTAURANT_ID,
        actor_user_id: DEMO_USER_ID,
        action: "demo_seeded",
        entity_table: "restaurants",
        entity_id: DEMO_RESTAURANT_ID,
        metadata: { provider: provider ?? "Demo POS" },
        created_at: now
      }
    ],
    currentRestaurantId: DEMO_RESTAURANT_ID,
    posProvider: provider,
    posConnectedAt: provider ? now : null
  };

  const presetState = applyDemoPreset(state, provider, now, setupProfile?.preset, nowDate);
  return applyDemoSetupProfile(presetState, setupProfile);
}

/**
 * Repairs persisted demo data without discarding operator history.
 *
 * Version 1 reused `rec_<inventory item id>` for every recommendation
 * lifecycle. After a fresh count, that produced duplicate React keys and made
 * an old handled recommendation indistinguishable from the new pending one.
 * Version 2 retains every handled row, keeps only the newest pending row for an
 * item, assigns unique lifecycle ids, and restores the exact order link when a
 * legacy row can be matched safely.
 */
export function repairDemoState(raw: StoredDemoState): DemoStateRepairResult {
  const seeded = createInitialDemoState(raw.posProvider ?? DEMO_DATASET.defaultPosProvider);
  const seedRestaurant = seeded.restaurants[0]!;
  const restaurants = (raw.restaurants ?? seeded.restaurants).map((restaurant) => ({
    ...seedRestaurant,
    ...restaurant,
    operational_profile: {
      ...seedRestaurant.operational_profile,
      ...(restaurant.operational_profile ?? {})
    }
  }));
  const supplierOrders = (raw.supplierOrders ?? seeded.supplierOrders).map((order) => ({
    ...order,
    operator_note: typeof order.operator_note === "string" ? order.operator_note : null
  }));
  const inputRecommendations = raw.purchaseRecommendations ?? seeded.purchaseRecommendations;
  const newestPendingByItem = new Map<string, { recommendation: PurchaseRecommendation; index: number }>();

  inputRecommendations.forEach((recommendation, index) => {
    if (recommendation.status !== "pending") return;
    const key = `${recommendation.restaurant_id}\u0000${recommendation.inventory_item_id}`;
    const current = newestPendingByItem.get(key);
    if (
      !current ||
      recommendation.created_at.localeCompare(current.recommendation.created_at) > 0 ||
      (recommendation.created_at === current.recommendation.created_at && index > current.index)
    ) {
      newestPendingByItem.set(key, { recommendation, index });
    }
  });

  const retained = inputRecommendations.filter((recommendation, index) => {
    if (recommendation.status !== "pending") return true;
    const key = `${recommendation.restaurant_id}\u0000${recommendation.inventory_item_id}`;
    return newestPendingByItem.get(key)?.index === index;
  });
  const seenIds = new Set<string>();
  const purchaseRecommendations = retained.map((recommendation, index) => {
    const baseId = recommendation.id?.trim() || `rec_legacy_${index + 1}`;
    let id = baseId;
    let collision = 1;
    while (seenIds.has(id)) {
      id = `${baseId}_v2_${collision}`;
      collision += 1;
    }
    seenIds.add(id);

    const linkedOrder = findLegacyRecommendationOrder(
      recommendation,
      supplierOrders,
      typeof recommendation.supplier_order_id === "string" ? recommendation.supplier_order_id : null
    );
    return {
      ...recommendation,
      id,
      supplier_order_id: linkedOrder?.id ?? null
    };
  });

  const memberships = Array.isArray(raw.memberships) && raw.memberships.length > 0
    ? raw.memberships
    : seeded.memberships;
  const users = (() => {
    const base = raw.users && raw.users.length > 0 ? [...raw.users] : [...seeded.users];
    for (const membership of memberships) {
      if (base.some((entry) => entry.id === membership.user_id)) continue;
      const seededUser = seeded.users.find((entry) => entry.id === membership.user_id);
      if (seededUser) base.push(seededUser);
    }
    return base;
  })();

  const state: DemoState = {
    ...seeded,
    ...raw,
    schema_version: DEMO_SCHEMA_VERSION,
    restaurants,
    users,
    memberships,
    memberInvites: Array.isArray(raw.memberInvites) ? raw.memberInvites : [],
    posSales: raw.posSales ?? seeded.posSales,
    inventoryItems: raw.inventoryItems ?? seeded.inventoryItems,
    inventoryMovements: Array.isArray(raw.inventoryMovements) ? raw.inventoryMovements : seeded.inventoryMovements,
    inventoryCountSessions: Array.isArray(raw.inventoryCountSessions)
      ? raw.inventoryCountSessions
      : seeded.inventoryCountSessions,
    storageLocations: Array.isArray(raw.storageLocations) ? raw.storageLocations : seeded.storageLocations,
    inventoryLocationBalances: Array.isArray(raw.inventoryLocationBalances)
      ? raw.inventoryLocationBalances
      : seeded.inventoryLocationBalances,
    menuItemIngredients: raw.menuItemIngredients ?? seeded.menuItemIngredients,
    purchaseRecommendations,
    supplierOrders,
    insights: raw.insights ?? seeded.insights,
    posIntegrations: raw.posIntegrations ?? seeded.posIntegrations,
    salesImports: raw.salesImports ?? seeded.salesImports,
    supplierItems: raw.supplierItems ?? seeded.supplierItems,
    purchaseOrders: raw.purchaseOrders ?? seeded.purchaseOrders,
    aiInsights: raw.aiInsights ?? seeded.aiInsights,
    auditLogs: raw.auditLogs ?? seeded.auditLogs,
    emailConnections: raw.emailConnections ?? seeded.emailConnections,
    supplierRecipients: raw.supplierRecipients ?? seeded.supplierRecipients,
    currentRestaurantId: raw.currentRestaurantId ?? seeded.currentRestaurantId,
    posProvider: raw.posProvider ?? seeded.posProvider,
    posConnectedAt: raw.posConnectedAt ?? seeded.posConnectedAt
  };

  const needsBalanceSync =
    !Array.isArray(raw.inventoryLocationBalances) ||
    raw.schema_version !== DEMO_SCHEMA_VERSION ||
    state.inventoryItems.some((item) => {
      const balances = state.inventoryLocationBalances.filter(
        (balance) =>
          balance.restaurant_id === item.restaurant_id && balance.inventory_item_id === item.id
      );
      if (balances.length === 0) return item.current_quantity > 0;
      const sum = balances.reduce((total, row) => total + Number(row.quantity || 0), 0);
      return Math.abs(sum - item.current_quantity) > 1e-9;
    });
  if (needsBalanceSync) {
    for (const item of state.inventoryItems) {
      reconcileDemoLocationBalancesToOnHand(state, item.restaurant_id, item);
    }
  }

  return {
    state,
    migrated:
      raw.schema_version !== DEMO_SCHEMA_VERSION ||
      retained.length !== inputRecommendations.length ||
      purchaseRecommendations.some((recommendation, index) => recommendation.id !== retained[index]?.id) ||
      supplierOrders.some((order, index) => order.operator_note !== raw.supplierOrders?.[index]?.operator_note) ||
      !Array.isArray(raw.inventoryMovements) ||
      !Array.isArray(raw.inventoryCountSessions) ||
      !Array.isArray(raw.storageLocations) ||
      !Array.isArray(raw.inventoryLocationBalances) ||
      needsBalanceSync ||
      !Array.isArray(raw.memberships) ||
      !Array.isArray(raw.memberInvites) ||
      (raw.memberships?.length ?? 0) === 0
  };
}

function findLegacyRecommendationOrder(
  recommendation: PurchaseRecommendation,
  orders: SupplierOrder[],
  existingOrderId: string | null
) {
  if (recommendation.status === "pending" || recommendation.status === "dismissed") return null;
  const eligibleStatuses = recommendation.status === "approved" ? ["draft"] : ["sent", "completed"];
  const existing = orders.find(
    (order) =>
      order.id === existingOrderId &&
      order.restaurant_id === recommendation.restaurant_id &&
      eligibleStatuses.includes(order.status)
  );
  if (existing) return existing;
  return orders
    .filter((order) => order.restaurant_id === recommendation.restaurant_id)
    .filter((order) => order.supplier_name === recommendation.supplier_name)
    .filter((order) => eligibleStatuses.includes(order.status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export function applyDemoSetupProfile(state: DemoState, setupProfile?: DemoSetupProfile) {
  if (!setupProfile) return state;

  applyRecipeBaselineText(state, setupProfile.recipeBaselineText);
  applyImportedPosSales(state, setupProfile.posSales);

  const inventoryItemNames = normalizeSetupList(setupProfile.inventoryItemNames);
  inventoryItemNames.forEach((itemName, index) => {
    const item = state.inventoryItems[index];
    if (item) item.item_name = itemName;
  });

  const supplierNames = normalizeSetupList(setupProfile.supplierNames);
  if (supplierNames.length > 0) {
    state.inventoryItems.forEach((item, index) => {
      item.supplier_name = supplierNames[index % supplierNames.length]!;
    });
    state.supplierItems.forEach((item, index) => {
      item.supplier_name = supplierNames[index % supplierNames.length]!;
    });
    state.supplierRecipients = supplierNames.map((supplierName, index) => ({
      id: `recipient_${index}`,
      restaurant_id: DEMO_RESTAURANT_ID,
      supplier_name: supplierName,
      email: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    const restaurant = state.restaurants[0];
    if (restaurant) {
      restaurant.operational_profile = {
        ...restaurant.operational_profile,
        primarySuppliers: supplierNames
      };
    }
  }

  return state;
}

function applyImportedPosSales(state: DemoState, posSales?: SetupPosSaleDraft[]) {
  if (!posSales || posSales.length === 0) return;

  const createdAt = new Date().toISOString();
  state.posSales = posSales.map((entry, index) =>
    sale(
      `custom_pos_sale_${index + 1}`,
      entry.saleDate,
      entry.itemName,
      entry.category,
      entry.quantitySold,
      entry.grossSales,
      entry.sourcePos,
      createdAt
    )
  );
  state.salesImports = [
    {
      id: "custom_sales_import_1",
      restaurant_id: DEMO_RESTAURANT_ID,
      pos_integration_id: state.posIntegrations[0]?.id ?? null,
      import_type: "csv_upload",
      status: "completed",
      source_file_name: null,
      records_processed: posSales.length,
      error_message: null,
      metadata: {
        source: "setup_onboarding",
        storage_status: "rows_only",
        raw_file_stored: false
      },
      imported_at: createdAt
    }
  ];
}

function applyDemoPreset(
  state: DemoState,
  provider: PosProvider | null,
  createdAt: string,
  preset?: DemoPreset,
  nowDate = new Date()
) {
  if (preset !== DEMO_DATASET.id) return state;
  return applyDefaultDemoDataset(state, provider, createdAt, nowDate);
}

function applyDefaultDemoDataset(state: DemoState, provider: PosProvider | null, createdAt: string, nowDate: Date) {
  const timeZone = state.restaurants[0]?.timezone ?? DEMO_RESTAURANT_TIME_ZONE;
  const today = toDateKeyInTimeZone(nowDate, timeZone);
  const tomorrow = toDateKeyInTimeZone(addDays(nowDate, 1), timeZone);
  const restaurant = state.restaurants[0];
  if (restaurant) {
    restaurant.name = DEMO_DATASET.restaurant.name;
    restaurant.address = "100 Demo Avenue";
    restaurant.cuisine_type = DEMO_DATASET.restaurant.cuisineType;
    restaurant.brand_color = "#EF1D18";
    restaurant.accent_color = "#EF1D18";
    restaurant.service_style = "fast_casual";
    restaurant.timezone = DEMO_DATASET.restaurant.timezone;
    restaurant.currency = "USD";
    restaurant.operational_profile = {
      serviceStyle: "fast_casual",
      orderCadence: ["Monday", "Thursday", "Saturday"],
      prepWindows: ["9:00 AM wok prep", "3:30 PM dinner reset", "9:45 PM close count"],
      primarySuppliers: ["Metro Produce Supply", "Regional Protein Co.", "Pantry Wholesale"],
      inventoryReviewDays: ["Monday", "Thursday", "Saturday"],
      notes:
        "Lunch pickup and dinner rush with wok proteins, rice, dumplings, and produce checked before peak service."
    };
  }

  const user = state.users[0];
  if (user) {
    user.name = DEMO_DATASET.user.name;
    user.email = DEMO_DATASET.user.email;
  }

  const itemUpdates: Record<string, Partial<InventoryItem>> = {
    [itemIds.chicken]: {
      item_name: "Chicken thigh",
      category: "Protein",
      unit: "lbs",
      current_quantity: 140,
      par_level: 95,
      reorder_threshold: 38,
      estimated_unit_cost: 3.65,
      supplier_name: "Regional Protein Co."
    },
    [itemIds.eggs]: {
      item_name: "Eggs",
      category: "Dairy",
      unit: "units",
      current_quantity: 560,
      par_level: 280,
      reorder_threshold: 110,
      estimated_unit_cost: 0.24,
      supplier_name: "Pantry Wholesale"
    },
    [itemIds.rice]: {
      item_name: "Jasmine rice",
      category: "Dry goods",
      unit: "lbs",
      current_quantity: 310,
      par_level: 190,
      reorder_threshold: 85,
      estimated_unit_cost: 0.95,
      supplier_name: "Pantry Wholesale"
    },
    [itemIds.lettuce]: {
      item_name: "Napa cabbage",
      category: "Produce",
      unit: "heads",
      current_quantity: 14,
      par_level: 46,
      reorder_threshold: 18,
      estimated_unit_cost: 2.1,
      supplier_name: "Metro Produce Supply"
    },
    [itemIds.tomatoes]: {
      item_name: "Bell peppers",
      category: "Produce",
      unit: "lbs",
      current_quantity: 90,
      par_level: 52,
      reorder_threshold: 22,
      estimated_unit_cost: 2.35,
      supplier_name: "Metro Produce Supply"
    },
    [itemIds.beef]: {
      item_name: "Beef strips",
      category: "Protein",
      unit: "lbs",
      current_quantity: 80,
      par_level: 82,
      reorder_threshold: 34,
      estimated_unit_cost: 5.45,
      supplier_name: "Regional Protein Co."
    },
    [itemIds.pancakeMix]: {
      item_name: "Dumpling wrappers",
      category: "Dry goods",
      unit: "packs",
      current_quantity: 85,
      par_level: 52,
      reorder_threshold: 20,
      estimated_unit_cost: 2.2,
      supplier_name: "Pantry Wholesale"
    }
  };

  state.inventoryItems = state.inventoryItems.map((item) => ({
    ...item,
    ...itemUpdates[item.id],
    last_updated: createdAt
  }));

  state.menuItemIngredients = [
    ingredient("00000000-0000-4000-8000-000000000201", "General Tso Chicken", itemIds.chicken, 0.42, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000202", "General Tso Chicken", itemIds.rice, 0.24, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000203", "General Tso Chicken", itemIds.tomatoes, 0.12, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000204", "Orange Chicken", itemIds.chicken, 0.38, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000205", "Orange Chicken", itemIds.rice, 0.25, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000206", "Beef Lo Mein", itemIds.beef, 0.32, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000207", "Beef Lo Mein", itemIds.tomatoes, 0.16, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000208", "Pork Fried Rice", itemIds.rice, 0.34, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000209", "Pork Fried Rice", itemIds.eggs, 1.5, "units"),
    ingredient("00000000-0000-4000-8000-000000000210", "Dumplings", itemIds.pancakeMix, 0.33, "packs"),
    ingredient("00000000-0000-4000-8000-000000000211", "Dumplings", itemIds.chicken, 0.18, "lbs"),
    ingredient("00000000-0000-4000-8000-000000000212", "Egg Drop Soup", itemIds.eggs, 2, "units")
  ];

  state.posSales = [
    ...buildDefaultDemoCurrentSales(today, provider ?? "Demo POS", createdAt),
    ...buildDefaultDemoWeeklySales(provider ?? "Demo POS", createdAt, nowDate, timeZone)
  ];

  state.supplierOrders = [
    {
      id: "00000000-0000-4000-8000-000000000601",
      restaurant_id: DEMO_RESTAURANT_ID,
      supplier_name: "Metro Produce Supply",
      order_message:
        `Order draft for Metro Produce Supply\n\nNapa Cabbage - 18 head\nBell Peppers - 24 lb\nScallions - 12 bunch\nGinger - 6 lb\nGarlic - 8 lb\n\nDelivery requested: Tomorrow morning\n\nNotes:\nRecommended from ${DEMO_DATASET.restaurant.name}'s current dinner pace and close-count levels.`,
      operator_note: null,
      status: "draft",
      delivery_date: tomorrow,
      created_at: createdAt
    },
    {
      id: "00000000-0000-4000-8000-000000000602",
      restaurant_id: DEMO_RESTAURANT_ID,
      supplier_name: "Pantry Wholesale",
      order_message:
        "Order draft for Pantry Wholesale\n\nJasmine Rice - 80 lb\nDumpling Wrappers - 24 packs\nSoy Sauce - 6 gal\nSesame Oil - 4 gal\n\nDelivery requested: Today\n\nNotes:\nPantry order drafted from weekly usage and par targets.",
      operator_note: null,
      status: "sent",
      delivery_date: today,
      created_at: addDays(nowDate, -1).toISOString()
    }
  ];

  const sentOrderCreatedAt = addDays(nowDate, -1).toISOString();
  state.purchaseRecommendations = [
    {
      id: "00000000-0000-4000-8000-000000000501",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: itemIds.lettuce,
      item_name: "Napa cabbage",
      supplier_name: "Metro Produce Supply",
      recommended_quantity: 18,
      original_recommended_quantity: 18,
      dismiss_reason: null,
      unit: "heads",
      reason: "Included in the current produce draft.",
      urgency: "medium",
      status: "approved",
      supplier_order_id: "00000000-0000-4000-8000-000000000601",
      created_at: createdAt
    },
    {
      id: "00000000-0000-4000-8000-000000000502",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: itemIds.tomatoes,
      item_name: "Bell peppers",
      supplier_name: "Metro Produce Supply",
      recommended_quantity: 24,
      original_recommended_quantity: 24,
      dismiss_reason: null,
      unit: "lbs",
      reason: "Included in the current produce draft.",
      urgency: "medium",
      status: "approved",
      supplier_order_id: "00000000-0000-4000-8000-000000000601",
      created_at: createdAt
    },
    {
      id: "00000000-0000-4000-8000-000000000503",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: itemIds.rice,
      item_name: "Jasmine rice",
      supplier_name: "Pantry Wholesale",
      recommended_quantity: 80,
      original_recommended_quantity: 80,
      dismiss_reason: null,
      unit: "lbs",
      reason: "Included in the sent pantry order.",
      urgency: "medium",
      status: "ordered",
      supplier_order_id: "00000000-0000-4000-8000-000000000602",
      created_at: sentOrderCreatedAt
    },
    {
      id: "00000000-0000-4000-8000-000000000504",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: itemIds.pancakeMix,
      item_name: "Dumpling wrappers",
      supplier_name: "Pantry Wholesale",
      recommended_quantity: 24,
      original_recommended_quantity: 24,
      dismiss_reason: null,
      unit: "packs",
      reason: "Included in the sent pantry order.",
      urgency: "medium",
      status: "ordered",
      supplier_order_id: "00000000-0000-4000-8000-000000000602",
      created_at: sentOrderCreatedAt
    }
  ];

  state.supplierItems = state.inventoryItems.map((item, index) => ({
    id: `00000000-0000-4000-8000-0000000008${String(index).padStart(2, "0")}`,
    restaurant_id: DEMO_RESTAURANT_ID,
    supplier_name: item.supplier_name,
    supplier_sku: null,
    item_name: item.item_name,
    unit: item.unit,
    pack_size: item.unit === "lbs" ? "10 lb case" : item.unit === "packs" ? "12 pack case" : null,
    estimated_unit_cost: item.estimated_unit_cost,
    preferred: true,
    created_at: createdAt,
    updated_at: createdAt
  }));

  state.supplierRecipients = [
    {
      id: "00000000-0000-4000-8000-000000000b01",
      restaurant_id: DEMO_RESTAURANT_ID,
      supplier_name: "Metro Produce Supply",
      email: "orders@metroproduce.example",
      created_at: createdAt,
      updated_at: createdAt
    },
    {
      id: "00000000-0000-4000-8000-000000000b02",
      restaurant_id: DEMO_RESTAURANT_ID,
      supplier_name: "Regional Protein Co.",
      email: "orders@regionalprotein.example",
      created_at: createdAt,
      updated_at: createdAt
    },
    {
      id: "00000000-0000-4000-8000-000000000b03",
      restaurant_id: DEMO_RESTAURANT_ID,
      supplier_name: "Pantry Wholesale",
      email: null,
      created_at: createdAt,
      updated_at: createdAt
    }
  ];

  state.salesImports = [
    {
      id: "00000000-0000-4000-8000-000000000711",
      restaurant_id: DEMO_RESTAURANT_ID,
      pos_integration_id: "00000000-0000-4000-8000-000000000701",
      import_type: "pos_sync",
      status: "completed",
      source_file_name: null,
      records_processed: state.posSales.length,
      error_message: null,
      metadata: { provider: provider ?? "Demo POS", preset: DEMO_DATASET.id, week_span: 52 },
      imported_at: createdAt
    }
  ];

  state.auditLogs = [
    {
      id: "00000000-0000-4000-8000-000000000901",
      restaurant_id: DEMO_RESTAURANT_ID,
      actor_user_id: DEMO_USER_ID,
      action: "demo_seeded",
      entity_table: "restaurants",
      entity_id: DEMO_RESTAURANT_ID,
      metadata: { provider: provider ?? "Demo POS", preset: DEMO_DATASET.id, deterministic: true },
      created_at: createdAt
    }
  ];

  return state;
}

function buildDefaultDemoCurrentSales(today: string, sourcePos: string, createdAt: string) {
  return [
    sale("00000000-0000-4000-8000-000000000301", today, "General Tso Chicken", "Entrees", 146, 2263, sourcePos, createdAt),
    sale("00000000-0000-4000-8000-000000000302", today, "Orange Chicken", "Entrees", 124, 1829, sourcePos, createdAt),
    sale("00000000-0000-4000-8000-000000000303", today, "Beef Lo Mein", "Noodles", 106, 1404, sourcePos, createdAt),
    sale("00000000-0000-4000-8000-000000000304", today, "Pork Fried Rice", "Rice", 98, 1225, sourcePos, createdAt),
    sale("00000000-0000-4000-8000-000000000305", today, "Dumplings", "Dim Sum", 88, 858, sourcePos, createdAt),
    sale("00000000-0000-4000-8000-000000000306", today, "Egg Drop Soup", "Soup", 58, 319, sourcePos, createdAt)
  ];
}

function buildDefaultDemoWeeklySales(sourcePos: string, createdAt: string, nowDate: Date, timeZone: string) {
  const menu = [
    { name: "General Tso Chicken", category: "Entrees", base: 560, price: 15.5 },
    { name: "Orange Chicken", category: "Entrees", base: 500, price: 14.75 },
    { name: "Beef Lo Mein", category: "Noodles", base: 390, price: 13.25 },
    { name: "Pork Fried Rice", category: "Rice", base: 420, price: 12.5 },
    { name: "Dumplings", category: "Dim Sum", base: 320, price: 9.75 },
    { name: "Egg Drop Soup", category: "Soup", base: 230, price: 5.5 }
  ];
  const sales: PosSale[] = [];

  for (let weekOffset = 52; weekOffset >= 1; weekOffset -= 1) {
    const weekIndex = 52 - weekOffset;
    const saleDate = toDateKeyInTimeZone(addDays(nowDate, -7 * weekOffset), timeZone);
    const lunarLift = weekIndex >= 31 && weekIndex <= 35 ? 1.18 : 1;
    const winterLift = weekIndex <= 8 || weekIndex >= 45 ? 1.08 : 1;
    const summerDip = weekIndex >= 22 && weekIndex <= 30 ? 0.94 : 1;
    const momentum = 1 + weekIndex * 0.0045;
    // The most recent comparison service day is deliberately close to the
    // in-progress demo day so movement reads like a healthy +8%, not a crisis.
    // Older weeks retain their full scale for stable demand learning.
    const comparisonDayScale = weekOffset === 1 ? 0.178 : 1;

    menu.forEach((item, menuIndex) => {
      const deterministicNoise = ((weekIndex * 17 + menuIndex * 11) % 15) - 7;
      const quantity = Math.max(
        12,
        Math.round(
          (item.base * lunarLift * winterLift * summerDip * momentum + deterministicNoise) * comparisonDayScale
        )
      );
      const gross = Math.round(quantity * item.price);
      sales.push(
        sale(
          `00000000-0000-4000-8000-${String(1000 + weekIndex * 10 + menuIndex).padStart(12, "0")}`,
          saleDate,
          item.name,
          item.category,
          quantity,
          gross,
          sourcePos,
          createdAt
        )
      );
    });
  }

  return sales;
}

export function providerToIntegrationProvider(provider: PosProvider | null) {
  if (provider === "Square") return "square";
  if (provider === "Toast") return "toast";
  if (provider === "Clover") return "clover";
  if (provider === "Lightspeed") return "lightspeed";
  if (provider === "Manual CSV Upload") return "manual_csv";
  return "demo";
}

export function applyManualPosSalesIngestToDemoState(
  state: DemoState,
  restaurantId: string,
  sales: Array<{
    source_record_id: string;
    sale_date: string;
    item_name: string;
    category: string;
    quantity_sold: number;
    gross_sales: number;
    net_sales: number;
    source_pos: "Manual CSV Upload";
  }>,
  sourceFileName: string | null = null,
  now = new Date().toISOString()
) {
  assertNoConsumedPosSaleCorrections({
    incoming: sales.map((sale) => ({
      source_record_id: sale.source_record_id,
      quantity_sold: sale.quantity_sold,
      item_name: sale.item_name,
      category: sale.category,
      sale_date: sale.sale_date
    })),
    existing: state.posSales
      .filter((sale) => sale.restaurant_id === restaurantId)
      .map((sale) => ({
        source_record_id: sale.source_record_id ?? "",
        quantity_sold: sale.quantity_sold,
        item_name: sale.item_name,
        category: sale.category,
        sale_date: sale.sale_date
      })),
    consumedSourceRecordIds: collectConsumedPosSourceRecordIds(state.inventoryMovements ?? [])
  });

  const keptSales = state.posSales.filter(
    (sale) => sale.restaurant_id !== restaurantId || sale.source_pos !== "Manual CSV Upload"
  );
  const importedSales: PosSale[] = sales.map((saleInput, index) => ({
    ...saleInput,
    id: `manual_csv_sale_${index + 1}_${saleInput.source_record_id}`,
    restaurant_id: restaurantId,
    created_at: now
  }));
  state.posSales = [...keptSales, ...importedSales];
  state.posProvider = "Manual CSV Upload";
  state.posConnectedAt = now;

  const existingIntegration = state.posIntegrations.find(
    (entry) => entry.restaurant_id === restaurantId && entry.provider === "manual_csv"
  );
  const integrationId = existingIntegration?.id ?? `manual_csv_integration_${restaurantId}`;
  if (existingIntegration) {
    existingIntegration.status = "connected";
    existingIntegration.last_sync_at = now;
    existingIntegration.updated_at = now;
    existingIntegration.settings = {
      mode: "manual_csv",
      importsSales: true,
      storesCredentials: false
    };
  } else {
    state.posIntegrations.push({
      id: integrationId,
      restaurant_id: restaurantId,
      provider: "manual_csv",
      status: "connected",
      external_location_id: null,
      last_sync_at: now,
      sync_cursor: null,
      settings: {
        mode: "manual_csv",
        importsSales: true,
        storesCredentials: false
      },
      created_at: now,
      updated_at: now
    });
  }

  const salesImportId = `manual_csv_import_${Date.parse(now) || 0}`;
  state.salesImports.unshift({
    id: salesImportId,
    restaurant_id: restaurantId,
    pos_integration_id: integrationId,
    import_type: "csv_upload",
    status: "completed",
    source_file_name: sourceFileName,
    records_processed: importedSales.length,
    error_message: null,
    metadata: {
      source: "manual_csv_ingest",
      storage_status: "rows_only",
      raw_file_stored: false
    },
    imported_at: now
  });

  const plan = buildRecipeConsumptionPlan({
    restaurantId,
    sales: importedSales,
    mappings: state.menuItemIngredients,
    inventoryItems: state.inventoryItems
  });
  let consumptionMovementsWritten = 0;
  for (const line of plan.lines) {
    if (hasAppliedConsumptionLine(state.inventoryMovements ?? [], line)) continue;
    const item = state.inventoryItems.find(
      (entry) => entry.restaurant_id === restaurantId && entry.id === line.inventoryItemId
    );
    if (!item) continue;
    const quantityBefore = item.current_quantity;
    const quantityAfter = Math.round(Math.max(0, quantityBefore - line.quantityUsed) * 10000) / 10000;
    item.current_quantity = quantityAfter;
    item.last_updated = now;
    reconcileDemoLocationBalancesToOnHand(state, restaurantId, item, now);
    const movement: InventoryMovement = {
      id: `manual_csv_consumption_${line.sourceRecordId}_${line.inventoryItemId}`,
      restaurant_id: restaurantId,
      inventory_item_id: line.inventoryItemId,
      actor_user_id: DEMO_USER_ID,
      reason: "recipe_consumption",
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      delta: quantityAfter - quantityBefore,
      source_workflow: "manual_pos_csv_ingest",
      metadata: {
        source_record_id: line.sourceRecordId,
        pos_sale_id: line.posSaleId,
        menu_item_name: line.menuItemName,
        mapping_id: line.mappingId,
        sale_date: line.saleDate,
        quantity_used: line.quantityUsed
      },
      created_at: now
    };
    state.inventoryMovements = [movement, ...(state.inventoryMovements ?? [])].slice(0, 200);
    consumptionMovementsWritten += 1;
  }

  state.auditLogs.unshift({
    id: `manual_csv_audit_${Date.parse(now) || 0}`,
    restaurant_id: restaurantId,
    actor_user_id: DEMO_USER_ID,
    action: "manual_pos_csv_ingested",
    entity_table: "sales_imports",
    entity_id: salesImportId,
    metadata: {
      pos_sales_rows_saved: importedSales.length,
      pos_integration_id: integrationId,
      source_file_name: sourceFileName,
      consumption_movements_written: consumptionMovementsWritten,
      unmapped_sale_count: plan.unmappedSales.length,
      skipped_incompatible_count: plan.skippedIncompatible.length
    },
    created_at: now
  });

  return {
    posSalesRowsSaved: importedSales.length,
    salesImportId,
    consumptionMovementsWritten,
    unmappedSaleCount: plan.unmappedSales.length,
    skippedIncompatibleCount: plan.skippedIncompatible.length
  };
}

function normalizeSetupList(values?: string[]) {
  const seen = new Set<string>();
  return (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bheads?\b/g, "head")
    .replace(/\bunits?\b/g, "unit")
    .replace(/\blbs?\b/g, "lb")
    .trim();
}

function findInventoryItemByName(items: InventoryItem[], ingredientName: string) {
  const lookup = normalizeLookup(ingredientName);
  return (
    items.find((item) => normalizeLookup(item.item_name) === lookup) ??
    items.find((item) => {
      const itemLookup = normalizeLookup(item.item_name);
      return itemLookup.includes(lookup) || lookup.includes(itemLookup);
    }) ??
    null
  );
}

function parseRecipeLine(line: string) {
  const [menuItemName, ingredientText] = line.split(":");
  if (!menuItemName || !ingredientText) return null;

  const ingredients = ingredientText
    .split(",")
    .map((entry) => entry.trim())
    .map((entry) => {
      const match = entry.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s+([a-zA-Z]+)$/);
      if (!match) return null;
      return {
        itemName: match[1]!.trim(),
        quantity: Number(match[2]),
        unit: match[3]!.trim()
      };
    })
    .filter((entry): entry is { itemName: string; quantity: number; unit: string } =>
      Boolean(entry && Number.isFinite(entry.quantity) && entry.quantity > 0)
    );

  return {
    menuItemName: menuItemName.trim(),
    ingredients
  };
}

function customMappingId(lineIndex: number, ingredientIndex: number) {
  const numeric = 400 + lineIndex * 20 + ingredientIndex;
  return `00000000-0000-4000-8000-${String(numeric).padStart(12, "0")}`;
}

function applyRecipeBaselineText(state: DemoState, recipeBaselineText?: string) {
  if (!recipeBaselineText?.trim()) return;

  const parsedLines = recipeBaselineText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseRecipeLine)
    .filter((line): line is { menuItemName: string; ingredients: { itemName: string; quantity: number; unit: string }[] } =>
      Boolean(line && line.ingredients.length > 0)
    );

  parsedLines.forEach((line, lineIndex) => {
    const mappings = line.ingredients
      .map((ingredientEntry, ingredientIndex) => {
        const item = findInventoryItemByName(state.inventoryItems, ingredientEntry.itemName);
        if (!item) return null;
        return ingredient(
          customMappingId(lineIndex, ingredientIndex),
          line.menuItemName,
          item.id,
          ingredientEntry.quantity,
          ingredientEntry.unit
        );
      })
      .filter((mapping): mapping is MenuItemIngredient => Boolean(mapping));

    if (mappings.length === 0) return;
    state.menuItemIngredients = [
      ...state.menuItemIngredients.filter((mapping) => mapping.menu_item_name !== line.menuItemName),
      ...mappings
    ];
  });
}

function ingredient(
  id: string,
  menuItemName: string,
  inventoryItemId: string,
  quantity: number,
  unit: string
): MenuItemIngredient {
  return {
    id,
    restaurant_id: DEMO_RESTAURANT_ID,
    menu_item_name: menuItemName,
    inventory_item_id: inventoryItemId,
    quantity_used_per_sale: quantity,
    unit
  };
}

function sale(
  id: string,
  saleDate: string,
  itemName: string,
  category: string,
  quantitySold: number,
  grossSales: number,
  sourcePos: string,
  createdAt: string
): PosSale {
  return {
    id,
    restaurant_id: DEMO_RESTAURANT_ID,
    sale_date: saleDate,
    item_name: itemName,
    category,
    quantity_sold: quantitySold,
    gross_sales: grossSales,
    net_sales: Math.round(grossSales * 0.93),
    source_pos: sourcePos,
    created_at: createdAt
  };
}

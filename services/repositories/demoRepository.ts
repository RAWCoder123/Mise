import type {
  AiInsight,
  AuditLog,
  InventoryItem,
  MenuItemIngredient,
  PosSale,
  PurchaseRecommendation,
  SupplierRecipient
} from "../../types/mise";
import {
  DEMO_RESTAURANT_ID,
  DEMO_USER_ID,
  approveRecommendationInDemoState,
  dismissRecommendationInDemoState,
  isRollingDemoCurrentDaySale,
  markSupplierOrderSentInDemoState,
  rebuildInsights,
  rebuildPurchaseRecommendations,
  undoRecommendationInDemoState,
  type DemoState
} from "../demoData";
import {
  buildSupplierOrderMessage,
  createId,
  severityRank,
  severityRankForUrgency
} from "../domain/miseDomain";
import { TeamMembershipError } from "../domain/teamMembership";
import { createInMemoryInventoryEventRecorder } from "../domain/inventoryEventTransport";
import {
  findSupplierRecipientCatalogName,
  supplierRecipientDirectoryKey
} from "../domain/supplierRecipients";
import { mutateDemoState, readDemoState, resetDemoStore } from "../localStore";
import {
  normalizeAppUser,
  normalizeInsight,
  normalizeAiInsight,
  normalizeAuditLog,
  normalizeRestaurantEmailConnection,
  normalizeInventoryItem,
  normalizeMenuItemIngredient,
  normalizePosIntegration,
  normalizePosSale,
  normalizePurchaseRecommendation,
  normalizeRestaurant,
  normalizeRestaurantMembership,
  normalizeRestaurantTeamMember,
  normalizeSetupAttachment,
  normalizeSupplierItem,
  normalizeSupplierOrder,
  normalizeSupplierRecipient
} from "../miseValidation";
import { toDateKeyInTimeZone } from "../../utils/format";
import {
  GmailIntegrationError,
  normalizeRestaurantData,
  recommendationHistoryCutoffIso,
  type AuditLogInput,
  type MiseRepository,
  type RestaurantSetupSnapshotSummary
} from "./repositoryContracts";

async function readReadyDemoState(restaurantId: string = DEMO_RESTAURANT_ID) {
  return mutateDemoState((state) => {
    refreshLocalDemoSalesDate(state, restaurantId);
    rebuildPurchaseRecommendations(state, restaurantId);
    rebuildInsights(state, restaurantId);
    return state;
  });
}

function refreshLocalDemoSalesDate(state: DemoState, restaurantId: string) {
  const timeZone = state.restaurants.find((restaurant) => restaurant.id === restaurantId)?.timezone ?? "UTC";
  const today = toDateKeyInTimeZone(new Date(), timeZone);
  state.posSales
    .filter((sale) => sale.restaurant_id === restaurantId)
    .filter((sale) => isRollingDemoCurrentDaySale(sale.id))
    .forEach((sale) => {
      sale.sale_date = today;
    });
}

function fetchRestaurantFromState(state: DemoState, restaurantId: string) {
  const restaurant = state.restaurants.find((item) => item.id === restaurantId);
  if (!restaurant) throw new Error("Restaurant not found");
  return normalizeRestaurant(restaurant);
}

function requireActiveDemoRestaurant(state: DemoState, restaurantId: string) {
  if (state.currentRestaurantId !== restaurantId || !state.restaurants.some((entry) => entry.id === restaurantId)) {
    throw new Error("Restaurant not found");
  }
}

function appendDemoAuditLog(state: DemoState, input: AuditLogInput) {
  const entry: AuditLog = {
    ...input,
    entity_id: input.entity_id ?? null,
    metadata: input.metadata ?? {},
    actor_user_id: DEMO_USER_ID,
    id: createId("audit"),
    created_at: new Date().toISOString()
  };
  state.auditLogs.push(normalizeAuditLog(entry));
}

function prepareResetDemoState(state: DemoState) {
  rebuildPurchaseRecommendations(state, state.currentRestaurantId);
  rebuildInsights(state, state.currentRestaurantId);
}

function deterministicDemoEventId(restaurantId: string, clientEventId: string) {
  const value = `${restaurantId}\u001f${clientEventId}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `demo_inventory_event_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createLocalDemoRepository(): MiseRepository {
  const recordInventoryEvent = createInMemoryInventoryEventRecorder({
    actorUserId: DEMO_USER_ID,
    idFor: (event) =>
      deterministicDemoEventId(event.restaurantId, event.clientEventId)
  });
  return {
    async fetchMembershipsForAuthUser(userId) {
      const state = await readReadyDemoState();
      const user = state.users.find((entry) => entry.id === userId);
      if (!user?.restaurant_id) return [];
      return [
        normalizeRestaurantMembership({
          id: `membership_${user.id}`,
          restaurant_id: user.restaurant_id,
          user_id: user.id,
          role: "owner",
          status: "active",
          created_at: user.created_at,
          updated_at: user.created_at
        })
      ];
    },

    async fetchRestaurantTeam(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      requireActiveDemoRestaurant(state, restaurantId);
      const user = state.users.find((entry) => entry.restaurant_id === restaurantId) ?? state.users[0];
      if (!user) return [];
      return [
        normalizeRestaurantTeamMember({
          restaurant_id: restaurantId,
          user_id: user.id,
          role: "owner",
          status: "active",
          name: user.name,
          email: user.email,
          created_at: user.created_at,
          updated_at: user.created_at
        })
      ];
    },

    async addRestaurantMemberByEmail() {
      throw new TeamMembershipError(
        "account_not_found",
        "Demo mode is a single-operator workspace. Create a hosted account to add teammates."
      );
    },

    async addRestaurantMember() {
      throw new Error("Team membership management is available only for authenticated restaurant workspaces.");
    },

    async updateRestaurantMember() {
      throw new Error("Team membership management is available only for authenticated restaurant workspaces.");
    },

    async removeRestaurantMember() {
      throw new Error("Team membership management is available only for authenticated restaurant workspaces.");
    },

    async updateMyProfile(name) {
      return mutateDemoState((state) => {
        const user = state.users[0];
        if (!user) throw new Error("Demo user missing");
        user.name = name;
        return normalizeAppUser(user);
      });
    },

    async deleteAccount(_restaurantId) {
      // Demo accounts live only on this device; deletion resets the local store.
      await resetDemoStore();
    },

    async createRestaurantWithOwner(name, cuisineType) {
      return mutateDemoState((state) => {
        const restaurant = state.restaurants[0];
        if (!restaurant) throw new Error("Demo restaurant missing");
        restaurant.name = name.trim() || restaurant.name;
        restaurant.cuisine_type = cuisineType?.trim() || restaurant.cuisine_type;
        return normalizeRestaurant(restaurant);
      });
    },

    async fetchRestaurant(restaurantId) {
      return fetchRestaurantFromState(await readReadyDemoState(restaurantId), restaurantId);
    },

    async updateRestaurantProfile(restaurantId, patch) {
      return mutateDemoState((state) => {
        const restaurant = state.restaurants.find((entry) => entry.id === restaurantId);
        if (!restaurant) throw new Error("Restaurant not found");
        Object.assign(restaurant, patch);
        return normalizeRestaurant(restaurant);
      });
    },

    async fetchRestaurantOpsProfile(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      return {
        restaurant: fetchRestaurantFromState(state, restaurantId),
        posIntegrations: state.posIntegrations
          .filter((integration) => integration.restaurant_id === restaurantId)
          .map(normalizePosIntegration),
        supplierItems: state.supplierItems
          .filter((item) => item.restaurant_id === restaurantId)
          .map(normalizeSupplierItem),
        recentAiInsights: state.aiInsights
          .filter((insight) => insight.restaurant_id === restaurantId)
          .map(normalizeAiInsight)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 5)
      };
    },

    async fetchPosIntegrations(restaurantId) {
      const state = await readDemoState();
      return state.posIntegrations
        .filter((integration) => integration.restaurant_id === restaurantId)
        .map(normalizePosIntegration);
    },

    async fetchAiInsights(restaurantId) {
      const state = await readDemoState();
      return state.aiInsights
        .filter((insight) => insight.restaurant_id === restaurantId)
        .map(normalizeAiInsight)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async createAiInsight(input) {
      return mutateDemoState((state) => {
        const insight: AiInsight = {
          ...input,
          id: createId("ai"),
          created_at: new Date().toISOString()
        };
        state.aiInsights.push(insight);
        return normalizeAiInsight(insight);
      });
    },

    async recordAuditLog(input) {
      await mutateDemoState((state) => appendDemoAuditLog(state, input));
    },

    async fetchRestaurantData(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      return normalizeRestaurantData(
        fetchRestaurantFromState(state, restaurantId),
        state.posSales.filter((sale) => sale.restaurant_id === restaurantId),
        state.inventoryItems.filter((item) => item.restaurant_id === restaurantId),
        state.purchaseRecommendations.filter((recommendation) => recommendation.restaurant_id === restaurantId),
        state.insights.filter((insight) => insight.restaurant_id === restaurantId),
        state.menuItemIngredients.filter((mapping) => mapping.restaurant_id === restaurantId)
      );
    },

    async fetchInventoryItems(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      return state.inventoryItems
        .filter((item) => item.restaurant_id === restaurantId)
        .map(normalizeInventoryItem)
        .sort((a, b) => a.item_name.localeCompare(b.item_name));
    },

    recordInventoryEvent,

    async fetchPlanningData(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      const restaurant = fetchRestaurantFromState(state, restaurantId);
      return {
        inventoryItems: state.inventoryItems.filter((item) => item.restaurant_id === restaurantId).map(normalizeInventoryItem),
        sales: state.posSales.filter((sale) => sale.restaurant_id === restaurantId).map(normalizePosSale),
        menuItemIngredients: state.menuItemIngredients
          .filter((mapping) => mapping.restaurant_id === restaurantId)
          .map(normalizeMenuItemIngredient),
        operatingDate: toDateKeyInTimeZone(new Date(), restaurant.timezone)
      };
    },

    async saveRestaurantSetupSnapshot(restaurantId, input) {
      return mutateDemoState((state) => {
        const now = new Date().toISOString();

        input.suppliers.forEach((supplierInput) => {
          const existing = state.supplierRecipients.find(
            (recipient) =>
              recipient.restaurant_id === restaurantId &&
              recipient.supplier_name.trim().toLowerCase() === supplierInput.supplier_name.trim().toLowerCase()
          );
          if (existing) {
            existing.supplier_name = supplierInput.supplier_name;
            existing.email = supplierInput.email;
            existing.updated_at = now;
          } else {
            state.supplierRecipients.push({
              ...supplierInput,
              id: createId("recipient"),
              created_at: now,
              updated_at: now
            });
          }
        });

        const inventoryByName = new Map<string, InventoryItem>();
        input.inventoryItems.forEach((inventoryInput) => {
          const key = inventoryInput.item_name.trim().toLowerCase();
          const existing = state.inventoryItems.find(
            (item) => item.restaurant_id === restaurantId && item.item_name.trim().toLowerCase() === key
          );
          if (existing) {
            Object.assign(existing, inventoryInput, { last_updated: now });
            inventoryByName.set(key, existing);
          } else {
            const item: InventoryItem = {
              ...inventoryInput,
              id: createId("item"),
              last_updated: now
            };
            state.inventoryItems.push(item);
            inventoryByName.set(key, item);
          }
        });

        input.recipeMappings.forEach((mappingInput) => {
          const inventoryItem = inventoryByName.get(mappingInput.inventory_item_name.trim().toLowerCase()) ??
            state.inventoryItems.find(
              (item) =>
                item.restaurant_id === restaurantId &&
                item.item_name.trim().toLowerCase() === mappingInput.inventory_item_name.trim().toLowerCase()
            );
          if (!inventoryItem) throw new Error("Recipe inventory item was not persisted.");
          const existing = state.menuItemIngredients.find(
            (mapping) =>
              mapping.restaurant_id === restaurantId &&
              mapping.inventory_item_id === inventoryItem.id &&
              mapping.menu_item_name.trim().toLowerCase() === mappingInput.menu_item_name.trim().toLowerCase()
          );
          if (existing) {
            existing.menu_item_name = mappingInput.menu_item_name;
            existing.quantity_used_per_sale = mappingInput.quantity_used_per_sale;
            existing.unit = mappingInput.unit;
          } else {
            state.menuItemIngredients.push({
              id: createId("map"),
              restaurant_id: restaurantId,
              menu_item_name: mappingInput.menu_item_name,
              inventory_item_id: inventoryItem.id,
              quantity_used_per_sale: mappingInput.quantity_used_per_sale,
              unit: mappingInput.unit
            });
          }
        });

        input.posSales.forEach((saleInput) => {
          const existing = saleInput.source_record_id
            ? state.posSales.find(
                (sale) =>
                  sale.restaurant_id === restaurantId &&
                  sale.source_pos === saleInput.source_pos &&
                  sale.source_record_id === saleInput.source_record_id
              )
            : undefined;
          if (existing) {
            Object.assign(existing, saleInput);
          } else {
            state.posSales.push({
              ...saleInput,
              id: createId("sale"),
              created_at: now
            });
          }
        });

        const summary: RestaurantSetupSnapshotSummary = {
          inventoryItemsSaved: input.inventoryItems.length,
          supplierRecipientsSaved: input.suppliers.length,
          recipeMappingsSaved: input.recipeMappings.length,
          posSalesRowsSaved: input.posSales.length,
          attachmentMetadataSaved: input.attachments.length,
          skippedRecipeIngredients: input.skippedRecipeIngredients
        };
        appendDemoAuditLog(state, {
          restaurant_id: restaurantId,
          action: "setup_completed",
          entity_table: "restaurants",
          entity_id: restaurantId,
          metadata: {
            inventory_items_saved: summary.inventoryItemsSaved,
            supplier_recipients_saved: summary.supplierRecipientsSaved,
            recipe_mappings_saved: summary.recipeMappingsSaved,
            pos_sales_rows_saved: summary.posSalesRowsSaved,
            attachment_metadata_saved: summary.attachmentMetadataSaved,
            skipped_recipe_ingredients: summary.skippedRecipeIngredients
          }
        });
        return summary;
      });
    },

    async upsertInventoryItem(input) {
      return mutateDemoState((state) => {
        const now = new Date().toISOString();
        const existing = state.inventoryItems.find(
          (item) =>
            item.restaurant_id === input.restaurant_id &&
            item.item_name.trim().toLowerCase() === input.item_name.trim().toLowerCase()
        );

        if (existing) {
          Object.assign(existing, input, { last_updated: now });
          return normalizeInventoryItem(existing);
        }

        const item: InventoryItem = {
          ...input,
          id: createId("item"),
          last_updated: now
        };
        state.inventoryItems.push(item);
        return normalizeInventoryItem(item);
      });
    },

    async createPosSale(input) {
      return mutateDemoState((state) => {
        const sale: PosSale = {
          ...input,
          id: createId("sale"),
          created_at: new Date().toISOString()
        };
        state.posSales.push(sale);
        return normalizePosSale(sale);
      });
    },

    async updateInventoryItem(restaurantId, itemId, patch) {
      const payload = { ...patch, last_updated: new Date().toISOString() };
      return mutateDemoState((state) => {
        const item = state.inventoryItems.find((entry) => entry.restaurant_id === restaurantId && entry.id === itemId);
        if (!item) throw new Error("Inventory item not found");
        Object.assign(item, payload);
        return normalizeInventoryItem(item);
      });
    },

    async updateInventoryItemAndSignals(
      restaurantId,
      itemId,
      expectedLastUpdated,
      patch,
      recommendations,
      insights
    ) {
      return mutateDemoState((state) => {
        const item = state.inventoryItems.find(
          (entry) => entry.restaurant_id === restaurantId && entry.id === itemId
        );
        if (!item) throw new Error("Inventory item not found");
        if (item.last_updated !== expectedLastUpdated) {
          throw new Error("Inventory item changed since it was loaded. Reload and try again.");
        }
        Object.assign(item, patch, { last_updated: new Date().toISOString() });
        state.purchaseRecommendations = [
          ...state.purchaseRecommendations.filter(
            (recommendation) => recommendation.restaurant_id !== restaurantId || recommendation.status !== "pending"
          ),
          ...recommendations.map((recommendation) => ({
            ...recommendation,
            id: createId("rec"),
            created_at: new Date().toISOString()
          }))
        ];
        state.insights = [
          ...state.insights.filter((insight) => insight.restaurant_id !== restaurantId),
          ...insights
        ];
        return normalizeInventoryItem(item);
      });
    },

    async updateMenuItemIngredientQuantity(restaurantId, mappingId, quantityUsedPerSale) {
      return mutateDemoState((state) => {
        const mapping = state.menuItemIngredients.find(
          (entry) => entry.restaurant_id === restaurantId && entry.id === mappingId
        );
        if (!mapping) throw new Error("Recipe baseline mapping not found");
        mapping.quantity_used_per_sale = quantityUsedPerSale;
        return normalizeMenuItemIngredient(mapping);
      });
    },

    async upsertMenuItemIngredient(input) {
      return mutateDemoState((state) => {
        const inventoryItem = state.inventoryItems.find(
          (item) => item.restaurant_id === input.restaurant_id && item.id === input.inventory_item_id
        );
        if (!inventoryItem) throw new Error("Inventory item not found");

        const existing = state.menuItemIngredients.find(
          (entry) =>
            entry.restaurant_id === input.restaurant_id &&
            entry.inventory_item_id === input.inventory_item_id &&
            entry.menu_item_name.trim().toLowerCase() === input.menu_item_name.trim().toLowerCase()
        );

        if (existing) {
          existing.menu_item_name = input.menu_item_name;
          existing.quantity_used_per_sale = input.quantity_used_per_sale;
          existing.unit = input.unit || inventoryItem.unit;
          return normalizeMenuItemIngredient(existing);
        }

        const mapping: MenuItemIngredient = {
          ...input,
          id: createId("map"),
          unit: input.unit || inventoryItem.unit
        };
        state.menuItemIngredients.push(mapping);
        return normalizeMenuItemIngredient(mapping);
      });
    },

    async saveRecipeMappingAndSignals(input) {
      return mutateDemoState((state) => {
        const inventoryItem = state.inventoryItems.find(
          (item) => item.restaurant_id === input.restaurantId && item.id === input.inventoryItemId
        );
        if (!inventoryItem) throw new Error("Inventory item not found");
        let mapping = input.mappingId
          ? state.menuItemIngredients.find(
              (entry) => entry.restaurant_id === input.restaurantId && entry.id === input.mappingId
            )
          : state.menuItemIngredients.find(
              (entry) =>
                entry.restaurant_id === input.restaurantId &&
                entry.inventory_item_id === input.inventoryItemId &&
                entry.menu_item_name.trim().toLowerCase() === input.menuItemName.trim().toLowerCase()
            );
        if (input.mappingId) {
          if (!mapping) throw new Error("Recipe mapping not found");
          if (mapping.quantity_used_per_sale !== input.expectedQuantity) {
            throw new Error("Recipe mapping changed since it was loaded. Reload and try again.");
          }
        }
        if (mapping) {
          mapping.menu_item_name = input.menuItemName;
          mapping.quantity_used_per_sale = input.quantityUsedPerSale;
          mapping.unit = input.unit;
        } else {
          mapping = {
            id: createId("map"),
            restaurant_id: input.restaurantId,
            menu_item_name: input.menuItemName,
            inventory_item_id: input.inventoryItemId,
            quantity_used_per_sale: input.quantityUsedPerSale,
            unit: input.unit
          };
          state.menuItemIngredients.push(mapping);
        }
        state.purchaseRecommendations = [
          ...state.purchaseRecommendations.filter(
            (recommendation) => recommendation.restaurant_id !== input.restaurantId || recommendation.status !== "pending"
          ),
          ...input.recommendations.map((recommendation) => ({
            ...recommendation,
            id: createId("rec"),
            created_at: new Date().toISOString()
          }))
        ];
        state.insights = [
          ...state.insights.filter((insight) => insight.restaurant_id !== input.restaurantId),
          ...input.insights
        ];
        return normalizeMenuItemIngredient(mapping);
      });
    },

    async findPendingRecommendation(restaurantId, itemId) {
      const state = await readReadyDemoState(restaurantId);
      const recommendation = state.purchaseRecommendations.find(
        (entry) => entry.restaurant_id === restaurantId && entry.inventory_item_id === itemId && entry.status === "pending"
      );
      return recommendation ? normalizePurchaseRecommendation(recommendation) : null;
    },

    async createPurchaseRecommendation(input) {
      return mutateDemoState((state) => {
        const existing = state.purchaseRecommendations.find(
          (recommendation) =>
            recommendation.restaurant_id === input.restaurant_id &&
            recommendation.inventory_item_id === input.inventory_item_id &&
            recommendation.status === "pending"
        );
        if (existing) return normalizePurchaseRecommendation(existing);
        const recommendation: PurchaseRecommendation = {
          ...input,
          id: createId("rec"),
          created_at: new Date().toISOString()
        };
        state.purchaseRecommendations.push(recommendation);
        return normalizePurchaseRecommendation(recommendation);
      });
    },

    async fetchPurchaseRecommendations(restaurantId, status = "pending") {
      const state = await readReadyDemoState(restaurantId);
      return state.purchaseRecommendations
        .filter((recommendation) => recommendation.restaurant_id === restaurantId)
        .filter((recommendation) => status === "all" || recommendation.status === status)
        .map(normalizePurchaseRecommendation)
        .sort((a, b) => severityRankForUrgency(b.urgency) - severityRankForUrgency(a.urgency));
    },

    async fetchRecommendationHistory(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      const cutoff = recommendationHistoryCutoffIso();
      return state.purchaseRecommendations
        .filter((recommendation) => recommendation.restaurant_id === restaurantId)
        .filter((recommendation) => recommendation.created_at >= cutoff)
        .map(normalizePurchaseRecommendation)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async updatePurchaseRecommendation(restaurantId, recommendationId, patch) {
      return mutateDemoState((state) => {
        const recommendation = state.purchaseRecommendations.find(
          (item) => item.restaurant_id === restaurantId && item.id === recommendationId
        );
        if (!recommendation) throw new Error("Recommendation not found");
        Object.assign(recommendation, patch);
        return normalizePurchaseRecommendation(recommendation);
      });
    },

    async approvePurchaseRecommendation(restaurantId, recommendationId, recommendedQuantity) {
      return mutateDemoState((state) => {
        const result = approveRecommendationInDemoState(
          state,
          restaurantId,
          recommendationId,
          recommendedQuantity
        );
        if (result.outcome === "applied") {
          appendDemoAuditLog(state, {
            restaurant_id: restaurantId,
            action: "recommendation_approved",
            entity_table: "purchase_recommendations",
            entity_id: result.recommendation.id,
            metadata: {
              supplier_name: result.recommendation.supplier_name,
              urgency: result.recommendation.urgency,
              supplier_order_id: result.order?.id ?? null
            }
          });
        }
        return {
          ...result,
          recommendation: normalizePurchaseRecommendation(result.recommendation),
          order: result.order ? normalizeSupplierOrder(result.order) : null
        };
      });
    },

    async dismissPurchaseRecommendation(restaurantId, recommendationId) {
      return mutateDemoState((state) => {
        const result = dismissRecommendationInDemoState(state, restaurantId, recommendationId);
        if (result.outcome === "applied") {
          appendDemoAuditLog(state, {
            restaurant_id: restaurantId,
            action: "recommendation_dismissed",
            entity_table: "purchase_recommendations",
            entity_id: result.recommendation.id,
            metadata: {
              supplier_name: result.recommendation.supplier_name,
              urgency: result.recommendation.urgency
            }
          });
        }
        return { ...result, recommendation: normalizePurchaseRecommendation(result.recommendation) };
      });
    },

    async undoPurchaseRecommendationAction(restaurantId, recommendationId) {
      return mutateDemoState((state) => {
        const result = undoRecommendationInDemoState(state, restaurantId, recommendationId);
        if (result.outcome === "applied") {
          appendDemoAuditLog(state, {
            restaurant_id: restaurantId,
            action: "recommendation_undo",
            entity_table: "purchase_recommendations",
            entity_id: result.recommendation.id,
            metadata: {
              previous_status: result.previousStatus,
              supplier_name: result.recommendation.supplier_name
            }
          });
        }
        return {
          ...result,
          recommendation: normalizePurchaseRecommendation(result.recommendation),
          order: result.order ? normalizeSupplierOrder(result.order) : null
        };
      });
    },

    async replacePendingRecommendations(restaurantId, inserts) {
      await mutateDemoState((state) => {
        state.purchaseRecommendations = [
          ...state.purchaseRecommendations.filter(
            (recommendation) => recommendation.restaurant_id !== restaurantId || recommendation.status !== "pending"
          ),
          ...inserts.map((insert) => ({
            ...insert,
            id: createId("rec"),
            created_at: new Date().toISOString()
          }))
        ];
      });
    },

    async fetchApprovedRecommendations(restaurantId, supplierName) {
      const state = await readDemoState();
      return state.purchaseRecommendations
        .filter(
          (recommendation) =>
            recommendation.restaurant_id === restaurantId &&
            recommendation.status === "approved" &&
            (!supplierName || recommendation.supplier_name === supplierName)
        )
        .map(normalizePurchaseRecommendation);
    },

    async markApprovedRecommendationsOrdered(restaurantId, supplierName) {
      return mutateDemoState((state) => {
        const ordered = state.purchaseRecommendations.filter(
          (recommendation) =>
            recommendation.restaurant_id === restaurantId &&
            recommendation.supplier_name === supplierName &&
            recommendation.status === "approved"
        );
        ordered.forEach((recommendation) => {
          recommendation.status = "ordered";
        });
        return ordered.map(normalizePurchaseRecommendation);
      });
    },

    async upsertSupplierOrderDraft(draft) {
      return mutateDemoState((state) => {
        const existing = state.supplierOrders.find(
          (order) =>
            order.restaurant_id === draft.restaurant_id &&
            order.supplier_name === draft.supplier_name &&
            order.status === "draft"
        );
        if (existing) {
          existing.order_message = draft.order_message;
          existing.delivery_date = draft.delivery_date;
          return normalizeSupplierOrder(existing);
        }
        state.supplierOrders.push(draft);
        return normalizeSupplierOrder(draft);
      });
    },

    async deleteSupplierOrderDraft(restaurantId, supplierName) {
      await mutateDemoState((state) => {
        state.supplierOrders = state.supplierOrders.filter(
          (order) =>
            order.restaurant_id !== restaurantId ||
            order.supplier_name !== supplierName ||
            order.status !== "draft"
        );
      });
    },

    async fetchSupplierOrders(restaurantId) {
      const state = await readDemoState();
      return state.supplierOrders
        .filter((order) => order.restaurant_id === restaurantId)
        .map(normalizeSupplierOrder)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async fetchSupplierOrder(restaurantId, orderId) {
      const state = await readDemoState();
      const order = state.supplierOrders.find((item) => item.restaurant_id === restaurantId && item.id === orderId);
      if (!order) throw new Error("Order draft not found");
      return normalizeSupplierOrder(order);
    },

    async updateSupplierOrder(restaurantId, orderId, patch) {
      return mutateDemoState((state) => {
        const order = state.supplierOrders.find((item) => item.restaurant_id === restaurantId && item.id === orderId);
        if (!order) throw new Error("Order draft not found");
        if (order.status !== "draft") throw new Error("Sent orders cannot be edited.");
        Object.assign(order, patch);
        if (Object.prototype.hasOwnProperty.call(patch, "operator_note")) {
          order.operator_note = patch.operator_note?.trim() || null;
          const linked = state.purchaseRecommendations.filter(
            (recommendation) =>
              recommendation.restaurant_id === restaurantId &&
              recommendation.supplier_order_id === orderId &&
              recommendation.status === "approved"
          );
          order.order_message = buildSupplierOrderMessage(order.supplier_name, linked, order.operator_note);
        }
        return normalizeSupplierOrder(order);
      });
    },

    async markSupplierOrderSent(restaurantId, orderId) {
      return mutateDemoState((state) => {
        const result = markSupplierOrderSentInDemoState(state, restaurantId, orderId);
        if (result.outcome === "applied") {
          appendDemoAuditLog(state, {
            restaurant_id: restaurantId,
            action: "supplier_order_sent",
            entity_table: "supplier_orders",
            entity_id: result.order.id,
            metadata: {
              supplier_name: result.order.supplier_name,
              ordered_recommendation_count: result.orderedRecommendations.length
            }
          });
        }
        return {
          ...result,
          order: normalizeSupplierOrder(result.order),
          orderedRecommendations: result.orderedRecommendations.map(normalizePurchaseRecommendation)
        };
      });
    },

    async connectRestaurantGmail(restaurantId) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        const now = new Date().toISOString();
        let connection = state.emailConnections.find(
          (entry) => entry.restaurant_id === restaurantId && entry.provider === "gmail"
        );
        if (!connection) {
          connection = {
            id: createId("email_connection"),
            restaurant_id: restaurantId,
            provider: "gmail",
            status: "connected",
            sender_email: "demo.sender@example.com",
            last_verified_at: now,
            created_at: now,
            updated_at: now
          };
          state.emailConnections.push(connection);
        } else {
          connection.status = "connected";
          connection.sender_email = "demo.sender@example.com";
          connection.last_verified_at = now;
          connection.updated_at = now;
        }
        appendDemoAuditLog(state, {
          restaurant_id: restaurantId,
          action: "gmail_demo_connected",
          entity_table: "restaurant_email_connections",
          entity_id: connection.id,
          metadata: { provider: "gmail", simulated: true }
        });
        return {
          status: "connected" as const,
          outcome: "demo_connected" as const,
          connection: normalizeRestaurantEmailConnection(connection)
        };
      });
    },

    async disconnectRestaurantGmail(restaurantId) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        const connection = state.emailConnections.find(
          (entry) => entry.restaurant_id === restaurantId && entry.provider === "gmail"
        );
        const alreadyDisconnected = !connection || connection.status === "not_connected";
        if (connection) {
          connection.status = "not_connected";
          connection.sender_email = null;
          connection.last_verified_at = null;
          connection.updated_at = new Date().toISOString();
        }
        appendDemoAuditLog(state, {
          restaurant_id: restaurantId,
          action: "gmail_demo_disconnected",
          entity_table: "restaurant_email_connections",
          entity_id: connection?.id ?? null,
          metadata: { provider: "gmail", simulated: true, already_disconnected: alreadyDisconnected }
        });
        return {
          status: "not_connected" as const,
          outcome: alreadyDisconnected ? "already_disconnected" as const : "disconnected" as const
        };
      });
    },

    async sendSupplierOrderEmail(restaurantId, orderId) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, restaurantId);
        const order = state.supplierOrders.find(
          (entry) => entry.restaurant_id === restaurantId && entry.id === orderId
        );
        if (!order) throw new Error("Order draft not found");
        const connection = state.emailConnections.find(
          (entry) => entry.restaurant_id === restaurantId && entry.provider === "gmail"
        );
        if (connection?.status === "needs_reauth") {
          throw new GmailIntegrationError("needs_reauth", "Reconnect the demo Gmail sender before sending this order.");
        }
        if (!connection || connection.status !== "connected") {
          throw new GmailIntegrationError("gmail_not_connected", "Connect the demo Gmail sender before sending this order.");
        }
        const recipient = state.supplierRecipients.find(
          (entry) =>
            entry.restaurant_id === restaurantId &&
            entry.supplier_name.trim().toLowerCase() === order.supplier_name.trim().toLowerCase()
        );
        if (!recipient?.email) {
          throw new GmailIntegrationError("supplier_email_missing", `Add an email recipient for ${order.supplier_name} before sending.`);
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) {
          throw new GmailIntegrationError("supplier_email_invalid", `Add a valid email recipient for ${order.supplier_name} before sending.`);
        }

        const wasAlreadySent = order.status === "sent" || order.status === "completed";
        const result = markSupplierOrderSentInDemoState(state, restaurantId, orderId);
        const providerMessageId = `demo-gmail:${orderId}`;
        if (!wasAlreadySent) {
          appendDemoAuditLog(state, {
            restaurant_id: restaurantId,
            action: "supplier_email_sent",
            entity_table: "supplier_orders",
            entity_id: orderId,
            metadata: {
              provider: "gmail",
              provider_message_id: providerMessageId,
              simulated: true,
              ordered_recommendation_count: result.orderedRecommendations.length
            }
          });
        }
        return {
          status: "sent" as const,
          outcome: wasAlreadySent ? "already_sent" as const : result.outcome,
          providerMessageId,
          order: normalizeSupplierOrder(result.order),
          orderedRecommendations: result.orderedRecommendations.map(normalizePurchaseRecommendation)
        };
      });
    },

    async fetchInsights(restaurantId) {
      const state = await readReadyDemoState(restaurantId);
      return state.insights
        .filter((insight) => insight.restaurant_id === restaurantId)
        .map(normalizeInsight)
        .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
    },

    async replaceInsights(restaurantId, insights) {
      await mutateDemoState((state) => {
        state.insights = [
          ...state.insights.filter((insight) => insight.restaurant_id !== restaurantId),
          ...insights
        ];
      });
    },

    async replaceOperationalSignals(restaurantId, recommendations, insights) {
      await mutateDemoState((state) => {
        state.purchaseRecommendations = [
          ...state.purchaseRecommendations.filter(
            (recommendation) => recommendation.restaurant_id !== restaurantId || recommendation.status !== "pending"
          ),
          ...recommendations.map((recommendation) => ({
            ...recommendation,
            id: createId("rec"),
            created_at: new Date().toISOString()
          }))
        ];
        state.insights = [
          ...state.insights.filter((insight) => insight.restaurant_id !== restaurantId),
          ...insights
        ];
      });
    },

    async fetchEmailConnectionState(restaurantId) {
      const state = await readDemoState();
      const connection =
        state.emailConnections.find((entry) => entry.restaurant_id === restaurantId && entry.provider === "gmail") ??
        null;
      return connection ? normalizeRestaurantEmailConnection(connection) : null;
    },

    async fetchSupplierRecipients(restaurantId) {
      const state = await readDemoState();
      return state.supplierRecipients
        .filter((recipient) => recipient.restaurant_id === restaurantId)
        .map(normalizeSupplierRecipient)
        .sort((a, b) => a.supplier_name.localeCompare(b.supplier_name));
    },

    async upsertSupplierRecipient(input) {
      return mutateDemoState((state) => {
        requireActiveDemoRestaurant(state, input.restaurant_id);
        const catalogReferences = [
          ...state.inventoryItems.map((item) => ({ restaurantId: item.restaurant_id, supplierName: item.supplier_name })),
          ...state.supplierItems.map((item) => ({ restaurantId: item.restaurant_id, supplierName: item.supplier_name })),
          ...state.supplierOrders.map((order) => ({ restaurantId: order.restaurant_id, supplierName: order.supplier_name })),
          ...state.purchaseRecommendations.map((recommendation) => ({
            restaurantId: recommendation.restaurant_id,
            supplierName: recommendation.supplier_name
          })),
          ...state.purchaseOrders.map((order) => ({ restaurantId: order.restaurant_id, supplierName: order.supplier_name })),
          ...state.supplierRecipients.map((recipient) => ({
            restaurantId: recipient.restaurant_id,
            supplierName: recipient.supplier_name
          }))
        ];
        const canonicalSupplierName = findSupplierRecipientCatalogName(
          input.restaurant_id,
          input.supplier_name,
          catalogReferences
        );
        if (!canonicalSupplierName) throw new Error("Supplier is not part of this restaurant catalog");

        const now = new Date().toISOString();
        const existing = state.supplierRecipients.find(
          (recipient) =>
            recipient.restaurant_id === input.restaurant_id &&
            supplierRecipientDirectoryKey(recipient.supplier_name) ===
              supplierRecipientDirectoryKey(canonicalSupplierName)
        );

        if (existing) {
          const changed = existing.supplier_name !== canonicalSupplierName || existing.email !== input.email;
          if (!changed) return normalizeSupplierRecipient(existing);
          existing.supplier_name = canonicalSupplierName;
          existing.email = input.email;
          existing.updated_at = now;
          appendDemoAuditLog(state, {
            restaurant_id: input.restaurant_id,
            action: "supplier_recipient_updated",
            entity_table: "supplier_recipients",
            entity_id: existing.id,
            metadata: { supplier_name: canonicalSupplierName, email_configured: true, simulated: true }
          });
          return normalizeSupplierRecipient(existing);
        }

        const recipient: SupplierRecipient = {
          ...input,
          supplier_name: canonicalSupplierName,
          id: createId("recipient"),
          created_at: now,
          updated_at: now
        };
        state.supplierRecipients.push(recipient);
        appendDemoAuditLog(state, {
          restaurant_id: input.restaurant_id,
          action: "supplier_recipient_created",
          entity_table: "supplier_recipients",
          entity_id: recipient.id,
          metadata: { supplier_name: canonicalSupplierName, email_configured: true, simulated: true }
        });
        return normalizeSupplierRecipient(recipient);
      });
    },

    async createSetupAttachment(input) {
      const now = new Date().toISOString();
      return normalizeSetupAttachment({
        ...input,
        id: createId("setup_ref"),
        created_by: null,
        created_at: now,
        updated_at: now
      });
    },

    async loadDemoPOSData(provider, setupProfile) {
      const state = await resetDemoStore(provider, setupProfile, prepareResetDemoState);
      const restaurant = state.restaurants[0];
      if (!restaurant) throw new Error("Demo restaurant missing");
      return normalizeRestaurant(restaurant);
    },

    async resetDemoData(provider, setupProfile) {
      const state = await resetDemoStore(provider, setupProfile, prepareResetDemoState);
      const restaurant = state.restaurants[0];
      if (!restaurant) throw new Error("Demo restaurant missing");
      return normalizeRestaurant(restaurant);
    },

    async fetchPOSStatus() {
      const state = await readDemoState();
      return {
        provider: state.posProvider,
        connectedAt: state.posConnectedAt,
        label: state.posProvider ? "Demo connected" : "Demo mode"
      };
    }
  };
}

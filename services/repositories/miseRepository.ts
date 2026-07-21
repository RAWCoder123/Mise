import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { demandFallbackForRestaurant } from "../demoData";
import { buildInsightsFromData } from "../domain/miseDomain";
import { createLocalDemoRepository } from "./demoRepository";
import type { MiseRepository, PlanningData } from "./repositoryContracts";
import { createSupabaseRepository } from "./supabaseRepository";

export * from "./repositoryContracts";
export { createLocalDemoRepository } from "./demoRepository";
export { createSupabaseRepository } from "./supabaseRepository";

export function createMiseRepository(): MiseRepository {
  return isSupabaseConfigured && supabase ? createSupabaseRepository() : createLocalDemoRepository();
}

export function buildLocalInsightsForTest(data: PlanningData & { restaurantId: string }) {
  return buildInsightsFromData(
    data.restaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    demandFallbackForRestaurant(data.restaurantId)
  );
}

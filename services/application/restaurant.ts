import type { AiInsight, PosProvider, Restaurant, RestaurantMembership } from "../../types/mise";
import { buildAiInsightInput, parseStructuredInsightOutput } from "../ai/structuredInsights";
import { DEMO_DATASET, type DemoSetupProfile } from "../demoData";
import type { AuditLogInput } from "../repositories/miseRepository";
import {
  normalizeTeamMemberEmail,
  type AssignableTeamRole
} from "../domain/teamMembership";
import {
  requireRestaurantCuisineType,
  requireRestaurantName,
  requireRestaurantProfilePatch
} from "../miseValidation";
import { regenerateOperationalSignals } from "./recalculations";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export async function fetchRestaurant(restaurantId: string) {
  return repository.fetchRestaurant(restaurantId);
}

export async function fetchMembershipsForAuthUser(userId: string) {
  return repository.fetchMembershipsForAuthUser(userId);
}

export async function fetchRestaurantTeam(restaurantId: string) {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  return repository.fetchRestaurantTeam(normalizedRestaurantId);
}

export async function addRestaurantMemberByEmail(
  restaurantId: string,
  email: string,
  role: AssignableTeamRole
) {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  const normalizedEmail = normalizeTeamMemberEmail(email);
  if (!normalizedEmail) throw new Error("Enter a valid teammate email.");
  return repository.addRestaurantMemberByEmail(normalizedRestaurantId, normalizedEmail, role);
}

export async function addRestaurantMember(
  restaurantId: string,
  targetUserId: string,
  role: Exclude<RestaurantMembership["role"], "owner">
) {
  return repository.addRestaurantMember(restaurantId, targetUserId, role);
}

export async function updateRestaurantMember(
  restaurantId: string,
  targetUserId: string,
  patch: Partial<Pick<RestaurantMembership, "role" | "status">>
) {
  if (!patch.role && !patch.status) throw new Error("Choose a membership role or status change.");
  return repository.updateRestaurantMember(restaurantId, targetUserId, patch);
}

export async function removeRestaurantMember(restaurantId: string, targetUserId: string) {
  return repository.removeRestaurantMember(restaurantId, targetUserId);
}

export async function deleteAccount(restaurantId: string) {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  return repository.deleteAccount(normalizedRestaurantId);
}

export async function updateMyProfile(name: string) {
  const normalizedName = name.trim();
  if (normalizedName.length < 1 || normalizedName.length > 120) {
    throw new Error("Profile name must be between 1 and 120 characters.");
  }
  return repository.updateMyProfile(normalizedName);
}

export async function createRestaurantWithOwner(name: string, cuisineType?: string | null) {
  return repository.createRestaurantWithOwner(
    requireRestaurantName(name),
    requireRestaurantCuisineType(cuisineType)
  );
}

export async function updateRestaurantProfile(
  restaurantId: string,
  patch: Partial<
    Pick<
      Restaurant,
      | "name"
      | "address"
      | "cuisine_type"
      | "brand_color"
      | "accent_color"
      | "logo_url"
      | "service_style"
      | "timezone"
      | "currency"
      | "operational_profile"
    >
  >
) {
  return repository.updateRestaurantProfile(restaurantId, requireRestaurantProfilePatch(patch));
}

export async function fetchRestaurantOpsProfile(restaurantId: string) {
  return repository.fetchRestaurantOpsProfile(restaurantId);
}

export async function fetchPosIntegrations(restaurantId: string) {
  return repository.fetchPosIntegrations(restaurantId);
}

export async function fetchAiInsights(restaurantId: string) {
  return repository.fetchAiInsights(restaurantId);
}

export async function createStructuredAiInsight(
  restaurantId: string,
  output: unknown,
  generatedBy: string | null = "rules_engine"
): Promise<AiInsight> {
  return repository.createAiInsight(buildAiInsightInput(restaurantId, parseStructuredInsightOutput(output), generatedBy));
}

export async function recordAuditLog(input: AuditLogInput) {
  return repository.recordAuditLog(input);
}

export async function loadDemoPOSData(
  provider: PosProvider = DEMO_DATASET.defaultPosProvider,
  setupProfile?: DemoSetupProfile
) {
  const restaurant = await repository.loadDemoPOSData(provider, setupProfile);
  await regenerateOperationalSignals(restaurant.id);
  return restaurant;
}

export async function resetDemoData(
  provider: PosProvider | null = DEMO_DATASET.defaultPosProvider,
  setupProfile?: DemoSetupProfile
) {
  const restaurant = await repository.resetDemoData(provider, setupProfile);
  await regenerateOperationalSignals(restaurant.id);
  return restaurant;
}

export async function fetchSuppliers(restaurantId: string) {
  const inventoryItems = await repository.fetchInventoryItems(restaurantId);
  return [...new Set(inventoryItems.map((item) => item.supplier_name))].sort();
}

export async function fetchPOSStatus(restaurantId?: string | null) {
  return repository.fetchPOSStatus(restaurantId);
}

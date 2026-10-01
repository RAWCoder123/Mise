import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("orders keeps blocked recommendations visible while disabling only approval", async () => {
  const [screen, row] = await Promise.all([
    source("app/(tabs)/orders.tsx"),
    source("components/RecommendationDecisionRow.tsx")
  ]);

  assert.match(screen, /fetchPurchaseRecommendationAuthorities\(restaurantId\)/);
  assert.match(screen, /authority=\{recommendationAuthorities\[recommendation\.id\]\}/);
  assert.match(screen, /isPurchaseAuthorityBlockedError\(error\)/);
  assert.match(row, /const approvalBlocked = authority\?\.ready === false/);
  assert.match(row, /disabled=\{busy \|\| approvalBlocked\}/);
  assert.match(row, /onPress=\{onDismiss\}/);
  assert.doesNotMatch(row, /onDismiss[\s\S]{0,180}disabled=\{busy \|\| approvalBlocked\}/);
});

test("recipe settings exposes explicit confirmation and hosted changes remain RPC-only", async () => {
  const [screen, inventoryApplication, repository] = await Promise.all([
    source("app/settings/recipes.tsx"),
    source("services/application/inventory.ts"),
    source("services/repositories/supabaseRepository.ts")
  ]);

  assert.match(screen, /confirmRecipeBaselineComplete\(restaurantId, item\.menuItemId, item\.recipeRevision\)/);
  assert.match(screen, /item\.authorityReady \? "recipes\.authority\.confirmed"/);
  assert.match(screen, /setRecipeMenuItemActive\(restaurantId, item\.menuItemId, nextActive\)/);
  assert.match(inventoryApplication, /repository\.confirmRecipeComplete\(/);
  assert.match(inventoryApplication, /repository\.setMenuItemActive\(/);
  assert.match(repository, /client\.rpc\("confirm_recipe_complete"/);
  assert.match(repository, /client\.rpc\("list_recipe_authorities"/);
  assert.match(repository, /client\.rpc\("set_menu_item_active"/);
  assert.doesNotMatch(screen, /\.from\("menu_items"\)/);
});

test("hosted UI readiness is presentation-only and approval stays on one server RPC", async () => {
  const [ordersApplication, repository] = await Promise.all([
    source("services/application/orders.ts"),
    source("services/repositories/supabaseRepository.ts")
  ]);

  assert.match(repository, /client\.rpc\("list_purchase_recommendation_authority"/);
  assert.match(repository, /client\.rpc\("approve_purchase_recommendation"/);
  assert.match(ordersApplication, /PurchaseAuthorityBlockedError/);
  assert.match(
    ordersApplication,
    /Supplier drafts are created only by the server-authoritative recommendation approval workflow/
  );
  const legacyPath = ordersApplication.match(
    /export async function generateSupplierOrderDraft[\s\S]*?\n}\n\nexport async function undoPurchaseRecommendationAction/
  )?.[0] ?? "";
  assert.ok(legacyPath);
  assert.doesNotMatch(legacyPath, /upsertSupplierOrderDraft\(draft\)/);
});

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

test("blocked purchase recommendations surface blocker-specific recovery deep links", async () => {
  const [row, catalog, domain] = await Promise.all([
    source("components/RecommendationDecisionRow.tsx"),
    source("i18n/catalog.ts"),
    source("services/domain/purchaseAuthority.ts")
  ]);

  assert.match(domain, /export function resolvePurchaseAuthorityBlockerRecovery/);
  assert.match(row, /resolvePurchaseAuthorityBlockerRecovery\(blocker\.code, authority\.evidence\)/);
  assert.match(row, /router\.push\(recovery\.href as never\)/);
  assert.match(row, /t\(recovery\.labelKey\)/);
  assert.match(catalog, /"orders\.authority\.recovery\.count": "Start inventory count"/);
  assert.match(catalog, /"orders\.authority\.recovery\.posMappings": "Review POS mappings"/);
  assert.match(catalog, /"orders\.authority\.recovery\.count": "Iniciar conteo de inventario"/);
  assert.match(catalog, /"orders\.authority\.recovery\.count": "开始库存盘点"/);
  assert.doesNotMatch(row, /\.from\("purchase_recommendations"\)/);
});

test("home one-tap approve surfaces purchase-authority blockers with recovery deep links", async () => {
  const [home, domain] = await Promise.all([
    source("app/(tabs)/home.tsx"),
    source("services/domain/purchaseAuthority.ts")
  ]);

  assert.match(domain, /export function resolvePurchaseAuthorityBlockerRecovery/);
  assert.match(home, /isPurchaseAuthorityBlockedError\(approveError\)/);
  assert.match(home, /purchaseAuthorityBlockerMessageKey\(firstBlocker\.code\)/);
  assert.match(home, /setApprovalAuthorities\(/);
  assert.match(home, /approvalAuthorities=\{approvalAuthorities\}/);
  assert.match(home, /resolvePurchaseAuthorityBlockerRecovery\(blocker\.code, authority\.evidence\)/);
  assert.match(home, /router\.push\(recovery\.href as never\)/);
  assert.match(home, /disabled=\{Boolean\(approvingId\) \|\| \(canOneTap && approvalBlocked\)\}/);
  assert.doesNotMatch(home, /\.from\("purchase_recommendations"\)/);
  assert.doesNotMatch(home, /client\.rpc\(/);
});

test("recipe settings exposes explicit confirmation and hosted changes remain RPC-only", async () => {
  const [screen, inventoryApplication, repository] = await Promise.all([
    source("app/settings/recipes.tsx"),
    source("services/application/inventory.ts"),
    source("services/repositories/supabaseRepository.ts")
  ]);

  assert.match(screen, /confirmRecipeBaselineComplete\(restaurantId, item\.menuItemId, item\.recipeRevision\)/);
  assert.match(screen, /item\.authorityReady \? "recipes\.authority\.confirmed"/);
  assert.match(inventoryApplication, /repository\.confirmRecipeComplete\(/);
  assert.match(repository, /client\.rpc\("confirm_recipe_complete"/);
  assert.match(repository, /client\.rpc\("list_recipe_authorities"/);
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

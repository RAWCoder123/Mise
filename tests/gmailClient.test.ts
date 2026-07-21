import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Gmail client workflows stay typed, tenant-scoped, and behind backend functions", () => {
  const application = readFileSync("services/application/orders.ts", "utf8");
  const hostedRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");

  assert.match(application, /export async function connectRestaurantGmail/);
  assert.match(application, /export async function disconnectRestaurantGmail/);
  assert.match(application, /export async function sendSupplierOrderEmail/);
  assert.match(application, /requireWorkflowId\(restaurantId, "restaurant"\)/);
  assert.match(application, /requireWorkflowId\(orderId, "supplier order"\)/);

  assert.match(hostedRepository, /functions\.invoke\(functionName, \{ body \}\)/);
  assert.match(hostedRepository, /"link-gmail",\s*\{ restaurantId, action: "connect" \}/s);
  assert.match(hostedRepository, /"link-gmail",\s*\{ restaurantId, action: "disconnect" \}/s);
  assert.match(hostedRepository, /"send-supplier-email",\s*\{ restaurantId, orderId \}/s);
  assert.match(demoRepository, /requireActiveDemoRestaurant\(state, restaurantId\)/);
  assert.match(demoRepository, /entry\.restaurant_id === restaurantId && entry\.id === orderId/);
  assert.match(demoRepository, /entry\.restaurant_id === restaurantId && entry\.provider === "gmail"/);
  assert.doesNotMatch(application, /client_secret|refresh_token|access_token/i);
});

test("Gmail client validates provider responses and never trusts arbitrary authorization URLs", () => {
  const repository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");

  assert.match(repository, /url\.protocol !== "https:" \|\| url\.hostname !== "accounts\.google\.com"/);
  assert.match(repository, /url\.username \|\| url\.password/);
  assert.match(repository, /order\.id !== orderId \|\| order\.restaurant_id !== restaurantId/);
  assert.match(repository, /entry\.restaurant_id !== restaurantId \|\| entry\.supplier_order_id !== orderId/);
  assert.match(repository, /providerMessageId\.length <= 1024/);
  assert.match(repository, /candidateMessage\.trim\(\)\.slice\(0, 320\)/);
});

test("Gmail settings and order delivery UI preserve roles, simulation disclosure, and safe recovery", () => {
  const settings = readFileSync("app/settings/gmail.tsx", "utf8");
  const orderDetail = readFileSync("app/orders/[id].tsx", "utf8");
  const layout = readFileSync("app/_layout.tsx", "utf8");
  const routeSmoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  const layoutSmoke = readFileSync("scripts/mobile-layout-smoke.mjs", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(settings, /canDeleteRestaurantData\(memberships, restaurant\?\.id\)/);
  assert.match(settings, /Linking\.canOpenURL\(result\.authorizationUrl\)/);
  assert.match(settings, /Linking\.openURL\(result\.authorizationUrl\)/);
  assert.match(settings, /activeRestaurantIdRef\.current !== restaurantId/);
  assert.match(settings, /settings\.gmail\.demo\.body/);
  assert.doesNotMatch(settings, /refresh[_ ]?token|client[_ ]?secret|access[_ ]?token/i);

  assert.match(orderDetail, /canManageRestaurantData\(memberships, restaurant\?\.id\)/);
  assert.match(orderDetail, /canDeleteRestaurantData\(memberships, restaurant\?\.id\)/);
  assert.match(orderDetail, /emailConnection\?\.status !== "connected"/);
  assert.match(orderDetail, /await sendSupplierOrderEmail\(restaurantId, savedOrder\.id\)/);
  assert.match(orderDetail, /orders\.detail\.notice\.demoSentBody/);
  assert.match(catalog, /Mise updated the demo workflow\. No email was sent\./);
  assert.doesNotMatch(orderDetail, /markSupplierOrderSent/);

  assert.match(layout, /<Stack\.Screen name="settings\/gmail" \/>/);
  assert.match(layout, /<Stack\.Screen name="settings\/suppliers" \/>/);
  assert.match(routeSmoke, /"\/settings\/gmail"/);
  assert.match(layoutSmoke, /"\/settings\/gmail"/);
  assert.match(routeSmoke, /"\/settings\/language"/);
  assert.match(layoutSmoke, /"\/settings\/language"/);
  assert.match(routeSmoke, /"\/settings\/suppliers"/);
  assert.match(layoutSmoke, /"\/settings\/suppliers"/);
});

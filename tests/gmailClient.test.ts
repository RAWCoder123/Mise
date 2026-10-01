import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Gmail client workflows stay typed, tenant-scoped, and behind backend functions", () => {
  const application = readFileSync("services/application/orders.ts", "utf8");
  const actionApplication = readFileSync("services/application/miseActions.ts", "utf8");
  const hostedRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
  const sendFunction = readFileSync("supabase/functions/send-supplier-email/index.ts", "utf8");
  const envelopeMigration = readFileSync(
    "supabase/migrations/20260814130000_supplier_send_envelope_approval.sql",
    "utf8"
  );
  const sendIntegrityMigration = readFileSync(
    "supabase/migrations/20260823062101_mise_003b_supplier_send_integrity.sql",
    "utf8"
  );

  assert.match(application, /export async function connectRestaurantGmail/);
  assert.match(application, /export async function disconnectRestaurantGmail/);
  assert.match(application, /export async function sendSupplierOrderEmail/);
  assert.match(application, /export async function previewSupplierSendContent/);
  assert.match(actionApplication, /export async function approveSupplierSendContent/);
  assert.match(application, /requireWorkflowId\(restaurantId, "restaurant"\)/);
  assert.match(application, /requireWorkflowId\(orderId, "supplier order"\)/);

  assert.match(hostedRepository, /functions\.invoke\(functionName, \{ body \}\)/);
  assert.match(hostedRepository, /"link-gmail",\s*\{ restaurantId, action: "connect" \}/s);
  assert.match(hostedRepository, /"link-gmail",\s*\{ restaurantId, action: "disconnect" \}/s);
  assert.match(hostedRepository, /"send-supplier-email",\s*\{ restaurantId, orderId \}/s);
  assert.match(hostedRepository, /client\.rpc\("preview_supplier_send_content"/);
  assert.match(hostedRepository, /client\.rpc\("approve_supplier_send_content"/);
  assert.match(hostedRepository, /client\.rpc\("get_supplier_email_delivery_review"/);
  assert.match(hostedRepository, /client\.rpc\("resolve_supplier_email_delivery"/);
  assert.doesNotMatch(hostedRepository, /fingerprintSupplierSendSnapshot|serializeSupplierSendSnapshot/);
  assert.match(hostedRepository, /p_reviewed_content_fingerprint: reviewedFingerprint/);
  assert.doesNotMatch(hostedRepository, /client\.rpc\("approve_supplier_send_envelope"/);
  assert.match(hostedRepository, /\.eq\("idempotency_key", `send_supplier_order:\$\{orderId\}`\)/);
  assert.match(demoRepository, /requireActiveDemoRestaurant\(state, restaurantId\)/);
  assert.match(demoRepository, /entry\.restaurant_id === restaurantId && entry\.id === orderId/);
  assert.match(demoRepository, /entry\.restaurant_id === restaurantId && entry\.provider === "gmail"/);
  assert.match(sendFunction, /rpc\(\s*"service_claim_supplier_email_send"/s);
  assert.match(sendFunction, /isClaimedSupplierEmail\(claimData, requestedMessageId\)/);
  assert.match(sendFunction, /sentToPreviouslyClaimedRecipient/);
  assert.match(sendFunction, /externalIdentityChangedDuringClaim/);
  assert.match(sendFunction, /isPostgresSerializationFailure\(error\)/);
  assert.match(sendFunction, /blockerCodes: \["send_verification_race"\]/);
  assert.match(sendFunction, /status: changed \? "send_content_changed" : "send_content_unapproved"/);
  assert.match(
    sendFunction,
    /from: claim\.from,[\s\S]*to: claim\.to,[\s\S]*subject: claim\.subject,[\s\S]*textBody: claim\.body/
  );
  assert.doesNotMatch(sendFunction, /rpc\("decide_mise_action"/);
  assert.match(demoRepository, /approvedSendContent/);
  assert.match(demoRepository, /throw new GmailIntegrationError\("approval_required"/);
  assert.match(envelopeMigration, /approved_envelope[\s\S]*approval_required/);
  assert.match(envelopeMigration, /for update;[\s\S]*service_claim_supplier_email_send_unchecked/);
  assert.ok(
    (envelopeMigration.match(/lower\(trim\(supplier\.supplier_name\)\) = lower\(trim\(order_row\.supplier_name\)\)/g) ?? []).length >= 2
  );
  assert.match(
    envelopeMigration,
    /lower\(trim\(recipient\.supplier_name\)\) = lower\(trim\(order_row\.supplier_name\)\)/
  );
  assert.match(sendIntegrityMigration, /preview_supplier_send_content/);
  assert.match(sendIntegrityMigration, /approve_supplier_send_content/);
  assert.match(sendIntegrityMigration, /revoke all on function public\.approve_supplier_send_envelope/);
  assert.match(sendIntegrityMigration, /approvedSendContent/);
  assert.doesNotMatch(application, /client_secret|refresh_token|access_token/i);
});

test("Gmail client validates provider responses and never trusts arbitrary authorization URLs", () => {
  const repository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");

  assert.match(repository, /url\.protocol !== "https:" \|\| url\.hostname !== "accounts\.google\.com"/);
  assert.match(repository, /url\.username \|\| url\.password/);
  assert.match(repository, /order\.id !== orderId \|\| order\.restaurant_id !== restaurantId/);
  assert.match(repository, /entry\.restaurant_id !== restaurantId/);
  assert.match(repository, /entry\.supplier_order_id !== orderId/);
  assert.match(repository, /entry\.status !== "ordered"/);
  assert.match(repository, /new Set\(orderedRecommendationIds\)\.size !== orderedRecommendationIds\.length/);
  assert.match(repository, /providerMessageId\.length <= 1024/);
  assert.match(repository, /candidateMessage\.trim\(\)\.slice\(0, 320\)/);
  assert.match(repository, /parseSupplierSendBlockerCodes\(payload\.blockerCodes\)/);
  assert.match(repository, /normalizeSupplierSendContentPreview\(data, restaurantId, orderId\)/);
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
  assert.match(orderDetail, /prepareSupplierEmailPayload/);
  assert.match(orderDetail, /orders\.detail\.review\.to/);
  assert.match(orderDetail, /approveSupplierSendContent/);
  assert.match(orderDetail, /resolveSupplierEmailDelivery/);
  assert.match(orderDetail, /needsDeliveryReview/);
  assert.doesNotMatch(orderDetail, /decideMiseAction/);
  assert.match(orderDetail, /await sendSupplierOrderEmail\(restaurantId, savedOrder\.id\)/);
  assert.match(orderDetail, /orders\.detail\.notice\.demoSentBody/);
  assert.match(orderDetail, /result\.sentToPreviouslyClaimedRecipient/);
  assert.match(orderDetail, /orders\.detail\.notice\.claimedRecipientBody/);
  assert.match(orderDetail, /isSupplierSendVerificationRace\(error\)/);
  assert.match(orderDetail, /orders\.detail\.error\.verificationRaceTitle/);
  assert.match(orderDetail, /recovery: "retry"/);
  assert.match(orderDetail, /blockerCodes\.includes\("send_verification_race"\)/);
  assert.doesNotMatch(orderDetail, /fingerprintSupplierSendSnapshot|serializeSupplierSendSnapshot/);
  assert.doesNotMatch(orderDetail, /domain\/supplierSendContent/);
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

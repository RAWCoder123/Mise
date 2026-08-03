import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("orders presents reference-aligned draft, sent, and history lanes with safe Gmail setup guidance", () => {
  const screen = readFileSync("app/(tabs)/orders.tsx", "utf8");
  const segmentedControl = readFileSync("components/ui/SegmentedControl.tsx", "utf8");
  const button = readFileSync("components/ui/Button.tsx", "utf8");

  assert.match(screen, /type OrderLane = "drafts" \| "sent" \| "history"/);
  assert.match(screen, /lane === "drafts"/);
  assert.match(screen, /lane === "sent"/);
  assert.match(screen, /lane === "history"/);
  assert.match(screen, /visibleRecommendations\.length > 0/);
  assert.match(screen, /t\("orders\.review\.title"\)/);
  assert.match(screen, /components\/ui\/SegmentedControl/);
  assert.match(screen, /<SegmentedControl/);
  assert.match(screen, /value=\{lane\}/);
  assert.match(segmentedControl, /accessibilityRole="tab"/);
  assert.match(segmentedControl, /accessibilityState=\{\{ selected, disabled:/);
  assert.match(segmentedControl, /minHeight: 44/);
  assert.match(button, /minHeight: 44/);
  assert.doesNotMatch(screen, /minHeight:\s*(?:36|43)/);

  assert.match(screen, /t\("orders\.gmail\.ready\.title"\)/);
  assert.match(screen, /router\.push\("\/settings\/gmail"/i);
  assert.match(screen, /t\("orders\.gmail\.security\.live"\)/);
  assert.doesNotMatch(screen, /Send email/i);
  assert.doesNotMatch(screen, /Supplier spend/i);
  assert.doesNotMatch(screen, /Recently handled/i);
  assert.doesNotMatch(screen, /orderTab === "history"/);
});

test("orders keeps staff read-only while preserving review, copy, and detail access", () => {
  const screen = readFileSync("app/(tabs)/orders.tsx", "utf8");
  const row = readFileSync("components/RecommendationDecisionRow.tsx", "utf8");
  const card = readFileSync("components/SupplierDraftCard.tsx", "utf8");

  assert.match(screen, /canManageRestaurantData\(memberships, restaurant\?\.id\)/);
  assert.match(screen, /canDeleteRestaurantData\(memberships, restaurant\?\.id\)/);
  assert.match(screen, /readOnly=\{!canManage\}/);
  assert.match(screen, /showSend=\{canManage\}/);
  assert.match(screen, /canSend=\{canSendOrders \|\| canManage\}/);
  assert.match(screen, /t\("orders\.readOnly\.title"\)/);
  assert.ok((screen.match(/if \(!canManage\)/g) ?? []).length >= 4);
  assert.match(screen, /onCopy=\{\(\) => void copyOrder\(order\)\}/);
  assert.match(screen, /pathname: "\/orders\/\[id\]"/);

  assert.match(row, /readOnly\?: boolean/);
  assert.match(row, /!readOnly \? \(/);
  assert.match(row, /accessibilityState=\{\{ disabled: true \}\}/);
  assert.match(card, /showSend\?: boolean/);
  assert.match(card, /canSend\?: boolean/);
  assert.match(card, /isDraft && sendIsVisible && sendAction/);
  assert.match(card, /accessibilityState=\{\{ disabled: sendIsDisabled \}\}/);
});

test("recommendation actions validate quantity, lock locally, and reload authoritative state", () => {
  const screen = readFileSync("app/(tabs)/orders.tsx", "utf8");
  const row = readFileSync("components/RecommendationDecisionRow.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(screen, /nextQuantity <= 0/);
  assert.match(screen, /operatingLimits\.recommendationQuantity/);
  assert.match(screen, /parseNumber\(rawQuantity\)/);
  assert.match(screen, /t\("orders\.validation\.quantityRange"/);
  assert.match(screen, /recommendationLocksRef\.current\.has\(recommendation\.id\)/);
  assert.match(screen, /sendingLocksRef\.current\.has\(order\.id\)/);
  assert.match(screen, /undoLockRef\.current/);
  assert.match(screen, /await load\(false\)/);
  assert.match(screen, /buildRecommendationDecisionTelemetry/);
  assert.match(screen, /dismissPurchaseRecommendation\(\s*restaurantId,\s*recommendation\.id,\s*dismissReasonRaw/);
  assert.doesNotMatch(screen, /setRecommendations\(\(current\) => \[recommendation/);

  assert.match(row, /t\("orders\.recommendation\.quantityAccessibility"/);
  assert.match(row, /t\("orders\.recommendation\.dismissReason"/);
  assert.match(row, /onDismissReasonChange/);
  assert.match(row, /minHeight: 44/);
  assert.match(row, /action\?: "approve" \| "dismiss"/);
  assert.match(row, /accessibilityState=\{\{ expanded \}\}/);
  assert.match(catalog, /"orders\.recommendation\.dismissReason"/);
  assert.match(catalog, /"orders\.validation\.dismissReasonTooLong"/);
});

test("order list uses Gmail when connected and explicit external placement otherwise", () => {
  const screen = readFileSync("app/(tabs)/orders.tsx", "utf8");
  const detail = readFileSync("app/orders/[id].tsx", "utf8");
  const card = readFileSync("components/SupplierDraftCard.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(screen, /await sendSupplierOrderEmail\(restaurantId, order\.id\)/);
  assert.match(screen, /confirmSupplierOrderPlaced/);
  assert.doesNotMatch(screen, /markSupplierOrderSent/);
  assert.match(detail, /await sendSupplierOrderEmail\(restaurantId, savedOrder\.id\)/);
  assert.match(detail, /confirmSupplierOrderPlaced/);
  assert.match(detail, /receiveSupplierOrder/);
  assert.doesNotMatch(detail, /markSupplierOrderSent/);
  assert.match(detail, /t\("orders\.detail\.action\.simulate"\)/);
  assert.match(detail, /t\("orders\.detail\.gmail\.send"\)/);
  assert.match(detail, /t\("orders\.detail\.action\.markPlaced"\)/);
  assert.match(detail, /t\("orders\.detail\.action\.receive"\)/);
  assert.match(detail, /"orders\.detail\.notice\.demoSentBody"/);
  assert.match(detail, /presentOrderDetailMutationNoticeCopy/);
  assert.match(detail, /"demoSent"/);
  assert.match(detail, /captureMiseError/);
  assert.match(catalog, /Mise updated the demo workflow\. No email was sent\./);
  assert.match(detail, /operator_note: operatorNote\.trim\(\) \|\| null/);
  assert.match(detail, /order\.status !== "draft"/);
  assert.match(card, /title=\{busy \? resolvedBusyLabel : resolvedSendLabel\}/);
  assert.match(screen, /orders\.card\.action\.markPlaced/);
  assert.match(screen, /resolveOrdersHubSendSuccessReason/);
  assert.match(screen, /presentOrdersHubMutationNoticeCopy/);
  assert.match(screen, /orders\.notice\.send\.demo\.(?:already|zero|one|other)/);
  assert.match(screen, /captureMiseError/);
  assert.match(screen, /flow:\s*"orders_hub"/);
  assert.doesNotMatch(card, /Send email/i);
});

test("order receive uses locale-aware quantities and optional line notes", () => {
  const detail = readFileSync("app/orders/[id].tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const domain = readFileSync("services/domain/supplierOrderReceiving.ts", "utf8");

  assert.match(detail, /parseNumber/);
  assert.match(detail, /buildReceiveLinesFromFormInputs/);
  assert.match(detail, /isReceiveQuantityInputReady/);
  assert.match(detail, /receiveNotes/);
  assert.match(detail, /notesByItemId:\s*receiveNotes/);
  assert.match(detail, /t\("orders\.detail\.receive\.noteLabel"/);
  assert.match(detail, /t\("orders\.detail\.receive\.notePlaceholder"\)/);
  assert.match(detail, /"orders\.detail\.notice\.receiveInvalidTitle"/);
  assert.match(detail, /mutationNotice\(\s*"receiveInvalid/);
  assert.doesNotMatch(detail, /quantityReceived:\s*Number\(raw\)/);
  assert.doesNotMatch(detail, /note:\s*null\s*\n\s*\}/);
  assert.match(domain, /export function buildReceiveLinesFromFormInputs/);
  assert.match(catalog, /"orders\.detail\.receive\.noteLabel"/);
  assert.match(catalog, /"orders\.detail\.receive\.invalidQuantity"/);
  assert.match(catalog, /"orders\.detail\.notice\.receiveInvalidTitle"/);
});

test("order receive supports per-line put-away stations with a shared default", () => {
  const detail = readFileSync("app/orders/[id].tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const domain = readFileSync("services/domain/supplierOrderReceiving.ts", "utf8");

  assert.match(domain, /storageLocationIdsByItemId/);
  assert.match(detail, /receiveStorageLocationIds/);
  assert.match(detail, /storageLocationIdsByItemId:\s*receiveStorageLocationIds/);
  assert.match(detail, /t\("orders\.detail\.receive\.putAwayDefault"\)/);
  assert.match(detail, /t\("orders\.detail\.receive\.putAwayLine"/);
  assert.match(detail, /t\("orders\.detail\.receive\.putAwayLineOption"/);
  assert.match(detail, /setReceiveStorageLocationIds/);
  assert.match(catalog, /"orders\.detail\.receive\.putAwayDefault"/);
  assert.match(catalog, /"orders\.detail\.receive\.putAwayLine"/);
  assert.match(catalog, /"orders\.detail\.receive\.putAwayLineOption"/);
  assert.match(catalog, /"orders\.detail\.receive\.putAwayHelp"/);
});

test("completed orders show a read-only receive discrepancy summary from ledger movements", () => {
  const detail = readFileSync("app/orders/[id].tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const ordersWorkflow = readFileSync("services/application/orders.ts", "utf8");
  const domain = readFileSync("services/domain/supplierOrderReceiving.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");

  assert.match(domain, /export function buildCompletedSupplierOrderReceiveSummary/);
  assert.match(ordersWorkflow, /export async function fetchSupplierOrderReceiveSummary/);
  assert.match(repository, /fetchSupplierOrderReceiveMovements/);
  assert.match(repository, /metadata->>supplier_order_id/);
  assert.match(detail, /fetchSupplierOrderReceiveSummary/);
  assert.match(detail, /visibleReceiveSummary/);
  assert.match(detail, /isCompleted \? \(/);
  assert.match(detail, /t\("orders\.detail\.receivedSummary\.title"\)/);
  assert.match(detail, /t\("orders\.detail\.receivedSummary\.bodyWithDiscrepancy"/);
  assert.match(detail, /t\("orders\.detail\.receivedSummary\.matched"\)/);
  assert.doesNotMatch(detail, /setReceiveSummary\(\{[\s\S]*quantityReceived:\s*Number/);
  assert.match(catalog, /"orders\.detail\.receivedSummary\.title"/);
  assert.match(catalog, /"orders\.detail\.receivedSummary\.bodyWithDiscrepancy"/);
  assert.match(catalog, /"orders\.detail\.receivedSummary\.emptyBody"/);
});

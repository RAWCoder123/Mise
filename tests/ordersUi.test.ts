import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("orders presents reference-aligned draft, sent, and history lanes with safe Gmail setup guidance", () => {
  const screen = readFileSync("app/(tabs)/orders.tsx", "utf8");
  const segmentedControl = readFileSync("components/ui/SegmentedControl.tsx", "utf8");
  const button = readFileSync("components/ui/Button.tsx", "utf8");

  assert.match(screen, /type OrderLane = "drafts" \| "review" \| "sent" \| "history"/);
  assert.match(screen, /lane === "drafts"/);
  assert.match(screen, /lane === "review"/);
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
  assert.match(screen, /canSend=\{canSendOrders\}/);
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

  assert.match(screen, /nextQuantity <= 0/);
  assert.match(screen, /operatingLimits\.recommendationQuantity/);
  assert.match(screen, /parseNumber\(rawQuantity\)/);
  assert.match(screen, /t\("orders\.validation\.quantityRange"/);
  assert.match(screen, /recommendationLocksRef\.current\.has\(recommendation\.id\)/);
  assert.match(screen, /sendingLocksRef\.current\.has\(order\.id\)/);
  assert.match(screen, /undoLockRef\.current/);
  assert.match(screen, /await load\(false\)/);
  assert.doesNotMatch(screen, /setRecommendations\(\(current\) => \[recommendation/);

  assert.match(row, /t\("orders\.recommendation\.quantityAccessibility"/);
  assert.match(row, /minHeight: 44/);
  assert.match(row, /action\?: "approve" \| "dismiss"/);
  assert.match(row, /accessibilityState=\{\{ expanded \}\}/);
});

test("order list uses the Gmail delivery adapter and never fabricates hosted sends", () => {
  const screen = readFileSync("app/(tabs)/orders.tsx", "utf8");
  const detail = readFileSync("app/orders/[id].tsx", "utf8");
  const card = readFileSync("components/SupplierDraftCard.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(screen, /await sendSupplierOrderEmail\(restaurantId, order\.id\)/);
  assert.doesNotMatch(screen, /markSupplierOrderSent/);
  assert.match(detail, /await sendSupplierOrderEmail\(restaurantId, savedOrder\.id\)/);
  assert.doesNotMatch(detail, /markSupplierOrderSent/);
  assert.match(detail, /t\("orders\.detail\.action\.simulate"\)/);
  assert.match(detail, /t\("orders\.detail\.gmail\.send"\)/);
  assert.match(detail, /t\("orders\.detail\.notice\.demoSentBody"\)/);
  assert.match(catalog, /Mise updated the demo workflow\. No email was sent\./);
  assert.match(detail, /operator_note: operatorNote\.trim\(\) \|\| null/);
  assert.match(detail, /order\.status !== "draft"/);
  assert.match(card, /title=\{busy \? resolvedBusyLabel : resolvedSendLabel\}/);
  assert.match(screen, /sendLabel=\{t\(usingLocalDemo \? "orders\.action\.simulateSend" : "orders\.action\.gmailSend"\)\}/);
  assert.match(screen, /orders\.notice\.send\.demo\.(?:already|zero|one|other)/);
  assert.doesNotMatch(card, /Send email/i);
});

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
  assert.match(screen, /presentRestaurantScopedHubActionsEditable/);
  assert.match(screen, /readOnly=\{!actionsEditable\}/);
  assert.match(screen, /showSend=\{false\}/);
  assert.doesNotMatch(screen, /onSend=\{/);
  assert.match(screen, /t\("orders\.readOnly\.title"\)/);
  assert.ok((screen.match(/if \(!actionsEditable\)/g) ?? []).length >= 3);
  assert.match(screen, /onCopy=\{\(\) => void copyOrder\(order\)\}/);
  assert.match(screen, /pathname: "\/orders\/\[id\]"/);

  assert.match(row, /readOnly\?: boolean/);
  assert.match(row, /!readOnly \? \(/);
  assert.match(row, /accessibilityState=\{\{ disabled: true \}\}/);
  assert.match(row, /canExcludePattern/);
  assert.match(row, /onExcludePattern/);
  assert.match(row, /orders\.memory\.exclude/);
  assert.match(screen, /confirmExcludePattern/);
  assert.match(screen, /excludePurchaseDecisionEvent/);
  assert.match(screen, /onExcludePattern=\{/);
  assert.match(screen, /actionsEditable && purchaseDecisionPattern/);
  assert.doesNotMatch(screen, /onExcludePattern=\{\(\) =>/);
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
  assert.match(screen, /undoLockRef\.current/);
  assert.match(screen, /await load\(false\)/);
  assert.doesNotMatch(screen, /setRecommendations\(\(current\) => \[recommendation/);

  assert.match(row, /t\("orders\.recommendation\.quantityAccessibility"/);
  assert.match(row, /minHeight: 44/);
  assert.match(row, /action\?: "approve" \| "dismiss"/);
  assert.match(row, /accessibilityState=\{\{ expanded \}\}/);
});

test("order list routes drafts through exact-content review before the Gmail delivery adapter", () => {
  const screen = readFileSync("app/(tabs)/orders.tsx", "utf8");
  const detail = readFileSync("app/orders/[id].tsx", "utf8");
  const card = readFileSync("components/SupplierDraftCard.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.doesNotMatch(screen, /sendSupplierOrderEmail/);
  assert.match(screen, /showSend=\{false\}/);
  assert.doesNotMatch(screen, /markSupplierOrderSent/);
  assert.match(detail, /prepareSupplierEmailPayload\(restaurantId, orderId\)/);
  assert.match(detail, /fetchSupplierSendAction\(restaurantId, orderId\)/);
  assert.match(detail, /sameReviewedSendContent\(reviewedPayload, refreshedPayload\)/);
  assert.match(detail, /left\.orderId === right\.orderId/);
  assert.match(detail, /left\.contentVersion === right\.contentVersion/);
  assert.match(detail, /left\.contentFingerprint === right\.contentFingerprint/);
  assert.doesNotMatch(detail, /sameDeliveryEnvelope/);
  assert.match(detail, /await approveSupplierSendContent\(/);
  assert.doesNotMatch(detail, /approveSupplierSendEnvelope/);
  assert.match(detail, /refreshedPayload\.contentFingerprint/);
  assert.match(detail, /const preview = await refreshEmailPreview/);
  assert.match(detail, /setEmailPayload\(preview\)/);
  assert.doesNotMatch(detail, /\.canSend/);
  assert.doesNotMatch(detail, /blockedReason/);
  assert.doesNotMatch(detail, /decideMiseAction/);
  assert.match(detail, /await sendSupplierOrderEmail\(restaurantId, savedOrder\.id\)/);
  assert.doesNotMatch(detail, /markSupplierOrderSent/);
  assert.match(detail, /t\("orders\.detail\.action\.simulate"\)/);
  assert.match(detail, /t\("orders\.detail\.gmail\.approveAndSend"\)/);
  assert.match(detail, /orders\.detail\.review\.from/);
  assert.match(detail, /orders\.detail\.review\.to/);
  assert.match(detail, /orders\.detail\.review\.subject/);
  assert.match(detail, /orders\.detail\.review\.emailBody/);
  assert.match(detail, /visibleEmailPayload\?\.body/);
  assert.match(detail, /visibleEmailPayload\.lineCount/);
  assert.match(detail, /orders\.detail\.review\.pendingTitle/);
  assert.match(detail, /orders\.detail\.gmail\.inProgressTitle/);
  assert.match(detail, /t\("orders\.detail\.notice\.demoSentBody"\)/);
  assert.match(detail, /result\.sentToPreviouslyClaimedRecipient/);
  assert.match(detail, /t\("orders\.detail\.notice\.claimedRecipientBody"\)/);
  assert.match(detail, /isSupplierSendVerificationRace\(error\)/);
  assert.match(detail, /recovery: "retry"/);
  assert.match(detail, /notice\.recovery === "retry"[\s\S]{0,180}load\(false\)/);
  assert.match(catalog, /Mise updated the demo workflow\. No email was sent\./);
  assert.match(catalog, /Review the exact email below\. Mise will approve only this version/);
  assert.match(detail, /operator_note: operatorNote\.trim\(\) \|\| null/);
  assert.match(detail, /order\.status === "draft"/);
  assert.match(card, /title=\{busy \? resolvedBusyLabel : resolvedSendLabel\}/);
  assert.doesNotMatch(card, /Send email/i);
});

test("content approval blockers refresh the authoritative preview without hiding specific recovery", () => {
  const detail = readFileSync("app/orders/[id].tsx", "utf8");

  assert.match(
    detail,
    /approval\.outcome === "send_content_changed" \|\|[\s\S]{0,160}approval\.outcome === "send_content_unapproved"[\s\S]{0,300}await refreshEmailPreview\(restaurantId, savedOrder\.id\)[\s\S]{0,300}setNotice\(supplierSendBlockerNotice\(approvalBlockers, t\)\)[\s\S]{0,80}return;/
  );

  const noticeHelper = detail.slice(
    detail.indexOf("function supplierSendBlockerNotice"),
    detail.indexOf("function purchaseAuthoritySendNotice")
  );
  const genericApprovalIndex = noticeHelper.indexOf(
    'blockerCodes.includes("send_content_unapproved")'
  );
  assert.ok(genericApprovalIndex > 0);
  assert.ok(
    noticeHelper.indexOf('blockerCodes.includes("supplier_email_missing")') < genericApprovalIndex
  );
  assert.ok(
    noticeHelper.indexOf('blockerCodes.includes("gmail_not_connected")') < genericApprovalIndex
  );
  assert.ok(
    noticeHelper.indexOf('blockerCodes.includes("order_not_draft")') < genericApprovalIndex
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimMiseActionsObjectToken,
  canonicalizeMiseActionsObjectId,
  requireCanonicalMiseActionsObjectId
} from "../services/domain/miseActionsObjectIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/miseActionsObjectIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/miseActions.ts", import.meta.url),
  "utf8"
);

const supplierOrderId = "00000000-0000-4000-8000-000000000601";
const demoSupplierOrderId = "so-demo-order";
const supplierSendActionId = "00000000-0000-4000-8000-000000000701";
const demoActionId = "action-demo-send";

test("MISE-005ME pins Mise-actions orderId/actionId object labels to ASCII C", () => {
  assert.match(identitySource, /MISE-005ME/);
  assert.match(applicationSource, /MISE-005ME/);

  assert.match(
    identitySource,
    /export function asciiTrimMiseActionsObjectToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /requireCanonicalMiseActionsObjectId\(orderId, "supplier order"\)/
  );
  assert.match(
    applicationSource,
    /from "\.\.\/domain\/miseActionsObjectIdentity"/
  );
  assert.match(
    applicationSource,
    /if \(label === "supplier order" \|\| label === "supplier send action"\) \{\s*return requireCanonicalMiseActionsObjectId\(value, label as MiseActionsObjectLabel\);/s
  );
  assert.match(
    applicationSource,
    /requireSupplierSendApprovalId\(actionId, "supplier send action"\)/
  );
  assert.match(
    applicationSource,
    /requireSupplierSendApprovalId\(orderId, "supplier order"\)/
  );

  // Leave restaurant workspace on Unicode trim (owned by #738 / MISE-005LH).
  assert.match(
    applicationSource,
    /export async function fetchMiseActions\(\s*restaurantId: string,\s*options: \{ status\?: MiseAction\["status"\] \| "awaiting_decision"; limit\?: number \} = \{\}\s*\) \{\s*const normalizedRestaurantId = restaurantId\.trim\(\);\s*if \(!normalizedRestaurantId\) throw new Error\("Missing restaurant workspace\."\);/s
  );
  assert.match(
    applicationSource,
    /const normalizedRestaurantId = restaurantId\.trim\(\);\s*\/\/ MISE-005ME: ASCII-C supplier-order identity for Mise-action send lookup\.\s*const normalizedOrderId = requireCanonicalMiseActionsObjectId\(orderId, "supplier order"\);\s*if \(!normalizedRestaurantId\) throw new Error\("Missing restaurant workspace\."\);/s
  );
  assert.match(
    applicationSource,
    /export async function decideMiseAction\(\s*restaurantId: string,\s*actionId: string,\s*decision: "approved" \| "rejected"\s*\) \{\s*const normalizedRestaurantId = restaurantId\.trim\(\);\s*if \(!normalizedRestaurantId\) throw new Error\("Missing restaurant workspace\."\);/s
  );
  assert.match(
    applicationSource,
    /requireSupplierSendApprovalId\(\s*restaurantId,\s*"restaurant workspace"\s*\)/
  );
  assert.match(
    applicationSource,
    /const normalized = typeof value === "string" \? value\.trim\(\) : "";\s*if \(!normalized \|\| normalized\.length > 128 \|\| \/\[\\u0000-\\u001f\\u007f\]\/\.test\(normalized\)\) \{\s*throw new Error\(`Missing \$\{label\}\.`\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalMiseActionsWorkspaceId/);
  assert.doesNotMatch(applicationSource, /miseActionsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/miseActionsRestaurantIdentity"/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)MiseActionsRestaurant/
  );

  // Leave decideMiseAction raw actionId pass-through alone (no inventing trim today).
  assert.match(
    applicationSource,
    /const action = await repository\.decideMiseAction\(normalizedRestaurantId, actionId, decision\);/
  );

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /ordersWorkflowObjectIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesSupplierOrderIdentity/);
  assert.doesNotMatch(identitySource, /posMappingWorkflowIdentity/);
  assert.doesNotMatch(identitySource, /posRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /ordersRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /wasteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /dailyReportRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /dailyPhaseBriefRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operatingBriefRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /pilotReadinessRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantAppRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /setupRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /autonomyRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /insightsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /todayTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operatingPlanRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
});

test("ASCII trim keeps ordinary Mise-actions object padding stable", () => {
  assert.equal(asciiTrimMiseActionsObjectToken(`  ${supplierOrderId}  `), supplierOrderId);
  assert.equal(canonicalizeMiseActionsObjectId(`\t${supplierOrderId}\n`), supplierOrderId);
  assert.equal(
    requireCanonicalMiseActionsObjectId(` ${supplierOrderId} `, "supplier order"),
    supplierOrderId
  );

  assert.equal(
    asciiTrimMiseActionsObjectToken(`  ${demoSupplierOrderId}  `),
    demoSupplierOrderId
  );
  assert.equal(
    canonicalizeMiseActionsObjectId(`\t${demoSupplierOrderId}\n`),
    demoSupplierOrderId
  );
  assert.equal(
    requireCanonicalMiseActionsObjectId(` ${demoSupplierOrderId} `, "supplier order"),
    demoSupplierOrderId
  );

  assert.equal(
    asciiTrimMiseActionsObjectToken(`  ${supplierSendActionId}  `),
    supplierSendActionId
  );
  assert.equal(
    canonicalizeMiseActionsObjectId(`\t${supplierSendActionId}\n`),
    supplierSendActionId
  );
  assert.equal(
    requireCanonicalMiseActionsObjectId(` ${supplierSendActionId} `, "supplier send action"),
    supplierSendActionId
  );

  assert.equal(asciiTrimMiseActionsObjectToken(`  ${demoActionId}  `), demoActionId);
  assert.equal(canonicalizeMiseActionsObjectId(`\t${demoActionId}\n`), demoActionId);
  assert.equal(
    requireCanonicalMiseActionsObjectId(` ${demoActionId} `, "supplier send action"),
    demoActionId
  );
});

test("ASCII Mise-actions object trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedOrder = `\u00a0${supplierOrderId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded supplier order id.
  assert.equal(nbspPaddedOrder.trim(), supplierOrderId);
  assert.notEqual(asciiTrimMiseActionsObjectToken(nbspPaddedOrder), supplierOrderId);
  assert.equal(canonicalizeMiseActionsObjectId(nbspPaddedOrder), null);
  assert.throws(
    () => requireCanonicalMiseActionsObjectId(nbspPaddedOrder, "supplier order"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier order."
  );

  const emSpacePaddedDemo = `\u2003${demoSupplierOrderId}\u2003`;
  assert.equal(emSpacePaddedDemo.trim(), demoSupplierOrderId);
  assert.equal(canonicalizeMiseActionsObjectId(emSpacePaddedDemo), null);
  assert.throws(
    () => requireCanonicalMiseActionsObjectId(emSpacePaddedDemo, "supplier order"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier order."
  );

  const nbspPaddedAction = `\u00a0${supplierSendActionId}\u00a0`;
  assert.equal(nbspPaddedAction.trim(), supplierSendActionId);
  assert.equal(canonicalizeMiseActionsObjectId(nbspPaddedAction), null);
  assert.throws(
    () => requireCanonicalMiseActionsObjectId(nbspPaddedAction, "supplier send action"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier send action."
  );

  const emSpacePaddedDemoAction = `\u2003${demoActionId}\u2003`;
  assert.equal(emSpacePaddedDemoAction.trim(), demoActionId);
  assert.equal(canonicalizeMiseActionsObjectId(emSpacePaddedDemoAction), null);
  assert.throws(
    () => requireCanonicalMiseActionsObjectId(emSpacePaddedDemoAction, "supplier send action"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier send action."
  );
});

test("Mise-actions object rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeMiseActionsObjectId(""), null);
  assert.equal(canonicalizeMiseActionsObjectId("   "), null);
  assert.equal(canonicalizeMiseActionsObjectId("a".repeat(129)), null);
  assert.equal(canonicalizeMiseActionsObjectId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalMiseActionsObjectId(null, "supplier order"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier order."
  );
  assert.throws(
    () => requireCanonicalMiseActionsObjectId("", "supplier send action"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier send action."
  );
  assert.throws(
    () => requireCanonicalMiseActionsObjectId(undefined, "supplier order"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier order."
  );
  assert.throws(
    () => requireCanonicalMiseActionsObjectId("bad\u0000id", "supplier send action"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier send action."
  );
});

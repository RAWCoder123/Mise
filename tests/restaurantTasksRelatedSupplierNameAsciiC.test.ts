import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  canonicalRestaurantTasksRelatedSupplierName,
  normalizeCanonicalRestaurantTasksRelatedSupplierName
} from "../services/domain/restaurantTasksRelatedSupplierNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksRelatedSupplierNameIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const relatedSupplierName = "Regional Protein Co";
const accentedSupplierName = "Café Protein Co";
const sourceReference = "inventory-risk:item-1";
const clientTaskId = "client-task-1";
const relatedRecommendationId = "recommendation-1";
const relatedOrderId = "order-1";
const relatedInventoryItemId = "item-1";
const assigneeUserId = "staff-1";

const baseRow: PersistedRestaurantTaskRow = {
  id: "task-1",
  restaurant_id: "restaurant-a",
  location_id: null,
  origin: "human",
  title: "Confirm chicken count",
  detail: "Count the walk-in case.",
  operational_category: "inventory",
  priority: "urgent",
  status: "waiting",
  timing_bucket: "now",
  due_at: "2026-08-02T19:30:00.000Z",
  service_window: "before_supplier_cutoff",
  window_start: null,
  window_end: null,
  required_role: "member",
  assignee_user_id: assigneeUserId,
  verification_method: "count",
  verification_required: true,
  checklist: [{ label: "Record physical count" }],
  completion_result: null,
  completion_evidence: [],
  completed_at: null,
  completed_by: null,
  related_inventory_item_id: relatedInventoryItemId,
  related_order_id: relatedOrderId,
  related_recommendation_id: relatedRecommendationId,
  related_supplier_name: relatedSupplierName,
  source_reference: sourceReference,
  created_by: "manager-1",
  client_task_id: clientTaskId,
  correlation_id: "correlation-1",
  created_at: "2026-08-02T19:00:00.000Z",
  updated_at: "2026-08-02T19:00:00.000Z"
};

test("MISE-005OM pins restaurant-tasks relatedSupplierName to ASCII C display prep", () => {
  assert.match(identitySource, /MISE-005OM/);
  assert.match(domainSource, /MISE-005OM/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalRestaurantTasksRelatedSupplierName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(
    domainSource,
    /relatedSupplierName: normalizeCanonicalRestaurantTasksRelatedSupplierName\(\s*input\.relatedSupplierName\s*\)/
  );
  assert.match(
    domainSource,
    /relatedSupplierName: normalizeCanonicalRestaurantTasksRelatedSupplierName\(\s*row\.related_supplier_name\s*\)/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksRelatedSupplierNameIdentity"/);

  // Leave sibling requiredText / optionalText identity surfaces on Unicode trim.
  assert.match(
    domainSource,
    /const restaurantId = requiredText\(input\.restaurantId, 200, "Restaurant id"\);/
  );
  assert.match(
    domainSource,
    /const clientTaskId = requiredText\(input\.clientTaskId, 200, "Client task id"\);/
  );
  assert.match(
    domainSource,
    /const title = requiredText\(input\.title, 160, "Task title"\);/
  );
  assert.match(
    domainSource,
    /assigneeUserId: optionalText\(input\.assigneeUserId, 200, "Task assignee"\),/
  );
  assert.match(
    domainSource,
    /relatedInventoryItemId: optionalText\(input\.relatedInventoryItemId, 200, "Related inventory item"\),/
  );
  assert.match(
    domainSource,
    /relatedOrderId: optionalText\(input\.relatedOrderId, 200, "Related order"\),/
  );
  assert.match(
    domainSource,
    /relatedRecommendationId: optionalText\(input\.relatedRecommendationId, 200, "Related recommendation"\),/
  );
  assert.match(
    domainSource,
    /sourceReference: optionalText\(input\.sourceReference, 240, "Task source reference"\),/
  );
  assert.match(
    domainSource,
    /sourceReference: optionalText\(row\.source_reference, 240, "Task source reference"\),/
  );
  assert.match(
    domainSource,
    /createdBy: requiredText\(row\.created_by, 200, "Task creator"\),/
  );
  assert.match(
    domainSource,
    /correlationId: requiredText\(row\.correlation_id, 200, "Task correlation id"\),/
  );
  assert.match(
    domainSource,
    /completedBy: optionalText\(row\.completed_by, 200, "Task completer"\),/
  );
  assert.match(
    domainSource,
    /locationId: optionalText\(row\.location_id, 200, "Location id"\),/
  );
  assert.match(
    domainSource,
    /\(input\.dependencyIds \?\? \[\]\)\.map\(\(id\) => requiredText\(id, 200, "Dependency id"\)\)/
  );
  assert.match(
    domainSource,
    /dependencyIds\.map\(\(id\) => requiredText\(id, 200, "Dependency id"\)\)/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedInventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedOrderIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksSourceReferenceIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksLocationIdIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierSettingsNameIdentity/);
  assert.doesNotMatch(identitySource, /supplierDisplayNameIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedOrderIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksSourceReferenceIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksLocationIdIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /supplierSettingsNameIdentity/);
  assert.doesNotMatch(domainSource, /supplierDisplayNameIdentity/);
});

test("ASCII C display prep keeps ordinary restaurant-tasks relatedSupplierName stable", () => {
  assert.equal(
    canonicalRestaurantTasksRelatedSupplierName(`  ${relatedSupplierName}  `),
    relatedSupplierName
  );
  // Pure display prep still collapses C whitespace (TAB/NL); the normalize
  // gate below rejects those same code points as controls on the raw token.
  assert.equal(
    canonicalRestaurantTasksRelatedSupplierName(`\t${relatedSupplierName}\n`),
    relatedSupplierName
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksRelatedSupplierName(`  ${relatedSupplierName}  `),
    relatedSupplierName
  );
  assert.equal(
    canonicalRestaurantTasksRelatedSupplierName(accentedSupplierName),
    accentedSupplierName
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksRelatedSupplierName(accentedSupplierName),
    accentedSupplierName
  );

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedSupplierName: `  ${relatedSupplierName}  `
  });
  assert.equal(created.relatedSupplierName, relatedSupplierName);
  assert.equal(created.clientTaskId, clientTaskId);

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    related_supplier_name: `  ${relatedSupplierName}  `
  });
  assert.equal(hydrated.relatedSupplierName, relatedSupplierName);
  assert.equal(hydrated.clientTaskId, clientTaskId);
});

test("NBSP folds and em-space padding cannot invent restaurant-tasks relatedSupplierName", () => {
  const nbspName = `\u00a0${relatedSupplierName}\u00a0`;
  const emName = `\u2003${relatedSupplierName}\u2003`;
  const internalEm = `Regional\u2003Protein Co`;

  // Pasted NBSP is folded like MISE-005B / private.normalize_supplier_display_name.
  assert.equal(nbspName.trim(), relatedSupplierName);
  assert.equal(canonicalRestaurantTasksRelatedSupplierName(nbspName), relatedSupplierName);
  assert.equal(
    normalizeCanonicalRestaurantTasksRelatedSupplierName(nbspName),
    relatedSupplierName
  );
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      restaurantId: "restaurant-a",
      clientTaskId,
      title: "Confirm chicken count",
      relatedSupplierName: nbspName
    }).relatedSupplierName,
    relatedSupplierName
  );
  assert.equal(
    restaurantTaskFromPersistedRow({
      ...baseRow,
      related_supplier_name: nbspName
    }).relatedSupplierName,
    relatedSupplierName
  );

  // Unicode em-space trim invents a clean display name; C display prep does not.
  assert.equal(emName.trim(), relatedSupplierName);
  assert.notEqual(
    canonicalRestaurantTasksRelatedSupplierName(emName),
    relatedSupplierName
  );
  assert.equal(
    canonicalRestaurantTasksRelatedSupplierName(emName),
    emName
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksRelatedSupplierName(emName),
    emName
  );
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      restaurantId: "restaurant-a",
      clientTaskId,
      title: "Confirm chicken count",
      relatedSupplierName: emName
    }).relatedSupplierName,
    emName
  );
  assert.equal(
    restaurantTaskFromPersistedRow({
      ...baseRow,
      related_supplier_name: emName
    }).relatedSupplierName,
    emName
  );

  assert.equal(
    canonicalRestaurantTasksRelatedSupplierName(internalEm),
    internalEm
  );
  assert.notEqual(
    canonicalRestaurantTasksRelatedSupplierName(internalEm),
    canonicalRestaurantTasksRelatedSupplierName("Regional Protein Co")
  );

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(
    canonicalRestaurantTasksRelatedSupplierName("Kelvin Foods"),
    "Kelvin Foods"
  );
  assert.notEqual(
    canonicalRestaurantTasksRelatedSupplierName("Kelvin Foods"),
    canonicalRestaurantTasksRelatedSupplierName("Kelvin Foods")
  );
});

test("relatedSupplierName soft-empty stays null and inventing/control/over-long fail closed", () => {
  assert.equal(normalizeCanonicalRestaurantTasksRelatedSupplierName(null), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedSupplierName(undefined), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedSupplierName(""), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedSupplierName("   "), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedSupplierName("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedSupplierName("\u2003"), null);

  assert.equal(
    normalizeCreateRestaurantTaskInput({
      restaurantId: "restaurant-a",
      clientTaskId,
      title: "Confirm chicken count",
      relatedSupplierName: "   "
    }).relatedSupplierName,
    null
  );
  assert.equal(
    restaurantTaskFromPersistedRow({
      ...baseRow,
      related_supplier_name: null
    }).relatedSupplierName,
    null
  );

  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedSupplierName(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Related supplier is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedSupplierName("Bad\u0000Name"),
    (error: unknown) =>
      error instanceof Error && error.message === "Related supplier is invalid."
  );
  // TAB is C whitespace for collapse, but remaining control chars in the raw
  // input still fail closed (same control gate as #691 / #692).
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedSupplierName("Regional\tProtein Co"),
    (error: unknown) =>
      error instanceof Error && error.message === "Related supplier is invalid."
  );
  assert.throws(
    () =>
      normalizeCanonicalRestaurantTasksRelatedSupplierName(
        `${"x".repeat(201)}`
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Related supplier is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        relatedSupplierName: "Bad\u0000Name"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related supplier is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        related_supplier_name: "x".repeat(201)
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related supplier is invalid."
  );
});

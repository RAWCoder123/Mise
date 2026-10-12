import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  asciiTrimRestaurantTasksSourceReferenceToken,
  canonicalizeRestaurantTasksSourceReference,
  normalizeCanonicalRestaurantTasksSourceReference
} from "../services/domain/restaurantTasksSourceReferenceIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksSourceReferenceIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const sourceReference = "inventory-risk:item-1";
const demoSourceReference = "purchase-approval:dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const clientTaskId = "client-task-1";
const relatedRecommendationId = "recommendation-1";
const relatedOrderId = "order-1";
const relatedInventoryItemId = "item-1";
const assigneeUserId = "staff-1";
const relatedSupplierName = "Regional Protein Co";

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

test("MISE-005OL pins restaurant-tasks sourceReference to ASCII C", () => {
  assert.match(identitySource, /MISE-005OL/);
  assert.match(domainSource, /MISE-005OL/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksSourceReferenceToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /sourceReference: normalizeCanonicalRestaurantTasksSourceReference\(\s*input\.sourceReference\s*\)/
  );
  assert.match(
    domainSource,
    /sourceReference: normalizeCanonicalRestaurantTasksSourceReference\(\s*row\.source_reference\s*\)/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksSourceReferenceIdentity"/);

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
    /relatedSupplierName: optionalText\(input\.relatedSupplierName, 200, "Related supplier"\),/
  );
  assert.match(
    domainSource,
    /relatedSupplierName: optionalText\(row\.related_supplier_name, 200, "Related supplier"\),/
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
  assert.doesNotMatch(identitySource, /restaurantTasksLocationIdIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedOrderIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksLocationIdIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
});

test("ASCII trim keeps ordinary restaurant-tasks sourceReference padding stable", () => {
  assert.equal(
    asciiTrimRestaurantTasksSourceReferenceToken(`  ${sourceReference}  `),
    sourceReference
  );
  assert.equal(
    canonicalizeRestaurantTasksSourceReference(`\t${sourceReference}\n`),
    sourceReference
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksSourceReference(`  ${sourceReference}  `),
    sourceReference
  );

  assert.equal(
    asciiTrimRestaurantTasksSourceReferenceToken(`  ${demoSourceReference}  `),
    demoSourceReference
  );
  assert.equal(
    canonicalizeRestaurantTasksSourceReference(`\t${demoSourceReference}\n`),
    demoSourceReference
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksSourceReference(` ${demoSourceReference} `),
    demoSourceReference
  );

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    sourceReference: `  ${sourceReference}  `
  });
  assert.equal(created.sourceReference, sourceReference);
  assert.equal(created.clientTaskId, clientTaskId);

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    source_reference: `  ${sourceReference}  `
  });
  assert.equal(hydrated.sourceReference, sourceReference);
  assert.equal(hydrated.clientTaskId, clientTaskId);
});

test("NBSP and em-space padding cannot invent restaurant-tasks sourceReference", () => {
  const nbspReference = `\u00a0${sourceReference}\u00a0`;
  const emReference = `\u2003${demoSourceReference}\u2003`;

  // Unicode trim invents an exact match against the unpadded source reference.
  assert.equal(nbspReference.trim(), sourceReference);
  assert.notEqual(
    asciiTrimRestaurantTasksSourceReferenceToken(nbspReference),
    sourceReference
  );
  assert.equal(canonicalizeRestaurantTasksSourceReference(nbspReference), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksSourceReference(nbspReference),
    (error: unknown) =>
      error instanceof Error && error.message === "Task source reference is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        sourceReference: nbspReference
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task source reference is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        source_reference: nbspReference
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task source reference is invalid."
  );

  assert.equal(emReference.trim(), demoSourceReference);
  assert.equal(canonicalizeRestaurantTasksSourceReference(emReference), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksSourceReference(emReference),
    (error: unknown) =>
      error instanceof Error && error.message === "Task source reference is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        sourceReference: emReference
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task source reference is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        source_reference: emReference
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task source reference is invalid."
  );
});

test("restaurant-tasks sourceReference soft-empty stays null; invalid tokens fail closed", () => {
  assert.equal(normalizeCanonicalRestaurantTasksSourceReference(null), null);
  assert.equal(normalizeCanonicalRestaurantTasksSourceReference(undefined), null);
  assert.equal(normalizeCanonicalRestaurantTasksSourceReference(""), null);
  assert.equal(normalizeCanonicalRestaurantTasksSourceReference("   "), null);
  assert.equal(normalizeCanonicalRestaurantTasksSourceReference("\u00a0\u00a0"), null);

  const unreferenced = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    sourceReference: null
  });
  assert.equal(unreferenced.sourceReference, null);

  const softEmpty = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    sourceReference: "\u00a0\u00a0"
  });
  assert.equal(softEmpty.sourceReference, null);

  const hydratedUnreferenced = restaurantTaskFromPersistedRow({
    ...baseRow,
    source_reference: null
  });
  assert.equal(hydratedUnreferenced.sourceReference, null);

  assert.equal(canonicalizeRestaurantTasksSourceReference("a".repeat(241)), null);
  assert.equal(canonicalizeRestaurantTasksSourceReference("inventory-risk:\u0000x"), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksSourceReference(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Task source reference is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksSourceReference("inventory-risk:\u0000x"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task source reference is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        sourceReference: "inventory-risk:\u0000x"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task source reference is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        source_reference: "a".repeat(241)
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task source reference is invalid."
  );
});

test("sibling relatedSupplierName NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspSupplier = `\u00a0${relatedSupplierName}\u00a0`;
  assert.equal(nbspSupplier.trim(), relatedSupplierName);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedSupplierName: nbspSupplier,
    sourceReference
  });
  assert.equal(created.relatedSupplierName, relatedSupplierName);
  assert.equal(created.sourceReference, sourceReference);
});

test("sibling relatedRecommendationId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspRecommendation = `\u00a0${relatedRecommendationId}\u00a0`;
  assert.equal(nbspRecommendation.trim(), relatedRecommendationId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedRecommendationId: nbspRecommendation,
    sourceReference
  });
  assert.equal(created.relatedRecommendationId, relatedRecommendationId);
  assert.equal(created.sourceReference, sourceReference);
});

test("sibling relatedOrderId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspOrder = `\u00a0${relatedOrderId}\u00a0`;
  assert.equal(nbspOrder.trim(), relatedOrderId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedOrderId: nbspOrder,
    sourceReference
  });
  assert.equal(created.relatedOrderId, relatedOrderId);
  assert.equal(created.sourceReference, sourceReference);
});

test("sibling relatedInventoryItemId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspItem = `\u00a0${relatedInventoryItemId}\u00a0`;
  assert.equal(nbspItem.trim(), relatedInventoryItemId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedInventoryItemId: nbspItem,
    sourceReference
  });
  assert.equal(created.relatedInventoryItemId, relatedInventoryItemId);
  assert.equal(created.sourceReference, sourceReference);
});

test("sibling assigneeUserId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspAssignee = `\u00a0${assigneeUserId}\u00a0`;
  assert.equal(nbspAssignee.trim(), assigneeUserId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    assigneeUserId: nbspAssignee,
    sourceReference
  });
  assert.equal(created.assigneeUserId, assigneeUserId);
  assert.equal(created.sourceReference, sourceReference);
});

test("sibling locationId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspLocation = `\u00a0location-1\u00a0`;
  assert.equal(nbspLocation.trim(), "location-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    location_id: nbspLocation
  });
  assert.equal(hydrated.locationId, "location-1");
  assert.equal(hydrated.sourceReference, sourceReference);
});

test("sibling createdBy NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCreatedBy = `\u00a0manager-1\u00a0`;
  assert.equal(nbspCreatedBy.trim(), "manager-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    created_by: nbspCreatedBy
  });
  assert.equal(hydrated.createdBy, "manager-1");
  assert.equal(hydrated.sourceReference, sourceReference);
});

test("sibling completedBy NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCompletedBy = `\u00a0manager-1\u00a0`;
  assert.equal(nbspCompletedBy.trim(), "manager-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    status: "completed",
    completion_result: "Counted 12 cases.",
    completion_evidence: [{ type: "count", label: "Walk-in count" }],
    completed_at: "2026-08-02T20:00:00.000Z",
    completed_by: nbspCompletedBy
  });
  assert.equal(hydrated.completedBy, "manager-1");
  assert.equal(hydrated.sourceReference, sourceReference);
});

test("sibling clientTaskId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspClient = `\u00a0${clientTaskId}\u00a0`;
  assert.equal(nbspClient.trim(), clientTaskId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId: nbspClient,
    title: "Confirm chicken count",
    sourceReference
  });
  assert.equal(created.clientTaskId, clientTaskId);
  assert.equal(created.sourceReference, sourceReference);
});

test("sibling dependencyIds NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspDependency = `\u00a0task-a\u00a0`;
  assert.equal(nbspDependency.trim(), "task-a");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    sourceReference,
    dependencyIds: [nbspDependency]
  });
  assert.deepEqual(created.dependencyIds, ["task-a"]);
  assert.equal(created.sourceReference, sourceReference);
});

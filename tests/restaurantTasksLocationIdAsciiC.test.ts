import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  asciiTrimRestaurantTasksLocationIdToken,
  canonicalizeRestaurantTasksLocationId,
  normalizeCanonicalRestaurantTasksLocationId
} from "../services/domain/restaurantTasksLocationIdIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksLocationIdIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const locationId = "location-1";
const uuidLocationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const clientTaskId = "client-task-1";

const baseRow: PersistedRestaurantTaskRow = {
  id: "task-1",
  restaurant_id: "restaurant-a",
  location_id: locationId,
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
  assignee_user_id: "staff-1",
  verification_method: "count",
  verification_required: true,
  checklist: [{ label: "Record physical count" }],
  completion_result: null,
  completion_evidence: [],
  completed_at: null,
  completed_by: null,
  related_inventory_item_id: "item-1",
  related_order_id: null,
  related_recommendation_id: "recommendation-1",
  related_supplier_name: "Regional Protein Co",
  source_reference: "inventory-risk:item-1",
  created_by: "manager-1",
  client_task_id: clientTaskId,
  correlation_id: "correlation-1",
  created_at: "2026-08-02T19:00:00.000Z",
  updated_at: "2026-08-02T19:00:00.000Z"
};

test("MISE-005OI pins restaurant-tasks locationId to ASCII C", () => {
  assert.match(identitySource, /MISE-005OI/);
  assert.match(domainSource, /MISE-005OI/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksLocationIdToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /locationId: normalizeCanonicalRestaurantTasksLocationId\(row\.location_id\),/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksLocationIdIdentity"/);

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
    /assigneeUserId: optionalText\(row\.assignee_user_id, 200, "Task assignee"\),/
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
    /createdBy: requiredText\(row\.created_by, 200, "Task creator"\),/
  );
  assert.match(
    domainSource,
    /completedBy: optionalText\(row\.completed_by, 200, "Task completer"\),/
  );
  assert.match(
    domainSource,
    /correlationId: requiredText\(row\.correlation_id, 200, "Task correlation id"\),/
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
  assert.doesNotMatch(identitySource, /restaurantTasksCompletedByIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCreatedByIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedInventoryIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedOrderIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCompletedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCreatedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedInventoryIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedOrderIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
});

test("ASCII trim keeps ordinary restaurant-tasks locationId padding stable", () => {
  assert.equal(asciiTrimRestaurantTasksLocationIdToken(`  ${locationId}  `), locationId);
  assert.equal(canonicalizeRestaurantTasksLocationId(`\t${locationId}\n`), locationId);
  assert.equal(
    normalizeCanonicalRestaurantTasksLocationId(`  ${locationId}  `),
    locationId
  );

  assert.equal(
    asciiTrimRestaurantTasksLocationIdToken(`  ${uuidLocationId}  `),
    uuidLocationId
  );
  assert.equal(
    canonicalizeRestaurantTasksLocationId(`\t${uuidLocationId}\n`),
    uuidLocationId
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksLocationId(` ${uuidLocationId} `),
    uuidLocationId
  );

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    location_id: `  ${locationId}  `
  });
  assert.equal(hydrated.locationId, locationId);
  assert.equal(hydrated.clientTaskId, clientTaskId);
});

test("NBSP and em-space padding cannot invent restaurant-tasks locationId", () => {
  const nbspLocationId = `\u00a0${locationId}\u00a0`;
  const emLocationId = `\u2003${uuidLocationId}\u2003`;

  // Unicode trim invents an exact match against the unpadded location id.
  assert.equal(nbspLocationId.trim(), locationId);
  assert.notEqual(asciiTrimRestaurantTasksLocationIdToken(nbspLocationId), locationId);
  assert.equal(canonicalizeRestaurantTasksLocationId(nbspLocationId), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksLocationId(nbspLocationId),
    (error: unknown) =>
      error instanceof Error && error.message === "Location id is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        location_id: nbspLocationId
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Location id is invalid."
  );

  assert.equal(emLocationId.trim(), uuidLocationId);
  assert.equal(canonicalizeRestaurantTasksLocationId(emLocationId), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksLocationId(emLocationId),
    (error: unknown) =>
      error instanceof Error && error.message === "Location id is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        location_id: emLocationId
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Location id is invalid."
  );
});

test("restaurant-tasks locationId soft-empty stays null; invalid tokens fail closed", () => {
  assert.equal(normalizeCanonicalRestaurantTasksLocationId(null), null);
  assert.equal(normalizeCanonicalRestaurantTasksLocationId(undefined), null);
  assert.equal(normalizeCanonicalRestaurantTasksLocationId(""), null);
  assert.equal(normalizeCanonicalRestaurantTasksLocationId("   "), null);
  assert.equal(normalizeCanonicalRestaurantTasksLocationId("\u00a0\u00a0"), null);

  const restaurantWide = restaurantTaskFromPersistedRow({
    ...baseRow,
    location_id: null
  });
  assert.equal(restaurantWide.locationId, null);

  const softEmpty = restaurantTaskFromPersistedRow({
    ...baseRow,
    location_id: "\u00a0\u00a0"
  });
  assert.equal(softEmpty.locationId, null);

  assert.equal(canonicalizeRestaurantTasksLocationId("a".repeat(201)), null);
  assert.equal(canonicalizeRestaurantTasksLocationId("location-\u0000id"), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksLocationId(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Location id is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksLocationId("location-\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Location id is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        location_id: "location-\u0000id"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Location id is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        location_id: "a".repeat(201)
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Location id is invalid."
  );
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
  assert.equal(hydrated.locationId, locationId);
});

test("sibling assigneeUserId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspAssignee = `\u00a0staff-1\u00a0`;
  assert.equal(nbspAssignee.trim(), "staff-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    assigneeUserId: nbspAssignee
  });
  assert.equal(created.assigneeUserId, "staff-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    assignee_user_id: nbspAssignee
  });
  assert.equal(hydrated.assigneeUserId, "staff-1");
  assert.equal(hydrated.locationId, locationId);
});

test("sibling relatedInventoryItemId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspItem = `\u00a0item-1\u00a0`;
  assert.equal(nbspItem.trim(), "item-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedInventoryItemId: nbspItem
  });
  assert.equal(created.relatedInventoryItemId, "item-1");
});

test("sibling relatedOrderId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspOrder = `\u00a0order-1\u00a0`;
  assert.equal(nbspOrder.trim(), "order-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedOrderId: nbspOrder
  });
  assert.equal(created.relatedOrderId, "order-1");
});

test("sibling relatedRecommendationId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspRecommendation = `\u00a0recommendation-1\u00a0`;
  assert.equal(nbspRecommendation.trim(), "recommendation-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedRecommendationId: nbspRecommendation
  });
  assert.equal(created.relatedRecommendationId, "recommendation-1");
});

test("sibling createdBy NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCreatedBy = `\u00a0manager-1\u00a0`;
  assert.equal(nbspCreatedBy.trim(), "manager-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    created_by: nbspCreatedBy
  });
  assert.equal(hydrated.createdBy, "manager-1");
  assert.equal(hydrated.locationId, locationId);
});

test("sibling clientTaskId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspClient = `\u00a0${clientTaskId}\u00a0`;
  assert.equal(nbspClient.trim(), clientTaskId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId: nbspClient,
    title: "Confirm chicken count"
  });
  assert.equal(created.clientTaskId, clientTaskId);
});

test("sibling dependencyIds NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspDependency = `\u00a0task-a\u00a0`;
  assert.equal(nbspDependency.trim(), "task-a");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    dependencyIds: [nbspDependency]
  });
  assert.deepEqual(created.dependencyIds, ["task-a"]);
});

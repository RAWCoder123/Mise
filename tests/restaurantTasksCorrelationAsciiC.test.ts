import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  asciiTrimRestaurantTasksCorrelationToken,
  canonicalizeRestaurantTasksCorrelationId,
  requireCanonicalRestaurantTasksCorrelationId
} from "../services/domain/restaurantTasksCorrelationIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksCorrelationIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const correlationId = "correlation-1";
const uuidCorrelationId = "11111111-1111-4111-8111-111111111111";

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
  client_task_id: "client-task-1",
  correlation_id: correlationId,
  created_at: "2026-08-02T19:00:00.000Z",
  updated_at: "2026-08-02T19:00:00.000Z"
};

test("MISE-005OA pins restaurant-tasks correlationId to ASCII C", () => {
  assert.match(identitySource, /MISE-005OA/);
  assert.match(domainSource, /MISE-005OA/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksCorrelationToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /correlationId: requireCanonicalRestaurantTasksCorrelationId\(\s*row\.correlation_id\s*\)/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksCorrelationIdentity"/);

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
    /createdBy: requiredText\(row\.created_by, 200, "Task creator"\),/
  );
  assert.match(
    domainSource,
    /clientTaskId: requiredText\(row\.client_task_id, 200, "Client task id"\),/
  );
  assert.match(
    domainSource,
    /dependencyIds: \[\.\.\.new Set\(dependencyIds\.map\(\(id\) => requiredText\(id, 200, "Dependency id"\)\)\)\],/
  );
  assert.match(
    domainSource,
    /const dependencyIds = \[\.\.\.new Set\(\(input\.dependencyIds \?\? \[\]\)\.map\(\(id\) => requiredText\(id, 200, "Dependency id"\)\)\)\];/
  );
  assert.match(
    domainSource,
    /completedBy: optionalText\(row\.completed_by, 200, "Task completer"\),/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
});

test("ASCII trim keeps ordinary restaurant-tasks correlationId padding stable", () => {
  assert.equal(asciiTrimRestaurantTasksCorrelationToken(`  ${correlationId}  `), correlationId);
  assert.equal(canonicalizeRestaurantTasksCorrelationId(`\t${correlationId}\n`), correlationId);
  assert.equal(requireCanonicalRestaurantTasksCorrelationId(`  ${correlationId}  `), correlationId);

  assert.equal(asciiTrimRestaurantTasksCorrelationToken(`  ${uuidCorrelationId}  `), uuidCorrelationId);
  assert.equal(canonicalizeRestaurantTasksCorrelationId(`\t${uuidCorrelationId}\n`), uuidCorrelationId);
  assert.equal(requireCanonicalRestaurantTasksCorrelationId(` ${uuidCorrelationId} `), uuidCorrelationId);

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    correlation_id: `  ${uuidCorrelationId}  `
  });
  assert.equal(hydrated.correlationId, uuidCorrelationId);
  assert.equal(hydrated.clientTaskId, "client-task-1");
});

test("NBSP and em-space padding cannot invent restaurant-tasks correlationId", () => {
  const nbspCorrelation = `\u00a0${correlationId}\u00a0`;
  const emCorrelation = `\u2003${uuidCorrelationId}\u2003`;

  // Unicode trim invents an exact match against the unpadded correlation id.
  assert.equal(nbspCorrelation.trim(), correlationId);
  assert.notEqual(asciiTrimRestaurantTasksCorrelationToken(nbspCorrelation), correlationId);
  assert.equal(canonicalizeRestaurantTasksCorrelationId(nbspCorrelation), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksCorrelationId(nbspCorrelation),
    (error: unknown) =>
      error instanceof Error && error.message === "Task correlation id is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        correlation_id: nbspCorrelation
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task correlation id is invalid."
  );

  assert.equal(emCorrelation.trim(), uuidCorrelationId);
  assert.equal(canonicalizeRestaurantTasksCorrelationId(emCorrelation), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksCorrelationId(emCorrelation),
    (error: unknown) =>
      error instanceof Error && error.message === "Task correlation id is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        correlation_id: emCorrelation
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task correlation id is invalid."
  );
});

test("sibling clientTaskId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspClient = `\u00a0client-task-1\u00a0`;
  assert.equal(nbspClient.trim(), "client-task-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId: nbspClient,
    title: "Confirm chicken count"
  });
  assert.equal(created.clientTaskId, "client-task-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    client_task_id: nbspClient
  });
  assert.equal(hydrated.clientTaskId, "client-task-1");
  assert.equal(hydrated.correlationId, correlationId);
});

test("sibling restaurantId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspRestaurant = `\u00a0restaurant-a\u00a0`;
  assert.equal(nbspRestaurant.trim(), "restaurant-a");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: nbspRestaurant,
    clientTaskId: "client-task-1",
    title: "Confirm chicken count"
  });
  assert.equal(created.restaurantId, "restaurant-a");
});

test("sibling dependencyIds NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspDependency = `\u00a0task-a\u00a0`;
  assert.equal(nbspDependency.trim(), "task-a");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId: "client-task-1",
    title: "Confirm chicken count",
    dependencyIds: [nbspDependency, "task-b"]
  });
  assert.deepEqual(created.dependencyIds, ["task-a", "task-b"]);

  const hydrated = restaurantTaskFromPersistedRow(baseRow, [nbspDependency, "task-b"]);
  assert.deepEqual(hydrated.dependencyIds, ["task-a", "task-b"]);
  assert.equal(hydrated.correlationId, correlationId);
});

test("sibling assigneeUserId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspAssignee = `\u00a0staff-1\u00a0`;
  assert.equal(nbspAssignee.trim(), "staff-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId: "client-task-1",
    title: "Confirm chicken count",
    assigneeUserId: nbspAssignee
  });
  assert.equal(created.assigneeUserId, "staff-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    assignee_user_id: nbspAssignee
  });
  assert.equal(hydrated.assigneeUserId, "staff-1");
  assert.equal(hydrated.correlationId, correlationId);
});

test("sibling createdBy NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCreator = `\u00a0manager-1\u00a0`;
  assert.equal(nbspCreator.trim(), "manager-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    created_by: nbspCreator
  });
  assert.equal(hydrated.createdBy, "manager-1");
  assert.equal(hydrated.correlationId, correlationId);
});

test("over-long, empty, and control restaurant-tasks correlationId values fail closed", () => {
  assert.equal(canonicalizeRestaurantTasksCorrelationId(""), null);
  assert.equal(canonicalizeRestaurantTasksCorrelationId("   "), null);
  assert.equal(canonicalizeRestaurantTasksCorrelationId("a".repeat(201)), null);
  assert.equal(canonicalizeRestaurantTasksCorrelationId("corr-\u0000id"), null);

  assert.throws(
    () => requireCanonicalRestaurantTasksCorrelationId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Task correlation id is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCorrelationId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Task correlation id is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCorrelationId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Task correlation id is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCorrelationId("   "),
    (error: unknown) =>
      error instanceof Error && error.message === "Task correlation id is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCorrelationId("a".repeat(201)),
    (error: unknown) =>
      error instanceof Error && error.message === "Task correlation id is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCorrelationId("corr-\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task correlation id is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        correlation_id: "corr-\u0000id"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task correlation id is invalid."
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  asciiTrimRestaurantTasksClientTaskToken,
  canonicalizeRestaurantTasksClientTaskId,
  requireCanonicalRestaurantTasksClientTaskId
} from "../services/domain/restaurantTasksClientTaskIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksClientTaskIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const clientTaskId = "client-task-1";
const demoClientTaskId = "demo-shared-count";

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
  client_task_id: clientTaskId,
  correlation_id: "correlation-1",
  created_at: "2026-08-02T19:00:00.000Z",
  updated_at: "2026-08-02T19:00:00.000Z"
};

test("MISE-005NZ pins restaurant-tasks clientTaskId to ASCII C", () => {
  assert.match(identitySource, /MISE-005NZ/);
  assert.match(domainSource, /MISE-005NZ/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksClientTaskToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /const clientTaskId = requireCanonicalRestaurantTasksClientTaskId\(\s*input\.clientTaskId\s*\)/
  );
  assert.match(
    domainSource,
    /clientTaskId: requireCanonicalRestaurantTasksClientTaskId\(\s*row\.client_task_id\s*\)/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksClientTaskIdentity"/);

  // Leave sibling requiredText / optionalText identity surfaces on Unicode trim.
  assert.match(
    domainSource,
    /const restaurantId = requiredText\(input\.restaurantId, 200, "Restaurant id"\);/
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
    /correlationId: requiredText\(row\.correlation_id, 200, "Task correlation id"\),/
  );
  assert.match(
    domainSource,
    /dependencyIds: \[\.\.\.new Set\(dependencyIds\.map\(\(id\) => requiredText\(id, 200, "Dependency id"\)\)\)\],/
  );
  assert.match(
    domainSource,
    /const dependencyIds = \[\.\.\.new Set\(\(input\.dependencyIds \?\? \[\]\)\.map\(\(id\) => requiredText\(id, 200, "Dependency id"\)\)\)\];/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecipeRevisionIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
});

test("ASCII trim keeps ordinary restaurant-tasks clientTaskId padding stable", () => {
  assert.equal(asciiTrimRestaurantTasksClientTaskToken(`  ${clientTaskId}  `), clientTaskId);
  assert.equal(canonicalizeRestaurantTasksClientTaskId(`\t${clientTaskId}\n`), clientTaskId);
  assert.equal(requireCanonicalRestaurantTasksClientTaskId(`  ${clientTaskId}  `), clientTaskId);

  assert.equal(asciiTrimRestaurantTasksClientTaskToken(`  ${demoClientTaskId}  `), demoClientTaskId);
  assert.equal(canonicalizeRestaurantTasksClientTaskId(`\t${demoClientTaskId}\n`), demoClientTaskId);
  assert.equal(requireCanonicalRestaurantTasksClientTaskId(` ${demoClientTaskId} `), demoClientTaskId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId: `  ${clientTaskId}  `,
    title: "Confirm chicken count"
  });
  assert.equal(created.clientTaskId, clientTaskId);
  assert.equal(created.restaurantId, "restaurant-a");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    client_task_id: `  ${demoClientTaskId}  `
  });
  assert.equal(hydrated.clientTaskId, demoClientTaskId);
  assert.equal(hydrated.correlationId, "correlation-1");
});

test("NBSP and em-space padding cannot invent restaurant-tasks clientTaskId", () => {
  const nbspClient = `\u00a0${clientTaskId}\u00a0`;
  const emClient = `\u2003${demoClientTaskId}\u2003`;

  // Unicode trim invents an exact match against the unpadded client-task id.
  assert.equal(nbspClient.trim(), clientTaskId);
  assert.notEqual(asciiTrimRestaurantTasksClientTaskToken(nbspClient), clientTaskId);
  assert.equal(canonicalizeRestaurantTasksClientTaskId(nbspClient), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksClientTaskId(nbspClient),
    (error: unknown) =>
      error instanceof Error && error.message === "Client task id is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId: nbspClient,
        title: "Confirm chicken count"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Client task id is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        client_task_id: nbspClient
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Client task id is invalid."
  );

  assert.equal(emClient.trim(), demoClientTaskId);
  assert.equal(canonicalizeRestaurantTasksClientTaskId(emClient), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksClientTaskId(emClient),
    (error: unknown) =>
      error instanceof Error && error.message === "Client task id is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId: emClient,
        title: "Confirm chicken count"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Client task id is invalid."
  );
});

test("sibling restaurantId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspRestaurant = `\u00a0restaurant-a\u00a0`;
  assert.equal(nbspRestaurant.trim(), "restaurant-a");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: nbspRestaurant,
    clientTaskId,
    title: "Confirm chicken count"
  });
  assert.equal(created.restaurantId, "restaurant-a");
  assert.equal(created.clientTaskId, clientTaskId);
});

test("sibling correlationId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCorrelation = `\u00a0correlation-1\u00a0`;
  assert.equal(nbspCorrelation.trim(), "correlation-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    correlation_id: nbspCorrelation
  });
  assert.equal(hydrated.correlationId, "correlation-1");
  assert.equal(hydrated.clientTaskId, clientTaskId);
});

test("sibling dependencyIds NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspDependency = `\u00a0task-a\u00a0`;
  assert.equal(nbspDependency.trim(), "task-a");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    dependencyIds: [nbspDependency, "task-b"]
  });
  assert.deepEqual(created.dependencyIds, ["task-a", "task-b"]);
  assert.equal(created.clientTaskId, clientTaskId);
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
  assert.equal(created.clientTaskId, clientTaskId);
});

test("over-long, empty, and control restaurant-tasks clientTaskId values fail closed", () => {
  assert.equal(canonicalizeRestaurantTasksClientTaskId(""), null);
  assert.equal(canonicalizeRestaurantTasksClientTaskId("   "), null);
  assert.equal(canonicalizeRestaurantTasksClientTaskId("a".repeat(201)), null);
  assert.equal(canonicalizeRestaurantTasksClientTaskId("client-\u0000task"), null);

  assert.throws(
    () => requireCanonicalRestaurantTasksClientTaskId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Client task id is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksClientTaskId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Client task id is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksClientTaskId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Client task id is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksClientTaskId("   "),
    (error: unknown) =>
      error instanceof Error && error.message === "Client task id is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksClientTaskId("a".repeat(201)),
    (error: unknown) =>
      error instanceof Error && error.message === "Client task id is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksClientTaskId("client-\u0000task"),
    (error: unknown) =>
      error instanceof Error && error.message === "Client task id is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId: "client-\u0000task",
        title: "Confirm chicken count"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Client task id is invalid."
  );
});

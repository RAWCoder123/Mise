import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  asciiTrimRestaurantTasksDependencyToken,
  canonicalizeRestaurantTasksDependencyId,
  requireCanonicalRestaurantTasksDependencyId
} from "../services/domain/restaurantTasksDependencyIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksDependencyIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const dependencyId = "task-a";
const otherDependencyId = "task-b";
const clientTaskId = "client-task-1";

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

test("MISE-005OB pins restaurant-tasks dependencyIds to ASCII C", () => {
  assert.match(identitySource, /MISE-005OB/);
  assert.match(domainSource, /MISE-005OB/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksDependencyToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /\(input\.dependencyIds \?\? \[\]\)\.map\(\(id\) => requireCanonicalRestaurantTasksDependencyId\(id\)\)/
  );
  assert.match(
    domainSource,
    /dependencyIds\.map\(\(id\) => requireCanonicalRestaurantTasksDependencyId\(id\)\)/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksDependencyIdentity"/);

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
    /correlationId: requiredText\(row\.correlation_id, 200, "Task correlation id"\),/
  );
  assert.match(
    domainSource,
    /completedBy: optionalText\(row\.completed_by, 200, "Task completer"\),/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
});

test("ASCII trim keeps ordinary restaurant-tasks dependencyIds padding stable", () => {
  assert.equal(asciiTrimRestaurantTasksDependencyToken(`  ${dependencyId}  `), dependencyId);
  assert.equal(canonicalizeRestaurantTasksDependencyId(`\t${dependencyId}\n`), dependencyId);
  assert.equal(requireCanonicalRestaurantTasksDependencyId(`  ${dependencyId}  `), dependencyId);

  assert.equal(
    asciiTrimRestaurantTasksDependencyToken(`  ${otherDependencyId}  `),
    otherDependencyId
  );
  assert.equal(
    canonicalizeRestaurantTasksDependencyId(`\t${otherDependencyId}\n`),
    otherDependencyId
  );
  assert.equal(
    requireCanonicalRestaurantTasksDependencyId(` ${otherDependencyId} `),
    otherDependencyId
  );

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    dependencyIds: [`  ${dependencyId}  `, ` ${otherDependencyId} `]
  });
  assert.deepEqual(created.dependencyIds, [dependencyId, otherDependencyId]);
  assert.equal(created.clientTaskId, clientTaskId);

  const hydrated = restaurantTaskFromPersistedRow(baseRow, [
    `  ${dependencyId}  `,
    ` ${otherDependencyId} `
  ]);
  assert.deepEqual(hydrated.dependencyIds, [dependencyId, otherDependencyId]);
  assert.equal(hydrated.clientTaskId, clientTaskId);
});

test("NBSP and em-space padding cannot invent restaurant-tasks dependencyIds", () => {
  const nbspDependency = `\u00a0${dependencyId}\u00a0`;
  const emDependency = `\u2003${otherDependencyId}\u2003`;

  // Unicode trim invents an exact match against the unpadded dependency id.
  assert.equal(nbspDependency.trim(), dependencyId);
  assert.notEqual(asciiTrimRestaurantTasksDependencyToken(nbspDependency), dependencyId);
  assert.equal(canonicalizeRestaurantTasksDependencyId(nbspDependency), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksDependencyId(nbspDependency),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        dependencyIds: [nbspDependency, otherDependencyId]
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is invalid."
  );
  assert.throws(
    () => restaurantTaskFromPersistedRow(baseRow, [nbspDependency, otherDependencyId]),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is invalid."
  );

  assert.equal(emDependency.trim(), otherDependencyId);
  assert.equal(canonicalizeRestaurantTasksDependencyId(emDependency), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksDependencyId(emDependency),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        dependencyIds: [dependencyId, emDependency]
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is invalid."
  );
  assert.throws(
    () => restaurantTaskFromPersistedRow(baseRow, [dependencyId, emDependency]),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is invalid."
  );
});

test("sibling restaurantId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspRestaurant = `\u00a0restaurant-a\u00a0`;
  assert.equal(nbspRestaurant.trim(), "restaurant-a");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: nbspRestaurant,
    clientTaskId,
    title: "Confirm chicken count",
    dependencyIds: [dependencyId]
  });
  assert.equal(created.restaurantId, "restaurant-a");
  assert.deepEqual(created.dependencyIds, [dependencyId]);
});

test("sibling clientTaskId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspClient = `\u00a0${clientTaskId}\u00a0`;
  assert.equal(nbspClient.trim(), clientTaskId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId: nbspClient,
    title: "Confirm chicken count",
    dependencyIds: [dependencyId]
  });
  assert.equal(created.clientTaskId, clientTaskId);
  assert.deepEqual(created.dependencyIds, [dependencyId]);
});

test("sibling correlationId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCorrelation = `\u00a0correlation-1\u00a0`;
  assert.equal(nbspCorrelation.trim(), "correlation-1");

  const hydrated = restaurantTaskFromPersistedRow(
    {
      ...baseRow,
      correlation_id: nbspCorrelation
    },
    [dependencyId]
  );
  assert.equal(hydrated.correlationId, "correlation-1");
  assert.deepEqual(hydrated.dependencyIds, [dependencyId]);
});

test("sibling assigneeUserId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspAssignee = `\u00a0staff-1\u00a0`;
  assert.equal(nbspAssignee.trim(), "staff-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    assigneeUserId: nbspAssignee,
    dependencyIds: [dependencyId]
  });
  assert.equal(created.assigneeUserId, "staff-1");
  assert.deepEqual(created.dependencyIds, [dependencyId]);
});

test("sibling createdBy NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCreatedBy = `\u00a0manager-1\u00a0`;
  assert.equal(nbspCreatedBy.trim(), "manager-1");

  const hydrated = restaurantTaskFromPersistedRow(
    {
      ...baseRow,
      created_by: nbspCreatedBy
    },
    [dependencyId]
  );
  assert.equal(hydrated.createdBy, "manager-1");
  assert.deepEqual(hydrated.dependencyIds, [dependencyId]);
});

test("over-long, empty, and control restaurant-tasks dependencyIds values fail closed", () => {
  assert.equal(canonicalizeRestaurantTasksDependencyId(""), null);
  assert.equal(canonicalizeRestaurantTasksDependencyId("   "), null);
  assert.equal(canonicalizeRestaurantTasksDependencyId("a".repeat(201)), null);
  assert.equal(canonicalizeRestaurantTasksDependencyId("task-\u0000a"), null);

  assert.throws(
    () => requireCanonicalRestaurantTasksDependencyId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksDependencyId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksDependencyId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksDependencyId("   "),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksDependencyId("a".repeat(201)),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksDependencyId("task-\u0000a"),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        dependencyIds: ["task-\u0000a"]
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is invalid."
  );
  assert.throws(
    () => restaurantTaskFromPersistedRow(baseRow, ["task-\u0000a"]),
    (error: unknown) =>
      error instanceof Error && error.message === "Dependency id is invalid."
  );
});

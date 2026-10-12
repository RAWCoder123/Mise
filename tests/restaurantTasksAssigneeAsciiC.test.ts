import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  asciiTrimRestaurantTasksAssigneeToken,
  canonicalizeRestaurantTasksAssigneeUserId,
  normalizeCanonicalRestaurantTasksAssigneeUserId
} from "../services/domain/restaurantTasksAssigneeIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksAssigneeIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const assigneeUserId = "staff-1";
const demoAssigneeUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
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
  assignee_user_id: assigneeUserId,
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

test("MISE-005OC pins restaurant-tasks assigneeUserId to ASCII C", () => {
  assert.match(identitySource, /MISE-005OC/);
  assert.match(domainSource, /MISE-005OC/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksAssigneeToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /assigneeUserId: normalizeCanonicalRestaurantTasksAssigneeUserId\(input\.assigneeUserId\),/
  );
  assert.match(
    domainSource,
    /assigneeUserId: normalizeCanonicalRestaurantTasksAssigneeUserId\(row\.assignee_user_id\),/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksAssigneeIdentity"/);

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
  assert.match(
    domainSource,
    /\(input\.dependencyIds \?\? \[\]\)\.map\(\(id\) => requiredText\(id, 200, "Dependency id"\)\)/
  );
  assert.match(
    domainSource,
    /dependencyIds\.map\(\(id\) => requiredText\(id, 200, "Dependency id"\)\)/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
});

test("ASCII trim keeps ordinary restaurant-tasks assigneeUserId padding stable", () => {
  assert.equal(asciiTrimRestaurantTasksAssigneeToken(`  ${assigneeUserId}  `), assigneeUserId);
  assert.equal(canonicalizeRestaurantTasksAssigneeUserId(`\t${assigneeUserId}\n`), assigneeUserId);
  assert.equal(
    normalizeCanonicalRestaurantTasksAssigneeUserId(`  ${assigneeUserId}  `),
    assigneeUserId
  );

  assert.equal(
    asciiTrimRestaurantTasksAssigneeToken(`  ${demoAssigneeUserId}  `),
    demoAssigneeUserId
  );
  assert.equal(
    canonicalizeRestaurantTasksAssigneeUserId(`\t${demoAssigneeUserId}\n`),
    demoAssigneeUserId
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksAssigneeUserId(` ${demoAssigneeUserId} `),
    demoAssigneeUserId
  );

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    assigneeUserId: `  ${assigneeUserId}  `
  });
  assert.equal(created.assigneeUserId, assigneeUserId);
  assert.equal(created.clientTaskId, clientTaskId);

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    assignee_user_id: `  ${assigneeUserId}  `
  });
  assert.equal(hydrated.assigneeUserId, assigneeUserId);
  assert.equal(hydrated.clientTaskId, clientTaskId);
});

test("NBSP and em-space padding cannot invent restaurant-tasks assigneeUserId", () => {
  const nbspAssignee = `\u00a0${assigneeUserId}\u00a0`;
  const emAssignee = `\u2003${demoAssigneeUserId}\u2003`;

  // Unicode trim invents an exact match against the unpadded assignee id.
  assert.equal(nbspAssignee.trim(), assigneeUserId);
  assert.notEqual(asciiTrimRestaurantTasksAssigneeToken(nbspAssignee), assigneeUserId);
  assert.equal(canonicalizeRestaurantTasksAssigneeUserId(nbspAssignee), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksAssigneeUserId(nbspAssignee),
    (error: unknown) =>
      error instanceof Error && error.message === "Task assignee is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        assigneeUserId: nbspAssignee
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task assignee is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        assignee_user_id: nbspAssignee
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task assignee is invalid."
  );

  assert.equal(emAssignee.trim(), demoAssigneeUserId);
  assert.equal(canonicalizeRestaurantTasksAssigneeUserId(emAssignee), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksAssigneeUserId(emAssignee),
    (error: unknown) =>
      error instanceof Error && error.message === "Task assignee is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        assigneeUserId: emAssignee
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task assignee is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        assignee_user_id: emAssignee
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task assignee is invalid."
  );
});

test("restaurant-tasks assigneeUserId soft-empty stays null; invalid tokens fail closed", () => {
  assert.equal(normalizeCanonicalRestaurantTasksAssigneeUserId(null), null);
  assert.equal(normalizeCanonicalRestaurantTasksAssigneeUserId(undefined), null);
  assert.equal(normalizeCanonicalRestaurantTasksAssigneeUserId(""), null);
  assert.equal(normalizeCanonicalRestaurantTasksAssigneeUserId("   "), null);
  assert.equal(normalizeCanonicalRestaurantTasksAssigneeUserId("\u00a0\u00a0"), null);

  const unassigned = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    assigneeUserId: null
  });
  assert.equal(unassigned.assigneeUserId, null);

  const softEmpty = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    assigneeUserId: "\u00a0\u00a0"
  });
  assert.equal(softEmpty.assigneeUserId, null);

  const hydratedUnassigned = restaurantTaskFromPersistedRow({
    ...baseRow,
    assignee_user_id: null
  });
  assert.equal(hydratedUnassigned.assigneeUserId, null);

  assert.equal(canonicalizeRestaurantTasksAssigneeUserId("a".repeat(201)), null);
  assert.equal(canonicalizeRestaurantTasksAssigneeUserId("staff-\u0000user"), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksAssigneeUserId(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Task assignee is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksAssigneeUserId("staff-\u0000user"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task assignee is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        assigneeUserId: "staff-\u0000user"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task assignee is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        assignee_user_id: "a".repeat(201)
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task assignee is invalid."
  );
});

test("sibling relatedInventoryItemId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspItem = `\u00a0item-1\u00a0`;
  assert.equal(nbspItem.trim(), "item-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    assigneeUserId,
    relatedInventoryItemId: nbspItem
  });
  assert.equal(created.relatedInventoryItemId, "item-1");
  assert.equal(created.assigneeUserId, assigneeUserId);
});

test("sibling relatedOrderId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspOrder = `\u00a0order-1\u00a0`;
  assert.equal(nbspOrder.trim(), "order-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    assigneeUserId,
    relatedOrderId: nbspOrder
  });
  assert.equal(created.relatedOrderId, "order-1");
  assert.equal(created.assigneeUserId, assigneeUserId);
});

test("sibling relatedRecommendationId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspRecommendation = `\u00a0recommendation-1\u00a0`;
  assert.equal(nbspRecommendation.trim(), "recommendation-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    assigneeUserId,
    relatedRecommendationId: nbspRecommendation
  });
  assert.equal(created.relatedRecommendationId, "recommendation-1");
  assert.equal(created.assigneeUserId, assigneeUserId);
});

test("sibling createdBy NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCreatedBy = `\u00a0manager-1\u00a0`;
  assert.equal(nbspCreatedBy.trim(), "manager-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    created_by: nbspCreatedBy
  });
  assert.equal(hydrated.createdBy, "manager-1");
  assert.equal(hydrated.assigneeUserId, assigneeUserId);
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
  assert.equal(hydrated.assigneeUserId, assigneeUserId);
});

test("sibling clientTaskId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspClient = `\u00a0${clientTaskId}\u00a0`;
  assert.equal(nbspClient.trim(), clientTaskId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId: nbspClient,
    title: "Confirm chicken count",
    assigneeUserId
  });
  assert.equal(created.clientTaskId, clientTaskId);
  assert.equal(created.assigneeUserId, assigneeUserId);
});

test("sibling dependencyIds NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspDependency = `\u00a0task-a\u00a0`;
  assert.equal(nbspDependency.trim(), "task-a");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    assigneeUserId,
    dependencyIds: [nbspDependency]
  });
  assert.deepEqual(created.dependencyIds, ["task-a"]);
  assert.equal(created.assigneeUserId, assigneeUserId);
});

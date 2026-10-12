import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  asciiTrimRestaurantTasksRelatedOrderToken,
  canonicalizeRestaurantTasksRelatedOrderId,
  normalizeCanonicalRestaurantTasksRelatedOrderId
} from "../services/domain/restaurantTasksRelatedOrderIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksRelatedOrderIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const relatedOrderId = "order-1";
const demoRelatedOrderId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const clientTaskId = "client-task-1";
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
  related_recommendation_id: "recommendation-1",
  related_supplier_name: "Regional Protein Co",
  source_reference: "inventory-risk:item-1",
  created_by: "manager-1",
  client_task_id: clientTaskId,
  correlation_id: "correlation-1",
  created_at: "2026-08-02T19:00:00.000Z",
  updated_at: "2026-08-02T19:00:00.000Z"
};

test("MISE-005OE pins restaurant-tasks relatedOrderId to ASCII C", () => {
  assert.match(identitySource, /MISE-005OE/);
  assert.match(domainSource, /MISE-005OE/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksRelatedOrderToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /relatedOrderId: normalizeCanonicalRestaurantTasksRelatedOrderId\(\s*input\.relatedOrderId\s*\)/
  );
  assert.match(
    domainSource,
    /relatedOrderId: normalizeCanonicalRestaurantTasksRelatedOrderId\(\s*row\.related_order_id\s*\)/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksRelatedOrderIdentity"/);

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
  assert.doesNotMatch(identitySource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedInventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
});

test("ASCII trim keeps ordinary restaurant-tasks relatedOrderId padding stable", () => {
  assert.equal(
    asciiTrimRestaurantTasksRelatedOrderToken(`  ${relatedOrderId}  `),
    relatedOrderId
  );
  assert.equal(
    canonicalizeRestaurantTasksRelatedOrderId(`\t${relatedOrderId}\n`),
    relatedOrderId
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksRelatedOrderId(`  ${relatedOrderId}  `),
    relatedOrderId
  );

  assert.equal(
    asciiTrimRestaurantTasksRelatedOrderToken(`  ${demoRelatedOrderId}  `),
    demoRelatedOrderId
  );
  assert.equal(
    canonicalizeRestaurantTasksRelatedOrderId(`\t${demoRelatedOrderId}\n`),
    demoRelatedOrderId
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksRelatedOrderId(` ${demoRelatedOrderId} `),
    demoRelatedOrderId
  );

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedOrderId: `  ${relatedOrderId}  `
  });
  assert.equal(created.relatedOrderId, relatedOrderId);
  assert.equal(created.clientTaskId, clientTaskId);

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    related_order_id: `  ${relatedOrderId}  `
  });
  assert.equal(hydrated.relatedOrderId, relatedOrderId);
  assert.equal(hydrated.clientTaskId, clientTaskId);
});

test("NBSP and em-space padding cannot invent restaurant-tasks relatedOrderId", () => {
  const nbspOrder = `\u00a0${relatedOrderId}\u00a0`;
  const emOrder = `\u2003${demoRelatedOrderId}\u2003`;

  // Unicode trim invents an exact match against the unpadded order id.
  assert.equal(nbspOrder.trim(), relatedOrderId);
  assert.notEqual(
    asciiTrimRestaurantTasksRelatedOrderToken(nbspOrder),
    relatedOrderId
  );
  assert.equal(canonicalizeRestaurantTasksRelatedOrderId(nbspOrder), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedOrderId(nbspOrder),
    (error: unknown) =>
      error instanceof Error && error.message === "Related order is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        relatedOrderId: nbspOrder
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related order is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        related_order_id: nbspOrder
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related order is invalid."
  );

  assert.equal(emOrder.trim(), demoRelatedOrderId);
  assert.equal(canonicalizeRestaurantTasksRelatedOrderId(emOrder), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedOrderId(emOrder),
    (error: unknown) =>
      error instanceof Error && error.message === "Related order is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        relatedOrderId: emOrder
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related order is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        related_order_id: emOrder
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related order is invalid."
  );
});

test("restaurant-tasks relatedOrderId soft-empty stays null; invalid tokens fail closed", () => {
  assert.equal(normalizeCanonicalRestaurantTasksRelatedOrderId(null), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedOrderId(undefined), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedOrderId(""), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedOrderId("   "), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedOrderId("\u00a0\u00a0"), null);

  const unrelated = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedOrderId: null
  });
  assert.equal(unrelated.relatedOrderId, null);

  const softEmpty = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedOrderId: "\u00a0\u00a0"
  });
  assert.equal(softEmpty.relatedOrderId, null);

  const hydratedUnrelated = restaurantTaskFromPersistedRow({
    ...baseRow,
    related_order_id: null
  });
  assert.equal(hydratedUnrelated.relatedOrderId, null);

  assert.equal(canonicalizeRestaurantTasksRelatedOrderId("a".repeat(201)), null);
  assert.equal(canonicalizeRestaurantTasksRelatedOrderId("order-\u0000x"), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedOrderId(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Related order is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedOrderId("order-\u0000x"),
    (error: unknown) =>
      error instanceof Error && error.message === "Related order is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        relatedOrderId: "order-\u0000x"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related order is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        related_order_id: "a".repeat(201)
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related order is invalid."
  );
});

test("sibling relatedInventoryItemId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspItem = `\u00a0${relatedInventoryItemId}\u00a0`;
  assert.equal(nbspItem.trim(), relatedInventoryItemId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedInventoryItemId: nbspItem,
    relatedOrderId
  });
  assert.equal(created.relatedInventoryItemId, relatedInventoryItemId);
  assert.equal(created.relatedOrderId, relatedOrderId);
});

test("sibling assigneeUserId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspAssignee = `\u00a0${assigneeUserId}\u00a0`;
  assert.equal(nbspAssignee.trim(), assigneeUserId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    assigneeUserId: nbspAssignee,
    relatedOrderId
  });
  assert.equal(created.assigneeUserId, assigneeUserId);
  assert.equal(created.relatedOrderId, relatedOrderId);
});

test("sibling relatedRecommendationId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspRecommendation = `\u00a0recommendation-1\u00a0`;
  assert.equal(nbspRecommendation.trim(), "recommendation-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedOrderId,
    relatedRecommendationId: nbspRecommendation
  });
  assert.equal(created.relatedRecommendationId, "recommendation-1");
  assert.equal(created.relatedOrderId, relatedOrderId);
});

test("sibling createdBy NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCreatedBy = `\u00a0manager-1\u00a0`;
  assert.equal(nbspCreatedBy.trim(), "manager-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    created_by: nbspCreatedBy
  });
  assert.equal(hydrated.createdBy, "manager-1");
  assert.equal(hydrated.relatedOrderId, relatedOrderId);
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
  assert.equal(hydrated.relatedOrderId, relatedOrderId);
});

test("sibling clientTaskId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspClient = `\u00a0${clientTaskId}\u00a0`;
  assert.equal(nbspClient.trim(), clientTaskId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId: nbspClient,
    title: "Confirm chicken count",
    relatedOrderId
  });
  assert.equal(created.clientTaskId, clientTaskId);
  assert.equal(created.relatedOrderId, relatedOrderId);
});

test("sibling dependencyIds NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspDependency = `\u00a0task-a\u00a0`;
  assert.equal(nbspDependency.trim(), "task-a");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedOrderId,
    dependencyIds: [nbspDependency]
  });
  assert.deepEqual(created.dependencyIds, ["task-a"]);
  assert.equal(created.relatedOrderId, relatedOrderId);
});

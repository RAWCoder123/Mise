import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  asciiTrimRestaurantTasksRelatedInventoryItemToken,
  canonicalizeRestaurantTasksRelatedInventoryItemId,
  normalizeCanonicalRestaurantTasksRelatedInventoryItemId
} from "../services/domain/restaurantTasksRelatedInventoryItemIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksRelatedInventoryItemIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const relatedInventoryItemId = "item-1";
const demoRelatedInventoryItemId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const clientTaskId = "client-task-1";
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

test("MISE-005OD pins restaurant-tasks relatedInventoryItemId to ASCII C", () => {
  assert.match(identitySource, /MISE-005OD/);
  assert.match(domainSource, /MISE-005OD/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksRelatedInventoryItemToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /relatedInventoryItemId: normalizeCanonicalRestaurantTasksRelatedInventoryItemId\(\s*input\.relatedInventoryItemId\s*\)/
  );
  assert.match(
    domainSource,
    /relatedInventoryItemId: normalizeCanonicalRestaurantTasksRelatedInventoryItemId\(\s*row\.related_inventory_item_id\s*\)/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksRelatedInventoryItemIdentity"/);

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
  assert.doesNotMatch(identitySource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
});

test("ASCII trim keeps ordinary restaurant-tasks relatedInventoryItemId padding stable", () => {
  assert.equal(
    asciiTrimRestaurantTasksRelatedInventoryItemToken(`  ${relatedInventoryItemId}  `),
    relatedInventoryItemId
  );
  assert.equal(
    canonicalizeRestaurantTasksRelatedInventoryItemId(`\t${relatedInventoryItemId}\n`),
    relatedInventoryItemId
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksRelatedInventoryItemId(`  ${relatedInventoryItemId}  `),
    relatedInventoryItemId
  );

  assert.equal(
    asciiTrimRestaurantTasksRelatedInventoryItemToken(`  ${demoRelatedInventoryItemId}  `),
    demoRelatedInventoryItemId
  );
  assert.equal(
    canonicalizeRestaurantTasksRelatedInventoryItemId(`\t${demoRelatedInventoryItemId}\n`),
    demoRelatedInventoryItemId
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksRelatedInventoryItemId(` ${demoRelatedInventoryItemId} `),
    demoRelatedInventoryItemId
  );

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedInventoryItemId: `  ${relatedInventoryItemId}  `
  });
  assert.equal(created.relatedInventoryItemId, relatedInventoryItemId);
  assert.equal(created.clientTaskId, clientTaskId);

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    related_inventory_item_id: `  ${relatedInventoryItemId}  `
  });
  assert.equal(hydrated.relatedInventoryItemId, relatedInventoryItemId);
  assert.equal(hydrated.clientTaskId, clientTaskId);
});

test("NBSP and em-space padding cannot invent restaurant-tasks relatedInventoryItemId", () => {
  const nbspItem = `\u00a0${relatedInventoryItemId}\u00a0`;
  const emItem = `\u2003${demoRelatedInventoryItemId}\u2003`;

  // Unicode trim invents an exact match against the unpadded inventory item id.
  assert.equal(nbspItem.trim(), relatedInventoryItemId);
  assert.notEqual(
    asciiTrimRestaurantTasksRelatedInventoryItemToken(nbspItem),
    relatedInventoryItemId
  );
  assert.equal(canonicalizeRestaurantTasksRelatedInventoryItemId(nbspItem), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedInventoryItemId(nbspItem),
    (error: unknown) =>
      error instanceof Error && error.message === "Related inventory item is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        relatedInventoryItemId: nbspItem
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related inventory item is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        related_inventory_item_id: nbspItem
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related inventory item is invalid."
  );

  assert.equal(emItem.trim(), demoRelatedInventoryItemId);
  assert.equal(canonicalizeRestaurantTasksRelatedInventoryItemId(emItem), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedInventoryItemId(emItem),
    (error: unknown) =>
      error instanceof Error && error.message === "Related inventory item is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        relatedInventoryItemId: emItem
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related inventory item is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        related_inventory_item_id: emItem
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related inventory item is invalid."
  );
});

test("restaurant-tasks relatedInventoryItemId soft-empty stays null; invalid tokens fail closed", () => {
  assert.equal(normalizeCanonicalRestaurantTasksRelatedInventoryItemId(null), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedInventoryItemId(undefined), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedInventoryItemId(""), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedInventoryItemId("   "), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedInventoryItemId("\u00a0\u00a0"), null);

  const unrelated = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedInventoryItemId: null
  });
  assert.equal(unrelated.relatedInventoryItemId, null);

  const softEmpty = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedInventoryItemId: "\u00a0\u00a0"
  });
  assert.equal(softEmpty.relatedInventoryItemId, null);

  const hydratedUnrelated = restaurantTaskFromPersistedRow({
    ...baseRow,
    related_inventory_item_id: null
  });
  assert.equal(hydratedUnrelated.relatedInventoryItemId, null);

  assert.equal(canonicalizeRestaurantTasksRelatedInventoryItemId("a".repeat(201)), null);
  assert.equal(canonicalizeRestaurantTasksRelatedInventoryItemId("item-\u0000x"), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedInventoryItemId(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Related inventory item is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedInventoryItemId("item-\u0000x"),
    (error: unknown) =>
      error instanceof Error && error.message === "Related inventory item is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        relatedInventoryItemId: "item-\u0000x"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related inventory item is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        related_inventory_item_id: "a".repeat(201)
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related inventory item is invalid."
  );
});

test("sibling assigneeUserId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspAssignee = `\u00a0${assigneeUserId}\u00a0`;
  assert.equal(nbspAssignee.trim(), assigneeUserId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    assigneeUserId: nbspAssignee,
    relatedInventoryItemId
  });
  assert.equal(created.assigneeUserId, assigneeUserId);
  assert.equal(created.relatedInventoryItemId, relatedInventoryItemId);
});

test("sibling relatedOrderId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspOrder = `\u00a0order-1\u00a0`;
  assert.equal(nbspOrder.trim(), "order-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedInventoryItemId,
    relatedOrderId: nbspOrder
  });
  assert.equal(created.relatedOrderId, "order-1");
  assert.equal(created.relatedInventoryItemId, relatedInventoryItemId);
});

test("sibling relatedRecommendationId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspRecommendation = `\u00a0recommendation-1\u00a0`;
  assert.equal(nbspRecommendation.trim(), "recommendation-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedInventoryItemId,
    relatedRecommendationId: nbspRecommendation
  });
  assert.equal(created.relatedRecommendationId, "recommendation-1");
  assert.equal(created.relatedInventoryItemId, relatedInventoryItemId);
});

test("sibling createdBy NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCreatedBy = `\u00a0manager-1\u00a0`;
  assert.equal(nbspCreatedBy.trim(), "manager-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    created_by: nbspCreatedBy
  });
  assert.equal(hydrated.createdBy, "manager-1");
  assert.equal(hydrated.relatedInventoryItemId, relatedInventoryItemId);
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
  assert.equal(hydrated.relatedInventoryItemId, relatedInventoryItemId);
});

test("sibling clientTaskId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspClient = `\u00a0${clientTaskId}\u00a0`;
  assert.equal(nbspClient.trim(), clientTaskId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId: nbspClient,
    title: "Confirm chicken count",
    relatedInventoryItemId
  });
  assert.equal(created.clientTaskId, clientTaskId);
  assert.equal(created.relatedInventoryItemId, relatedInventoryItemId);
});

test("sibling dependencyIds NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspDependency = `\u00a0task-a\u00a0`;
  assert.equal(nbspDependency.trim(), "task-a");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedInventoryItemId,
    dependencyIds: [nbspDependency]
  });
  assert.deepEqual(created.dependencyIds, ["task-a"]);
  assert.equal(created.relatedInventoryItemId, relatedInventoryItemId);
});

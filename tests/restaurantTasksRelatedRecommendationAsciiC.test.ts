import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  asciiTrimRestaurantTasksRelatedRecommendationToken,
  canonicalizeRestaurantTasksRelatedRecommendationId,
  normalizeCanonicalRestaurantTasksRelatedRecommendationId
} from "../services/domain/restaurantTasksRelatedRecommendationIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksRelatedRecommendationIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const relatedRecommendationId = "recommendation-1";
const demoRelatedRecommendationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const clientTaskId = "client-task-1";
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
  related_supplier_name: "Regional Protein Co",
  source_reference: "inventory-risk:item-1",
  created_by: "manager-1",
  client_task_id: clientTaskId,
  correlation_id: "correlation-1",
  created_at: "2026-08-02T19:00:00.000Z",
  updated_at: "2026-08-02T19:00:00.000Z"
};

test("MISE-005OF pins restaurant-tasks relatedRecommendationId to ASCII C", () => {
  assert.match(identitySource, /MISE-005OF/);
  assert.match(domainSource, /MISE-005OF/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksRelatedRecommendationToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /relatedRecommendationId: normalizeCanonicalRestaurantTasksRelatedRecommendationId\(\s*input\.relatedRecommendationId\s*\)/
  );
  assert.match(
    domainSource,
    /relatedRecommendationId: normalizeCanonicalRestaurantTasksRelatedRecommendationId\(\s*row\.related_recommendation_id\s*\)/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksRelatedRecommendationIdentity"/);

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
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedOrderIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedOrderIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
});

test("ASCII trim keeps ordinary restaurant-tasks relatedRecommendationId padding stable", () => {
  assert.equal(
    asciiTrimRestaurantTasksRelatedRecommendationToken(`  ${relatedRecommendationId}  `),
    relatedRecommendationId
  );
  assert.equal(
    canonicalizeRestaurantTasksRelatedRecommendationId(`\t${relatedRecommendationId}\n`),
    relatedRecommendationId
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksRelatedRecommendationId(`  ${relatedRecommendationId}  `),
    relatedRecommendationId
  );

  assert.equal(
    asciiTrimRestaurantTasksRelatedRecommendationToken(`  ${demoRelatedRecommendationId}  `),
    demoRelatedRecommendationId
  );
  assert.equal(
    canonicalizeRestaurantTasksRelatedRecommendationId(`\t${demoRelatedRecommendationId}\n`),
    demoRelatedRecommendationId
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksRelatedRecommendationId(` ${demoRelatedRecommendationId} `),
    demoRelatedRecommendationId
  );

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedRecommendationId: `  ${relatedRecommendationId}  `
  });
  assert.equal(created.relatedRecommendationId, relatedRecommendationId);
  assert.equal(created.clientTaskId, clientTaskId);

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    related_recommendation_id: `  ${relatedRecommendationId}  `
  });
  assert.equal(hydrated.relatedRecommendationId, relatedRecommendationId);
  assert.equal(hydrated.clientTaskId, clientTaskId);
});

test("NBSP and em-space padding cannot invent restaurant-tasks relatedRecommendationId", () => {
  const nbspRecommendation = `\u00a0${relatedRecommendationId}\u00a0`;
  const emRecommendation = `\u2003${demoRelatedRecommendationId}\u2003`;

  // Unicode trim invents an exact match against the unpadded recommendation id.
  assert.equal(nbspRecommendation.trim(), relatedRecommendationId);
  assert.notEqual(
    asciiTrimRestaurantTasksRelatedRecommendationToken(nbspRecommendation),
    relatedRecommendationId
  );
  assert.equal(canonicalizeRestaurantTasksRelatedRecommendationId(nbspRecommendation), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedRecommendationId(nbspRecommendation),
    (error: unknown) =>
      error instanceof Error && error.message === "Related recommendation is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        relatedRecommendationId: nbspRecommendation
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related recommendation is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        related_recommendation_id: nbspRecommendation
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related recommendation is invalid."
  );

  assert.equal(emRecommendation.trim(), demoRelatedRecommendationId);
  assert.equal(canonicalizeRestaurantTasksRelatedRecommendationId(emRecommendation), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedRecommendationId(emRecommendation),
    (error: unknown) =>
      error instanceof Error && error.message === "Related recommendation is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        relatedRecommendationId: emRecommendation
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related recommendation is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        related_recommendation_id: emRecommendation
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related recommendation is invalid."
  );
});

test("restaurant-tasks relatedRecommendationId soft-empty stays null; invalid tokens fail closed", () => {
  assert.equal(normalizeCanonicalRestaurantTasksRelatedRecommendationId(null), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedRecommendationId(undefined), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedRecommendationId(""), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedRecommendationId("   "), null);
  assert.equal(normalizeCanonicalRestaurantTasksRelatedRecommendationId("\u00a0\u00a0"), null);

  const unrelated = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedRecommendationId: null
  });
  assert.equal(unrelated.relatedRecommendationId, null);

  const softEmpty = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedRecommendationId: "\u00a0\u00a0"
  });
  assert.equal(softEmpty.relatedRecommendationId, null);

  const hydratedUnrelated = restaurantTaskFromPersistedRow({
    ...baseRow,
    related_recommendation_id: null
  });
  assert.equal(hydratedUnrelated.relatedRecommendationId, null);

  assert.equal(canonicalizeRestaurantTasksRelatedRecommendationId("a".repeat(201)), null);
  assert.equal(canonicalizeRestaurantTasksRelatedRecommendationId("recommendation-\u0000x"), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedRecommendationId(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Related recommendation is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksRelatedRecommendationId("recommendation-\u0000x"),
    (error: unknown) =>
      error instanceof Error && error.message === "Related recommendation is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        relatedRecommendationId: "recommendation-\u0000x"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related recommendation is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        related_recommendation_id: "a".repeat(201)
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Related recommendation is invalid."
  );
});

test("sibling relatedOrderId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspOrder = `\u00a0${relatedOrderId}\u00a0`;
  assert.equal(nbspOrder.trim(), relatedOrderId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedOrderId: nbspOrder,
    relatedRecommendationId
  });
  assert.equal(created.relatedOrderId, relatedOrderId);
  assert.equal(created.relatedRecommendationId, relatedRecommendationId);
});

test("sibling relatedInventoryItemId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspItem = `\u00a0${relatedInventoryItemId}\u00a0`;
  assert.equal(nbspItem.trim(), relatedInventoryItemId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedInventoryItemId: nbspItem,
    relatedRecommendationId
  });
  assert.equal(created.relatedInventoryItemId, relatedInventoryItemId);
  assert.equal(created.relatedRecommendationId, relatedRecommendationId);
});

test("sibling assigneeUserId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspAssignee = `\u00a0${assigneeUserId}\u00a0`;
  assert.equal(nbspAssignee.trim(), assigneeUserId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    assigneeUserId: nbspAssignee,
    relatedRecommendationId
  });
  assert.equal(created.assigneeUserId, assigneeUserId);
  assert.equal(created.relatedRecommendationId, relatedRecommendationId);
});

test("sibling createdBy NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCreatedBy = `\u00a0manager-1\u00a0`;
  assert.equal(nbspCreatedBy.trim(), "manager-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    created_by: nbspCreatedBy
  });
  assert.equal(hydrated.createdBy, "manager-1");
  assert.equal(hydrated.relatedRecommendationId, relatedRecommendationId);
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
  assert.equal(hydrated.relatedRecommendationId, relatedRecommendationId);
});

test("sibling clientTaskId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspClient = `\u00a0${clientTaskId}\u00a0`;
  assert.equal(nbspClient.trim(), clientTaskId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId: nbspClient,
    title: "Confirm chicken count",
    relatedRecommendationId
  });
  assert.equal(created.clientTaskId, clientTaskId);
  assert.equal(created.relatedRecommendationId, relatedRecommendationId);
});

test("sibling dependencyIds NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspDependency = `\u00a0task-a\u00a0`;
  assert.equal(nbspDependency.trim(), "task-a");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedRecommendationId,
    dependencyIds: [nbspDependency]
  });
  assert.deepEqual(created.dependencyIds, ["task-a"]);
  assert.equal(created.relatedRecommendationId, relatedRecommendationId);
});

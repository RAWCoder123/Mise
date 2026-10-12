import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  asciiTrimRestaurantTasksCreatedByToken,
  canonicalizeRestaurantTasksCreatedBy,
  requireCanonicalRestaurantTasksCreatedBy
} from "../services/domain/restaurantTasksCreatedByIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksCreatedByIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const createdBy = "manager-1";
const uuidCreatedBy = "22222222-2222-4222-8222-222222222222";

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
  created_by: createdBy,
  client_task_id: "client-task-1",
  correlation_id: "correlation-1",
  created_at: "2026-08-02T19:00:00.000Z",
  updated_at: "2026-08-02T19:00:00.000Z"
};

test("MISE-005OG pins restaurant-tasks createdBy to ASCII C", () => {
  assert.match(identitySource, /MISE-005OG/);
  assert.match(domainSource, /MISE-005OG/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksCreatedByToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /createdBy: requireCanonicalRestaurantTasksCreatedBy\(\s*row\.created_by\s*\)/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksCreatedByIdentity"/);

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
    /clientTaskId: requiredText\(row\.client_task_id, 200, "Client task id"\),/
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
  assert.match(
    domainSource,
    /completedBy: optionalText\(row\.completed_by, 200, "Task completer"\),/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedInventoryIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedOrderIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedInventoryIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedOrderIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
});

test("ASCII trim keeps ordinary restaurant-tasks createdBy padding stable", () => {
  assert.equal(asciiTrimRestaurantTasksCreatedByToken(`  ${createdBy}  `), createdBy);
  assert.equal(canonicalizeRestaurantTasksCreatedBy(`\t${createdBy}\n`), createdBy);
  assert.equal(requireCanonicalRestaurantTasksCreatedBy(`  ${createdBy}  `), createdBy);

  assert.equal(asciiTrimRestaurantTasksCreatedByToken(`  ${uuidCreatedBy}  `), uuidCreatedBy);
  assert.equal(canonicalizeRestaurantTasksCreatedBy(`\t${uuidCreatedBy}\n`), uuidCreatedBy);
  assert.equal(requireCanonicalRestaurantTasksCreatedBy(` ${uuidCreatedBy} `), uuidCreatedBy);

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    created_by: `  ${uuidCreatedBy}  `
  });
  assert.equal(hydrated.createdBy, uuidCreatedBy);
  assert.equal(hydrated.clientTaskId, "client-task-1");
});

test("NBSP and em-space padding cannot invent restaurant-tasks createdBy", () => {
  const nbspCreator = `\u00a0${createdBy}\u00a0`;
  const emCreator = `\u2003${uuidCreatedBy}\u2003`;

  // Unicode trim invents an exact match against the unpadded creator id.
  assert.equal(nbspCreator.trim(), createdBy);
  assert.notEqual(asciiTrimRestaurantTasksCreatedByToken(nbspCreator), createdBy);
  assert.equal(canonicalizeRestaurantTasksCreatedBy(nbspCreator), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksCreatedBy(nbspCreator),
    (error: unknown) =>
      error instanceof Error && error.message === "Task creator is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        created_by: nbspCreator
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task creator is invalid."
  );

  assert.equal(emCreator.trim(), uuidCreatedBy);
  assert.equal(canonicalizeRestaurantTasksCreatedBy(emCreator), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksCreatedBy(emCreator),
    (error: unknown) =>
      error instanceof Error && error.message === "Task creator is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        created_by: emCreator
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task creator is invalid."
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
  assert.equal(hydrated.createdBy, createdBy);
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
  assert.equal(hydrated.createdBy, createdBy);
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
  assert.equal(hydrated.createdBy, createdBy);
});

test("sibling correlationId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCorrelation = `\u00a0correlation-1\u00a0`;
  assert.equal(nbspCorrelation.trim(), "correlation-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    correlation_id: nbspCorrelation
  });
  assert.equal(hydrated.correlationId, "correlation-1");
  assert.equal(hydrated.createdBy, createdBy);
});

test("sibling relatedRecommendationId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspRecommendation = `\u00a0recommendation-1\u00a0`;
  assert.equal(nbspRecommendation.trim(), "recommendation-1");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId: "client-task-1",
    title: "Confirm chicken count",
    relatedRecommendationId: nbspRecommendation
  });
  assert.equal(created.relatedRecommendationId, "recommendation-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    related_recommendation_id: nbspRecommendation
  });
  assert.equal(hydrated.relatedRecommendationId, "recommendation-1");
  assert.equal(hydrated.createdBy, createdBy);
});

test("sibling completedBy NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCompleter = `\u00a0staff-1\u00a0`;
  assert.equal(nbspCompleter.trim(), "staff-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    status: "completed",
    completed_at: "2026-08-02T20:00:00.000Z",
    completed_by: nbspCompleter,
    completion_result: "Counted 12 cases.",
    completion_evidence: [{ label: "Count photo", type: "photo" }],
    verification_method: "count",
    verification_required: true
  });
  assert.equal(hydrated.completedBy, "staff-1");
  assert.equal(hydrated.createdBy, createdBy);
});

test("over-long, empty, and control restaurant-tasks createdBy values fail closed", () => {
  assert.equal(canonicalizeRestaurantTasksCreatedBy(""), null);
  assert.equal(canonicalizeRestaurantTasksCreatedBy("   "), null);
  assert.equal(canonicalizeRestaurantTasksCreatedBy("a".repeat(201)), null);
  assert.equal(canonicalizeRestaurantTasksCreatedBy("creator-\u0000id"), null);

  assert.throws(
    () => requireCanonicalRestaurantTasksCreatedBy(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Task creator is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCreatedBy(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Task creator is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCreatedBy(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Task creator is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCreatedBy("   "),
    (error: unknown) =>
      error instanceof Error && error.message === "Task creator is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCreatedBy("a".repeat(201)),
    (error: unknown) =>
      error instanceof Error && error.message === "Task creator is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCreatedBy("creator-\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task creator is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        created_by: "creator-\u0000id"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task creator is invalid."
  );
});

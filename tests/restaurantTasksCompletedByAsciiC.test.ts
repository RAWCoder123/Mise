import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  asciiTrimRestaurantTasksCompletedByToken,
  canonicalizeRestaurantTasksCompletedBy,
  normalizeCanonicalRestaurantTasksCompletedBy
} from "../services/domain/restaurantTasksCompletedByIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksCompletedByIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const completedBy = "manager-1";
const demoCompletedBy = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
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

function completedRow(
  overrides: Partial<PersistedRestaurantTaskRow> = {}
): PersistedRestaurantTaskRow {
  return {
    ...baseRow,
    status: "completed",
    completion_result: "Counted 12 cases.",
    completion_evidence: [{ type: "count", label: "Walk-in count" }],
    completed_at: "2026-08-02T20:00:00.000Z",
    completed_by: completedBy,
    ...overrides
  };
}

test("MISE-005OH pins restaurant-tasks completedBy to ASCII C", () => {
  assert.match(identitySource, /MISE-005OH/);
  assert.match(domainSource, /MISE-005OH/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksCompletedByToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /completedBy: normalizeCanonicalRestaurantTasksCompletedBy\(row\.completed_by\),/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksCompletedByIdentity"/);

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
  assert.doesNotMatch(identitySource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCreatedByIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCreatedByIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
});

test("ASCII trim keeps ordinary restaurant-tasks completedBy padding stable", () => {
  assert.equal(asciiTrimRestaurantTasksCompletedByToken(`  ${completedBy}  `), completedBy);
  assert.equal(canonicalizeRestaurantTasksCompletedBy(`\t${completedBy}\n`), completedBy);
  assert.equal(
    normalizeCanonicalRestaurantTasksCompletedBy(`  ${completedBy}  `),
    completedBy
  );

  assert.equal(
    asciiTrimRestaurantTasksCompletedByToken(`  ${demoCompletedBy}  `),
    demoCompletedBy
  );
  assert.equal(
    canonicalizeRestaurantTasksCompletedBy(`\t${demoCompletedBy}\n`),
    demoCompletedBy
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksCompletedBy(` ${demoCompletedBy} `),
    demoCompletedBy
  );

  const hydrated = restaurantTaskFromPersistedRow(
    completedRow({ completed_by: `  ${completedBy}  ` })
  );
  assert.equal(hydrated.completedBy, completedBy);
  assert.equal(hydrated.clientTaskId, clientTaskId);
});

test("NBSP and em-space padding cannot invent restaurant-tasks completedBy", () => {
  const nbspCompletedBy = `\u00a0${completedBy}\u00a0`;
  const emCompletedBy = `\u2003${demoCompletedBy}\u2003`;

  // Unicode trim invents an exact match against the unpadded completer id.
  assert.equal(nbspCompletedBy.trim(), completedBy);
  assert.notEqual(asciiTrimRestaurantTasksCompletedByToken(nbspCompletedBy), completedBy);
  assert.equal(canonicalizeRestaurantTasksCompletedBy(nbspCompletedBy), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksCompletedBy(nbspCompletedBy),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completer is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow(
        completedRow({ completed_by: nbspCompletedBy })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completer is invalid."
  );

  assert.equal(emCompletedBy.trim(), demoCompletedBy);
  assert.equal(canonicalizeRestaurantTasksCompletedBy(emCompletedBy), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksCompletedBy(emCompletedBy),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completer is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow(
        completedRow({ completed_by: emCompletedBy })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completer is invalid."
  );
});

test("restaurant-tasks completedBy soft-empty stays null; invalid tokens fail closed", () => {
  assert.equal(normalizeCanonicalRestaurantTasksCompletedBy(null), null);
  assert.equal(normalizeCanonicalRestaurantTasksCompletedBy(undefined), null);
  assert.equal(normalizeCanonicalRestaurantTasksCompletedBy(""), null);
  assert.equal(normalizeCanonicalRestaurantTasksCompletedBy("   "), null);
  assert.equal(normalizeCanonicalRestaurantTasksCompletedBy("\u00a0\u00a0"), null);

  const incomplete = restaurantTaskFromPersistedRow({
    ...baseRow,
    completed_by: null
  });
  assert.equal(incomplete.completedBy, null);

  const softEmpty = restaurantTaskFromPersistedRow({
    ...baseRow,
    completed_by: "\u00a0\u00a0"
  });
  assert.equal(softEmpty.completedBy, null);

  assert.equal(canonicalizeRestaurantTasksCompletedBy("a".repeat(201)), null);
  assert.equal(canonicalizeRestaurantTasksCompletedBy("manager-\u0000user"), null);
  assert.throws(
    () => normalizeCanonicalRestaurantTasksCompletedBy(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completer is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksCompletedBy("manager-\u0000user"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completer is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow(
        completedRow({ completed_by: "manager-\u0000user" })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completer is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow(
        completedRow({ completed_by: "a".repeat(201) })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completer is invalid."
  );
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

  const hydrated = restaurantTaskFromPersistedRow(
    completedRow({ assignee_user_id: nbspAssignee })
  );
  assert.equal(hydrated.assigneeUserId, "staff-1");
  assert.equal(hydrated.completedBy, completedBy);
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

  const hydrated = restaurantTaskFromPersistedRow(
    completedRow({ created_by: nbspCreatedBy })
  );
  assert.equal(hydrated.createdBy, "manager-1");
  assert.equal(hydrated.completedBy, completedBy);
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

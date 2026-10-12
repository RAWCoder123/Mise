import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  canonicalRestaurantTasksTitle,
  requireCanonicalRestaurantTasksTitle
} from "../services/domain/restaurantTasksTitleIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksTitleIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const title = "Confirm chicken count";
const accentedTitle = "Confirmar conteo de pollo";
const relatedSupplierName = "Regional Protein Co";
const sourceReference = "inventory-risk:item-1";
const clientTaskId = "client-task-1";
const relatedRecommendationId = "recommendation-1";
const relatedOrderId = "order-1";
const relatedInventoryItemId = "item-1";
const assigneeUserId = "staff-1";

const baseRow: PersistedRestaurantTaskRow = {
  id: "task-1",
  restaurant_id: "restaurant-a",
  location_id: null,
  origin: "human",
  title,
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
  related_supplier_name: relatedSupplierName,
  source_reference: sourceReference,
  created_by: "manager-1",
  client_task_id: clientTaskId,
  correlation_id: "correlation-1",
  created_at: "2026-08-02T19:00:00.000Z",
  updated_at: "2026-08-02T19:00:00.000Z"
};

test("MISE-005ON pins restaurant-tasks title to ASCII C display prep", () => {
  assert.match(identitySource, /MISE-005ON/);
  assert.match(domainSource, /MISE-005ON/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalRestaurantTasksTitle("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(
    domainSource,
    /const title = requireCanonicalRestaurantTasksTitle\(\s*input\.title\s*\);/
  );
  assert.match(
    domainSource,
    /title: requireCanonicalRestaurantTasksTitle\(\s*row\.title\s*\),/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksTitleIdentity"/);

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
    /const detail = optionalText\(input\.detail, 2000, "Task detail"\);/
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
    /relatedSupplierName: optionalText\(input\.relatedSupplierName, 200, "Related supplier"\),/
  );
  assert.match(
    domainSource,
    /relatedSupplierName: optionalText\(row\.related_supplier_name, 200, "Related supplier"\),/
  );
  assert.match(
    domainSource,
    /sourceReference: optionalText\(input\.sourceReference, 240, "Task source reference"\),/
  );
  assert.match(
    domainSource,
    /sourceReference: optionalText\(row\.source_reference, 240, "Task source reference"\),/
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
    /locationId: optionalText\(row\.location_id, 200, "Location id"\),/
  );
  assert.match(
    domainSource,
    /completionResult: optionalText\(row\.completion_result, 1000, "Task completion result"\),/
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
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksSourceReferenceIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksLocationIdIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierSettingsNameIdentity/);
  assert.doesNotMatch(identitySource, /supplierDisplayNameIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedOrderIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksSourceReferenceIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedSupplierNameIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksLocationIdIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /supplierSettingsNameIdentity/);
  assert.doesNotMatch(domainSource, /supplierDisplayNameIdentity/);
});

test("ASCII C display prep keeps ordinary restaurant-tasks title stable", () => {
  assert.equal(canonicalRestaurantTasksTitle(`  ${title}  `), title);
  // Pure display prep still collapses C whitespace (TAB/NL); the require
  // gate below rejects those same code points as controls on the raw token.
  assert.equal(canonicalRestaurantTasksTitle(`\t${title}\n`), title);
  assert.equal(requireCanonicalRestaurantTasksTitle(`  ${title}  `), title);
  assert.equal(canonicalRestaurantTasksTitle(accentedTitle), accentedTitle);
  assert.equal(requireCanonicalRestaurantTasksTitle(accentedTitle), accentedTitle);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: `  ${title}  `
  });
  assert.equal(created.title, title);
  assert.equal(created.clientTaskId, clientTaskId);

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    title: `  ${title}  `
  });
  assert.equal(hydrated.title, title);
  assert.equal(hydrated.clientTaskId, clientTaskId);
});

test("NBSP folds and em-space padding cannot invent restaurant-tasks title", () => {
  const nbspTitle = `\u00a0${title}\u00a0`;
  const emTitle = `\u2003${title}\u2003`;
  const internalEm = `Confirm\u2003chicken count`;
  const internalNbsp = `Confirm\u00a0chicken count`;

  // Pasted NBSP is folded like relatedSupplierName / MISE-005B display prep.
  assert.equal(nbspTitle.trim().replace(/\s+/g, " "), title);
  assert.equal(canonicalRestaurantTasksTitle(nbspTitle), title);
  assert.equal(requireCanonicalRestaurantTasksTitle(nbspTitle), title);
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      restaurantId: "restaurant-a",
      clientTaskId,
      title: nbspTitle
    }).title,
    title
  );
  assert.equal(
    restaurantTaskFromPersistedRow({
      ...baseRow,
      title: nbspTitle
    }).title,
    title
  );
  assert.equal(canonicalRestaurantTasksTitle(internalNbsp), title);

  // Unicode em-space trim + \\s collapse invents a clean title; C display prep does not.
  assert.equal(emTitle.trim().replace(/\s+/g, " "), title);
  assert.notEqual(canonicalRestaurantTasksTitle(emTitle), title);
  assert.equal(canonicalRestaurantTasksTitle(emTitle), emTitle);
  assert.equal(requireCanonicalRestaurantTasksTitle(emTitle), emTitle);
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      restaurantId: "restaurant-a",
      clientTaskId,
      title: emTitle
    }).title,
    emTitle
  );
  assert.equal(
    restaurantTaskFromPersistedRow({
      ...baseRow,
      title: emTitle
    }).title,
    emTitle
  );

  assert.equal(canonicalRestaurantTasksTitle(internalEm), internalEm);
  assert.notEqual(
    canonicalRestaurantTasksTitle(internalEm),
    canonicalRestaurantTasksTitle(title)
  );

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(canonicalRestaurantTasksTitle("Kelvin count"), "Kelvin count");
  assert.notEqual(
    canonicalRestaurantTasksTitle("Kelvin count"),
    canonicalRestaurantTasksTitle("Kelvin count")
  );
});

test("restaurant-tasks title empty/control/over-long fail closed", () => {
  assert.throws(
    () => requireCanonicalRestaurantTasksTitle(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Task title is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksTitle(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Task title is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksTitle(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Task title is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksTitle(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Task title is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksTitle("   "),
    (error: unknown) =>
      error instanceof Error && error.message === "Task title is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksTitle("\u00a0\u00a0"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task title is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksTitle("\u2003"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task title is invalid."
  );

  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "   "
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task title is invalid."
  );

  assert.throws(
    () => requireCanonicalRestaurantTasksTitle("Bad\u0000Title"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task title is invalid."
  );
  // TAB is C whitespace for collapse, but remaining control chars in the raw
  // input still fail closed (parity with #821 / SQL cntrl pin #556).
  assert.throws(
    () => requireCanonicalRestaurantTasksTitle("Confirm\tchicken count"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task title is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksTitle("x".repeat(161)),
    (error: unknown) =>
      error instanceof Error && error.message === "Task title is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Bad\u0000Title"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task title is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        title: "x".repeat(161)
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task title is invalid."
  );
});

test("sibling relatedSupplierName NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspSupplier = `\u00a0${relatedSupplierName}\u00a0`;
  assert.equal(nbspSupplier.trim(), relatedSupplierName);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title,
    relatedSupplierName: nbspSupplier
  });
  assert.equal(created.relatedSupplierName, relatedSupplierName);
  assert.equal(created.title, title);
});

test("sibling sourceReference NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspReference = `\u00a0${sourceReference}\u00a0`;
  assert.equal(nbspReference.trim(), sourceReference);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title,
    sourceReference: nbspReference
  });
  assert.equal(created.sourceReference, sourceReference);
  assert.equal(created.title, title);
});

test("sibling relatedRecommendationId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspRecommendation = `\u00a0${relatedRecommendationId}\u00a0`;
  assert.equal(nbspRecommendation.trim(), relatedRecommendationId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title,
    relatedRecommendationId: nbspRecommendation
  });
  assert.equal(created.relatedRecommendationId, relatedRecommendationId);
  assert.equal(created.title, title);
});

test("sibling relatedOrderId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspOrder = `\u00a0${relatedOrderId}\u00a0`;
  assert.equal(nbspOrder.trim(), relatedOrderId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title,
    relatedOrderId: nbspOrder
  });
  assert.equal(created.relatedOrderId, relatedOrderId);
  assert.equal(created.title, title);
});

test("sibling relatedInventoryItemId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspItem = `\u00a0${relatedInventoryItemId}\u00a0`;
  assert.equal(nbspItem.trim(), relatedInventoryItemId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title,
    relatedInventoryItemId: nbspItem
  });
  assert.equal(created.relatedInventoryItemId, relatedInventoryItemId);
  assert.equal(created.title, title);
});

test("sibling assigneeUserId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspAssignee = `\u00a0${assigneeUserId}\u00a0`;
  assert.equal(nbspAssignee.trim(), assigneeUserId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title,
    assigneeUserId: nbspAssignee
  });
  assert.equal(created.assigneeUserId, assigneeUserId);
  assert.equal(created.title, title);
});

test("sibling locationId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspLocation = `\u00a0location-1\u00a0`;
  assert.equal(nbspLocation.trim(), "location-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    location_id: nbspLocation
  });
  assert.equal(hydrated.locationId, "location-1");
  assert.equal(hydrated.title, title);
});

test("sibling createdBy NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCreatedBy = `\u00a0manager-1\u00a0`;
  assert.equal(nbspCreatedBy.trim(), "manager-1");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    created_by: nbspCreatedBy
  });
  assert.equal(hydrated.createdBy, "manager-1");
  assert.equal(hydrated.title, title);
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
  assert.equal(hydrated.title, title);
});

test("sibling clientTaskId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspClient = `\u00a0${clientTaskId}\u00a0`;
  assert.equal(nbspClient.trim(), clientTaskId);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId: nbspClient,
    title
  });
  assert.equal(created.clientTaskId, clientTaskId);
  assert.equal(created.title, title);
});

test("sibling dependencyIds NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspDependency = `\u00a0task-a\u00a0`;
  assert.equal(nbspDependency.trim(), "task-a");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title,
    dependencyIds: [nbspDependency]
  });
  assert.deepEqual(created.dependencyIds, ["task-a"]);
  assert.equal(created.title, title);
});

test("sibling detail NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspDetail = `\u00a0Count the walk-in case.\u00a0`;
  assert.equal(nbspDetail.trim(), "Count the walk-in case.");

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title,
    detail: nbspDetail
  });
  assert.equal(created.detail, "Count the walk-in case.");
  assert.equal(created.title, title);
});

test("sibling completionResult NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspResult = `\u00a0Counted 12 cases.\u00a0`;
  assert.equal(nbspResult.trim(), "Counted 12 cases.");

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    status: "completed",
    completion_result: nbspResult,
    completion_evidence: [{ type: "count", label: "Walk-in count" }],
    completed_at: "2026-08-02T20:00:00.000Z",
    completed_by: "manager-1"
  });
  assert.equal(hydrated.completionResult, "Counted 12 cases.");
  assert.equal(hydrated.title, title);
});

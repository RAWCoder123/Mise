import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeCompleteRestaurantTaskInput,
  normalizeCreateRestaurantTaskInput,
  restaurantTaskFromPersistedRow,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";
import {
  canonicalRestaurantTasksDetail,
  normalizeCanonicalRestaurantTasksDetail
} from "../services/domain/restaurantTasksDetailIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksDetailIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const title = "Confirm chicken count";
const detail = "Count the walk-in case.";
const multilineDetail = "Count the walk-in case.\nRecord variance.\nPhoto the shelf.";
const accentedDetail = "Contar el pollo fresco.";
const relatedSupplierName = "Regional Protein Co";
const sourceReference = "inventory-risk:item-1";
const clientTaskId = "client-task-1";
const relatedRecommendationId = "recommendation-1";
const relatedOrderId = "order-1";
const relatedInventoryItemId = "item-1";
const assigneeUserId = "staff-1";
const completionResult = "Counted 12 cases.";

const baseRow: PersistedRestaurantTaskRow = {
  id: "task-1",
  restaurant_id: "restaurant-a",
  location_id: null,
  origin: "human",
  title,
  detail,
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

test("MISE-005OO pins restaurant-tasks detail to ASCII C multiline free-text prep", () => {
  assert.match(identitySource, /MISE-005OO/);
  assert.match(domainSource, /MISE-005OO/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalRestaurantTasksDetail("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  // Free-text must not collapse internal C whitespace the way title/display-name tips do.
  assert.doesNotMatch(canonicalBody, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.doesNotMatch(canonicalBody, /\.replace\(C_WHITESPACE/);

  assert.match(
    domainSource,
    /detail = normalizeCanonicalRestaurantTasksDetail\(\s*input\.detail\s*\)/
  );
  assert.match(
    domainSource,
    /detail: normalizeCanonicalRestaurantTasksDetail\(\s*row\.detail\s*\)/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksDetailIdentity"/);

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
    /relatedSupplierName: optionalText\(input\.relatedSupplierName, 200, "Related supplier"\),/
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
    /completionResult: requiredText\(input\.completionResult, 1000, "Completion result"\),/
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
  assert.doesNotMatch(identitySource, /restaurantTasksTitleIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksSourceReferenceIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedInventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedOrderIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksLocationIdIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierSettingsNameIdentity/);
  assert.doesNotMatch(identitySource, /supplierDisplayNameIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksTitleIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedSupplierNameIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksSourceReferenceIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksAssigneeIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksClientTaskIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCorrelationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksDependencyIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedOrderIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksLocationIdIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /supplierSettingsNameIdentity/);
  assert.doesNotMatch(domainSource, /supplierDisplayNameIdentity/);
});

test("ASCII C multiline prep keeps ordinary restaurant-tasks detail stable", () => {
  assert.equal(canonicalRestaurantTasksDetail(`  ${detail}  `), detail);
  assert.equal(canonicalRestaurantTasksDetail(`\t${detail}\n`), detail);
  assert.equal(normalizeCanonicalRestaurantTasksDetail(`  ${detail}  `), detail);
  assert.equal(canonicalRestaurantTasksDetail(accentedDetail), accentedDetail);
  assert.equal(normalizeCanonicalRestaurantTasksDetail(accentedDetail), accentedDetail);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalRestaurantTasksDetail(multilineDetail), multilineDetail);
  assert.equal(
    canonicalRestaurantTasksDetail("Line1\tTabbed\rLine2"),
    "Line1\tTabbed\rLine2"
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksDetail(`\n${multilineDetail}\n`),
    multilineDetail
  );

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title,
    detail: `  ${detail}  `
  });
  assert.equal(created.detail, detail);
  assert.equal(created.title, title);

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    detail: `  ${detail}  `
  });
  assert.equal(hydrated.detail, detail);
  assert.equal(hydrated.title, title);

  const multilineCreated = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title,
    detail: multilineDetail
  });
  assert.equal(multilineCreated.detail, multilineDetail);
});

test("NBSP folds and em-space padding cannot invent restaurant-tasks detail", () => {
  const nbspDetail = `\u00a0${detail}\u00a0`;
  const emDetail = `\u2003${detail}\u2003`;
  const internalEm = `Count\u2003the walk-in case.`;
  const internalNbsp = `Count\u00a0the walk-in case.`;
  const emMultiline = `\u2003${multilineDetail}\u2003`;

  // Pasted NBSP is folded like relatedSupplierName / MISE-005B display prep.
  assert.equal(nbspDetail.trim(), detail);
  assert.equal(canonicalRestaurantTasksDetail(nbspDetail), detail);
  assert.equal(normalizeCanonicalRestaurantTasksDetail(nbspDetail), detail);
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      restaurantId: "restaurant-a",
      clientTaskId,
      title,
      detail: nbspDetail
    }).detail,
    detail
  );
  assert.equal(
    restaurantTaskFromPersistedRow({
      ...baseRow,
      detail: nbspDetail
    }).detail,
    detail
  );
  assert.equal(canonicalRestaurantTasksDetail(internalNbsp), "Count the walk-in case.");

  // Unicode em-space trim invents a clean detail; C free-text prep does not.
  assert.equal(emDetail.trim(), detail);
  assert.notEqual(canonicalRestaurantTasksDetail(emDetail), detail);
  assert.equal(canonicalRestaurantTasksDetail(emDetail), emDetail);
  assert.equal(normalizeCanonicalRestaurantTasksDetail(emDetail), emDetail);
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      restaurantId: "restaurant-a",
      clientTaskId,
      title,
      detail: emDetail
    }).detail,
    emDetail
  );
  assert.equal(
    restaurantTaskFromPersistedRow({
      ...baseRow,
      detail: emDetail
    }).detail,
    emDetail
  );

  assert.equal(canonicalRestaurantTasksDetail(internalEm), internalEm);
  assert.notEqual(
    canonicalRestaurantTasksDetail(internalEm),
    canonicalRestaurantTasksDetail(detail)
  );

  // Em-space padding around multiline detail must not invent equality either.
  assert.equal(emMultiline.trim(), multilineDetail);
  assert.notEqual(canonicalRestaurantTasksDetail(emMultiline), multilineDetail);
  assert.equal(canonicalRestaurantTasksDetail(emMultiline), emMultiline);
  assert.equal(normalizeCanonicalRestaurantTasksDetail(emMultiline), emMultiline);

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(canonicalRestaurantTasksDetail("Kelvin count notes"), "Kelvin count notes");
  assert.notEqual(
    canonicalRestaurantTasksDetail("Kelvin count notes"),
    canonicalRestaurantTasksDetail("Kelvin count notes")
  );
});

test("restaurant-tasks detail soft-empty stays null; unsafe control/over-long fail closed", () => {
  assert.equal(normalizeCanonicalRestaurantTasksDetail(null), null);
  assert.equal(normalizeCanonicalRestaurantTasksDetail(undefined), null);
  assert.equal(normalizeCanonicalRestaurantTasksDetail(""), null);
  assert.equal(normalizeCanonicalRestaurantTasksDetail("   "), null);
  assert.equal(normalizeCanonicalRestaurantTasksDetail("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalRestaurantTasksDetail("\u2003"), null);
  assert.equal(normalizeCanonicalRestaurantTasksDetail("\n\t\r"), null);

  assert.equal(
    normalizeCreateRestaurantTaskInput({
      restaurantId: "restaurant-a",
      clientTaskId,
      title,
      detail: "   "
    }).detail,
    null
  );
  assert.equal(
    restaurantTaskFromPersistedRow({
      ...baseRow,
      detail: null
    }).detail,
    null
  );

  assert.throws(
    () => normalizeCanonicalRestaurantTasksDetail(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Task detail is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksDetail("Bad\u0000Detail"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task detail is invalid."
  );
  // VT/FF remain rejected; LF/TAB/CR are allowlisted for multiline free-text.
  assert.throws(
    () => normalizeCanonicalRestaurantTasksDetail("Count\u000bthe walk-in"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task detail is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksDetail("Count\u000cthe walk-in"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task detail is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksDetail("Count\u007fthe walk-in"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task detail is invalid."
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksDetail("Count\tthe walk-in\ncase."),
    "Count\tthe walk-in\ncase."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksDetail("x".repeat(2001)),
    (error: unknown) =>
      error instanceof Error && error.message === "Task detail is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title,
        detail: "Bad\u0000Detail"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task detail is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        detail: "x".repeat(2001)
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task detail is invalid."
  );
});

test("sibling title NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspTitle = `\u00a0${title}\u00a0`;
  assert.equal(nbspTitle.trim().replace(/\s+/g, " "), title);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: nbspTitle,
    detail
  });
  assert.equal(created.title, title);
  assert.equal(created.detail, detail);
});

test("sibling relatedSupplierName NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspSupplier = `\u00a0${relatedSupplierName}\u00a0`;
  assert.equal(nbspSupplier.trim(), relatedSupplierName);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title,
    detail,
    relatedSupplierName: nbspSupplier
  });
  assert.equal(created.relatedSupplierName, relatedSupplierName);
  assert.equal(created.detail, detail);
});

test("sibling sourceReference NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspReference = `\u00a0${sourceReference}\u00a0`;
  assert.equal(nbspReference.trim(), sourceReference);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title,
    detail,
    sourceReference: nbspReference
  });
  assert.equal(created.sourceReference, sourceReference);
  assert.equal(created.detail, detail);
});

test("sibling completionResult Unicode trim still invents until tipped", () => {
  const emResult = `\u2003${completionResult}\u2003`;
  assert.equal(emResult.trim().replace(/\s+/g, " "), completionResult);

  const completed = normalizeCompleteRestaurantTaskInput({
    restaurantId: "restaurant-a",
    taskId: "task-1",
    completionResult: emResult
  });
  assert.equal(completed.completionResult, completionResult);

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    status: "completed",
    completion_result: emResult,
    completed_at: "2026-08-02T20:00:00.000Z",
    completed_by: "manager-1",
    completion_evidence: [{ type: "count", label: "12 cases" }]
  });
  assert.equal(hydrated.completionResult, completionResult);
  assert.equal(hydrated.detail, detail);
});

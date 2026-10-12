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
  canonicalRestaurantTasksCompletionResult,
  normalizeCanonicalRestaurantTasksCompletionResult,
  requireCanonicalRestaurantTasksCompletionResult
} from "../services/domain/restaurantTasksCompletionResultIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksCompletionResultIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const title = "Confirm chicken count";
const detail = "Count the walk-in case.";
const completionResult = "Counted 18 lb";
const multilineResult = "Counted 18 lb.\nVariance noted.\nPhoto attached.";
const accentedResult = "Contado 18 lb de pollo fresco.";
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

function completedRow(
  overrides: Partial<PersistedRestaurantTaskRow> = {}
): PersistedRestaurantTaskRow {
  return {
    ...baseRow,
    status: "completed",
    completion_result: completionResult,
    completed_at: "2026-08-02T20:00:00.000Z",
    completed_by: "manager-1",
    completion_evidence: [{ type: "count", label: "18 lb" }],
    ...overrides
  };
}

test("MISE-005OP pins restaurant-tasks completionResult to ASCII C multiline free-text prep", () => {
  assert.match(identitySource, /MISE-005OP/);
  assert.match(domainSource, /MISE-005OP/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalRestaurantTasksCompletionResult("),
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
    /completionResult: requireCanonicalRestaurantTasksCompletionResult\(\s*input\.completionResult\s*\)/
  );
  assert.match(
    domainSource,
    /completionResult: normalizeCanonicalRestaurantTasksCompletionResult\(\s*row\.completion_result\s*\)/
  );
  assert.match(domainSource, /from "\.\/restaurantTasksCompletionResultIdentity"/);

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
    /detail: optionalText\(row\.detail, 2000, "Task detail"\),/
  );
  assert.match(
    domainSource,
    /taskId: requiredText\(input\.taskId, 200, "Task id"\),/
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
  assert.doesNotMatch(identitySource, /restaurantTasksDetailIdentity/);
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
  assert.doesNotMatch(domainSource, /restaurantTasksDetailIdentity/);
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

test("ASCII C multiline prep keeps ordinary restaurant-tasks completionResult stable", () => {
  assert.equal(canonicalRestaurantTasksCompletionResult(`  ${completionResult}  `), completionResult);
  assert.equal(canonicalRestaurantTasksCompletionResult(`\t${completionResult}\n`), completionResult);
  assert.equal(
    requireCanonicalRestaurantTasksCompletionResult(`  ${completionResult}  `),
    completionResult
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksCompletionResult(`  ${completionResult}  `),
    completionResult
  );
  assert.equal(canonicalRestaurantTasksCompletionResult(accentedResult), accentedResult);
  assert.equal(requireCanonicalRestaurantTasksCompletionResult(accentedResult), accentedResult);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalRestaurantTasksCompletionResult(multilineResult), multilineResult);
  assert.equal(
    canonicalRestaurantTasksCompletionResult("Line1\tTabbed\rLine2"),
    "Line1\tTabbed\rLine2"
  );
  assert.equal(
    requireCanonicalRestaurantTasksCompletionResult(`\n${multilineResult}\n`),
    multilineResult
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksCompletionResult(`\n${multilineResult}\n`),
    multilineResult
  );

  const completed = normalizeCompleteRestaurantTaskInput({
    restaurantId: "restaurant-a",
    taskId: "task-1",
    completionResult: `  ${completionResult}  `
  });
  assert.equal(completed.completionResult, completionResult);

  const hydrated = restaurantTaskFromPersistedRow(
    completedRow({ completion_result: `  ${completionResult}  ` })
  );
  assert.equal(hydrated.completionResult, completionResult);
  assert.equal(hydrated.title, title);

  const multilineCompleted = normalizeCompleteRestaurantTaskInput({
    restaurantId: "restaurant-a",
    taskId: "task-1",
    completionResult: multilineResult
  });
  assert.equal(multilineCompleted.completionResult, multilineResult);
});

test("NBSP folds and em-space padding cannot invent restaurant-tasks completionResult", () => {
  const nbspResult = `\u00a0${completionResult}\u00a0`;
  const emResult = `\u2003${completionResult}\u2003`;
  const internalEm = `Counted\u200318\u2003lb`;
  const internalNbsp = `Counted\u00a018\u00a0lb`;
  const emMultiline = `\u2003${multilineResult}\u2003`;

  // Pasted NBSP is folded like detail / MISE-005B display prep.
  assert.equal(nbspResult.trim().replace(/\s+/g, " "), completionResult);
  assert.equal(canonicalRestaurantTasksCompletionResult(nbspResult), completionResult);
  assert.equal(requireCanonicalRestaurantTasksCompletionResult(nbspResult), completionResult);
  assert.equal(normalizeCanonicalRestaurantTasksCompletionResult(nbspResult), completionResult);
  assert.equal(
    normalizeCompleteRestaurantTaskInput({
      restaurantId: "restaurant-a",
      taskId: "task-1",
      completionResult: nbspResult
    }).completionResult,
    completionResult
  );
  assert.equal(
    restaurantTaskFromPersistedRow(completedRow({ completion_result: nbspResult }))
      .completionResult,
    completionResult
  );
  assert.equal(canonicalRestaurantTasksCompletionResult(internalNbsp), "Counted 18 lb");

  // Unicode em-space trim + \\s collapse invents a clean result; C free-text prep does not.
  assert.equal(emResult.trim().replace(/\s+/g, " "), completionResult);
  assert.notEqual(canonicalRestaurantTasksCompletionResult(emResult), completionResult);
  assert.equal(canonicalRestaurantTasksCompletionResult(emResult), emResult);
  assert.equal(requireCanonicalRestaurantTasksCompletionResult(emResult), emResult);
  assert.equal(normalizeCanonicalRestaurantTasksCompletionResult(emResult), emResult);
  assert.equal(
    normalizeCompleteRestaurantTaskInput({
      restaurantId: "restaurant-a",
      taskId: "task-1",
      completionResult: emResult
    }).completionResult,
    emResult
  );
  assert.equal(
    restaurantTaskFromPersistedRow(completedRow({ completion_result: emResult }))
      .completionResult,
    emResult
  );

  assert.equal(canonicalRestaurantTasksCompletionResult(internalEm), internalEm);
  assert.notEqual(
    canonicalRestaurantTasksCompletionResult(internalEm),
    canonicalRestaurantTasksCompletionResult(completionResult)
  );
  // Prior requiredText collapsed mid-string em-space into ASCII spaces.
  assert.equal(internalEm.trim().replace(/\s+/g, " "), completionResult);
  assert.notEqual(
    requireCanonicalRestaurantTasksCompletionResult(internalEm),
    completionResult
  );

  // Em-space padding around multiline result must not invent equality either.
  assert.equal(emMultiline.trim(), multilineResult);
  assert.notEqual(canonicalRestaurantTasksCompletionResult(emMultiline), multilineResult);
  assert.equal(canonicalRestaurantTasksCompletionResult(emMultiline), emMultiline);
  assert.equal(requireCanonicalRestaurantTasksCompletionResult(emMultiline), emMultiline);

  // Prior requiredText collapsed internal LF into a single space; C prep keeps it.
  assert.equal(multilineResult.trim().replace(/\s+/g, " "), "Counted 18 lb. Variance noted. Photo attached.");
  assert.equal(
    requireCanonicalRestaurantTasksCompletionResult(multilineResult),
    multilineResult
  );
  assert.notEqual(
    requireCanonicalRestaurantTasksCompletionResult(multilineResult),
    multilineResult.trim().replace(/\s+/g, " ")
  );

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(
    canonicalRestaurantTasksCompletionResult("Kelvin count notes"),
    "Kelvin count notes"
  );
  assert.notEqual(
    canonicalRestaurantTasksCompletionResult("Kelvin count notes"),
    canonicalRestaurantTasksCompletionResult("Kelvin count notes")
  );
});

test("restaurant-tasks completionResult require empty/control/over-long fail closed", () => {
  assert.throws(
    () => requireCanonicalRestaurantTasksCompletionResult(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCompletionResult(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCompletionResult(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCompletionResult(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCompletionResult("   "),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCompletionResult("\u00a0\u00a0"),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCompletionResult("\u2003"),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is invalid."
  );

  assert.throws(
    () =>
      normalizeCompleteRestaurantTaskInput({
        restaurantId: "restaurant-a",
        taskId: "task-1",
        completionResult: "   "
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is invalid."
  );

  assert.throws(
    () => requireCanonicalRestaurantTasksCompletionResult("Bad\u0000Result"),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is invalid."
  );
  // VT/FF remain rejected; LF/TAB/CR are allowlisted for multiline free-text.
  assert.throws(
    () => requireCanonicalRestaurantTasksCompletionResult("Counted\u000b18 lb"),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCompletionResult("Counted\u000c18 lb"),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCompletionResult("Counted\u007f18 lb"),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is invalid."
  );
  assert.equal(
    requireCanonicalRestaurantTasksCompletionResult("Counted\t18 lb\nrecorded."),
    "Counted\t18 lb\nrecorded."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksCompletionResult("x".repeat(1001)),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is invalid."
  );
  assert.throws(
    () =>
      normalizeCompleteRestaurantTaskInput({
        restaurantId: "restaurant-a",
        taskId: "task-1",
        completionResult: "Bad\u0000Result"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion result is invalid."
  );
});

test("restaurant-tasks completionResult hydrate soft-empty stays null; unsafe control/over-long fail closed", () => {
  assert.equal(normalizeCanonicalRestaurantTasksCompletionResult(null), null);
  assert.equal(normalizeCanonicalRestaurantTasksCompletionResult(undefined), null);
  assert.equal(normalizeCanonicalRestaurantTasksCompletionResult(""), null);
  assert.equal(normalizeCanonicalRestaurantTasksCompletionResult("   "), null);
  assert.equal(normalizeCanonicalRestaurantTasksCompletionResult("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalRestaurantTasksCompletionResult("\u2003"), null);
  assert.equal(normalizeCanonicalRestaurantTasksCompletionResult("\n\t\r"), null);

  assert.equal(
    restaurantTaskFromPersistedRow({
      ...baseRow,
      completion_result: null
    }).completionResult,
    null
  );

  assert.throws(
    () => normalizeCanonicalRestaurantTasksCompletionResult(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completion result is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksCompletionResult("Bad\u0000Result"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completion result is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksCompletionResult("Counted\u000b18 lb"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completion result is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksCompletionResult("Counted\u000c18 lb"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completion result is invalid."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksCompletionResult("Counted\u007f18 lb"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completion result is invalid."
  );
  assert.equal(
    normalizeCanonicalRestaurantTasksCompletionResult("Counted\t18 lb\nrecorded."),
    "Counted\t18 lb\nrecorded."
  );
  assert.throws(
    () => normalizeCanonicalRestaurantTasksCompletionResult("x".repeat(1001)),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completion result is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow(
        completedRow({ completion_result: "x".repeat(1001) })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Task completion result is invalid."
  );
});

test("sibling detail NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspDetail = `\u00a0${detail}\u00a0`;
  assert.equal(nbspDetail.trim(), detail);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title,
    detail: nbspDetail
  });
  assert.equal(created.detail, detail);
  assert.equal(created.title, title);
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
});

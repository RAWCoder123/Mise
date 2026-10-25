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
  asciiTrimRestaurantTasksEvidenceTypeToken,
  canonicalizeRestaurantTasksEvidenceType,
  requireCanonicalRestaurantTasksEvidenceType
} from "../services/domain/restaurantTasksEvidenceTypeIdentity";
import { RESTAURANT_TASK_EVIDENCE_TYPE_MAX_CHARACTERS } from "../services/domain/securityLimits";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksEvidenceTypeIdentity.ts", import.meta.url),
  "utf8"
);
const tasksSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);
const limitsSource = readFileSync(
  new URL("../services/domain/securityLimits.ts", import.meta.url),
  "utf8"
);

const evidenceType = "count";
const clientTaskId = "client-task-1";
const sourceReference = "inventory-risk:item-1";
const relatedSupplierName = "Regional Protein Co";

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
  related_supplier_name: relatedSupplierName,
  source_reference: sourceReference,
  created_by: "manager-1",
  client_task_id: clientTaskId,
  correlation_id: "correlation-1",
  created_at: "2026-08-02T19:00:00.000Z",
  updated_at: "2026-08-02T19:00:00.000Z"
};

test("MISE-005PV pins restaurant-tasks evidence type to ASCII C", () => {
  assert.match(identitySource, /MISE-005PV/);
  assert.match(tasksSource, /MISE-005PV/);
  assert.match(
    limitsSource,
    /export const RESTAURANT_TASK_EVIDENCE_TYPE_MAX_CHARACTERS = 80;/
  );
  assert.equal(RESTAURANT_TASK_EVIDENCE_TYPE_MAX_CHARACTERS, 80);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksEvidenceTypeToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    tasksSource,
    /requireCanonicalRestaurantTasksEvidenceType\(record\.type, label\)/
  );
  assert.match(
    tasksSource,
    /from "\.\/restaurantTasksEvidenceTypeIdentity"/
  );

  // Soft-empty type → label fallback and label emptiness stay on Unicode trim.
  assert.match(
    tasksSource,
    /typeof record\.type !== "string" \|\| !record\.type\.trim\(\)/
  );
  assert.match(
    tasksSource,
    /const labelValue = typeof record\.label === "string" \? record\.label\.trim\(\) : "";/
  );
  assert.match(tasksSource, /record\.type = "checklist_item";/);

  // Leave sibling requiredText / optionalText surfaces on Unicode trim.
  assert.match(
    tasksSource,
    /sourceReference: optionalText\(input\.sourceReference, 240, "Task source reference"\)/
  );
  assert.match(
    tasksSource,
    /relatedSupplierName: optionalText\(input\.relatedSupplierName, 200, "Related supplier"\)/
  );
  assert.match(
    tasksSource,
    /const title = requiredText\(input\.title, 160, "Task title"\);/
  );
  assert.match(
    tasksSource,
    /const detail = optionalText\(input\.detail, 2000, "Task detail"\);/
  );
  assert.match(
    tasksSource,
    /completionResult: requiredText\(input\.completionResult, 1000, "Completion result"\)/
  );

  // Do not rewrite sibling tips or finding-decision evidence type.
  assert.doesNotMatch(identitySource, /restaurantTasksSourceReferenceIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksTitleIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksDetailIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCompletionResultIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionEvidenceTypeIdentity/);
  assert.doesNotMatch(tasksSource, /restaurantTasksSourceReferenceIdentity/);
  assert.doesNotMatch(tasksSource, /operationalFindingDecisionEvidenceTypeIdentity/);
});

test("ASCII trim keeps ordinary restaurant-tasks evidence type padding stable", () => {
  assert.equal(
    asciiTrimRestaurantTasksEvidenceTypeToken(`  ${evidenceType}  `),
    evidenceType
  );
  assert.equal(
    canonicalizeRestaurantTasksEvidenceType(`\t${evidenceType}\n`),
    evidenceType
  );
  assert.equal(
    requireCanonicalRestaurantTasksEvidenceType(`  ${evidenceType}  `, "Task checklist"),
    evidenceType
  );

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    checklist: [{ type: `  ${evidenceType}  `, quantity: 18 }]
  });
  assert.equal(created.checklist[0]?.type, evidenceType);

  const completed = normalizeCompleteRestaurantTaskInput({
    restaurantId: "restaurant-a",
    taskId: "task-1",
    completionResult: "Counted 18 lb",
    completionEvidence: [{ type: `  ${evidenceType}  `, quantity: 18 }]
  });
  assert.equal(completed.completionEvidence[0]?.type, evidenceType);

  const hydrated = restaurantTaskFromPersistedRow({
    ...baseRow,
    checklist: [{ type: `  ${evidenceType}  `, quantity: 18 }],
    status: "completed",
    completion_result: "Counted 18 lb",
    completion_evidence: [{ type: `  ${evidenceType}  `, quantity: 18 }],
    completed_at: "2026-08-02T19:12:00.000Z",
    completed_by: "staff-1"
  });
  assert.equal(hydrated.checklist[0]?.type, evidenceType);
  assert.equal(hydrated.completionEvidence[0]?.type, evidenceType);
});

test("Unicode end padding does not invent a restaurant-tasks evidence type", () => {
  const nbspType = `\u00a0${evidenceType}\u00a0`;
  const emType = `\u2003photo\u2003`;

  // Unicode trim invents an exact match against the unpadded evidence type.
  assert.equal(nbspType.trim(), evidenceType);
  assert.equal(emType.trim(), "photo");
  assert.notEqual(asciiTrimRestaurantTasksEvidenceTypeToken(nbspType), evidenceType);
  assert.equal(canonicalizeRestaurantTasksEvidenceType(nbspType), null);
  assert.equal(canonicalizeRestaurantTasksEvidenceType(emType), null);

  assert.throws(
    () => requireCanonicalRestaurantTasksEvidenceType(nbspType, "Task checklist"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task checklist type is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksEvidenceType(emType, "Completion evidence"),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion evidence type is invalid."
  );

  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        checklist: [{ type: nbspType, quantity: 18 }]
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task checklist type is invalid."
  );
  assert.throws(
    () =>
      normalizeCompleteRestaurantTaskInput({
        restaurantId: "restaurant-a",
        taskId: "task-1",
        completionResult: "Counted 18 lb",
        completionEvidence: [{ type: emType }]
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion evidence type is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        checklist: [{ type: nbspType }]
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task checklist type is invalid."
  );
  assert.throws(
    () =>
      restaurantTaskFromPersistedRow({
        ...baseRow,
        status: "completed",
        completion_result: "Counted 18 lb",
        completion_evidence: [{ type: emType }],
        completed_at: "2026-08-02T19:12:00.000Z",
        completed_by: "staff-1"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Completion evidence type is invalid."
  );
});

test("Soft-empty evidence type keeps label fallback; invalid tokens fail closed", () => {
  assert.equal(canonicalizeRestaurantTasksEvidenceType(""), null);
  assert.equal(canonicalizeRestaurantTasksEvidenceType("   "), null);
  assert.equal(canonicalizeRestaurantTasksEvidenceType("\u00a0\u00a0"), null);
  assert.equal(canonicalizeRestaurantTasksEvidenceType("a\u0000b"), null);
  assert.equal(
    canonicalizeRestaurantTasksEvidenceType("x".repeat(RESTAURANT_TASK_EVIDENCE_TYPE_MAX_CHARACTERS + 1)),
    null
  );

  const labelOnly = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    checklist: [{ label: "Record physical count" }]
  });
  assert.equal(labelOnly.checklist[0]?.type, "checklist_item");

  const softEmptyType = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    checklist: [{ type: "\u00a0\u00a0", label: "Record physical count" }]
  });
  assert.equal(softEmptyType.checklist[0]?.type, "checklist_item");

  assert.throws(
    () => requireCanonicalRestaurantTasksEvidenceType(null, "Task checklist"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task checklist type is invalid."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksEvidenceType(12, "Task checklist"),
    (error: unknown) =>
      error instanceof Error && error.message === "Task checklist type is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        checklist: [{ type: "count\u0000x" }]
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task checklist type is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        checklist: [{ type: "x".repeat(RESTAURANT_TASK_EVIDENCE_TYPE_MAX_CHARACTERS + 1) }]
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Task checklist type is invalid."
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        restaurantId: "restaurant-a",
        clientTaskId,
        title: "Confirm chicken count",
        checklist: [{}]
      }),
    /entries require a type or label/i
  );
});

test("sibling sourceReference NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspReference = `\u00a0${sourceReference}\u00a0`;
  assert.equal(nbspReference.trim(), sourceReference);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    sourceReference: nbspReference,
    checklist: [{ type: evidenceType }]
  });
  assert.equal(created.sourceReference, sourceReference);
  assert.equal(created.checklist[0]?.type, evidenceType);
});

test("sibling relatedSupplierName NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspSupplier = `\u00a0${relatedSupplierName}\u00a0`;
  assert.equal(nbspSupplier.trim(), relatedSupplierName);

  const created = normalizeCreateRestaurantTaskInput({
    restaurantId: "restaurant-a",
    clientTaskId,
    title: "Confirm chicken count",
    relatedSupplierName: nbspSupplier,
    checklist: [{ type: evidenceType }]
  });
  assert.equal(created.relatedSupplierName, relatedSupplierName);
  assert.equal(created.checklist[0]?.type, evidenceType);
});

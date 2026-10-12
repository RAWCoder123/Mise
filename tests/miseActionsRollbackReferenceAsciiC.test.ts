import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createPreparedAction,
  markApproved,
  markExecuted,
  markReversed
} from "../services/domain/miseActions";
import {
  asciiTrimMiseActionsRollbackReferenceToken,
  canonicalizeMiseActionsRollbackReference,
  requireCanonicalMiseActionsRollbackReference
} from "../services/domain/miseActionsRollbackReferenceIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/miseActionsRollbackReferenceIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/miseActions.ts", import.meta.url),
  "utf8"
);

const restaurantId = "restaurant-a";
const approvedBy = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const rollback = "rollback_1";

function executedAction() {
  const prepared = createPreparedAction({
    restaurantId,
    actionType: "send_supplier_order",
    idempotencyKey: "send:order-1",
    now: "2026-10-12T00:00:00.000Z"
  });
  const approved = markApproved(prepared, approvedBy, "2026-10-12T00:05:00.000Z");
  return markExecuted(approved, { ok: true }, "2026-10-12T00:06:00.000Z");
}

test("MISE-005NS pins Mise-actions rollbackReference to ASCII C", () => {
  assert.match(identitySource, /MISE-005NS/);
  assert.match(domainSource, /MISE-005NS/);

  assert.match(
    identitySource,
    /export function asciiTrimMiseActionsRollbackReferenceToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /rollbackReference: requireCanonicalMiseActionsRollbackReference\(rollbackReference\)/
  );
  assert.match(domainSource, /from "\.\/miseActionsRollbackReferenceIdentity"/);

  // Leave restaurant workspace and domain object identities on Unicode trim /
  // prior tips.
  assert.match(
    domainSource,
    /return `\$\{restaurantId\.trim\(\)\}:\$\{actionType\}:\$\{subjectId\.trim\(\)\}`;/
  );
  assert.match(
    domainSource,
    /const restaurantId = input\.restaurantId\.trim\(\);\s*if \(!restaurantId\) throw new Error\("Mise actions require a restaurant id\."\);/
  );
  assert.match(domainSource, /idempotencyKey: input\.idempotencyKey\.trim\(\),/);
  assert.match(domainSource, /if \(!input\.actionId\.trim\(\)\) throw new Error\("Outcomes require an action id\."\);/);
  assert.match(domainSource, /restaurantId: row\.restaurant_id\.trim\(\),/);

  // Leave sibling free-text / approvedBy on Unicode trim until their tips land.
  assert.match(domainSource, /error: error\.trim\(\) \|\| "Action failed\.",/);
  assert.match(domainSource, /approvedBy: approvedBy\.trim\(\) \|\| null/);
  assert.match(domainSource, /approvedBy: approvedBy\?\.trim\(\) \|\| action\.approvedBy/);
  assert.match(domainSource, /lesson: input\.lesson\?\.trim\(\) \|\| null/);

  // Do not rewrite sibling tips.
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsDomainObjectIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionResponseActorIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsDomainObjectIdentity/);
  assert.doesNotMatch(domainSource, /operationalFindingDecisionResponseActorIdentity/);
});

test("ASCII trim keeps ordinary Mise-actions rollbackReference padding stable", () => {
  assert.equal(asciiTrimMiseActionsRollbackReferenceToken(`  ${rollback}  `), rollback);
  assert.equal(canonicalizeMiseActionsRollbackReference(`\t${rollback}\n`), rollback);
  assert.equal(requireCanonicalMiseActionsRollbackReference(`  ${rollback}  `), rollback);

  const reversed = markReversed(executedAction(), `  ${rollback}  `, "2026-10-12T00:10:00.000Z");
  assert.equal(reversed.rollbackReference, rollback);
  assert.equal(reversed.status, "reversed");
});

test("NBSP and em-space padding cannot invent Mise-actions rollbackReference", () => {
  const nbspRollback = `\u00a0${rollback}\u00a0`;
  const emRollback = `\u2003${rollback}\u2003`;

  assert.equal(nbspRollback.trim(), rollback);
  assert.equal(emRollback.trim(), rollback);

  assert.equal(canonicalizeMiseActionsRollbackReference(nbspRollback), null);
  assert.equal(canonicalizeMiseActionsRollbackReference(emRollback), null);

  assert.throws(
    () => requireCanonicalMiseActionsRollbackReference(nbspRollback),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action rollbackReference is invalid."
  );
  assert.throws(
    () => requireCanonicalMiseActionsRollbackReference(emRollback),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action rollbackReference is invalid."
  );

  assert.throws(
    () => markReversed(executedAction(), nbspRollback, "2026-10-12T00:10:00.000Z"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action rollbackReference is invalid."
  );
  assert.throws(
    () => markReversed(executedAction(), emRollback, "2026-10-12T00:10:00.000Z"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action rollbackReference is invalid."
  );
});

test("sibling approvedBy NBSP padding still invents under Unicode trim until #800 lands", () => {
  const nbspApprover = `\u00a0${approvedBy}\u00a0`;
  assert.equal(nbspApprover.trim(), approvedBy);

  const prepared = createPreparedAction({
    restaurantId,
    actionType: "send_supplier_order",
    idempotencyKey: "send:order-2",
    now: "2026-10-12T00:00:00.000Z"
  });
  const approved = markApproved(prepared, nbspApprover, "2026-10-12T00:05:00.000Z");
  assert.equal(approved.approvedBy, approvedBy);
});

test("sibling idempotencyKey NBSP padding still invents under Unicode trim until #772 lands", () => {
  const key = "send:order-3";
  const nbspKey = `\u00a0${key}\u00a0`;
  assert.equal(nbspKey.trim(), key);

  const action = createPreparedAction({
    restaurantId,
    actionType: "create_internal_task",
    idempotencyKey: nbspKey,
    now: "2026-10-12T00:00:00.000Z"
  });
  assert.equal(action.idempotencyKey, key);
});

test("over-long, empty, control, and non-string rollbackReference values fail closed", () => {
  assert.equal(canonicalizeMiseActionsRollbackReference(""), null);
  assert.equal(canonicalizeMiseActionsRollbackReference("   "), null);
  assert.equal(canonicalizeMiseActionsRollbackReference("r".repeat(241)), null);
  assert.equal(canonicalizeMiseActionsRollbackReference("rollback-\u0000ref"), null);

  assert.throws(
    () => requireCanonicalMiseActionsRollbackReference(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action rollbackReference is invalid."
  );
  assert.throws(
    () => requireCanonicalMiseActionsRollbackReference(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action rollbackReference is invalid."
  );
  assert.throws(
    () => requireCanonicalMiseActionsRollbackReference("   "),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action rollbackReference is invalid."
  );
  assert.throws(
    () => requireCanonicalMiseActionsRollbackReference("r".repeat(241)),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action rollbackReference is invalid."
  );
  assert.throws(
    () => markReversed(executedAction(), "   ", "2026-10-12T00:10:00.000Z"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action rollbackReference is invalid."
  );
});

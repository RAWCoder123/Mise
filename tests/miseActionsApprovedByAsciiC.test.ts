import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createPreparedAction,
  markApproved,
  markExecuted,
  markRejected,
  markReversed
} from "../services/domain/miseActions";
import {
  asciiTrimMiseActionsApprovedByToken,
  canonicalizeMiseActionsApprovedBy,
  normalizeCanonicalMiseActionsApprovedBy
} from "../services/domain/miseActionsApprovedByIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/miseActionsApprovedByIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/miseActions.ts", import.meta.url),
  "utf8"
);

const restaurantId = "restaurant-a";
const approvedBy = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function preparedAction() {
  return createPreparedAction({
    restaurantId,
    actionType: "send_supplier_order",
    idempotencyKey: "send:order-1",
    now: "2026-10-11T12:00:00.000Z"
  });
}

test("MISE-005NR pins Mise-actions approvedBy to ASCII C", () => {
  assert.match(identitySource, /MISE-005NR/);
  assert.match(domainSource, /MISE-005NR/);

  assert.match(
    identitySource,
    /export function asciiTrimMiseActionsApprovedByToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /approvedBy: normalizeCanonicalMiseActionsApprovedBy\(approvedBy\)/
  );
  assert.match(
    domainSource,
    /normalizeCanonicalMiseActionsApprovedBy\(approvedBy\) \|\| action\.approvedBy/
  );
  assert.match(domainSource, /from "\.\/miseActionsApprovedByIdentity"/);

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

  // Leave sibling free-text / reference fields on Unicode trim.
  assert.match(domainSource, /error: error\.trim\(\) \|\| "Action failed\.",/);
  assert.match(domainSource, /rollbackReference: rollbackReference\.trim\(\)/);
  assert.match(domainSource, /lesson: input\.lesson\?\.trim\(\) \|\| null/);

  // Do not rewrite sibling tips.
  assert.doesNotMatch(identitySource, /miseActionsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsDomainObjectIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionResponseActorIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsDomainObjectIdentity/);
  assert.doesNotMatch(domainSource, /operationalFindingDecisionResponseActorIdentity/);
});

test("ASCII trim keeps ordinary Mise-actions approvedBy padding stable", () => {
  assert.equal(asciiTrimMiseActionsApprovedByToken(`  ${approvedBy}  `), approvedBy);
  assert.equal(canonicalizeMiseActionsApprovedBy(`\t${approvedBy}\n`), approvedBy);
  assert.equal(normalizeCanonicalMiseActionsApprovedBy(`  ${approvedBy}  `), approvedBy);

  const approved = markApproved(preparedAction(), `  ${approvedBy}  `, "2026-10-11T12:05:00.000Z");
  assert.equal(approved.approvedBy, approvedBy);

  const rejected = markRejected(preparedAction(), `  ${approvedBy}  `, "2026-10-11T12:05:00.000Z");
  assert.equal(rejected.approvedBy, approvedBy);
});

test("soft-empty approvedBy remains null on approve and falls back on reject", () => {
  assert.equal(normalizeCanonicalMiseActionsApprovedBy("   "), null);
  assert.equal(normalizeCanonicalMiseActionsApprovedBy("\t\n"), null);

  const approved = markApproved(preparedAction(), "   ", "2026-10-11T12:05:00.000Z");
  assert.equal(approved.approvedBy, null);

  const prior = markApproved(preparedAction(), approvedBy, "2026-10-11T12:05:00.000Z");
  // Re-create waiting action then reject with empty approver — falls back.
  const waiting = preparedAction();
  const rejectedNull = markRejected(waiting, null, "2026-10-11T12:06:00.000Z");
  assert.equal(rejectedNull.approvedBy, null);

  const rejectedEmpty = markRejected(waiting, "   ", "2026-10-11T12:06:00.000Z");
  assert.equal(rejectedEmpty.approvedBy, waiting.approvedBy);

  assert.equal(prior.approvedBy, approvedBy);
});

test("NBSP and em-space padding cannot invent Mise-actions approvedBy", () => {
  const nbspApprover = `\u00a0${approvedBy}\u00a0`;
  const emApprover = `\u2003${approvedBy}\u2003`;

  assert.equal(nbspApprover.trim(), approvedBy);
  assert.equal(emApprover.trim(), approvedBy);

  assert.equal(canonicalizeMiseActionsApprovedBy(nbspApprover), null);
  assert.equal(canonicalizeMiseActionsApprovedBy(emApprover), null);

  assert.throws(
    () => normalizeCanonicalMiseActionsApprovedBy(nbspApprover),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action approvedBy is invalid."
  );
  assert.throws(
    () => normalizeCanonicalMiseActionsApprovedBy(emApprover),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action approvedBy is invalid."
  );

  assert.throws(
    () => markApproved(preparedAction(), nbspApprover, "2026-10-11T12:05:00.000Z"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action approvedBy is invalid."
  );
  assert.throws(
    () => markApproved(preparedAction(), emApprover, "2026-10-11T12:05:00.000Z"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action approvedBy is invalid."
  );
  assert.throws(
    () => markRejected(preparedAction(), nbspApprover, "2026-10-11T12:05:00.000Z"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action approvedBy is invalid."
  );
  assert.throws(
    () => markRejected(preparedAction(), emApprover, "2026-10-11T12:05:00.000Z"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action approvedBy is invalid."
  );
});

test("sibling rollbackReference NBSP padding still invents under Unicode trim until tipped", () => {
  const action = preparedAction();
  const approved = markApproved(action, approvedBy, "2026-10-11T12:05:00.000Z");
  const executed = markExecuted(approved, { ok: true }, "2026-10-11T12:06:00.000Z");
  const rollback = "rollback_1";
  const nbspRollback = `\u00a0${rollback}\u00a0`;
  assert.equal(nbspRollback.trim(), rollback);

  const reversed = markReversed(executed, nbspRollback, "2026-10-11T13:00:00.000Z");
  assert.equal(reversed.rollbackReference, rollback);
});

test("sibling idempotencyKey NBSP padding still invents under Unicode trim until #772 lands", () => {
  const key = "send:order-1";
  const nbspKey = `\u00a0${key}\u00a0`;
  assert.equal(nbspKey.trim(), key);

  const action = createPreparedAction({
    restaurantId,
    actionType: "create_internal_task",
    idempotencyKey: nbspKey,
    now: "2026-10-11T12:00:00.000Z"
  });
  assert.equal(action.idempotencyKey, key);
});

test("over-long, empty, control, and non-string approvedBy values fail closed", () => {
  assert.equal(canonicalizeMiseActionsApprovedBy(""), null);
  assert.equal(canonicalizeMiseActionsApprovedBy("   "), null);
  assert.equal(canonicalizeMiseActionsApprovedBy("a".repeat(65)), null);
  assert.equal(canonicalizeMiseActionsApprovedBy("approver-\u0000user"), null);

  assert.throws(
    () => normalizeCanonicalMiseActionsApprovedBy(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action approvedBy is invalid."
  );
  assert.throws(
    () => normalizeCanonicalMiseActionsApprovedBy(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action approvedBy is invalid."
  );
  assert.throws(
    () => normalizeCanonicalMiseActionsApprovedBy("a".repeat(65)),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action approvedBy is invalid."
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createPreparedAction,
  measureOutcome,
  miseActionIdempotencyKey
} from "../services/domain/miseActions";
import {
  asciiTrimMiseActionsDomainObjectToken,
  canonicalizeMiseActionsDomainObjectId,
  requireCanonicalMiseActionsDomainObjectId
} from "../services/domain/miseActionsDomainObjectIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/miseActionsDomainObjectIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/miseActions.ts", import.meta.url),
  "utf8"
);

const subjectId = "order_1";
const idempotencyKey = "task:count-cabbage";
const actionId = "action_1";
const restaurantId = "restaurant-a";

test("MISE-005MP pins Mise-actions domain subjectId/idempotencyKey/actionId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MP/);
  assert.match(domainSource, /MISE-005MP/);

  assert.match(
    identitySource,
    /export function asciiTrimMiseActionsDomainObjectToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /requireCanonicalMiseActionsDomainObjectId\(subjectId, "subject id"\)/
  );
  assert.match(
    domainSource,
    /requireCanonicalMiseActionsDomainObjectId\(\s*input\.idempotencyKey,\s*"idempotency key"\s*\)/
  );
  assert.match(
    domainSource,
    /requireCanonicalMiseActionsDomainObjectId\(input\.actionId, "action id"\)/
  );
  assert.match(domainSource, /from "\.\/miseActionsDomainObjectIdentity"/);

  // Leave restaurant workspace on Unicode trim.
  assert.match(
    domainSource,
    /return `\$\{restaurantId\.trim\(\)\}:\$\{actionType\}:\$\{canonicalSubjectId\}`;/
  );
  assert.match(
    domainSource,
    /const restaurantId = input\.restaurantId\.trim\(\);\s*if \(!restaurantId\) throw new Error\("Mise actions require a restaurant id\."\);/
  );
  assert.match(
    domainSource,
    /const restaurantId = input\.restaurantId\.trim\(\);\s*if \(!restaurantId\) throw new Error\("Outcomes require a restaurant id\."\);/
  );
  assert.match(domainSource, /restaurantId: row\.restaurant_id\.trim\(\),/);

  // Leave operator free-text and application object tip alone.
  assert.match(domainSource, /approvedBy: approvedBy\.trim\(\) \|\| null/);
  assert.match(domainSource, /error: error\.trim\(\) \|\| "Action failed\.",/);
  assert.match(domainSource, /rollbackReference: rollbackReference\.trim\(\)/);
  assert.match(domainSource, /lesson: input\.lesson\?\.trim\(\) \|\| null/);
  assert.doesNotMatch(domainSource, /miseActionsObjectIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/miseActionsObjectIdentity"/);
  assert.doesNotMatch(identitySource, /requireCanonicalMiseActionsObjectId/);
  assert.doesNotMatch(identitySource, /MiseActionsObjectLabel/);
  assert.doesNotMatch(identitySource, /asciiTrimMiseActionsObjectToken/);

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /inventoryLedgerObjectIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountItemIdentity/);
  assert.doesNotMatch(identitySource, /inventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesObjectIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesSupplierOrderIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesClientDeliveryIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLinesObjectIdentity/);
  assert.doesNotMatch(identitySource, /orderAutomation/);
  assert.doesNotMatch(identitySource, /supplierDelivery/);
});

test("ASCII trim keeps ordinary Mise-actions domain object padding stable", () => {
  assert.equal(asciiTrimMiseActionsDomainObjectToken(`  ${subjectId}  `), subjectId);
  assert.equal(canonicalizeMiseActionsDomainObjectId(`\t${subjectId}\n`), subjectId);

  assert.equal(asciiTrimMiseActionsDomainObjectToken(`  ${idempotencyKey}  `), idempotencyKey);
  assert.equal(canonicalizeMiseActionsDomainObjectId(`\t${idempotencyKey}\n`), idempotencyKey);

  assert.equal(asciiTrimMiseActionsDomainObjectToken(`  ${actionId}  `), actionId);
  assert.equal(canonicalizeMiseActionsDomainObjectId(`\t${actionId}\n`), actionId);

  assert.equal(
    miseActionIdempotencyKey(restaurantId, "send_supplier_order", `  ${subjectId}  `),
    `${restaurantId}:send_supplier_order:${subjectId}`
  );

  const prepared = createPreparedAction({
    restaurantId,
    actionType: "create_internal_task",
    idempotencyKey: `  ${idempotencyKey}  `
  });
  assert.equal(prepared.idempotencyKey, idempotencyKey);

  const outcome = measureOutcome({
    restaurantId,
    actionId: `  ${actionId}  `,
    expectedResult: { count: 1 },
    actualResult: { count: 1 }
  });
  assert.equal(outcome.actionId, actionId);
});

test("ASCII Mise-actions domain trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedSubject = `\u00a0${subjectId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded subject id.
  assert.equal(nbspPaddedSubject.trim(), subjectId);
  assert.notEqual(asciiTrimMiseActionsDomainObjectToken(nbspPaddedSubject), subjectId);
  assert.equal(canonicalizeMiseActionsDomainObjectId(nbspPaddedSubject), null);
  assert.throws(
    () => miseActionIdempotencyKey(restaurantId, "send_supplier_order", nbspPaddedSubject),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise actions require a subject id."
  );

  const emSpacePaddedKey = `\u2003${idempotencyKey}\u2003`;
  assert.equal(emSpacePaddedKey.trim(), idempotencyKey);
  assert.equal(canonicalizeMiseActionsDomainObjectId(emSpacePaddedKey), null);
  assert.throws(
    () =>
      createPreparedAction({
        restaurantId,
        actionType: "create_internal_task",
        idempotencyKey: emSpacePaddedKey
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise actions require an idempotency key."
  );

  const emSpacePaddedAction = `\u2003${actionId}\u2003`;
  assert.equal(emSpacePaddedAction.trim(), actionId);
  assert.equal(canonicalizeMiseActionsDomainObjectId(emSpacePaddedAction), null);
  assert.throws(
    () =>
      measureOutcome({
        restaurantId,
        actionId: emSpacePaddedAction,
        expectedResult: { count: 1 },
        actualResult: { count: 1 }
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Outcomes require an action id."
  );
});

test("Mise-actions domain object identities reject empty and control-bearing tokens", () => {
  assert.equal(canonicalizeMiseActionsDomainObjectId(""), null);
  assert.equal(canonicalizeMiseActionsDomainObjectId("   "), null);
  assert.equal(canonicalizeMiseActionsDomainObjectId("a".repeat(129)), null);
  assert.equal(canonicalizeMiseActionsDomainObjectId("bad\u0000id"), null);

  assert.throws(
    () => requireCanonicalMiseActionsDomainObjectId("", "subject id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise actions require a subject id."
  );
  assert.throws(
    () => requireCanonicalMiseActionsDomainObjectId("bad\u0000key", "idempotency key"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise actions require an idempotency key."
  );
  assert.throws(
    () => requireCanonicalMiseActionsDomainObjectId(null, "action id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Outcomes require an action id."
  );

  assert.throws(
    () => miseActionIdempotencyKey(restaurantId, "send_supplier_order", ""),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise actions require a subject id."
  );
  assert.throws(
    () =>
      createPreparedAction({
        restaurantId,
        actionType: "create_internal_task",
        idempotencyKey: ""
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise actions require an idempotency key."
  );
  assert.throws(
    () =>
      measureOutcome({
        restaurantId,
        actionId: "",
        expectedResult: { count: 1 },
        actualResult: { count: 1 }
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Outcomes require an action id."
  );
});

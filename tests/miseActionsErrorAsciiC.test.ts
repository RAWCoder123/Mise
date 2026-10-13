import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createPreparedAction,
  markFailed,
  measureOutcome,
  miseActionFromPersistedRow
} from "../services/domain/miseActions";
import {
  canonicalMiseActionsError,
  normalizeCanonicalMiseActionsError
} from "../services/domain/miseActionsErrorIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/miseActionsErrorIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/miseActions.ts", import.meta.url),
  "utf8"
);

const restaurantId = "rest_actions_error";
const errorMessage = "Provider unavailable";
const multilineError =
  "Provider unavailable.\nRetry after reconnect.\nTicket #1842 attached.";
const accentedError = "Proveedor no disponible durante el servicio.";

function preparedAction() {
  return createPreparedAction({
    restaurantId,
    actionType: "send_supplier_communication",
    idempotencyKey: "comm:error-ascii-c",
    now: "2026-08-02T12:00:00.000Z"
  });
}

test("MISE-005OT pins mise-actions error free-text to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005OT/);
  assert.match(domainSource, /MISE-005OT/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalMiseActionsError("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.doesNotMatch(canonicalBody, /\.replace\(C_WHITESPACE/);

  assert.match(domainSource, /normalizeCanonicalMiseActionsError\(error\)/);
  assert.match(domainSource, /from "\.\/miseActionsErrorIdentity"/);

  // Leave sibling lesson free-text on Unicode trim until tipped.
  assert.match(domainSource, /lesson: input\.lesson\?\.trim\(\) \|\| null/);
  // Leave hydrate error_message pass-through alone.
  assert.match(domainSource, /error: row\.error_message \?\? null/);
  // Leave requestedBy pass-through alone (proved non-inventing).
  assert.match(domainSource, /requestedBy: input\.requestedBy \?\? null/);

  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsRollbackReferenceIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsLessonIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCompletionResultIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
  assert.doesNotMatch(domainSource, /miseActionsLessonIdentity/);
  assert.doesNotMatch(domainSource, /inventoryCountLineNoteIdentity/);
});

test("ASCII C multiline prep keeps ordinary mise-actions errors stable", () => {
  assert.equal(canonicalMiseActionsError(`  ${errorMessage}  `), errorMessage);
  assert.equal(canonicalMiseActionsError(`\t${errorMessage}\n`), errorMessage);
  assert.equal(normalizeCanonicalMiseActionsError(`  ${errorMessage}  `), errorMessage);
  assert.equal(canonicalMiseActionsError(accentedError), accentedError);
  assert.equal(normalizeCanonicalMiseActionsError(accentedError), accentedError);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalMiseActionsError(multilineError), multilineError);
  assert.equal(normalizeCanonicalMiseActionsError(multilineError), multilineError);

  const failed = markFailed(preparedAction(), `  ${errorMessage}  `);
  assert.equal(failed.error, errorMessage);

  const failedMultiline = markFailed(preparedAction(), multilineError);
  assert.equal(failedMultiline.error, multilineError);
});

test("NBSP folds and em-space padding cannot invent mise-actions errors", () => {
  const nbspError = `\u00a0${errorMessage}\u00a0`;
  const emError = `\u2003${errorMessage}\u2003`;
  const internalEm = `Provider\u2003unavailable`;
  const internalNbsp = `Provider\u00a0unavailable`;
  const emMultiline = `\u2003${multilineError}\u2003`;

  // Pasted NBSP is folded like MISE-005B / #821 / #823 / #824 / #827 free-text prep.
  assert.equal(nbspError.trim(), errorMessage);
  assert.equal(canonicalMiseActionsError(nbspError), errorMessage);
  assert.equal(normalizeCanonicalMiseActionsError(nbspError), errorMessage);
  assert.equal(canonicalMiseActionsError(internalNbsp), "Provider unavailable");

  const nbspFailed = markFailed(preparedAction(), nbspError);
  assert.equal(nbspFailed.error, errorMessage);

  // Unicode em-space trim invents a clean error; C free-text prep does not.
  assert.equal(emError.trim(), errorMessage);
  assert.notEqual(canonicalMiseActionsError(emError), errorMessage);
  assert.equal(canonicalMiseActionsError(emError), emError);
  assert.equal(normalizeCanonicalMiseActionsError(emError), emError);

  const emFailed = markFailed(preparedAction(), emError);
  assert.equal(emFailed.error, emError);
  assert.notEqual(emFailed.error, errorMessage);

  assert.equal(canonicalMiseActionsError(internalEm), internalEm);
  assert.notEqual(
    canonicalMiseActionsError(internalEm),
    canonicalMiseActionsError(errorMessage)
  );

  assert.equal(emMultiline.trim(), multilineError);
  assert.notEqual(canonicalMiseActionsError(emMultiline), multilineError);
  assert.equal(canonicalMiseActionsError(emMultiline), emMultiline);
  assert.equal(normalizeCanonicalMiseActionsError(emMultiline), emMultiline);

  const emMultilineFailed = markFailed(preparedAction(), emMultiline);
  assert.equal(emMultilineFailed.error, emMultiline);

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(canonicalMiseActionsError("Kelvin provider failure"), "Kelvin provider failure");
  assert.notEqual(
    canonicalMiseActionsError("Kelvin provider failure"),
    canonicalMiseActionsError("Kelvin provider failure")
  );
});

test("mise-actions errors soft-empty default; unsafe control/over-long fail closed", () => {
  assert.equal(normalizeCanonicalMiseActionsError(""), "Action failed.");
  assert.equal(normalizeCanonicalMiseActionsError("   "), "Action failed.");
  assert.equal(normalizeCanonicalMiseActionsError("\u00a0\u00a0"), "Action failed.");
  assert.equal(normalizeCanonicalMiseActionsError("\u2003"), "Action failed.");
  assert.equal(normalizeCanonicalMiseActionsError("\n\t\r"), "Action failed.");

  const softFailed = markFailed(preparedAction(), "   ");
  assert.equal(softFailed.error, "Action failed.");
  const emSoftFailed = markFailed(preparedAction(), "\u2003");
  assert.equal(emSoftFailed.error, "Action failed.");

  assert.throws(
    () => normalizeCanonicalMiseActionsError(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action error must be text."
  );
  assert.throws(
    () => normalizeCanonicalMiseActionsError("Bad\u0000Error"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action error must be text."
  );
  assert.throws(
    () => normalizeCanonicalMiseActionsError("Bad\u000bError"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action error must be text."
  );
  assert.throws(
    () => normalizeCanonicalMiseActionsError("Bad\u000cError"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action error must be text."
  );
  assert.throws(
    () => normalizeCanonicalMiseActionsError("Bad\u007fError"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action error must be text."
  );
  assert.equal(
    normalizeCanonicalMiseActionsError("Provider\tunavailable\nretry."),
    "Provider\tunavailable\nretry."
  );

  assert.throws(
    () => normalizeCanonicalMiseActionsError("x".repeat(1001)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Mise action error is outside supported limits."
  );
  assert.throws(
    () => markFailed(preparedAction(), "Bad\u0000Error"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action error must be text."
  );
  assert.throws(
    () => markFailed(preparedAction(), "x".repeat(1001)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Mise action error is outside supported limits."
  );
});

test("hydrate error_message stays pass-through; sibling lesson still invents under Unicode trim", () => {
  const emError = `\u2003${errorMessage}\u2003`;
  const hydrated = miseActionFromPersistedRow({
    id: "action_1",
    restaurant_id: restaurantId,
    action_type: "create_internal_task",
    execution_mode: "execute",
    status: "failed",
    autonomy_level: 4,
    error_message: emError,
    idempotency_key: "task:hydrate",
    created_at: "2026-08-02T12:00:00.000Z",
    updated_at: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(hydrated.error, emError);

  const lesson = "Owner usually increases chicken orders by about 10%.";
  const emLesson = `\u2003${lesson}\u2003`;
  const nbspLesson = `\u00a0${lesson}\u00a0`;

  assert.equal(emLesson.trim(), lesson);
  assert.equal(nbspLesson.trim(), lesson);

  const outcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { ok: true },
    actualResult: { ok: true },
    lesson: emLesson
  });
  assert.equal(outcome.lesson, lesson);

  const nbspOutcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { ok: true },
    actualResult: { ok: true },
    lesson: nbspLesson
  });
  assert.equal(nbspOutcome.lesson, lesson);
});

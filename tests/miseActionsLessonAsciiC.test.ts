import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createPreparedAction,
  markFailed,
  measureOutcome
} from "../services/domain/miseActions";
import {
  canonicalMiseActionsLesson,
  normalizeCanonicalMiseActionsLesson
} from "../services/domain/miseActionsLessonIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/miseActionsLessonIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/miseActions.ts", import.meta.url),
  "utf8"
);
const memorySource = readFileSync(
  new URL("../services/domain/restaurantMemory.ts", import.meta.url),
  "utf8"
);

const restaurantId = "rest_actions_lesson";
const lesson =
  "Ordering before the cutoff protected dinner availability.";
const multilineLesson =
  "Ordering before the cutoff protected dinner availability.\nCarry the same window tomorrow.\nOwner note attached.";
const accentedLesson =
  "Pedir antes del corte protegió la disponibilidad de la cena.";

test("MISE-005OU pins mise-actions lesson free-text to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005OU/);
  assert.match(domainSource, /MISE-005OU/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalMiseActionsLesson("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.doesNotMatch(canonicalBody, /\.replace\(C_WHITESPACE/);

  assert.match(domainSource, /normalizeCanonicalMiseActionsLesson\(input\.lesson\)/);
  assert.match(domainSource, /from "\.\/miseActionsLessonIdentity"/);
  assert.doesNotMatch(domainSource, /lesson: input\.lesson\?\.trim\(\) \|\| null/);

  // Leave sibling error free-text on Unicode trim until tipped / landed.
  assert.match(domainSource, /error: error\.trim\(\) \|\| "Action failed\."/);
  // Leave hydrate error_message pass-through alone.
  assert.match(domainSource, /error: row\.error_message \?\? null/);
  // Leave requestedBy pass-through alone (proved non-inventing).
  assert.match(domainSource, /requestedBy: input\.requestedBy \?\? null/);
  // Leave restaurantMemory lesson consumers alone until a dedicated tip.
  assert.match(memorySource, /outcome\.lesson\?\.trim\(\)/);

  assert.doesNotMatch(identitySource, /miseActionsErrorIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsRollbackReferenceIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCompletionResultIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
  assert.doesNotMatch(domainSource, /miseActionsErrorIdentity/);
  assert.doesNotMatch(domainSource, /inventoryCountLineNoteIdentity/);
});

test("ASCII C multiline prep keeps ordinary mise-actions lessons stable", () => {
  assert.equal(canonicalMiseActionsLesson(`  ${lesson}  `), lesson);
  assert.equal(canonicalMiseActionsLesson(`\t${lesson}\n`), lesson);
  assert.equal(normalizeCanonicalMiseActionsLesson(`  ${lesson}  `), lesson);
  assert.equal(canonicalMiseActionsLesson(accentedLesson), accentedLesson);
  assert.equal(normalizeCanonicalMiseActionsLesson(accentedLesson), accentedLesson);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalMiseActionsLesson(multilineLesson), multilineLesson);
  assert.equal(normalizeCanonicalMiseActionsLesson(multilineLesson), multilineLesson);

  const outcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { ok: true },
    actualResult: { ok: true },
    lesson: `  ${lesson}  `
  });
  assert.equal(outcome.lesson, lesson);

  const multilineOutcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { ok: true },
    actualResult: { ok: true },
    lesson: multilineLesson
  });
  assert.equal(multilineOutcome.lesson, multilineLesson);
});

test("NBSP folds and em-space padding cannot invent mise-actions lessons", () => {
  const nbspLesson = `\u00a0${lesson}\u00a0`;
  const emLesson = `\u2003${lesson}\u2003`;
  const internalEm = `Ordering\u2003before the cutoff`;
  const internalNbsp = `Ordering\u00a0before the cutoff`;
  const emMultiline = `\u2003${multilineLesson}\u2003`;

  // Pasted NBSP is folded like MISE-005B / #821 / #823 / #824 / #827 / #828.
  assert.equal(nbspLesson.trim(), lesson);
  assert.equal(canonicalMiseActionsLesson(nbspLesson), lesson);
  assert.equal(normalizeCanonicalMiseActionsLesson(nbspLesson), lesson);
  assert.equal(canonicalMiseActionsLesson(internalNbsp), "Ordering before the cutoff");

  const nbspOutcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { ok: true },
    actualResult: { ok: true },
    lesson: nbspLesson
  });
  assert.equal(nbspOutcome.lesson, lesson);

  // Unicode em-space trim invents a clean lesson; C free-text prep does not.
  assert.equal(emLesson.trim(), lesson);
  assert.notEqual(canonicalMiseActionsLesson(emLesson), lesson);
  assert.equal(canonicalMiseActionsLesson(emLesson), emLesson);
  assert.equal(normalizeCanonicalMiseActionsLesson(emLesson), emLesson);

  const emOutcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { ok: true },
    actualResult: { ok: true },
    lesson: emLesson
  });
  assert.equal(emOutcome.lesson, emLesson);
  assert.notEqual(emOutcome.lesson, lesson);

  assert.equal(canonicalMiseActionsLesson(internalEm), internalEm);
  assert.notEqual(
    canonicalMiseActionsLesson(internalEm),
    canonicalMiseActionsLesson("Ordering before the cutoff")
  );

  assert.equal(emMultiline.trim(), multilineLesson);
  assert.notEqual(canonicalMiseActionsLesson(emMultiline), multilineLesson);
  assert.equal(canonicalMiseActionsLesson(emMultiline), emMultiline);
  assert.equal(normalizeCanonicalMiseActionsLesson(emMultiline), emMultiline);

  const emMultilineOutcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { ok: true },
    actualResult: { ok: true },
    lesson: emMultiline
  });
  assert.equal(emMultilineOutcome.lesson, emMultiline);

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(canonicalMiseActionsLesson("Kelvin dinner lesson"), "Kelvin dinner lesson");
  assert.notEqual(
    canonicalMiseActionsLesson("Kelvin dinner lesson"),
    canonicalMiseActionsLesson("Kelvin dinner lesson")
  );
});

test("mise-actions lessons soft-null empty; unsafe control/over-long fail closed", () => {
  assert.equal(normalizeCanonicalMiseActionsLesson(null), null);
  assert.equal(normalizeCanonicalMiseActionsLesson(undefined), null);
  assert.equal(normalizeCanonicalMiseActionsLesson(""), null);
  assert.equal(normalizeCanonicalMiseActionsLesson("   "), null);
  assert.equal(normalizeCanonicalMiseActionsLesson("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalMiseActionsLesson("\u2003"), null);
  assert.equal(normalizeCanonicalMiseActionsLesson("\n\t\r"), null);

  const softOutcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { ok: true },
    actualResult: { ok: true },
    lesson: "   "
  });
  assert.equal(softOutcome.lesson, null);
  const emSoftOutcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { ok: true },
    actualResult: { ok: true },
    lesson: "\u2003"
  });
  assert.equal(emSoftOutcome.lesson, null);
  const omittedOutcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { ok: true },
    actualResult: { ok: true }
  });
  assert.equal(omittedOutcome.lesson, null);

  assert.throws(
    () => normalizeCanonicalMiseActionsLesson(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action lesson must be text."
  );
  assert.throws(
    () => normalizeCanonicalMiseActionsLesson("Bad\u0000Lesson"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action lesson must be text."
  );
  assert.throws(
    () => normalizeCanonicalMiseActionsLesson("Bad\u000bLesson"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action lesson must be text."
  );
  assert.throws(
    () => normalizeCanonicalMiseActionsLesson("Bad\u000cLesson"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action lesson must be text."
  );
  assert.throws(
    () => normalizeCanonicalMiseActionsLesson("Bad\u007fLesson"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action lesson must be text."
  );
  assert.equal(
    normalizeCanonicalMiseActionsLesson("Ordering\tbefore cutoff\ncarry forward."),
    "Ordering\tbefore cutoff\ncarry forward."
  );

  assert.throws(
    () => normalizeCanonicalMiseActionsLesson("x".repeat(1001)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Mise action lesson is outside supported limits."
  );
  assert.throws(
    () =>
      measureOutcome({
        restaurantId,
        actionId: "action_1",
        expectedResult: { ok: true },
        actualResult: { ok: true },
        lesson: "Bad\u0000Lesson"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise action lesson must be text."
  );
  assert.throws(
    () =>
      measureOutcome({
        restaurantId,
        actionId: "action_1",
        expectedResult: { ok: true },
        actualResult: { ok: true },
        lesson: "x".repeat(1001)
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Mise action lesson is outside supported limits."
  );
});

test("sibling markFailed error still invents under Unicode trim until tipped", () => {
  const errorMessage = "Provider unavailable";
  const emError = `\u2003${errorMessage}\u2003`;
  const nbspError = `\u00a0${errorMessage}\u00a0`;

  assert.equal(emError.trim(), errorMessage);
  assert.equal(nbspError.trim(), errorMessage);

  const action = createPreparedAction({
    restaurantId,
    actionType: "send_supplier_communication",
    idempotencyKey: "comm:lesson-ascii-c-sibling-error",
    now: "2026-08-02T12:00:00.000Z"
  });
  const failed = markFailed(action, emError);
  assert.equal(failed.error, errorMessage);

  const nbspFailed = markFailed(action, nbspError);
  assert.equal(nbspFailed.error, errorMessage);
});

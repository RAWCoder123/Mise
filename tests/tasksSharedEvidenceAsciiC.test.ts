import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiPrepTasksSharedEvidence,
  canonicalizeTasksSharedEvidence,
  normalizeTasksSharedEvidence
} from "../services/domain/presentationTasksSharedEvidenceIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationTasksSharedEvidenceIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const taskDetailSource = readFileSync(
  new URL("../app/tasks/[id].tsx", import.meta.url),
  "utf8"
);

const note = "Counted walk-in";
const accentedNote = "Conteo de cámara fría";
const multilineNote =
  "Counted walk-in.\nProduce drawers checked.\tPhoto attached.";
const FALLBACK = "Verification evidence";

test("MISE-005VS pins tasks.shared.evidence display to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005VS/);
  assert.match(taskDetailSource, /MISE-005VS/);

  assert.ok(identitySource.includes("C_LEADING_WHITESPACE = /^[ \\t\\n\\v\\f\\r]+/;"));
  assert.ok(identitySource.includes("C_TRAILING_WHITESPACE = /[ \\t\\n\\v\\f\\r]+$/;"));
  assert.ok(identitySource.includes('.replace(/\\u00a0/g, " ")'));
  assert.ok(
    identitySource.includes(
      "UNSAFE_MULTILINE_CONTROL = /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/;"
    )
  );

  const prepBody = identitySource.slice(
    identitySource.indexOf("export function asciiPrepTasksSharedEvidence("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(prepBody, /\.trim\(\)/);
  assert.doesNotMatch(prepBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\\s/);

  assert.match(
    taskDetailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationTasksSharedEvidenceIdentity"/
  );
  assert.match(
    taskDetailSource,
    /normalizeTasksSharedEvidence\(entry\.note\)\s*\|\|\s*normalizeTasksSharedEvidence\(entry\.label\)\s*\|\|\s*normalizeTasksSharedEvidence\(entry\.type\)\s*\|\|\s*t\("tasks\.shared\.evidence"\)/
  );
  assert.doesNotMatch(
    taskDetailSource,
    /entry\.note \?\? entry\.label \?\? entry\.type \?\? t\("tasks\.shared\.evidence"\)/
  );

  // Leave sibling display / write paths alone.
  assert.match(
    taskDetailSource,
    /entry\.label \?\? entry\.type \?\? t\("tasks\.shared\.checklistItem"/
  );
  assert.match(
    taskDetailSource,
    /entry\.label \?\? entry\.type \?\? "Completed checklist item"/
  );
  assert.match(
    taskDetailSource,
    /sharedTask\.detail \?\? t\("tasks\.shared\.noInstructions"\)/
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationTasksSharedChecklistItemIdentity/);
  assert.doesNotMatch(identityCode, /presentationTasksSharedDetailNoInstructionsIdentity/);
  assert.doesNotMatch(identityCode, /taskCompletionEvidenceNoteIdentity/);
  assert.doesNotMatch(identityCode, /restaurantTasksDetailIdentity/);
  assert.doesNotMatch(identityCode, /ordersDetailNoteNoneIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C multiline prep keeps ordinary evidence note/label/type stable", () => {
  assert.equal(asciiPrepTasksSharedEvidence(`  ${note}  `), note);
  assert.equal(asciiPrepTasksSharedEvidence(`\t${note}\n`), note);
  assert.equal(canonicalizeTasksSharedEvidence(`  ${note}  `), note);
  assert.equal(normalizeTasksSharedEvidence(`  ${note}  `), note);

  assert.equal(asciiPrepTasksSharedEvidence(accentedNote), accentedNote);
  assert.equal(normalizeTasksSharedEvidence(accentedNote), accentedNote);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(asciiPrepTasksSharedEvidence(multilineNote), multilineNote);
  assert.equal(normalizeTasksSharedEvidence(multilineNote), multilineNote);
});

test("Unicode-only space cannot bypass localized tasks.shared.evidence", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";
  const empty = "";
  // Simulate the prior `??` cascade with typed nullable candidates so empty
  // string remains a reachable non-nullish bypass in TypeScript.
  const priorEvidence = (
    noteValue: string | null | undefined,
    labelValue: string | null | undefined,
    typeValue: string | null | undefined
  ) => noteValue ?? labelValue ?? typeValue ?? FALLBACK;

  // Bypass proof: non-nullish Unicode-only space / empty string skip ?? fallback
  // and also skip later candidates when an earlier field alone is padded.
  assert.equal(priorEvidence(emOnly, note, undefined), emOnly);
  assert.equal(priorEvidence(nbspOnly, note, undefined), nbspOnly);
  assert.equal(priorEvidence(empty, note, undefined), empty);
  assert.equal(priorEvidence(undefined, emOnly, note), emOnly);
  assert.equal(priorEvidence(null, empty, note), empty);
  assert.equal(priorEvidence(undefined, undefined, emOnly), emOnly);
  assert.notEqual(priorEvidence(emOnly, note, undefined), FALLBACK);
  assert.notEqual(priorEvidence(undefined, emOnly, note), FALLBACK);
  assert.notEqual(priorEvidence(empty, note, undefined), note);

  // Soft-null restores the intentional localized fallback (and note→label→type).
  assert.equal(normalizeTasksSharedEvidence(emOnly), null);
  assert.equal(normalizeTasksSharedEvidence(nbspOnly), null);
  assert.equal(normalizeTasksSharedEvidence(paddedSpaces), null);
  assert.equal(
    normalizeTasksSharedEvidence(emOnly) ||
      normalizeTasksSharedEvidence(note) ||
      normalizeTasksSharedEvidence(undefined) ||
      FALLBACK,
    note
  );
  assert.equal(
    normalizeTasksSharedEvidence(emOnly) ||
      normalizeTasksSharedEvidence(emOnly) ||
      normalizeTasksSharedEvidence(emOnly) ||
      FALLBACK,
    FALLBACK
  );
  assert.equal(
    normalizeTasksSharedEvidence(empty) ||
      normalizeTasksSharedEvidence(undefined) ||
      normalizeTasksSharedEvidence(null) ||
      FALLBACK,
    FALLBACK
  );
  assert.equal(normalizeTasksSharedEvidence(null), null);
  assert.equal(normalizeTasksSharedEvidence(undefined), null);
  assert.equal(normalizeTasksSharedEvidence(""), null);
});

test("NBSP folds and em-space padding cannot invent clean evidence display", () => {
  const nbspNote = `\u00a0${note}\u00a0`;
  const emNote = `\u2003${note}\u2003`;
  const internalEm = `Counted\u2003walk-in`;
  const internalNbsp = `Counted\u00a0walk-in`;
  const emMultiline = `\u2003${multilineNote}\u2003`;

  // Pasted NBSP folds like sibling multiline free-text prep.
  assert.equal(nbspNote.trim(), note);
  assert.equal(asciiPrepTasksSharedEvidence(nbspNote), note);
  assert.equal(normalizeTasksSharedEvidence(nbspNote), note);

  // Unicode trim invents a clean body; ASCII C soft-null refuses to invent.
  assert.equal(emNote.trim(), note);
  assert.notEqual(asciiPrepTasksSharedEvidence(emNote), note);
  assert.equal(normalizeTasksSharedEvidence(emNote), null);
  assert.equal(normalizeTasksSharedEvidence(emNote) || FALLBACK, FALLBACK);
  assert.equal(normalizeTasksSharedEvidence(emMultiline), null);

  // Internal em-space / folded NBSP stay (no inventing strip of interior).
  assert.equal(normalizeTasksSharedEvidence(internalEm), internalEm);
  assert.equal(normalizeTasksSharedEvidence(internalNbsp), "Counted walk-in");
});

test("Unsafe multiline controls soft-null for tasks.shared.evidence display", () => {
  assert.equal(normalizeTasksSharedEvidence(`${note}\u0000`), null);
  assert.equal(normalizeTasksSharedEvidence(`${note}\u0007`), null);
  assert.equal(normalizeTasksSharedEvidence(`${note}\u007f`), null);
  assert.equal(normalizeTasksSharedEvidence(123 as unknown as string), null);
  // LF/TAB/CR remain allowed.
  assert.equal(
    normalizeTasksSharedEvidence("Line one\nLine two\tTabbed\r"),
    "Line one\nLine two\tTabbed"
  );
});

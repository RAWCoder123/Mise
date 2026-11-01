import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiPrepTasksSharedDetailNoInstructions,
  canonicalizeTasksSharedDetailNoInstructions,
  normalizeTasksSharedDetailNoInstructions
} from "../services/domain/presentationTasksSharedDetailNoInstructionsIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationTasksSharedDetailNoInstructionsIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const taskDetailSource = readFileSync(
  new URL("../app/tasks/[id].tsx", import.meta.url),
  "utf8"
);

const detail = "Count the walk-in case.";
const accentedDetail = "Contar la cámara fría.";
const multilineDetail =
  "Count the walk-in case.\nCheck produce drawers.\tCase count attached.";
const FALLBACK = "No additional instructions were provided.";

test("MISE-005VQ pins tasks.shared.noInstructions display to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005VQ/);
  assert.match(taskDetailSource, /MISE-005VQ/);

  assert.ok(identitySource.includes("C_LEADING_WHITESPACE = /^[ \\t\\n\\v\\f\\r]+/;"));
  assert.ok(identitySource.includes("C_TRAILING_WHITESPACE = /[ \\t\\n\\v\\f\\r]+$/;"));
  assert.ok(identitySource.includes('.replace(/\\u00a0/g, " ")'));
  assert.ok(
    identitySource.includes(
      "UNSAFE_MULTILINE_CONTROL = /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/;"
    )
  );

  const prepBody = identitySource.slice(
    identitySource.indexOf("export function asciiPrepTasksSharedDetailNoInstructions("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(prepBody, /\.trim\(\)/);
  assert.doesNotMatch(prepBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\\s/);

  assert.match(
    taskDetailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationTasksSharedDetailNoInstructionsIdentity"/
  );
  assert.match(
    taskDetailSource,
    /normalizeTasksSharedDetailNoInstructions\(sharedTask\.detail\)\s*\|\|\s*t\("tasks\.shared\.noInstructions"\)/
  );
  assert.doesNotMatch(
    taskDetailSource,
    /sharedTask\.detail \?\? t\("tasks\.shared\.noInstructions"\)/
  );

  // Leave sibling display / write paths alone.
  assert.match(
    taskDetailSource,
    /entry\.label \?\? entry\.type \?\? t\("tasks\.shared\.checklistItem"/
  );
  assert.match(
    taskDetailSource,
    /entry\.note \?\? entry\.label \?\? entry\.type \?\? t\("tasks\.shared\.evidence"\)/
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /restaurantTasksDetailIdentity/);
  assert.doesNotMatch(identityCode, /taskCompletionEvidenceNoteIdentity/);
  assert.doesNotMatch(identityCode, /ordersDetailNoteNoneIdentity/);
  assert.doesNotMatch(identityCode, /presentationPosMappingsMenuItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C multiline prep keeps ordinary shared-task detail stable", () => {
  assert.equal(asciiPrepTasksSharedDetailNoInstructions(`  ${detail}  `), detail);
  assert.equal(asciiPrepTasksSharedDetailNoInstructions(`\t${detail}\n`), detail);
  assert.equal(canonicalizeTasksSharedDetailNoInstructions(`  ${detail}  `), detail);
  assert.equal(normalizeTasksSharedDetailNoInstructions(`  ${detail}  `), detail);

  assert.equal(asciiPrepTasksSharedDetailNoInstructions(accentedDetail), accentedDetail);
  assert.equal(normalizeTasksSharedDetailNoInstructions(accentedDetail), accentedDetail);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(asciiPrepTasksSharedDetailNoInstructions(multilineDetail), multilineDetail);
  assert.equal(normalizeTasksSharedDetailNoInstructions(multilineDetail), multilineDetail);
});

test("Unicode-only space cannot bypass localized tasks.shared.noInstructions", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";
  const empty = "";
  // Simulate the prior `??` row with a typed nullable candidate so empty
  // string remains a reachable non-nullish bypass in TypeScript.
  const priorDetail = (value: string | null | undefined) => value ?? FALLBACK;

  // Bypass proof: non-nullish Unicode-only space / empty string skip ?? fallback.
  assert.equal(priorDetail(emOnly), emOnly);
  assert.equal(priorDetail(nbspOnly), nbspOnly);
  assert.equal(priorDetail(empty), empty);
  assert.notEqual(priorDetail(emOnly), FALLBACK);
  assert.notEqual(priorDetail(empty), FALLBACK);

  // Soft-null restores the intentional localized fallback.
  assert.equal(normalizeTasksSharedDetailNoInstructions(emOnly), null);
  assert.equal(normalizeTasksSharedDetailNoInstructions(nbspOnly), null);
  assert.equal(normalizeTasksSharedDetailNoInstructions(paddedSpaces), null);
  assert.equal(normalizeTasksSharedDetailNoInstructions(emOnly) || FALLBACK, FALLBACK);
  assert.equal(normalizeTasksSharedDetailNoInstructions(empty) || FALLBACK, FALLBACK);
  assert.equal(normalizeTasksSharedDetailNoInstructions(null), null);
  assert.equal(normalizeTasksSharedDetailNoInstructions(undefined), null);
  assert.equal(normalizeTasksSharedDetailNoInstructions(""), null);
});

test("NBSP folds and em-space padding cannot invent clean shared-task detail display", () => {
  const nbspDetail = `\u00a0${detail}\u00a0`;
  const emDetail = `\u2003${detail}\u2003`;
  const internalEm = `Count\u2003the walk-in case.`;
  const internalNbsp = `Count\u00a0the walk-in case.`;
  const emMultiline = `\u2003${multilineDetail}\u2003`;

  // Pasted NBSP folds like sibling multiline free-text prep.
  assert.equal(nbspDetail.trim(), detail);
  assert.equal(asciiPrepTasksSharedDetailNoInstructions(nbspDetail), detail);
  assert.equal(normalizeTasksSharedDetailNoInstructions(nbspDetail), detail);

  // Unicode trim invents a clean body; ASCII C soft-null refuses to invent.
  assert.equal(emDetail.trim(), detail);
  assert.notEqual(asciiPrepTasksSharedDetailNoInstructions(emDetail), detail);
  assert.equal(normalizeTasksSharedDetailNoInstructions(emDetail), null);
  assert.equal(normalizeTasksSharedDetailNoInstructions(emDetail) || FALLBACK, FALLBACK);
  assert.equal(normalizeTasksSharedDetailNoInstructions(emMultiline), null);

  // Internal em-space / folded NBSP stay (no inventing strip of interior).
  assert.equal(normalizeTasksSharedDetailNoInstructions(internalEm), internalEm);
  assert.equal(
    normalizeTasksSharedDetailNoInstructions(internalNbsp),
    "Count the walk-in case."
  );
});

test("Unsafe multiline controls soft-null for tasks.shared.noInstructions display", () => {
  assert.equal(normalizeTasksSharedDetailNoInstructions(`${detail}\u0000`), null);
  assert.equal(normalizeTasksSharedDetailNoInstructions(`${detail}\u0007`), null);
  assert.equal(normalizeTasksSharedDetailNoInstructions(`${detail}\u007f`), null);
  assert.equal(normalizeTasksSharedDetailNoInstructions(123 as unknown as string), null);
  // LF/TAB/CR remain allowed.
  assert.equal(
    normalizeTasksSharedDetailNoInstructions("Line one\nLine two\tTabbed\r"),
    "Line one\nLine two\tTabbed"
  );
});

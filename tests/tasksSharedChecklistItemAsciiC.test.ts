import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimTasksSharedChecklistItem,
  canonicalizeTasksSharedChecklistItem,
  normalizeTasksSharedChecklistItem
} from "../services/domain/presentationTasksSharedChecklistItemIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationTasksSharedChecklistItemIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const taskDetailSource = readFileSync(
  new URL("../app/tasks/[id].tsx", import.meta.url),
  "utf8"
);

const label = "Walk-in count";
const accentedLabel = "Conteo de cámara fría";
const FALLBACK = "Checklist item 1";

test("MISE-005VR pins tasks.shared.checklistItem display to ASCII C", () => {
  assert.match(identitySource, /MISE-005VR/);
  assert.match(taskDetailSource, /MISE-005VR/);

  assert.match(
    identitySource,
    /export function asciiTrimTasksSharedChecklistItem\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line label/type tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimTasksSharedChecklistItem("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    taskDetailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationTasksSharedChecklistItemIdentity"/
  );
  assert.match(
    taskDetailSource,
    /normalizeTasksSharedChecklistItem\(entry\.label\)\s*\|\|\s*normalizeTasksSharedChecklistItem\(entry\.type\)\s*\|\|\s*t\("tasks\.shared\.checklistItem"/
  );
  assert.doesNotMatch(
    taskDetailSource,
    /entry\.label \?\? entry\.type \?\? t\("tasks\.shared\.checklistItem"/
  );

  // Leave sibling display / write paths alone.
  assert.match(
    taskDetailSource,
    /entry\.note \?\? entry\.label \?\? entry\.type \?\? t\("tasks\.shared\.evidence"\)/
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
  assert.doesNotMatch(identityCode, /presentationTasksSharedDetailNoInstructionsIdentity/);
  assert.doesNotMatch(identityCode, /restaurantTasksDetailIdentity/);
  assert.doesNotMatch(identityCode, /taskCompletionEvidenceNoteIdentity/);
  assert.doesNotMatch(identityCode, /presentationPosMappingsMenuItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C checklist prep keeps ordinary label/type display stable", () => {
  assert.equal(asciiTrimTasksSharedChecklistItem(`  ${label}  `), label);
  assert.equal(asciiTrimTasksSharedChecklistItem(`\t${label}\n`), label);
  assert.equal(canonicalizeTasksSharedChecklistItem(`  ${label}  `), label);
  assert.equal(normalizeTasksSharedChecklistItem(`  ${label}  `), label);

  assert.equal(asciiTrimTasksSharedChecklistItem(accentedLabel), accentedLabel);
  assert.equal(normalizeTasksSharedChecklistItem(accentedLabel), accentedLabel);
});

test("Unicode-only space cannot bypass localized tasks.shared.checklistItem", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";
  const empty = "";
  // Simulate the prior `??` cascade with typed nullable candidates so empty
  // string remains a reachable non-nullish bypass in TypeScript.
  const priorChecklist = (
    labelValue: string | null | undefined,
    typeValue: string | null | undefined
  ) => labelValue ?? typeValue ?? FALLBACK;

  // Bypass proof: non-nullish Unicode-only space / empty string skip ?? fallback
  // and also skip the type candidate when label alone is padded.
  assert.equal(priorChecklist(emOnly, label), emOnly);
  assert.equal(priorChecklist(nbspOnly, label), nbspOnly);
  assert.equal(priorChecklist(empty, label), empty);
  assert.equal(priorChecklist(undefined, emOnly), emOnly);
  assert.equal(priorChecklist(null, empty), empty);
  assert.notEqual(priorChecklist(emOnly, label), FALLBACK);
  assert.notEqual(priorChecklist(undefined, emOnly), FALLBACK);
  assert.notEqual(priorChecklist(empty, label), label);

  // Soft-null restores the intentional localized fallback (and label→type fallthrough).
  assert.equal(normalizeTasksSharedChecklistItem(emOnly), null);
  assert.equal(normalizeTasksSharedChecklistItem(nbspOnly), null);
  assert.equal(normalizeTasksSharedChecklistItem(paddedSpaces), null);
  assert.equal(
    normalizeTasksSharedChecklistItem(emOnly) ||
      normalizeTasksSharedChecklistItem(label) ||
      FALLBACK,
    label
  );
  assert.equal(
    normalizeTasksSharedChecklistItem(emOnly) ||
      normalizeTasksSharedChecklistItem(emOnly) ||
      FALLBACK,
    FALLBACK
  );
  assert.equal(
    normalizeTasksSharedChecklistItem(empty) ||
      normalizeTasksSharedChecklistItem(undefined) ||
      FALLBACK,
    FALLBACK
  );
  assert.equal(normalizeTasksSharedChecklistItem(null), null);
  assert.equal(normalizeTasksSharedChecklistItem(undefined), null);
  assert.equal(normalizeTasksSharedChecklistItem(""), null);
});

test("NBSP / em-space padding cannot invent clean checklist label display", () => {
  const nbspLabel = `\u00a0${label}\u00a0`;
  const emLabel = `\u2003${label}\u2003`;
  const internalEm = `Walk-in\u2003count`;
  const internalNbsp = `Walk-in\u00a0count`;

  // Soft-null when Unicode trim would still strip end padding (NBSP preserved).
  assert.equal(nbspLabel.trim(), label);
  assert.notEqual(asciiTrimTasksSharedChecklistItem(nbspLabel), label);
  assert.equal(normalizeTasksSharedChecklistItem(nbspLabel), null);
  assert.equal(normalizeTasksSharedChecklistItem(nbspLabel) || FALLBACK, FALLBACK);

  // Unicode trim invents a clean label; ASCII C soft-null refuses to invent.
  assert.equal(emLabel.trim(), label);
  assert.notEqual(asciiTrimTasksSharedChecklistItem(emLabel), label);
  assert.equal(normalizeTasksSharedChecklistItem(emLabel), null);
  assert.equal(normalizeTasksSharedChecklistItem(emLabel) || FALLBACK, FALLBACK);

  // Internal em-space / NBSP stay (no inventing strip of interior; no NBSP fold).
  assert.equal(normalizeTasksSharedChecklistItem(internalEm), internalEm);
  assert.equal(normalizeTasksSharedChecklistItem(internalNbsp), internalNbsp);
});

test("Unsafe single-line controls soft-null for tasks.shared.checklistItem display", () => {
  assert.equal(normalizeTasksSharedChecklistItem(`${label}\u0000`), null);
  assert.equal(normalizeTasksSharedChecklistItem(`\u0007${label}`), null);
  assert.equal(normalizeTasksSharedChecklistItem(`${label}\u007f`), null);
  // Single-line checklist labels reject embedded LF/CR (unlike multiline tips).
  assert.equal(normalizeTasksSharedChecklistItem(`${label}\nnext`), null);
  assert.equal(normalizeTasksSharedChecklistItem(`${label}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeTasksSharedChecklistItem(`${label}\t`), label);
  assert.equal(normalizeTasksSharedChecklistItem("Walk-in count"), label);
  assert.equal(normalizeTasksSharedChecklistItem(123 as unknown as string), null);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimTaskChecklistCompletionEvidenceLabel,
  buildChecklistCompletionEvidenceLabel,
  canonicalizeTaskChecklistCompletionEvidenceLabel,
  normalizeTaskChecklistCompletionEvidenceLabel
} from "../services/domain/taskChecklistCompletionEvidenceLabelIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/taskChecklistCompletionEvidenceLabelIdentity.ts",
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
const ENGLISH_FALLBACK = "Completed checklist item";

test("MISE-005VT pins checklist completion-evidence labels to ASCII C", () => {
  assert.match(identitySource, /MISE-005VT/);
  assert.match(taskDetailSource, /MISE-005VT/);

  assert.match(
    identitySource,
    /export function asciiTrimTaskChecklistCompletionEvidenceLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line label tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf(
      "export function asciiTrimTaskChecklistCompletionEvidenceLabel("
    ),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    taskDetailSource,
    /from "\.\.\/\.\.\/services\/domain\/taskChecklistCompletionEvidenceLabelIdentity"/
  );
  assert.match(
    taskDetailSource,
    /sharedTask\.checklist\.map\(\(entry\) => buildChecklistCompletionEvidenceLabel\(entry\)\)/
  );
  assert.doesNotMatch(
    taskDetailSource,
    /entry\.label \?\? entry\.type \?\? "Completed checklist item"/
  );
  // Executable write path must not hardcode the English UI fallback string.
  const taskDetailCode = taskDetailSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(taskDetailCode, /Completed checklist item/);

  // Leave sibling display / write paths alone.
  assert.match(
    taskDetailSource,
    /entry\.note \?\? entry\.label \?\? entry\.type \?\? t\("tasks\.shared\.evidence"\)/
  );
  assert.match(
    taskDetailSource,
    /entry\.label \?\? entry\.type \?\? t\("tasks\.shared\.checklistItem"/
  );
  assert.match(
    taskDetailSource,
    /sharedTask\.detail \?\? t\("tasks\.shared\.noInstructions"\)/
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationTasksSharedChecklistItemIdentity/);
  assert.doesNotMatch(identityCode, /presentationTasksSharedEvidenceIdentity/);
  assert.doesNotMatch(identityCode, /presentationTasksSharedDetailNoInstructionsIdentity/);
  assert.doesNotMatch(identityCode, /restaurantTasksDetailIdentity/);
  assert.doesNotMatch(identityCode, /taskCompletionEvidenceNoteIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C checklist evidence label prep keeps ordinary operator labels stable", () => {
  assert.equal(asciiTrimTaskChecklistCompletionEvidenceLabel(`  ${label}  `), label);
  assert.equal(asciiTrimTaskChecklistCompletionEvidenceLabel(`\t${label}\n`), label);
  assert.equal(canonicalizeTaskChecklistCompletionEvidenceLabel(`  ${label}  `), label);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(`  ${label}  `), label);

  assert.equal(asciiTrimTaskChecklistCompletionEvidenceLabel(accentedLabel), accentedLabel);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(accentedLabel), accentedLabel);
});

test("Unicode-only space / empty cannot bake English Completed checklist item", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";
  const empty = "";
  // Simulate the prior `??` cascade with typed nullable candidates so empty
  // string remains a reachable non-nullish bypass in TypeScript.
  const priorWriteLabel = (
    labelValue: string | null | undefined,
    typeValue: string | null | undefined
  ) => labelValue ?? typeValue ?? ENGLISH_FALLBACK;

  // Bypass proof: non-nullish Unicode-only space / empty string skip ?? fallback
  // and also skip the type candidate when label alone is padded.
  assert.equal(priorWriteLabel(emOnly, label), emOnly);
  assert.equal(priorWriteLabel(nbspOnly, label), nbspOnly);
  assert.equal(priorWriteLabel(empty, label), empty);
  assert.equal(priorWriteLabel(undefined, "checklist_item"), "checklist_item");
  assert.equal(priorWriteLabel(null, empty), empty);
  assert.equal(priorWriteLabel(undefined, undefined), ENGLISH_FALLBACK);
  assert.notEqual(priorWriteLabel(emOnly, label), ENGLISH_FALLBACK);
  assert.notEqual(priorWriteLabel(undefined, "checklist_item"), ENGLISH_FALLBACK);
  assert.notEqual(priorWriteLabel(empty, label), label);

  // Soft-null omits label rather than inventing English or promoting type.
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(emOnly), null);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(nbspOnly), null);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(paddedSpaces), null);
  assert.deepEqual(buildChecklistCompletionEvidenceLabel({ label: emOnly, type: "checklist_item" }), {
    type: "checklist_item",
    completed: true
  });
  assert.deepEqual(buildChecklistCompletionEvidenceLabel({ type: "checklist_item" }), {
    type: "checklist_item",
    completed: true
  });
  assert.deepEqual(buildChecklistCompletionEvidenceLabel({ label: empty }), {
    type: "checklist_item",
    completed: true
  });
  assert.deepEqual(buildChecklistCompletionEvidenceLabel({ label }), {
    type: "checklist_item",
    label,
    completed: true
  });
  assert.equal(
    JSON.stringify([
      buildChecklistCompletionEvidenceLabel({ label: emOnly }),
      buildChecklistCompletionEvidenceLabel({ type: "checklist_item" }),
      buildChecklistCompletionEvidenceLabel({ label: empty })
    ]).includes(ENGLISH_FALLBACK),
    false
  );
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(null), null);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(undefined), null);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(""), null);
});

test("NBSP / em-space padding cannot invent clean durable checklist evidence labels", () => {
  const nbspLabel = `\u00a0${label}\u00a0`;
  const emLabel = `\u2003${label}\u2003`;
  const internalEm = `Walk-in\u2003count`;
  const internalNbsp = `Walk-in\u00a0count`;

  // Soft-null when Unicode trim would still strip end padding (NBSP preserved).
  assert.equal(nbspLabel.trim(), label);
  assert.notEqual(asciiTrimTaskChecklistCompletionEvidenceLabel(nbspLabel), label);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(nbspLabel), null);
  assert.deepEqual(buildChecklistCompletionEvidenceLabel({ label: nbspLabel }), {
    type: "checklist_item",
    completed: true
  });

  // Unicode trim invents a clean label; ASCII C soft-null refuses to invent.
  assert.equal(emLabel.trim(), label);
  assert.notEqual(asciiTrimTaskChecklistCompletionEvidenceLabel(emLabel), label);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(emLabel), null);
  assert.deepEqual(buildChecklistCompletionEvidenceLabel({ label: emLabel }), {
    type: "checklist_item",
    completed: true
  });

  // Internal em-space / NBSP stay (no inventing strip of interior; no NBSP fold).
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(internalEm), internalEm);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(internalNbsp), internalNbsp);
  assert.deepEqual(buildChecklistCompletionEvidenceLabel({ label: internalNbsp }), {
    type: "checklist_item",
    label: internalNbsp,
    completed: true
  });
});

test("Unsafe single-line controls soft-null for checklist completion-evidence labels", () => {
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(`${label}\u0000`), null);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(`\u0007${label}`), null);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(`${label}\u007f`), null);
  // Single-line checklist labels reject embedded LF/CR (unlike multiline tips).
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(`${label}\nnext`), null);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(`${label}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(`${label}\t`), label);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel("Walk-in count"), label);
  assert.equal(normalizeTaskChecklistCompletionEvidenceLabel(123), null);
});

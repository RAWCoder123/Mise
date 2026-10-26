import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCreateTaskChecklistLine,
  normalizeCreateTaskChecklist,
  normalizeCreateTaskChecklistLine
} from "../services/domain/createTaskChecklistIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/createTaskChecklistIdentity.ts", import.meta.url),
  "utf8"
);
const createTaskScreenSource = readFileSync(
  new URL("../app/more/create-task.tsx", import.meta.url),
  "utf8"
);

const label = "Check walk-in";
const accentedLabel = "Revisar cámara fría";

test("MISE-005QV pins Create Task checklist identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005QV/);
  assert.match(createTaskScreenSource, /MISE-005QV/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /export function canonicalCreateTaskChecklistLine\(value: string\) \{/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalCreateTaskChecklistLine"),
    identitySource.indexOf("function hasUnsafeChecklistControls")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(
    createTaskScreenSource,
    /from "\.\.\/\.\.\/services\/domain\/createTaskChecklistIdentity"/
  );
  assert.match(
    createTaskScreenSource,
    /normalizeCreateTaskChecklist\(checklistText\)/
  );

  const saveBody = createTaskScreenSource.slice(
    createTaskScreenSource.indexOf("async function save()"),
    createTaskScreenSource.indexOf(
      "setSaving(false);",
      createTaskScreenSource.indexOf("async function save()")
    )
  );
  assert.doesNotMatch(saveBody, /\.map\(\(line\) => line\.trim\(\)\)/);
  assert.doesNotMatch(saveBody, /checklistText\s*\.split\("\\n"\)/);
  assert.match(saveBody, /normalizeCreateTaskChecklist\(checklistText\)/);

  // Leave title / due-date / body on existing contracts (#880 / #881).
  assert.match(createTaskScreenSource, /title\.trim\(\)/);
  assert.match(createTaskScreenSource, /const dueTrimmed = dueDateText\.trim\(\);/);

  // Do not rewrite sibling Create Task title / due-date tips through this module.
  assert.doesNotMatch(identitySource, /createTaskTitleIdentity/);
  assert.doesNotMatch(identitySource, /createTaskDueDateIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksTitleIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesTitleIdentity/);
  assert.doesNotMatch(createTaskScreenSource, /createTaskTitleIdentity/);
  assert.doesNotMatch(createTaskScreenSource, /createTaskDueDateIdentity/);
  assert.doesNotMatch(createTaskScreenSource, /normalizeCreateTaskTitle/);
  assert.doesNotMatch(createTaskScreenSource, /normalizeCreateTaskDueDate/);
});

test("ASCII C display prep keeps ordinary Create Task checklist labels stable", () => {
  assert.equal(canonicalCreateTaskChecklistLine(`  ${label}  `), label);
  assert.equal(canonicalCreateTaskChecklistLine(`\t${label}\n`), label);
  assert.equal(normalizeCreateTaskChecklistLine(`  ${label}  `), label);

  assert.equal(canonicalCreateTaskChecklistLine(accentedLabel), accentedLabel);
  assert.equal(normalizeCreateTaskChecklistLine(accentedLabel), accentedLabel);

  assert.equal(canonicalCreateTaskChecklistLine("Check  walk-in"), label);
  assert.equal(normalizeCreateTaskChecklistLine("Check  walk-in"), label);

  assert.deepEqual(normalizeCreateTaskChecklist(`  ${label}  \n\n  Count bar  `), [
    label,
    "Count bar"
  ]);
  assert.deepEqual(normalizeCreateTaskChecklist(""), []);
  assert.deepEqual(normalizeCreateTaskChecklist(null), []);
});

test("NBSP folds and em-space padding cannot invent Create Task checklist labels", () => {
  const nbspLabel = `\u00a0${label}\u00a0`;
  const emLabel = `\u2003${label}\u2003`;
  const internalEm = `Check\u2003walk-in`;
  const internalNbsp = `Check\u00a0walk-in`;

  assert.equal(nbspLabel.trim(), label);
  assert.equal(canonicalCreateTaskChecklistLine(nbspLabel), label);
  assert.equal(normalizeCreateTaskChecklistLine(nbspLabel), label);
  assert.equal(canonicalCreateTaskChecklistLine(internalNbsp), label);

  // Unicode em-space trim invents a clean label; C display prep does not.
  assert.equal(emLabel.trim(), label);
  assert.notEqual(canonicalCreateTaskChecklistLine(emLabel), label);
  assert.equal(canonicalCreateTaskChecklistLine(emLabel), emLabel);
  assert.equal(normalizeCreateTaskChecklistLine(emLabel), emLabel);
  assert.notEqual(normalizeCreateTaskChecklistLine(emLabel), label);

  assert.equal(canonicalCreateTaskChecklistLine(internalEm), internalEm);
  assert.notEqual(canonicalCreateTaskChecklistLine(internalEm), label);

  assert.equal(
    canonicalCreateTaskChecklistLine("Kelvin walk-in check"),
    "Kelvin walk-in check"
  );

  // Draft multiline path: em-space padded lines stay distinct from clean labels.
  assert.deepEqual(normalizeCreateTaskChecklist(`${emLabel}\n${label}`), [
    emLabel,
    label
  ]);
  assert.notDeepEqual(
    normalizeCreateTaskChecklist(`${emLabel}\n${label}`),
    [label, label]
  );
});

test("Soft empty and unsafe controls omit Create Task checklist lines without inventing", () => {
  assert.equal(normalizeCreateTaskChecklistLine(null), null);
  assert.equal(normalizeCreateTaskChecklistLine(undefined), null);
  assert.equal(normalizeCreateTaskChecklistLine(""), null);
  assert.equal(normalizeCreateTaskChecklistLine("   "), null);
  assert.equal(normalizeCreateTaskChecklistLine("\t\n"), null);
  assert.equal(normalizeCreateTaskChecklistLine("\u2003"), null);
  assert.equal(normalizeCreateTaskChecklistLine("\u00a0"), null);
  assert.equal(normalizeCreateTaskChecklistLine("\u2003\u00a0\u2003"), null);

  assert.equal(normalizeCreateTaskChecklistLine(`\u0000${label}`), null);
  assert.equal(normalizeCreateTaskChecklistLine(`${label}\u0007`), null);
  assert.equal(normalizeCreateTaskChecklistLine(`${label}\u007f`), null);

  assert.deepEqual(
    normalizeCreateTaskChecklist(`\u2003\n  ${label}  \n\u00a0\n`),
    [label]
  );
});

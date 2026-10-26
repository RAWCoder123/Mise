import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalTaskCompletionEvidenceNote,
  normalizeTaskCompletionEvidenceNote
} from "../services/domain/taskCompletionEvidenceNoteIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/taskCompletionEvidenceNoteIdentity.ts", import.meta.url),
  "utf8"
);
const taskDetailSource = readFileSync(
  new URL("../app/tasks/[id].tsx", import.meta.url),
  "utf8"
);
const restaurantTasksSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const note = "Counted walk-in";
const accentedNote = "Producto dañado en recepción";
const multilineNote = "Counted walk-in.\nPhoto attached.\tKeep cold.";

test("MISE-005QW pins shared-task completion evidence notes to ASCII C", () => {
  assert.match(identitySource, /MISE-005QW/);
  assert.match(taskDetailSource, /MISE-005QW/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /export function canonicalTaskCompletionEvidenceNote\(value: string\) \{/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalTaskCompletionEvidenceNote"),
    identitySource.indexOf("function hasUnsafeMultilineControls")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    taskDetailSource,
    /from "\.\.\/\.\.\/services\/domain\/taskCompletionEvidenceNoteIdentity"/
  );
  assert.match(
    taskDetailSource,
    /normalizeTaskCompletionEvidenceNote\(completionEvidence\)/
  );

  const completeBody = taskDetailSource.slice(
    taskDetailSource.indexOf("async function completeSharedTask()"),
    taskDetailSource.indexOf("async function reopenSharedTask()")
  );
  assert.doesNotMatch(completeBody, /completionEvidence\.trim\(\)/);
  assert.doesNotMatch(completeBody, /note: completionEvidence\.trim\(\)/);
  // Open #824 owns durable completionResult ASCII C; leave UI emptiness gate alone.
  assert.match(completeBody, /if \(!completionResult\.trim\(\)\)/);

  // Leave open evidence-type tip #856 on its existing Unicode label emptiness /
  // type trim contracts inside boundedEvidence until that tip lands.
  assert.match(restaurantTasksSource, /record\.type\.trim\(\)/);
  assert.match(
    restaurantTasksSource,
    /typeof record\.label === "string" \? record\.label\.trim\(\)/
  );

  // Do not rewrite sibling free-text or evidence tips through this module.
  assert.doesNotMatch(identitySource, /askMiseQuestionIdentity/);
  assert.doesNotMatch(identitySource, /inventoryOperationNoteIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesBodyIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksEvidenceTypeIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCompletionResultIdentity/);
  assert.doesNotMatch(identitySource, /createTaskChecklistIdentity/);
  assert.doesNotMatch(taskDetailSource, /normalizeCreateTaskChecklist/);
  assert.doesNotMatch(taskDetailSource, /normalizeCanonicalInventoryOperationNote/);
});

test("ASCII trim keeps ordinary completion evidence notes stable", () => {
  assert.equal(canonicalTaskCompletionEvidenceNote(`  ${note}  `), note);
  assert.equal(canonicalTaskCompletionEvidenceNote(`\t${note}\n`), note);
  assert.equal(normalizeTaskCompletionEvidenceNote(`  ${note}  `), note);

  assert.equal(canonicalTaskCompletionEvidenceNote(accentedNote), accentedNote);
  assert.equal(normalizeTaskCompletionEvidenceNote(accentedNote), accentedNote);

  assert.equal(canonicalTaskCompletionEvidenceNote(multilineNote), multilineNote);
  assert.equal(normalizeTaskCompletionEvidenceNote(multilineNote), multilineNote);
});

test("NBSP folds and em-space padding cannot invent completion evidence notes", () => {
  const nbspNote = `\u00a0${note}\u00a0`;
  const emNote = `\u2003${note}\u2003`;
  const internalEm = `Counted\u2003walk-in`;
  const internalNbsp = `Counted\u00a0walk-in`;
  const emMultiline = `\u2003${multilineNote}\u2003`;

  assert.equal(nbspNote.trim(), note);
  assert.equal(canonicalTaskCompletionEvidenceNote(nbspNote), note);
  assert.equal(normalizeTaskCompletionEvidenceNote(nbspNote), note);
  assert.equal(canonicalTaskCompletionEvidenceNote(internalNbsp), "Counted walk-in");

  // Unicode em-space trim invents a clean evidence note; C free-text prep does not.
  assert.equal(emNote.trim(), note);
  assert.notEqual(canonicalTaskCompletionEvidenceNote(emNote), note);
  assert.equal(canonicalTaskCompletionEvidenceNote(emNote), emNote);
  assert.equal(normalizeTaskCompletionEvidenceNote(emNote), emNote);
  assert.notEqual(normalizeTaskCompletionEvidenceNote(emNote), note);

  assert.equal(canonicalTaskCompletionEvidenceNote(internalEm), internalEm);
  assert.notEqual(
    canonicalTaskCompletionEvidenceNote(internalEm),
    canonicalTaskCompletionEvidenceNote(note)
  );

  assert.equal(emMultiline.trim(), multilineNote);
  assert.notEqual(canonicalTaskCompletionEvidenceNote(emMultiline), multilineNote);
  assert.equal(canonicalTaskCompletionEvidenceNote(emMultiline), emMultiline);
  assert.equal(normalizeTaskCompletionEvidenceNote(emMultiline), emMultiline);

  assert.equal(
    canonicalTaskCompletionEvidenceNote("Kelvin evidence note"),
    "Kelvin evidence note"
  );
});

test("Soft empty and unsafe controls omit completion evidence notes without inventing", () => {
  assert.equal(normalizeTaskCompletionEvidenceNote(null), null);
  assert.equal(normalizeTaskCompletionEvidenceNote(undefined), null);
  assert.equal(normalizeTaskCompletionEvidenceNote(""), null);
  assert.equal(normalizeTaskCompletionEvidenceNote("   "), null);
  assert.equal(normalizeTaskCompletionEvidenceNote("\t\n"), null);
  assert.equal(normalizeTaskCompletionEvidenceNote("\u2003"), null);
  assert.equal(normalizeTaskCompletionEvidenceNote("\u00a0"), null);
  assert.equal(normalizeTaskCompletionEvidenceNote("\u2003\u00a0\u2003"), null);

  assert.equal(normalizeTaskCompletionEvidenceNote(`\u0000${note}`), null);
  assert.equal(normalizeTaskCompletionEvidenceNote(`${note}\u0007`), null);
  assert.equal(normalizeTaskCompletionEvidenceNote(`${note}\u007f`), null);

  // LF/TAB/CR remain allowed inside completion evidence prose.
  assert.equal(
    normalizeTaskCompletionEvidenceNote("Line one.\nLine two.\tKeep."),
    "Line one.\nLine two.\tKeep."
  );
});

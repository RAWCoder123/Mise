import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimCreateTaskDueDate,
  canonicalizeCreateTaskDueDate,
  normalizeCreateTaskDueDate
} from "../services/domain/createTaskDueDateIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/createTaskDueDateIdentity.ts", import.meta.url),
  "utf8"
);
const createTaskScreenSource = readFileSync(
  new URL("../app/more/create-task.tsx", import.meta.url),
  "utf8"
);

const dueDate = "2026-08-01";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005QU pins Create Task due-date identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005QU/);
  assert.match(createTaskScreenSource, /MISE-005QU/);

  assert.match(
    identitySource,
    /export function asciiTrimCreateTaskDueDate\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    createTaskScreenSource,
    /from "\.\.\/\.\.\/services\/domain\/createTaskDueDateIdentity"/
  );
  assert.match(createTaskScreenSource, /normalizeCreateTaskDueDate\(dueDateText\)/);

  const saveBody = createTaskScreenSource.slice(
    createTaskScreenSource.indexOf("async function save()"),
    createTaskScreenSource.indexOf(
      "setSaving(false);",
      createTaskScreenSource.indexOf("async function save()")
    )
  );
  // Emptiness-only Unicode trim may remain for the due-date gate; the trimmed
  // result must not become the stored dueAt identity.
  assert.doesNotMatch(saveBody, /const dueTrimmed = dueDateText\.trim\(\);/);
  assert.doesNotMatch(saveBody, /dueAt:\s*dueTrimmed/);
  assert.doesNotMatch(saveBody, /dueAt:\s*dueDateText\.trim\(\)/);
  assert.match(
    saveBody,
    /dueDateText\.trim\(\) && !preparedDueDate/
  );
  assert.match(saveBody, /normalizeCreateTaskDueDate\(dueDateText\)/);
  assert.match(saveBody, /dueAt: preparedDueDate/);

  // Leave title / checklist / body on existing contracts (#880 owns title).
  assert.match(createTaskScreenSource, /title\.trim\(\)/);
  assert.match(createTaskScreenSource, /\.map\(\(line\) => line\.trim\(\)\)/);

  // UI emptiness for timing visibility may still Unicode-trim for emptiness only.
  assert.match(createTaskScreenSource, /const hasDueDate = dueDateText\.trim\(\)\.length > 0;/);

  // Do not rewrite sibling ISO / Create Task title tips through this module.
  assert.doesNotMatch(identitySource, /createTaskTitleIdentity/);
  assert.doesNotMatch(identitySource, /insightsSalesThroughDateIdentity/);
  assert.doesNotMatch(identitySource, /setupPosSaleDateIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineIsoDateIdentity/);
  assert.doesNotMatch(createTaskScreenSource, /createTaskTitleIdentity/);
  assert.doesNotMatch(createTaskScreenSource, /insightsSalesThroughDateIdentity/);
  assert.doesNotMatch(createTaskScreenSource, /purchaseLineIsoDateIdentity/);
});

test("ASCII C prep keeps ordinary Create Task due dates stable", () => {
  assert.equal(asciiTrimCreateTaskDueDate(`  ${dueDate}  `), dueDate);
  assert.equal(asciiTrimCreateTaskDueDate(`\t${dueDate}\n`), dueDate);
  assert.equal(canonicalizeCreateTaskDueDate(`  ${dueDate}  `), dueDate);
  assert.equal(normalizeCreateTaskDueDate(`  ${dueDate}  `), dueDate);
  assert.equal(normalizeCreateTaskDueDate(null), null);
  assert.equal(normalizeCreateTaskDueDate(undefined), null);
  assert.equal(normalizeCreateTaskDueDate(""), null);
  assert.equal(normalizeCreateTaskDueDate("   "), null);
});

test("NBSP and em-space padding cannot invent Create Task due dates", () => {
  const padded = `${em}${dueDate}${em}`;
  const nbspPadded = `${nbsp}${dueDate}${nbsp}`;

  // Inventing proof: Unicode trim would invent the clean ISO due date.
  assert.equal(padded.trim(), dueDate);
  assert.equal(nbspPadded.trim(), dueDate);
  assert.equal(/^\d{4}-\d{2}-\d{2}$/.test(padded.trim()), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimCreateTaskDueDate(padded), padded);
  assert.equal(canonicalizeCreateTaskDueDate(padded), null);
  assert.equal(canonicalizeCreateTaskDueDate(nbspPadded), null);
  assert.equal(normalizeCreateTaskDueDate(padded), null);
  assert.equal(normalizeCreateTaskDueDate(nbspPadded), null);
  assert.equal(normalizeCreateTaskDueDate("not-a-date"), null);
  assert.equal(normalizeCreateTaskDueDate("2026-13-40"), null);
  assert.equal(normalizeCreateTaskDueDate("08/01/2026"), null);
});

test("Soft empty and control due dates omit without inventing", () => {
  assert.equal(normalizeCreateTaskDueDate(`${em}${em}`), null);
  assert.equal(normalizeCreateTaskDueDate(`${nbsp}`), null);
  assert.equal(normalizeCreateTaskDueDate(`\u0000${dueDate}`), null);
  assert.equal(normalizeCreateTaskDueDate(`${dueDate}\u007f`), null);
});

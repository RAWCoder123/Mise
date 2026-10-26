import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCreateTaskTitle,
  normalizeCreateTaskTitle
} from "../services/domain/createTaskTitleIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/createTaskTitleIdentity.ts", import.meta.url),
  "utf8"
);
const createTaskScreenSource = readFileSync(
  new URL("../app/more/create-task.tsx", import.meta.url),
  "utf8"
);
const floorNotesSource = readFileSync(
  new URL("../services/application/floorNotes.ts", import.meta.url),
  "utf8"
);
const restaurantTasksSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const title = "Count walk-in";
const accentedTitle = "Contar cámara fría";

test("MISE-005QT pins Create Task title identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005QT/);
  assert.match(createTaskScreenSource, /MISE-005QT/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /export function canonicalCreateTaskTitle\(value: string\) \{/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalCreateTaskTitle"),
    identitySource.indexOf("function hasUnsafeTitleControls")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(
    createTaskScreenSource,
    /from "\.\.\/\.\.\/services\/domain\/createTaskTitleIdentity"/
  );
  assert.match(createTaskScreenSource, /normalizeCreateTaskTitle\(title\)/);

  const saveBody = createTaskScreenSource.slice(
    createTaskScreenSource.indexOf("async function save()"),
    createTaskScreenSource.indexOf(
      "setSaving(false);",
      createTaskScreenSource.indexOf("async function save()")
    )
  );
  assert.doesNotMatch(saveBody, /title\.trim\(\)/);
  assert.doesNotMatch(saveBody, /const trimmedTitle = /);
  assert.match(saveBody, /normalizeCreateTaskTitle\(title\)/);
  assert.match(saveBody, /title: preparedTitle/);

  // Leave due-date ISO, checklist lines, and body on existing contracts.
  assert.match(createTaskScreenSource, /const dueTrimmed = dueDateText\.trim\(\);/);
  assert.match(createTaskScreenSource, /\.map\(\(line\) => line\.trim\(\)\)/);

  // Leave open #838 / #822 on their existing Unicode-trim contracts until
  // those tips land their ASCII C helpers.
  assert.match(
    floorNotesSource,
    /export function normalizeOperatorTaskTitle\(value: string\): string \{/
  );
  assert.match(
    floorNotesSource,
    /return value\.trim\(\)\.replace\(\/\\s\+\/g, " "\)\.slice\(0, TITLE_MAX\);/
  );
  assert.match(restaurantTasksSource, /function requiredText\(/);
  assert.match(restaurantTasksSource, /\.trim\(\)\.replace\(\/\\s\+\/g, " "\)/);

  // Do not rewrite sibling title tips through this module.
  assert.doesNotMatch(identitySource, /restaurantTasksTitleIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesTitleIdentity/);
  assert.doesNotMatch(identitySource, /askMiseQuestionIdentity/);
  assert.doesNotMatch(identitySource, /operatingPlanWhyIdentity/);
  assert.doesNotMatch(createTaskScreenSource, /restaurantTasksTitleIdentity/);
  assert.doesNotMatch(createTaskScreenSource, /floorNotesTitleIdentity/);
  assert.doesNotMatch(createTaskScreenSource, /canonicalizeFloorNotesTitle/);
  assert.doesNotMatch(createTaskScreenSource, /requireCanonicalRestaurantTasksTitle/);
});

test("ASCII C display prep keeps ordinary Create Task titles stable", () => {
  assert.equal(canonicalCreateTaskTitle(`  ${title}  `), title);
  assert.equal(canonicalCreateTaskTitle(`\t${title}\n`), title);
  assert.equal(normalizeCreateTaskTitle(`  ${title}  `), title);

  assert.equal(canonicalCreateTaskTitle(accentedTitle), accentedTitle);
  assert.equal(normalizeCreateTaskTitle(accentedTitle), accentedTitle);

  assert.equal(canonicalCreateTaskTitle("Count  walk-in"), title);
  assert.equal(normalizeCreateTaskTitle("Count  walk-in"), title);
});

test("NBSP folds and em-space padding cannot invent Create Task titles", () => {
  const nbspTitle = `\u00a0${title}\u00a0`;
  const emTitle = `\u2003${title}\u2003`;
  const internalEm = `Count\u2003walk-in`;
  const internalNbsp = `Count\u00a0walk-in`;

  assert.equal(nbspTitle.trim(), title);
  assert.equal(canonicalCreateTaskTitle(nbspTitle), title);
  assert.equal(normalizeCreateTaskTitle(nbspTitle), title);
  assert.equal(canonicalCreateTaskTitle(internalNbsp), title);

  // Unicode em-space trim invents a clean title; C display prep does not.
  assert.equal(emTitle.trim(), title);
  assert.notEqual(canonicalCreateTaskTitle(emTitle), title);
  assert.equal(canonicalCreateTaskTitle(emTitle), emTitle);
  assert.equal(normalizeCreateTaskTitle(emTitle), emTitle);
  assert.notEqual(normalizeCreateTaskTitle(emTitle), title);

  assert.equal(canonicalCreateTaskTitle(internalEm), internalEm);
  assert.notEqual(canonicalCreateTaskTitle(internalEm), title);

  assert.equal(
    canonicalCreateTaskTitle("Kelvin walk-in count"),
    "Kelvin walk-in count"
  );
});

test("Soft empty and unsafe controls omit Create Task titles without inventing", () => {
  assert.equal(normalizeCreateTaskTitle(null), null);
  assert.equal(normalizeCreateTaskTitle(undefined), null);
  assert.equal(normalizeCreateTaskTitle(""), null);
  assert.equal(normalizeCreateTaskTitle("   "), null);
  assert.equal(normalizeCreateTaskTitle("\t\n"), null);
  assert.equal(normalizeCreateTaskTitle("\u2003"), null);
  assert.equal(normalizeCreateTaskTitle("\u00a0"), null);
  assert.equal(normalizeCreateTaskTitle("\u2003\u00a0\u2003"), null);

  assert.equal(normalizeCreateTaskTitle(`\u0000${title}`), null);
  assert.equal(normalizeCreateTaskTitle(`${title}\u0007`), null);
  assert.equal(normalizeCreateTaskTitle(`${title}\u007f`), null);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimFloorNotesDueAt,
  canonicalizeFloorNotesDueAt,
  normalizeFloorNotesDueAt
} from "../services/domain/floorNotesDueAtIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/floorNotesDueAtIdentity.ts", import.meta.url),
  "utf8"
);
const floorNotesSource = readFileSync(
  new URL("../services/application/floorNotes.ts", import.meta.url),
  "utf8"
);

const dueDate = "2026-08-05";
const dueInstant = "2026-08-05T12:30:00.000Z";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005RZ pins floor-notes dueAt identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RZ/);
  assert.match(floorNotesSource, /MISE-005RZ/);

  assert.match(
    identitySource,
    /export function asciiTrimFloorNotesDueAt\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    floorNotesSource,
    /from "\.\.\/domain\/floorNotesDueAtIdentity"/
  );
  assert.match(floorNotesSource, /normalizeFloorNotesDueAt\(value\)/);
  const dueAtFn = floorNotesSource.slice(
    floorNotesSource.indexOf("function normalizeDueAt"),
    floorNotesSource.indexOf(
      "function coerceBody",
      floorNotesSource.indexOf("function normalizeDueAt")
    )
  );
  assert.match(dueAtFn, /normalizeFloorNotesDueAt\(value\)/);
  assert.doesNotMatch(dueAtFn, /\.trim\(\)/);

  // Open #838 / #839 own title / body; leave their Unicode contracts alone.
  assert.match(floorNotesSource, /return value\.trim\(\)\.replace\(\/\\s\+\/g/);
  assert.match(floorNotesSource, /value\.replace\(\/\^\\s\+\/, ""\)\.replace\(\/\\s\+\$\//);

  // Open #881 owns Create Task UI dueDateText; do not share that module.
  assert.doesNotMatch(identitySource, /createTaskDueDateIdentity/);
  assert.doesNotMatch(identitySource, /normalizeCreateTaskDueDate/);
  assert.doesNotMatch(identitySource, /insightsSalesThroughDateIdentity/);
  assert.doesNotMatch(identitySource, /setupPosSaleDateIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineIsoDateIdentity/);
  assert.doesNotMatch(floorNotesSource, /createTaskDueDateIdentity/);
});

test("ASCII trim keeps ordinary floor-notes dueAt values stable", () => {
  assert.equal(asciiTrimFloorNotesDueAt(`  ${dueDate}  `), dueDate);
  assert.equal(asciiTrimFloorNotesDueAt(`\t${dueDate}\n`), dueDate);
  assert.equal(canonicalizeFloorNotesDueAt(`  ${dueDate}  `), `${dueDate}T00:00:00.000Z`);
  assert.equal(normalizeFloorNotesDueAt(`  ${dueDate}  `), `${dueDate}T00:00:00.000Z`);
  assert.equal(normalizeFloorNotesDueAt(dueDate), `${dueDate}T00:00:00.000Z`);
  assert.equal(normalizeFloorNotesDueAt(`  ${dueInstant}  `), dueInstant);
  assert.equal(normalizeFloorNotesDueAt(dueInstant), dueInstant);

  assert.equal(normalizeFloorNotesDueAt(null), null);
  assert.equal(normalizeFloorNotesDueAt(undefined), null);
  assert.equal(normalizeFloorNotesDueAt(""), null);
  assert.equal(normalizeFloorNotesDueAt("   "), null);
  assert.equal(normalizeFloorNotesDueAt("\t\n"), null);
});

test("NBSP and em-space padding cannot invent a clean floor-notes dueAt", () => {
  const paddedDate = `${em}${dueDate}${em}`;
  const nbspDate = `${nbsp}${dueDate}${nbsp}`;
  const paddedInstant = `${em}${dueInstant}${em}`;
  const nbspInstant = `${nbsp}${dueInstant}${nbsp}`;

  // Live inventing proof on Unicode trim (what normalizeDueAt previously did).
  assert.equal(paddedDate.trim(), dueDate);
  assert.equal(nbspDate.trim(), dueDate);
  assert.equal(/^\d{4}-\d{2}-\d{2}$/.test(paddedDate.trim()), true);
  assert.equal(paddedInstant.trim(), dueInstant);
  assert.equal(nbspInstant.trim(), dueInstant);

  assert.equal(asciiTrimFloorNotesDueAt(paddedDate), paddedDate);
  assert.equal(canonicalizeFloorNotesDueAt(paddedDate), null);
  assert.equal(canonicalizeFloorNotesDueAt(nbspDate), null);
  assert.equal(canonicalizeFloorNotesDueAt(paddedInstant), null);
  assert.equal(canonicalizeFloorNotesDueAt(nbspInstant), null);
  assert.equal(normalizeFloorNotesDueAt(paddedDate), null);
  assert.equal(normalizeFloorNotesDueAt(nbspDate), null);
  assert.equal(normalizeFloorNotesDueAt(paddedInstant), null);
  assert.equal(normalizeFloorNotesDueAt(nbspInstant), null);

  // Soft empty Unicode-only padding falls through like prior omit-dueAt.
  assert.equal(normalizeFloorNotesDueAt(`${em}${em}`), null);
  assert.equal(normalizeFloorNotesDueAt(`${nbsp}${nbsp}`), null);
  assert.notEqual(normalizeFloorNotesDueAt(paddedDate), `${dueDate}T00:00:00.000Z`);
});

test("ASCII controls and malformed floor-notes dueAt fail closed without inventing", () => {
  // Interior / embedded controls survive ASCII end-trim and fail closed.
  assert.equal(canonicalizeFloorNotesDueAt(`${dueDate.slice(0, 4)}\n${dueDate.slice(4)}`), null);
  assert.equal(canonicalizeFloorNotesDueAt(`\u0000${dueDate}`), null);
  assert.equal(canonicalizeFloorNotesDueAt(`${dueDate}\u007f`), null);
  assert.equal(normalizeFloorNotesDueAt(`${dueDate.slice(0, 4)}\n${dueDate.slice(4)}`), null);
  assert.equal(normalizeFloorNotesDueAt(`\u0000${dueDate}`), null);
  assert.equal(normalizeFloorNotesDueAt(`${dueDate}\u007f`), null);
  assert.equal(normalizeFloorNotesDueAt("not-a-date"), null);
  assert.equal(normalizeFloorNotesDueAt("2026-13-40"), null);
  // Prior Date.parse path still accepts ASCII-clean slash dates; do not
  // tighten that contract in this inventing tip.
  assert.equal(normalizeFloorNotesDueAt("08/05/2026"), "2026-08-05T00:00:00.000Z");
  assert.equal(normalizeFloorNotesDueAt(12345), null);
});

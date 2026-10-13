import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createFloorNote,
  createOperatorTask,
  normalizeFloorNoteTitle,
  normalizeOperatorTaskTitle,
  setFloorNoteStorageForTesting,
  type FloorNoteStorage
} from "../services/application/floorNotes";
import {
  canonicalFloorNotesTitle,
  canonicalizeFloorNotesTitle,
  normalizeCanonicalFloorNotesTitle,
  requireCanonicalFloorNotesTitle
} from "../services/application/floorNotesTitleIdentity";

const identitySource = readFileSync(
  new URL("../services/application/floorNotesTitleIdentity.ts", import.meta.url),
  "utf8"
);
const floorNotesSource = readFileSync(
  new URL("../services/application/floorNotes.ts", import.meta.url),
  "utf8"
);

const title = "Check walk-in";
const accentedTitle = "Revisar cámara fría";

function memoryStorage(seed?: Record<string, string>): FloorNoteStorage {
  const values = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    }
  };
}

test("MISE-005PD pins floor-notes titles to ASCII C display prep", () => {
  assert.match(identitySource, /MISE-005PD/);
  assert.match(floorNotesSource, /MISE-005PD/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalFloorNotesTitle("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(floorNotesSource, /canonicalizeFloorNotesTitle\(value\)/);
  assert.match(floorNotesSource, /from "\.\/floorNotesTitleIdentity"/);
  assert.doesNotMatch(
    floorNotesSource,
    /normalizeOperatorTaskTitle[\s\S]*?value\.trim\(\)\.replace\(/
  );

  // Leave body normalize and restaurant workspace on their existing contracts.
  assert.match(floorNotesSource, /function normalizeOperatorTaskBody\(/);
  assert.match(floorNotesSource, /replace\(\/\^\\s\+\//);
  assert.match(floorNotesSource, /replace\(\/\\s\+\$\//);
  assert.match(floorNotesSource, /function requireRestaurantId\(/);
  assert.match(floorNotesSource, /const normalized = restaurantId\.trim\(\);/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /floorNotesTaskIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksTitleIdentity/);
  assert.doesNotMatch(identitySource, /deliveryHistoryNoteIdentity/);
  assert.doesNotMatch(floorNotesSource, /restaurantTasksTitleIdentity/);
  assert.doesNotMatch(floorNotesSource, /deliveryHistoryNoteIdentity/);
});

test("ASCII C display prep keeps ordinary floor-note titles stable", () => {
  assert.equal(canonicalFloorNotesTitle(`  ${title}  `), title);
  assert.equal(canonicalFloorNotesTitle(`\t${title}\n`), title);
  assert.equal(canonicalizeFloorNotesTitle(`  ${title}  `), title);
  assert.equal(normalizeOperatorTaskTitle(`  ${title}  `), title);
  assert.equal(normalizeFloorNoteTitle("  Check  walk-in  "), title);
  assert.equal(normalizeCanonicalFloorNotesTitle(`  ${title}  `), title);
  assert.equal(requireCanonicalFloorNotesTitle(`  ${title}  `), title);

  assert.equal(canonicalFloorNotesTitle(accentedTitle), accentedTitle);
  assert.equal(canonicalizeFloorNotesTitle(accentedTitle), accentedTitle);
});

test("NBSP folds and em-space padding cannot invent floor-note titles", () => {
  const nbspTitle = `\u00a0${title}\u00a0`;
  const emTitle = `\u2003${title}\u2003`;
  const internalEm = `Check\u2003walk-in`;

  // Pasted NBSP is folded like restaurant-tasks title / MISE-005ON / #410.
  assert.equal(nbspTitle.trim().replace(/\s+/g, " "), title);
  assert.equal(canonicalFloorNotesTitle(nbspTitle), title);
  assert.equal(canonicalizeFloorNotesTitle(nbspTitle), title);
  assert.equal(normalizeOperatorTaskTitle(nbspTitle), title);
  assert.equal(normalizeCanonicalFloorNotesTitle(nbspTitle), title);

  // Unicode em-space trim + \s collapse invents a clean title; C prep does not.
  assert.equal(emTitle.trim().replace(/\s+/g, " "), title);
  assert.notEqual(canonicalFloorNotesTitle(emTitle), title);
  assert.equal(canonicalFloorNotesTitle(emTitle), emTitle);
  assert.equal(canonicalizeFloorNotesTitle(emTitle), emTitle);
  assert.equal(normalizeOperatorTaskTitle(emTitle), emTitle);
  assert.equal(normalizeCanonicalFloorNotesTitle(emTitle), emTitle);

  assert.equal(internalEm.trim().replace(/\s+/g, " "), title);
  assert.equal(canonicalFloorNotesTitle(internalEm), internalEm);
  assert.notEqual(
    canonicalFloorNotesTitle(internalEm),
    canonicalFloorNotesTitle(title)
  );

  // Kelvin / accents stay presentation-faithful.
  assert.equal(canonicalFloorNotesTitle("Kelvin walk-in"), "Kelvin walk-in");
  assert.notEqual(
    canonicalFloorNotesTitle("Kelvin walk-in"),
    canonicalFloorNotesTitle("Kelvin walk-in")
  );
});

test("floor-note titles soft-empty stays empty and inventing/control/over-long fail closed", () => {
  assert.equal(canonicalizeFloorNotesTitle(""), "");
  assert.equal(canonicalizeFloorNotesTitle("   "), "");
  assert.equal(canonicalizeFloorNotesTitle("\u2003\u2003"), "");
  assert.equal(canonicalizeFloorNotesTitle("\u00a0\u00a0"), "");
  assert.equal(normalizeOperatorTaskTitle("\u2003"), "");
  assert.equal(normalizeCanonicalFloorNotesTitle(null), "");
  assert.equal(normalizeCanonicalFloorNotesTitle(undefined), "");
  assert.equal(normalizeCanonicalFloorNotesTitle("\u2003"), "");

  assert.throws(
    () => normalizeCanonicalFloorNotesTitle(12),
    /Floor note title must be text\./
  );
  assert.throws(
    () => normalizeCanonicalFloorNotesTitle("Bad\u0000title"),
    /Floor note title must be text\./
  );
  assert.throws(
    () => requireCanonicalFloorNotesTitle(""),
    /Floor note title must be text\./
  );
  assert.throws(
    () => requireCanonicalFloorNotesTitle("\u2003"),
    /Floor note title must be text\./
  );

  const overLong = "x".repeat(121);
  assert.equal(canonicalizeFloorNotesTitle(overLong).length, 120);
  assert.throws(
    () => normalizeCanonicalFloorNotesTitle(overLong),
    /Floor note title is outside supported limits\./
  );
});

test("createFloorNote / createOperatorTask persist ASCII C titles without inventing", async () => {
  const restore = setFloorNoteStorageForTesting(memoryStorage());
  try {
    const note = await createFloorNote({
      restaurantId: "restaurant-a",
      title: `\u2003${title}\u2003`,
      timing: "now",
      now: "2026-08-01T12:00:00.000Z"
    });
    assert.equal(note.title, `\u2003${title}\u2003`);
    assert.notEqual(note.title, title);

    const task = await createOperatorTask({
      restaurantId: "restaurant-a",
      title: `\u00a0${title}\u00a0`,
      now: "2026-08-01T12:01:00.000Z"
    });
    assert.equal(task.title, title);

    await assert.rejects(
      () =>
        createFloorNote({
          restaurantId: "restaurant-a",
          title: "\u2003\u2003",
          timing: "now",
          now: "2026-08-01T12:02:00.000Z"
        }),
      /Floor note title is required\./
    );

    await assert.rejects(
      () =>
        createOperatorTask({
          restaurantId: "restaurant-a",
          title: "   ",
          now: "2026-08-01T12:03:00.000Z"
        }),
      /Operator task title is required\./
    );
  } finally {
    restore();
  }
});

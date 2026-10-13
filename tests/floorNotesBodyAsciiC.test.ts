import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createFloorNote,
  createOperatorTask,
  normalizeFloorNoteBody,
  normalizeOperatorTaskBody,
  setFloorNoteStorageForTesting,
  type FloorNoteStorage
} from "../services/application/floorNotes";
import {
  canonicalFloorNotesBody,
  canonicalizeFloorNotesBody,
  normalizeCanonicalFloorNotesBody,
  requireCanonicalFloorNotesBody
} from "../services/application/floorNotesBodyIdentity";

const identitySource = readFileSync(
  new URL("../services/application/floorNotesBodyIdentity.ts", import.meta.url),
  "utf8"
);
const floorNotesSource = readFileSync(
  new URL("../services/application/floorNotes.ts", import.meta.url),
  "utf8"
);

const body = "Ask prep";
const accentedBody = "Revisar cámara fría";
const multilineBody = "Ask prep\nwalk-in floor\tcase.";

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

test("MISE-005PE pins floor-notes bodies to ASCII C free-text prep", () => {
  assert.match(identitySource, /MISE-005PE/);
  assert.match(floorNotesSource, /MISE-005PE/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalFloorNotesBody("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  // Free-text must not collapse internal C whitespace the way title/display-name tips do.
  assert.doesNotMatch(canonicalBody, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.doesNotMatch(canonicalBody, /\.replace\(C_WHITESPACE/);

  assert.match(floorNotesSource, /canonicalizeFloorNotesBody\(value\)/);
  assert.match(floorNotesSource, /from "\.\/floorNotesBodyIdentity"/);
  assert.doesNotMatch(floorNotesSource, /replace\(\/\^\\s\+\//);
  assert.doesNotMatch(floorNotesSource, /replace\(\/\\s\+\$\//);
  assert.doesNotMatch(floorNotesSource, /\[\\^\\S\\n\]\+/);

  // Leave title normalize and restaurant workspace on their existing contracts.
  assert.match(floorNotesSource, /function normalizeOperatorTaskTitle\(/);
  assert.match(floorNotesSource, /function requireRestaurantId\(/);
  assert.match(floorNotesSource, /const normalized = restaurantId\.trim\(\);/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /floorNotesTitleIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesTaskIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksDetailIdentity/);
  assert.doesNotMatch(identitySource, /deliveryHistoryNoteIdentity/);
  assert.doesNotMatch(floorNotesSource, /floorNotesTitleIdentity/);
  assert.doesNotMatch(floorNotesSource, /restaurantTasksDetailIdentity/);
  assert.doesNotMatch(floorNotesSource, /deliveryHistoryNoteIdentity/);
});

test("ASCII C free-text prep keeps ordinary floor-note bodies stable", () => {
  assert.equal(canonicalFloorNotesBody(`  ${body}  `), body);
  assert.equal(canonicalFloorNotesBody(`\t${body}\n`), body);
  assert.equal(canonicalizeFloorNotesBody(`  ${body}  `), body);
  assert.equal(normalizeOperatorTaskBody(`  ${body}  `), body);
  assert.equal(normalizeFloorNoteBody(`  ${body}  `), body);
  assert.equal(normalizeCanonicalFloorNotesBody(`  ${body}  `), body);
  assert.equal(requireCanonicalFloorNotesBody(`  ${body}  `), body);

  assert.equal(canonicalFloorNotesBody(accentedBody), accentedBody);
  assert.equal(canonicalizeFloorNotesBody(accentedBody), accentedBody);
  assert.equal(canonicalFloorNotesBody(multilineBody), multilineBody);
  assert.equal(canonicalizeFloorNotesBody(multilineBody), multilineBody);
  assert.equal(normalizeOperatorTaskBody(multilineBody), multilineBody);

  // Internal double ASCII spaces are preserved (no per-line collapse).
  assert.equal(canonicalFloorNotesBody("Ask  prep"), "Ask  prep");
  assert.equal(normalizeOperatorTaskBody("  Ask  prep  "), "Ask  prep");
  assert.equal(
    normalizeOperatorTaskBody("  Line one  \n  Line two  \n"),
    "Line one  \n  Line two"
  );
});

test("NBSP folds and em-space padding cannot invent floor-note bodies", () => {
  const nbspBody = `\u00a0${body}\u00a0`;
  const emBody = `\u2003${body}\u2003`;
  const internalEm = `Ask\u2003prep`;
  const multilineEm = `\u2003Line one\u2003\n\u2003Line two\u2003`;

  // Pasted NBSP is folded like deliveryHistory / restaurant-tasks detail.
  assert.equal(nbspBody.replace(/^\s+/, "").replace(/\s+$/, ""), body);
  assert.equal(canonicalFloorNotesBody(nbspBody), body);
  assert.equal(canonicalizeFloorNotesBody(nbspBody), body);
  assert.equal(normalizeOperatorTaskBody(nbspBody), body);
  assert.equal(normalizeCanonicalFloorNotesBody(nbspBody), body);

  // Unicode \s end-trim invents a clean body; C prep does not.
  assert.equal(emBody.replace(/^\s+/, "").replace(/\s+$/, ""), body);
  assert.equal(emBody.trim(), body);
  assert.notEqual(canonicalFloorNotesBody(emBody), body);
  assert.equal(canonicalFloorNotesBody(emBody), emBody);
  assert.equal(canonicalizeFloorNotesBody(emBody), emBody);
  assert.equal(normalizeOperatorTaskBody(emBody), emBody);
  assert.equal(normalizeCanonicalFloorNotesBody(emBody), emBody);

  // Prior per-line [^\S\n]+ collapse invented ordinary ASCII spaces mid-line.
  assert.equal(
    internalEm
      .replace(/^\s+/, "")
      .replace(/\s+$/, "")
      .split("\n")
      .map((line) => line.replace(/[^\S\n]+/g, " ").replace(/^ +| +$/g, ""))
      .join("\n"),
    body
  );
  assert.equal(canonicalFloorNotesBody(internalEm), internalEm);
  assert.notEqual(
    canonicalFloorNotesBody(internalEm),
    canonicalFloorNotesBody(body)
  );

  assert.equal(
    multilineEm
      .replace(/^\s+/, "")
      .replace(/\s+$/, "")
      .split("\n")
      .map((line) => line.replace(/[^\S\n]+/g, " ").replace(/^ +| +$/g, ""))
      .join("\n")
      .replace(/^\n+/, "")
      .replace(/\n+$/, ""),
    "Line one\nLine two"
  );
  assert.equal(canonicalFloorNotesBody(multilineEm), multilineEm);
  assert.notEqual(canonicalFloorNotesBody(multilineEm), "Line one\nLine two");
  assert.equal(normalizeOperatorTaskBody(multilineEm), multilineEm);

  // Kelvin / accents stay presentation-faithful.
  assert.equal(canonicalFloorNotesBody("Kelvin walk-in"), "Kelvin walk-in");
  assert.notEqual(
    canonicalFloorNotesBody("Kelvin walk-in"),
    canonicalFloorNotesBody("Kelvin walk-in")
  );
});

test("floor-note bodies soft-empty stay null and inventing/control/over-long fail closed", () => {
  assert.equal(canonicalizeFloorNotesBody(null), null);
  assert.equal(canonicalizeFloorNotesBody(undefined), null);
  assert.equal(canonicalizeFloorNotesBody(""), null);
  assert.equal(canonicalizeFloorNotesBody("   "), null);
  assert.equal(canonicalizeFloorNotesBody("\u2003\u2003"), null);
  assert.equal(canonicalizeFloorNotesBody("\u00a0\u00a0"), null);
  assert.equal(normalizeOperatorTaskBody("\u2003"), null);
  assert.equal(normalizeCanonicalFloorNotesBody(null), null);
  assert.equal(normalizeCanonicalFloorNotesBody(undefined), null);
  assert.equal(normalizeCanonicalFloorNotesBody("\u2003"), null);

  assert.throws(
    () => normalizeCanonicalFloorNotesBody(12),
    /Floor note body must be text\./
  );
  assert.throws(
    () => normalizeCanonicalFloorNotesBody("Bad\u0000body"),
    /Floor note body must be text\./
  );
  // LF/TAB/CR are allowed in fail-closed normalize.
  assert.equal(
    normalizeCanonicalFloorNotesBody("Ask prep\nwalk-in\tfloor\r"),
    "Ask prep\nwalk-in\tfloor"
  );
  assert.throws(
    () => requireCanonicalFloorNotesBody(""),
    /Floor note body must be text\./
  );
  assert.throws(
    () => requireCanonicalFloorNotesBody("\u2003"),
    /Floor note body must be text\./
  );

  const overLong = "x".repeat(2001);
  assert.equal(canonicalizeFloorNotesBody(overLong)!.length, 2000);
  assert.equal(normalizeOperatorTaskBody(overLong)!.length, 2000);
  assert.throws(
    () => normalizeCanonicalFloorNotesBody(overLong),
    /Floor note body is outside supported limits\./
  );

  // Soft presentation does not newly throw on controls (prior path never threw).
  assert.equal(normalizeOperatorTaskBody("Bad\u0000body"), "Bad\u0000body");
});

test("createFloorNote / createOperatorTask persist ASCII C bodies without inventing", async () => {
  const restore = setFloorNoteStorageForTesting(memoryStorage());
  try {
    const note = await createFloorNote({
      restaurantId: "restaurant-a",
      title: "Check walk-in",
      note: `\u2003${body}\u2003`,
      timing: "now",
      now: "2026-08-01T12:00:00.000Z"
    });
    assert.equal(note.body, `\u2003${body}\u2003`);
    assert.equal(note.note, `\u2003${body}\u2003`);
    assert.notEqual(note.body, body);

    const task = await createOperatorTask({
      restaurantId: "restaurant-a",
      title: "Prep station",
      body: `\u00a0${body}\u00a0`,
      now: "2026-08-01T12:01:00.000Z"
    });
    assert.equal(task.body, body);
    assert.equal(task.note, body);

    const multiline = await createOperatorTask({
      restaurantId: "restaurant-a",
      title: "Walk-in notes",
      body: "  Line one  \n  Line two  \n",
      now: "2026-08-01T12:02:00.000Z"
    });
    assert.equal(multiline.body, "Line one  \n  Line two");

    const emptyBody = await createFloorNote({
      restaurantId: "restaurant-a",
      title: "No body",
      note: "\u2003\u2003",
      timing: "later",
      now: "2026-08-01T12:03:00.000Z"
    });
    assert.equal(emptyBody.body, null);
    assert.equal(emptyBody.note, null);
  } finally {
    restore();
  }
});

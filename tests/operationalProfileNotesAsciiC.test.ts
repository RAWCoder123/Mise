import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalizeOperationalProfileNotes,
  canonicalOperationalProfileNotes,
  normalizeCanonicalOperationalProfileNotes,
  requireCanonicalOperationalProfileNotes
} from "../services/domain/operationalProfileNotesIdentity";
import {
  requireOperationalProfileNotes,
  requireRestaurantProfilePatch
} from "../services/miseValidation";
import { RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS } from "../services/domain/securityLimits";

const identitySource = readFileSync(
  new URL("../services/domain/operationalProfileNotesIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const note = "Count before ordering";
const accentedNote = "Contar antes de pedir";
const multilineNote = "Count before ordering.\nCheck cooler first.\tCase count attached.";
const em = "\u2003";
const nbsp = "\u00a0";

const validProfile = {
  serviceStyle: "fast_casual" as const,
  orderCadence: ["Monday"],
  prepWindows: ["Before lunch"],
  primarySuppliers: ["Fresh Produce"],
  inventoryReviewDays: ["Friday"],
  notes: note
};

test("MISE-005PQ pins operational profile notes free-text to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005PQ/);
  assert.match(validationSource, /MISE-005PQ/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalOperationalProfileNotes("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    validationSource,
    /normalizeCanonicalOperationalProfileNotes\(value\)/
  );
  assert.match(
    validationSource,
    /from "\.\/domain\/operationalProfileNotesIdentity"/
  );
  assert.match(
    validationSource,
    /notes: requireOperationalProfileNotes\(profile\.notes\)/
  );

  const requireSlice = validationSource.slice(
    validationSource.indexOf("export function requireOperationalProfileNotes("),
    validationSource.indexOf("export function requireOperationalProfileNotes(") + 350
  );
  assert.doesNotMatch(requireSlice, /value\.trim\(\)/);
  assert.doesNotMatch(requireSlice, /requireNullableBoundedText/);

  // Leave sibling address / name / cuisine inventing and bounded array helper alone.
  assert.match(validationSource, /function requireNullableBoundedText\(/);
  assert.match(
    validationSource.slice(
      validationSource.indexOf("function requireNullableBoundedText("),
      validationSource.indexOf("function requireNullableBoundedText(") + 280
    ),
    /value\.trim\(\)/
  );
  assert.match(
    validationSource.slice(
      validationSource.indexOf("function requireBoundedStringArray("),
      validationSource.indexOf("function requireBoundedStringArray(") + 650
    ),
    /entry\.trim\(\)/
  );
  assert.match(
    validationSource.slice(
      validationSource.indexOf("export function requireRestaurantCuisineType("),
      validationSource.indexOf("export function requireRestaurantCuisineType(") + 350
    ),
    /value\.trim\(\)/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /restaurantAddressIdentity/);
  assert.doesNotMatch(identitySource, /supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/miseValidation"/);
});

test("ASCII C multiline prep keeps ordinary operational profile notes stable", () => {
  assert.equal(canonicalOperationalProfileNotes(`  ${note}  `), note);
  assert.equal(canonicalOperationalProfileNotes(`\t${note}\n`), note);
  assert.equal(canonicalizeOperationalProfileNotes(`  ${note}  `), note);
  assert.equal(normalizeCanonicalOperationalProfileNotes(`  ${note}  `), note);
  assert.equal(requireCanonicalOperationalProfileNotes(`  ${note}  `), note);
  assert.equal(requireOperationalProfileNotes(`  ${note}  `), note);

  assert.equal(canonicalOperationalProfileNotes(accentedNote), accentedNote);
  assert.equal(canonicalizeOperationalProfileNotes(accentedNote), accentedNote);
  assert.equal(requireOperationalProfileNotes(accentedNote), accentedNote);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalOperationalProfileNotes(multilineNote), multilineNote);
  assert.equal(normalizeCanonicalOperationalProfileNotes(multilineNote), multilineNote);
  assert.equal(requireOperationalProfileNotes(multilineNote), multilineNote);

  const patch = requireRestaurantProfilePatch({
    operational_profile: { ...validProfile, notes: `  ${note}  ` }
  });
  assert.equal(patch.operational_profile?.notes, note);
});

test("NBSP folds and em-space padding cannot invent operational profile notes", () => {
  const nbspNote = `${nbsp}${note}${nbsp}`;
  const emNote = `${em}${note}${em}`;
  const internalEm = `Count${em}before ordering`;
  const internalNbsp = `Count${nbsp}before ordering`;
  const emMultiline = `${em}${multilineNote}${em}`;

  // Pasted NBSP is folded like MISE-005PF / MISE-005OS free-text prep.
  assert.equal(nbspNote.trim(), note);
  assert.equal(canonicalOperationalProfileNotes(nbspNote), note);
  assert.equal(canonicalizeOperationalProfileNotes(nbspNote), note);
  assert.equal(normalizeCanonicalOperationalProfileNotes(nbspNote), note);
  assert.equal(requireOperationalProfileNotes(nbspNote), note);
  assert.equal(canonicalOperationalProfileNotes(internalNbsp), "Count before ordering");

  // Unicode em-space trim invents a clean note; C free-text prep does not.
  assert.equal(emNote.trim(), note);
  assert.notEqual(canonicalOperationalProfileNotes(emNote), note);
  assert.equal(canonicalOperationalProfileNotes(emNote), emNote);
  assert.equal(normalizeCanonicalOperationalProfileNotes(emNote), emNote);
  assert.equal(requireOperationalProfileNotes(emNote), emNote);
  assert.notEqual(requireOperationalProfileNotes(emNote), note);

  const emPatch = requireRestaurantProfilePatch({
    operational_profile: { ...validProfile, notes: emNote }
  });
  assert.equal(emPatch.operational_profile?.notes, emNote);
  assert.notEqual(emPatch.operational_profile?.notes, note);

  assert.equal(canonicalOperationalProfileNotes(internalEm), internalEm);
  assert.notEqual(
    canonicalOperationalProfileNotes(internalEm),
    canonicalOperationalProfileNotes(note)
  );

  assert.equal(emMultiline.trim(), multilineNote);
  assert.notEqual(canonicalOperationalProfileNotes(emMultiline), multilineNote);
  assert.equal(canonicalOperationalProfileNotes(emMultiline), emMultiline);
  assert.equal(requireOperationalProfileNotes(emMultiline), emMultiline);

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(
    canonicalOperationalProfileNotes("Kelvin cooler note"),
    "Kelvin cooler note"
  );
  assert.notEqual(
    canonicalOperationalProfileNotes("Kelvin cooler note"),
    canonicalOperationalProfileNotes("Kelvin cooler note")
  );
});

test("operational profile notes soft-empty to null; unsafe control/over-long fail closed", () => {
  assert.equal(canonicalizeOperationalProfileNotes(null), null);
  assert.equal(canonicalizeOperationalProfileNotes(undefined), null);
  assert.equal(canonicalizeOperationalProfileNotes(""), null);
  assert.equal(canonicalizeOperationalProfileNotes("   "), null);
  assert.equal(canonicalizeOperationalProfileNotes("\u00a0\u00a0"), null);
  assert.equal(canonicalizeOperationalProfileNotes("\u2003"), null);
  assert.equal(canonicalizeOperationalProfileNotes("\n\t\r"), null);

  assert.equal(requireOperationalProfileNotes(null), null);
  assert.equal(requireOperationalProfileNotes(undefined), null);
  assert.equal(requireOperationalProfileNotes(""), null);
  assert.equal(requireOperationalProfileNotes("   "), null);
  assert.equal(requireOperationalProfileNotes("\u2003"), null);

  const softPatch = requireRestaurantProfilePatch({
    operational_profile: { ...validProfile, notes: "\u2003" }
  });
  assert.equal(softPatch.operational_profile?.notes, null);

  assert.throws(
    () => normalizeCanonicalOperationalProfileNotes(123),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Operational profile notes must be text or empty."
  );
  assert.throws(
    () => requireOperationalProfileNotes(123),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Operational profile notes must be text or empty."
  );
  assert.throws(
    () => normalizeCanonicalOperationalProfileNotes("Bad\u0000Note"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Operational profile notes must be text or empty."
  );
  assert.throws(
    () => normalizeCanonicalOperationalProfileNotes("Bad\u000bNote"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Operational profile notes must be text or empty."
  );
  assert.throws(
    () => normalizeCanonicalOperationalProfileNotes("Bad\u000cNote"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Operational profile notes must be text or empty."
  );
  assert.throws(
    () => normalizeCanonicalOperationalProfileNotes("Bad\u007fNote"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Operational profile notes must be text or empty."
  );
  assert.equal(
    normalizeCanonicalOperationalProfileNotes("Line1\nLine2\tTabbed\rOk"),
    "Line1\nLine2\tTabbed\rOk"
  );

  assert.throws(
    () =>
      requireOperationalProfileNotes(
        "n".repeat(RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS + 1)
      ),
    (error: unknown) =>
      error instanceof Error &&
      error.message ===
        `Operational profile notes is limited to ${RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS} characters.`
  );
  assert.throws(
    () =>
      requireRestaurantProfilePatch({
        operational_profile: {
          ...validProfile,
          notes: "n".repeat(RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS + 1)
        }
      }),
    /2000 characters/
  );

  assert.equal(
    requireOperationalProfileNotes(
      "n".repeat(RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS)
    ),
    "n".repeat(RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS)
  );
});

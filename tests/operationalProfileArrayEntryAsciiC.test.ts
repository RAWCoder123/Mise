import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOperationalProfileArrayEntryToken,
  canonicalizeOperationalProfileArrayEntry,
  canonicalizeOperationalProfileArrayEntryToken,
  normalizeCanonicalOperationalProfileArrayEntry,
  requireCanonicalOperationalProfileArrayEntry
} from "../services/domain/operationalProfileArrayEntryIdentity";
import { requireRestaurantProfilePatch } from "../services/miseValidation";
import { RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS } from "../services/domain/securityLimits";

const identitySource = readFileSync(
  new URL("../services/domain/operationalProfileArrayEntryIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const entry = "Monday";
const accentedEntry = "Méxicana";
const prepWindow = "Before lunch";
const supplier = "Fresh Produce";
const em = "\u2003";
const nbsp = "\u00a0";

const validProfile = {
  serviceStyle: "fast_casual" as const,
  orderCadence: ["Monday"],
  prepWindows: ["Before lunch"],
  primarySuppliers: ["Fresh Produce"],
  inventoryReviewDays: ["Friday"],
  notes: "Count before ordering"
};

test("MISE-005PR pins operational profile array entries to ASCII C", () => {
  assert.match(identitySource, /MISE-005PR/);
  assert.match(validationSource, /MISE-005PR/);

  assert.match(
    identitySource,
    /export function asciiTrimOperationalProfileArrayEntryToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    validationSource,
    /normalizeCanonicalOperationalProfileArrayEntry\(entry, label\)/
  );
  assert.match(
    validationSource,
    /from "\.\/domain\/operationalProfileArrayEntryIdentity"/
  );

  const requireSlice = validationSource.slice(
    validationSource.indexOf("function requireBoundedStringArray("),
    validationSource.indexOf("function requireBoundedStringArray(") + 750
  );
  assert.doesNotMatch(requireSlice, /entry\.trim\(\)/);
  assert.match(requireSlice, /normalizeCanonicalOperationalProfileArrayEntry\(entry, label\)/);

  // Leave sibling notes / address / cuisine / logo inventing alone.
  assert.match(
    validationSource.slice(
      validationSource.indexOf("notes: requireNullableBoundedText("),
      validationSource.indexOf("notes: requireNullableBoundedText(") + 220
    ),
    /requireNullableBoundedText\(/
  );
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
      validationSource.indexOf("export function requireRestaurantCuisineType("),
      validationSource.indexOf("export function requireRestaurantCuisineType(") + 350
    ),
    /value\.trim\(\)/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /operationalProfileNotesIdentity/);
  assert.doesNotMatch(identitySource, /restaurantAddressIdentity/);
  assert.doesNotMatch(identitySource, /restaurantCuisineTypeIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/miseValidation"/);
});

test("ASCII C prep keeps ordinary operational profile array entries stable", () => {
  assert.equal(asciiTrimOperationalProfileArrayEntryToken(`  ${entry}  `), entry);
  assert.equal(asciiTrimOperationalProfileArrayEntryToken(`\t${entry}\n`), entry);
  assert.equal(canonicalizeOperationalProfileArrayEntryToken(`  ${entry}  `), entry);
  assert.equal(canonicalizeOperationalProfileArrayEntry(`  ${entry}  `), entry);
  assert.equal(normalizeCanonicalOperationalProfileArrayEntry(`  ${entry}  `, "Order cadence"), entry);
  assert.equal(requireCanonicalOperationalProfileArrayEntry(`  ${entry}  `, "Order cadence"), entry);

  assert.equal(canonicalizeOperationalProfileArrayEntry(accentedEntry), accentedEntry);
  assert.equal(
    normalizeCanonicalOperationalProfileArrayEntry(accentedEntry, "Primary suppliers"),
    accentedEntry
  );

  const patch = requireRestaurantProfilePatch({
    operational_profile: {
      ...validProfile,
      orderCadence: [`  ${entry}  `],
      prepWindows: [`\t${prepWindow}\n`],
      primarySuppliers: [`  ${supplier}  `],
      inventoryReviewDays: ["  Friday  "]
    }
  });
  assert.deepEqual(patch.operational_profile?.orderCadence, [entry]);
  assert.deepEqual(patch.operational_profile?.prepWindows, [prepWindow]);
  assert.deepEqual(patch.operational_profile?.primarySuppliers, [supplier]);
  assert.deepEqual(patch.operational_profile?.inventoryReviewDays, ["Friday"]);
});

test("Unicode em-space / NBSP padding cannot invent clean array entries", () => {
  const padded = `${em}${entry}${em}`;
  const nbspEntry = `${nbsp}${entry}${nbsp}`;
  const internalEm = `Mon${em}day`;
  const internalNbsp = `Mon${nbsp}day`;

  // Inventing proof: Unicode trim would invent the clean entry.
  assert.equal(padded.trim(), entry);
  assert.equal(nbspEntry.trim(), entry);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimOperationalProfileArrayEntryToken(padded), padded);
  assert.equal(canonicalizeOperationalProfileArrayEntryToken(padded), null);
  assert.equal(canonicalizeOperationalProfileArrayEntryToken(nbspEntry), null);
  assert.equal(canonicalizeOperationalProfileArrayEntry(padded), null);
  assert.equal(canonicalizeOperationalProfileArrayEntry(nbspEntry), null);

  assert.throws(
    () => normalizeCanonicalOperationalProfileArrayEntry(padded, "Order cadence"),
    /Order cadence entries must be text\./
  );
  assert.throws(
    () => requireCanonicalOperationalProfileArrayEntry(nbspEntry, "Order cadence"),
    /Order cadence entries must be text\./
  );
  assert.throws(
    () =>
      requireRestaurantProfilePatch({
        operational_profile: { ...validProfile, orderCadence: [padded] }
      }),
    /Order cadence entries must be text\./
  );
  assert.throws(
    () =>
      requireRestaurantProfilePatch({
        operational_profile: { ...validProfile, prepWindows: [nbspEntry] }
      }),
    /Prep windows entries must be text\./
  );
  assert.throws(
    () =>
      requireRestaurantProfilePatch({
        operational_profile: {
          ...validProfile,
          primarySuppliers: [`${em}${supplier}${em}`]
        }
      }),
    /Primary suppliers entries must be text\./
  );
  assert.throws(
    () =>
      requireRestaurantProfilePatch({
        operational_profile: {
          ...validProfile,
          inventoryReviewDays: [`${nbsp}Friday${nbsp}`]
        }
      }),
    /Inventory review days entries must be text\./
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeOperationalProfileArrayEntryToken(internalEm), internalEm);
  assert.equal(canonicalizeOperationalProfileArrayEntry(internalNbsp), internalNbsp);
  assert.deepEqual(
    requireRestaurantProfilePatch({
      operational_profile: { ...validProfile, orderCadence: [internalEm] }
    }).operational_profile?.orderCadence,
    [internalEm]
  );

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(
    canonicalizeOperationalProfileArrayEntryToken("Kelvin cooler"),
    "Kelvin cooler"
  );
  assert.notEqual(
    canonicalizeOperationalProfileArrayEntryToken("Kelvin cooler"),
    canonicalizeOperationalProfileArrayEntryToken("Kelvin cooler")
  );
});

test("soft empty array entries stay empty without inventing text; over-long fails closed", () => {
  assert.equal(normalizeCanonicalOperationalProfileArrayEntry(undefined, "Order cadence"), null);
  assert.equal(normalizeCanonicalOperationalProfileArrayEntry("", "Order cadence"), null);
  assert.equal(normalizeCanonicalOperationalProfileArrayEntry("   ", "Order cadence"), null);
  assert.equal(normalizeCanonicalOperationalProfileArrayEntry(`${em}${em}`, "Order cadence"), null);
  assert.equal(normalizeCanonicalOperationalProfileArrayEntry(`${nbsp}`, "Order cadence"), null);
  assert.equal(canonicalizeOperationalProfileArrayEntry(`${em}${em}`), null);

  assert.throws(
    () => requireCanonicalOperationalProfileArrayEntry(`${em}${em}`, "Order cadence"),
    /Order cadence entries must be between 1 and 160 characters\./
  );
  assert.throws(
    () =>
      requireRestaurantProfilePatch({
        operational_profile: { ...validProfile, orderCadence: ["   "] }
      }),
    /Order cadence entries must be between 1 and 160 characters\./
  );
  assert.throws(
    () =>
      requireRestaurantProfilePatch({
        operational_profile: { ...validProfile, orderCadence: [123 as never] }
      }),
    /Order cadence entries must be text\./
  );
  assert.throws(
    () =>
      requireRestaurantProfilePatch({
        operational_profile: { ...validProfile, orderCadence: [`\u0001${entry}`] }
      }),
    /Order cadence entries must be text\./
  );

  const overLong = "a".repeat(RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS + 1);
  assert.throws(
    () =>
      requireRestaurantProfilePatch({
        operational_profile: { ...validProfile, orderCadence: [overLong] }
      }),
    /Order cadence entries must be between 1 and 160 characters\./
  );
  assert.deepEqual(
    requireRestaurantProfilePatch({
      operational_profile: {
        ...validProfile,
        orderCadence: ["a".repeat(RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS)]
      }
    }).operational_profile?.orderCadence,
    ["a".repeat(RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS)]
  );
});

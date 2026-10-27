import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiCLowerDemoSupplierDisplayName,
  asciiTrimDemoSupplierDisplayName,
  canonicalizeDemoSupplierDisplayName,
  normalizeCanonicalDemoSupplierDisplayName,
  normalizeDemoSupplierDiscoveryName
} from "../services/domain/demoSupplierDisplayNameIdentity";
import {
  demoSupplierIdForLegacyName,
  demoSupplierNormalizedName,
  normalizeDemoSupplierDisplayName
} from "../services/demo/demoSupplierIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/demoSupplierDisplayNameIdentity.ts", import.meta.url),
  "utf8"
);
const demoSource = readFileSync(
  new URL("../services/demo/demoSupplierIdentity.ts", import.meta.url),
  "utf8"
);

test("MISE-005SB pins demo supplier display-name identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005SB/);
  assert.match(demoSource, /MISE-005SB/);
  assert.match(
    demoSource,
    /import \{\s*normalizeCanonicalDemoSupplierDisplayName,\s*normalizeDemoSupplierDiscoveryName\s*\} from "\.\.\/domain\/demoSupplierDisplayNameIdentity"/
  );
  assert.match(
    demoSource,
    /export function normalizeDemoSupplierDisplayName\(value: string\) \{\s*return normalizeCanonicalDemoSupplierDisplayName\(value\);\s*\}/
  );
  assert.match(
    demoSource,
    /export function demoSupplierNormalizedName\(value: string\) \{\s*return normalizeDemoSupplierDiscoveryName\(value\);\s*\}/
  );

  // Prior inventing sink was Unicode `.trim()` then Unicode `\s+` collapse —
  // that chain must not return on the live normalize path.
  const normalizeBody = demoSource.slice(
    demoSource.indexOf("export function normalizeDemoSupplierDisplayName("),
    demoSource.indexOf("export function demoSupplierNormalizedName(")
  );
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /replace\(\/\\s\+\//);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(/);

  const discoveryBody = demoSource.slice(
    demoSource.indexOf("export function demoSupplierNormalizedName("),
    demoSource.indexOf("export function demoSupplierIdForLegacyName(")
  );
  assert.doesNotMatch(discoveryBody, /\.toLocaleLowerCase\(/);
  assert.doesNotMatch(discoveryBody, /\.toLowerCase\(/);

  // Leave open hosted #692 / Settings #691 modules alone on main.
  assert.doesNotMatch(demoSource, /supplierDisplayNameIdentity/);
  assert.doesNotMatch(demoSource, /supplierSettingsNameIdentity/);
  assert.doesNotMatch(demoSource, /canonicalSupplierDisplayName/);
});

test("ASCII whitespace still trims and C-collapses clean for demo supplier names", () => {
  assert.equal(normalizeDemoSupplierDisplayName("  Acme Foods  "), "Acme Foods");
  // Prior raw-control gate rejected TAB/LF; only SPACE runs collapse clean.
  assert.equal(normalizeDemoSupplierDisplayName("Acme  Foods"), "Acme Foods");
  assert.equal(
    normalizeDemoSupplierDisplayName("Fresh\u00a0Foods  Co"),
    "Fresh Foods Co"
  );
  assert.equal(asciiTrimDemoSupplierDisplayName("  Acme  "), "Acme");
  assert.equal(canonicalizeDemoSupplierDisplayName("  Acme Foods  "), "Acme Foods");
  assert.equal(demoSupplierNormalizedName("Acme Foods"), "acme foods");
  assert.equal(normalizeDemoSupplierDiscoveryName("Acme Foods"), "acme foods");
  assert.equal(asciiCLowerDemoSupplierDisplayName("Acme Foods"), "acme foods");
  // Accents preserved on display; discovery folds only ASCII A–Z.
  assert.equal(normalizeDemoSupplierDisplayName("Café Suppliers"), "Café Suppliers");
  assert.equal(demoSupplierNormalizedName("Café Suppliers"), "café suppliers");
});

test("Unicode-padded demo supplier names fail closed instead of inventing", () => {
  // Prior Unicode trim invented a clean durable display_name / legacy UUID.
  assert.equal("\u2003Acme Foods\u2003".trim().replace(/\s+/g, " "), "Acme Foods");
  assert.throws(
    () => normalizeDemoSupplierDisplayName("\u2003Acme Foods\u2003"),
    /Enter a valid supplier name\./
  );
  assert.equal(canonicalizeDemoSupplierDisplayName("\u2003Acme Foods\u2003"), null);

  // Internal em-space: prior `\s+` invented a plain-space display name / UUID.
  assert.equal("Acme\u2003Foods".replace(/\s+/g, " "), "Acme Foods");
  assert.throws(
    () => normalizeDemoSupplierDisplayName("Acme\u2003Foods"),
    /Enter a valid supplier name\./
  );
  assert.notEqual(
    canonicalizeDemoSupplierDisplayName("Acme Foods"),
    canonicalizeDemoSupplierDisplayName("Acme\u2003Foods")
  );

  const cleanId = demoSupplierIdForLegacyName(
    "11111111-1111-4111-8111-111111111111",
    "Acme Foods"
  );
  assert.throws(
    () =>
      demoSupplierIdForLegacyName(
        "11111111-1111-4111-8111-111111111111",
        "\u2003Acme Foods\u2003"
      ),
    /Enter a valid supplier name\./
  );
  assert.equal(
    demoSupplierIdForLegacyName("11111111-1111-4111-8111-111111111111", "Acme Foods"),
    cleanId
  );

  // Kelvin-sign locale lower invents a discovery key; ASCII C keeps it distinct.
  assert.equal("\u212aALE".toLocaleLowerCase("en-US"), "kale");
  assert.equal(asciiCLowerDemoSupplierDisplayName("\u212aALE"), "\u212aale");
  assert.notEqual(
    normalizeDemoSupplierDiscoveryName("\u212aALE"),
    normalizeDemoSupplierDiscoveryName("KALE")
  );

  assert.throws(
    () => normalizeDemoSupplierDisplayName("Acme\u0000Foods"),
    /Enter a valid supplier name\./
  );
});

test("soft empty / Unicode-only space stay invalid for demo supplier names", () => {
  assert.throws(() => normalizeDemoSupplierDisplayName(""), /Enter a valid supplier name\./);
  assert.throws(() => normalizeDemoSupplierDisplayName("   "), /Enter a valid supplier name\./);
  assert.throws(() => normalizeDemoSupplierDisplayName("\u2003"), /Enter a valid supplier name\./);
  assert.throws(() => normalizeDemoSupplierDisplayName("\u00a0"), /Enter a valid supplier name\./);
  assert.throws(
    () => normalizeCanonicalDemoSupplierDisplayName(null),
    /Enter a valid supplier name\./
  );
  assert.throws(
    () => normalizeCanonicalDemoSupplierDisplayName(undefined),
    /Enter a valid supplier name\./
  );
  assert.equal(canonicalizeDemoSupplierDisplayName(""), null);
  assert.equal(canonicalizeDemoSupplierDisplayName("\u2003"), null);
});

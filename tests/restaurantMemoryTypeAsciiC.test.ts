import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { catalogs } from "../i18n/catalog";
import {
  asciiTrimRestaurantMemoryType,
  canonicalizeRestaurantMemoryType,
  normalizeRestaurantMemoryType,
  resolveRestaurantMemoryTypeMessageKey
} from "../services/domain/presentationRestaurantMemoryTypeIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationRestaurantMemoryTypeIdentity.ts", import.meta.url),
  "utf8"
);
const restaurantMemorySource = readFileSync(
  new URL("../app/more/restaurant-memory.tsx", import.meta.url),
  "utf8"
);
const domainRestaurantMemorySource = readFileSync(
  new URL("../services/domain/restaurantMemory.ts", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const evidenceSummaryIdentityPath = new URL(
  "../services/domain/presentationRestaurantMemoryEvidenceSummaryIdentity.ts",
  import.meta.url
);
const subtitleRestaurantNameIdentityPath = new URL(
  "../services/domain/presentationMemorySubtitleRestaurantNameIdentity.ts",
  import.meta.url
);
const correctionDraftIdentityPath = new URL(
  "../services/domain/restaurantMemoryCorrectionDraftIdentity.ts",
  import.meta.url
);

const em = "\u2003";
const nbsp = "\u00a0";
const knownType = "demand_pattern";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005ABT pins Restaurant Memory memoryType presentation to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABT/);
  assert.match(restaurantMemorySource, /MISE-005ABT/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantMemoryType\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    restaurantMemorySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationRestaurantMemoryTypeIdentity"/
  );
  assert.match(restaurantMemorySource, /resolveRestaurantMemoryTypeMessageKey\(/);
  assert.match(
    restaurantMemorySource,
    /t\(\s*resolveRestaurantMemoryTypeMessageKey\(\s*memory\.memoryType\s*\)\s*\)/
  );
  assert.doesNotMatch(
    restaurantMemorySource,
    /\{memory\.memoryType\.replace\(\/_\/g, " "\)\}/
  );

  // Leave memory.status on prior always-pass path (deferred tip).
  assert.match(restaurantMemorySource, /\{\s*memory\.status\s*\}/);

  // Leave sibling statement / evidence.summary / correction draft alone.
  assert.match(restaurantMemorySource, /\{memory\.statement\}/);
  assert.doesNotMatch(restaurantMemorySource, /normalizeRestaurantMemoryEvidenceSummary/);
  assert.doesNotMatch(restaurantMemorySource, /normalizeMemorySubtitleRestaurantName/);
  assert.doesNotMatch(restaurantMemorySource, /normalizeRestaurantMemoryCorrectionDraft/);
  assert.doesNotMatch(identitySource, /presentationRestaurantMemoryEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /presentationMemorySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryCorrectionDraftIdentity/);
  assert.match(identitySource, /^import type \{ MessageKey \} from "\.\.\/\.\.\/i18n\/catalog";$/m);
  assert.equal(filePresence(evidenceSummaryIdentityPath), "absent");
  assert.equal(filePresence(subtitleRestaurantNameIdentityPath), "absent");
  assert.equal(filePresence(correctionDraftIdentityPath), "absent");

  // Domain convertMemoryToRule title humanize stays untouched this tip.
  assert.match(
    domainRestaurantMemorySource,
    /title:\s*memory\.memoryType\.replace\(\/_\/g, " "\)/
  );

  assert.match(catalogSource, /"memory\.typeCode\.demand_pattern"/);
  assert.match(catalogSource, /"memory\.typeCode\.supplier_reliability"/);
  assert.match(catalogSource, /"memory\.typeCode\.unknown"/);
});

test("ASCII C prep keeps ordinary Restaurant Memory memoryType tokens stable", () => {
  assert.equal(asciiTrimRestaurantMemoryType(`  ${knownType}  `), knownType);
  assert.equal(asciiTrimRestaurantMemoryType(`\t${knownType}\n`), knownType);
  assert.equal(canonicalizeRestaurantMemoryType(`  ${knownType}  `), knownType);
  assert.equal(normalizeRestaurantMemoryType(`  ${knownType}  `), knownType);
  assert.equal(
    resolveRestaurantMemoryTypeMessageKey(knownType),
    "memory.typeCode.demand_pattern"
  );
  assert.equal(
    resolveRestaurantMemoryTypeMessageKey("supplier_reliability"),
    "memory.typeCode.supplier_reliability"
  );
  assert.equal(
    resolveRestaurantMemoryTypeMessageKey("action_outcome"),
    "memory.typeCode.action_outcome"
  );
  assert.equal(
    resolveRestaurantMemoryTypeMessageKey("recurring_bottleneck"),
    "memory.typeCode.recurring_bottleneck"
  );
});

test("Unicode-only space cannot invent blank-looking Restaurant Memory type chrome", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";

  // Prior always-pass path: truthy Unicode-only space still rendered type chrome.
  assert.equal(Boolean(unicodeOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.notEqual(unicodeOnly, "");

  // Soft-null / unknown path: non-empty unsafe and empty tokens localize to unknown.
  assert.equal(
    resolveRestaurantMemoryTypeMessageKey(unicodeOnly),
    "memory.typeCode.unknown"
  );
  assert.equal(resolveRestaurantMemoryTypeMessageKey(nbspOnly), "memory.typeCode.unknown");
  assert.equal(resolveRestaurantMemoryTypeMessageKey(empty), "memory.typeCode.unknown");
  assert.equal(resolveRestaurantMemoryTypeMessageKey(null), "memory.typeCode.unknown");
  assert.equal(resolveRestaurantMemoryTypeMessageKey(undefined), "memory.typeCode.unknown");
  assert.equal(normalizeRestaurantMemoryType(unicodeOnly), null);
  assert.equal(normalizeRestaurantMemoryType("   "), null);
});

test("Unicode em-space / NBSP padding cannot invent clean Restaurant Memory type tokens", () => {
  const padded = `${em}${knownType}${em}`;
  const nbspType = `${nbsp}${knownType}${nbsp}`;
  const internalEm = `demand${em}pattern`;
  const internalNbsp = `demand${nbsp}pattern`;

  assert.equal(padded.trim(), knownType);
  assert.equal(nbspType.trim(), knownType);
  assert.equal(Boolean(padded), true);

  assert.equal(asciiTrimRestaurantMemoryType(padded), padded);
  assert.equal(canonicalizeRestaurantMemoryType(padded), null);
  assert.equal(normalizeRestaurantMemoryType(padded), null);
  assert.equal(resolveRestaurantMemoryTypeMessageKey(padded), "memory.typeCode.unknown");
  assert.equal(resolveRestaurantMemoryTypeMessageKey(nbspType), "memory.typeCode.unknown");

  // Internal Unicode spaces are not stripped; they fail allowlist closed.
  assert.equal(canonicalizeRestaurantMemoryType(internalEm), null);
  assert.equal(normalizeRestaurantMemoryType(internalNbsp), null);
  assert.equal(resolveRestaurantMemoryTypeMessageKey(internalEm), "memory.typeCode.unknown");
});

test("unknown, control-bearing, and non-allowlisted memory types fail closed to localized unknown", () => {
  assert.equal(
    resolveRestaurantMemoryTypeMessageKey("not_a_real_type"),
    "memory.typeCode.unknown"
  );
  assert.equal(
    resolveRestaurantMemoryTypeMessageKey(`\u0001${knownType}`),
    "memory.typeCode.unknown"
  );
  assert.equal(
    resolveRestaurantMemoryTypeMessageKey(`${knownType}\u0007`),
    "memory.typeCode.unknown"
  );
  assert.equal(
    resolveRestaurantMemoryTypeMessageKey(123 as unknown as string),
    "memory.typeCode.unknown"
  );
  // Trailing ASCII tab trims clean for allowlisted tokens.
  assert.equal(
    resolveRestaurantMemoryTypeMessageKey(`${knownType}\t`),
    "memory.typeCode.demand_pattern"
  );
  assert.equal(normalizeRestaurantMemoryType("Demand_Pattern"), null);
  assert.equal(normalizeRestaurantMemoryType("demand-pattern"), null);
});

test("EN / ES / zh-Hans catalogs carry localized Restaurant Memory type codes", () => {
  const keys = [
    "memory.typeCode.demand_pattern",
    "memory.typeCode.supplier_reliability",
    "memory.typeCode.action_outcome",
    "memory.typeCode.unknown"
  ] as const;

  for (const key of keys) {
    assert.equal(typeof catalogs.en[key], "string");
    assert.equal(typeof catalogs.es[key], "string");
    assert.equal(typeof catalogs["zh-Hans"][key], "string");
    assert.notEqual(catalogs.en[key].trim(), "");
    assert.notEqual(catalogs.es[key].trim(), "");
    assert.notEqual(catalogs["zh-Hans"][key].trim(), "");
    // Localized copy must not echo the machine token.
    assert.doesNotMatch(catalogs.en[key], /demand_pattern|supplier_reliability|action_outcome/);
  }

  assert.match(catalogs.en["memory.typeCode.demand_pattern"], /Demand pattern/i);
  assert.match(catalogs.es["memory.typeCode.demand_pattern"], /demanda/i);
  assert.match(catalogs["zh-Hans"]["memory.typeCode.demand_pattern"], /需求/);
});

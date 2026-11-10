import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { catalogs } from "../i18n/catalog";
import {
  asciiTrimRestaurantMemoryStatus,
  canonicalizeRestaurantMemoryStatus,
  normalizeRestaurantMemoryStatus,
  resolveRestaurantMemoryStatusMessageKey
} from "../services/domain/presentationRestaurantMemoryStatusIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationRestaurantMemoryStatusIdentity.ts", import.meta.url),
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
const memoryTypeIdentityPath = new URL(
  "../services/domain/presentationRestaurantMemoryTypeIdentity.ts",
  import.meta.url
);

const em = "\u2003";
const nbsp = "\u00a0";
const knownStatus = "confirmed";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005ABU pins Restaurant Memory memory.status presentation to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABU/);
  assert.match(restaurantMemorySource, /MISE-005ABU/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantMemoryStatus\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    restaurantMemorySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationRestaurantMemoryStatusIdentity"/
  );
  assert.match(restaurantMemorySource, /resolveRestaurantMemoryStatusMessageKey\(/);
  assert.match(
    restaurantMemorySource,
    /t\(\s*resolveRestaurantMemoryStatusMessageKey\(\s*memory\.status\s*\)\s*\)/
  );
  assert.doesNotMatch(restaurantMemorySource, /\{\s*memory\.status\s*\}/);

  // Leave memoryType on prior always-pass path (owned by MISE-005ABT / #1230).
  assert.match(restaurantMemorySource, /\{memory\.memoryType\.replace\(\/_\/g, " "\)\}/);
  assert.doesNotMatch(restaurantMemorySource, /resolveRestaurantMemoryTypeMessageKey/);
  assert.equal(filePresence(memoryTypeIdentityPath), "absent");

  // Leave sibling statement / evidence.summary / correction draft alone.
  assert.match(restaurantMemorySource, /\{memory\.statement\}/);
  assert.doesNotMatch(restaurantMemorySource, /normalizeRestaurantMemoryEvidenceSummary/);
  assert.doesNotMatch(restaurantMemorySource, /normalizeMemorySubtitleRestaurantName/);
  assert.doesNotMatch(restaurantMemorySource, /normalizeRestaurantMemoryCorrectionDraft/);
  assert.doesNotMatch(identitySource, /presentationRestaurantMemoryEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /presentationMemorySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryCorrectionDraftIdentity/);
  assert.doesNotMatch(identitySource, /presentationRestaurantMemoryTypeIdentity/);
  assert.match(identitySource, /^import type \{ MessageKey \} from "\.\.\/\.\.\/i18n\/catalog";$/m);
  assert.equal(filePresence(evidenceSummaryIdentityPath), "absent");
  assert.equal(filePresence(subtitleRestaurantNameIdentityPath), "absent");
  assert.equal(filePresence(correctionDraftIdentityPath), "absent");

  // Domain convertMemoryToRule title humanize stays untouched this tip.
  assert.match(
    domainRestaurantMemorySource,
    /title:\s*memory\.memoryType\.replace\(\/_\/g, " "\)/
  );

  assert.match(catalogSource, /"memory\.statusCode\.active"/);
  assert.match(catalogSource, /"memory\.statusCode\.confirmed"/);
  assert.match(catalogSource, /"memory\.statusCode\.forgotten"/);
  assert.match(catalogSource, /"memory\.statusCode\.unknown"/);
});

test("ASCII C prep keeps ordinary Restaurant Memory memory.status tokens stable", () => {
  assert.equal(asciiTrimRestaurantMemoryStatus(`  ${knownStatus}  `), knownStatus);
  assert.equal(asciiTrimRestaurantMemoryStatus(`\t${knownStatus}\n`), knownStatus);
  assert.equal(canonicalizeRestaurantMemoryStatus(`  ${knownStatus}  `), knownStatus);
  assert.equal(normalizeRestaurantMemoryStatus(`  ${knownStatus}  `), knownStatus);
  assert.equal(
    resolveRestaurantMemoryStatusMessageKey(knownStatus),
    "memory.statusCode.confirmed"
  );
  assert.equal(resolveRestaurantMemoryStatusMessageKey("active"), "memory.statusCode.active");
  assert.equal(
    resolveRestaurantMemoryStatusMessageKey("dismissed"),
    "memory.statusCode.dismissed"
  );
  assert.equal(
    resolveRestaurantMemoryStatusMessageKey("forgotten"),
    "memory.statusCode.forgotten"
  );
  assert.equal(resolveRestaurantMemoryStatusMessageKey("disabled"), "memory.statusCode.disabled");
  assert.equal(
    resolveRestaurantMemoryStatusMessageKey("corrected"),
    "memory.statusCode.corrected"
  );
});

test("Unicode-only space cannot invent blank-looking Restaurant Memory status chrome", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";

  // Prior always-pass path: truthy Unicode-only space still rendered status chrome.
  assert.equal(Boolean(unicodeOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.notEqual(unicodeOnly, "");

  // Soft-null / unknown path: non-empty unsafe and empty tokens localize to unknown.
  assert.equal(
    resolveRestaurantMemoryStatusMessageKey(unicodeOnly),
    "memory.statusCode.unknown"
  );
  assert.equal(resolveRestaurantMemoryStatusMessageKey(nbspOnly), "memory.statusCode.unknown");
  assert.equal(resolveRestaurantMemoryStatusMessageKey(empty), "memory.statusCode.unknown");
  assert.equal(resolveRestaurantMemoryStatusMessageKey(null), "memory.statusCode.unknown");
  assert.equal(resolveRestaurantMemoryStatusMessageKey(undefined), "memory.statusCode.unknown");
  assert.equal(normalizeRestaurantMemoryStatus(unicodeOnly), null);
  assert.equal(normalizeRestaurantMemoryStatus("   "), null);
});

test("Unicode em-space / NBSP padding cannot invent clean Restaurant Memory status tokens", () => {
  const padded = `${em}${knownStatus}${em}`;
  const nbspStatus = `${nbsp}${knownStatus}${nbsp}`;
  const internalEm = `con${em}firmed`;
  const internalNbsp = `con${nbsp}firmed`;

  assert.equal(padded.trim(), knownStatus);
  assert.equal(nbspStatus.trim(), knownStatus);
  assert.equal(Boolean(padded), true);

  assert.equal(asciiTrimRestaurantMemoryStatus(padded), padded);
  assert.equal(canonicalizeRestaurantMemoryStatus(padded), null);
  assert.equal(normalizeRestaurantMemoryStatus(padded), null);
  assert.equal(resolveRestaurantMemoryStatusMessageKey(padded), "memory.statusCode.unknown");
  assert.equal(resolveRestaurantMemoryStatusMessageKey(nbspStatus), "memory.statusCode.unknown");

  // Internal Unicode spaces are not stripped; they fail allowlist closed.
  assert.equal(canonicalizeRestaurantMemoryStatus(internalEm), null);
  assert.equal(normalizeRestaurantMemoryStatus(internalNbsp), null);
  assert.equal(resolveRestaurantMemoryStatusMessageKey(internalEm), "memory.statusCode.unknown");
});

test("unknown, control-bearing, and non-allowlisted memory statuses fail closed to localized unknown", () => {
  assert.equal(
    resolveRestaurantMemoryStatusMessageKey("not_a_real_status"),
    "memory.statusCode.unknown"
  );
  assert.equal(
    resolveRestaurantMemoryStatusMessageKey(`\u0001${knownStatus}`),
    "memory.statusCode.unknown"
  );
  assert.equal(
    resolveRestaurantMemoryStatusMessageKey(`${knownStatus}\u0007`),
    "memory.statusCode.unknown"
  );
  assert.equal(
    resolveRestaurantMemoryStatusMessageKey(123 as unknown as string),
    "memory.statusCode.unknown"
  );
  // Trailing ASCII tab trims clean for allowlisted tokens.
  assert.equal(
    resolveRestaurantMemoryStatusMessageKey(`${knownStatus}\t`),
    "memory.statusCode.confirmed"
  );
  assert.equal(normalizeRestaurantMemoryStatus("Confirmed"), null);
  assert.equal(normalizeRestaurantMemoryStatus("ACTIVE"), null);
});

test("EN / ES / zh-Hans catalogs carry localized Restaurant Memory status codes", () => {
  const keys = [
    "memory.statusCode.active",
    "memory.statusCode.confirmed",
    "memory.statusCode.forgotten",
    "memory.statusCode.unknown"
  ] as const;

  for (const key of keys) {
    assert.equal(typeof catalogs.en[key], "string");
    assert.equal(typeof catalogs.es[key], "string");
    assert.equal(typeof catalogs["zh-Hans"][key], "string");
    assert.notEqual(catalogs.en[key].trim(), "");
    assert.notEqual(catalogs.es[key].trim(), "");
    assert.notEqual(catalogs["zh-Hans"][key].trim(), "");
    // Localized copy must not echo the machine token.
    assert.doesNotMatch(catalogs.en[key], /\bactive\b|\bconfirmed\b|\bforgotten\b/);
  }

  assert.match(catalogs.en["memory.statusCode.confirmed"], /Confirmed/i);
  assert.match(catalogs.es["memory.statusCode.confirmed"], /Confirmada/i);
  assert.match(catalogs["zh-Hans"]["memory.statusCode.confirmed"], /确认/);
});

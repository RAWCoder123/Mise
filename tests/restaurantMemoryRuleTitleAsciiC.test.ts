import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  convertMemoryToRule,
  type RestaurantMemory,
  type RestaurantMemoryType
} from "../services/domain/restaurantMemory";
import {
  asciiTrimRestaurantMemoryRuleTitleType,
  canonicalizeRestaurantMemoryRuleTitleType,
  normalizeRestaurantMemoryRuleTitleType
} from "../services/domain/restaurantMemoryRuleTitleIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantMemoryRuleTitleIdentity.ts", import.meta.url),
  "utf8"
);
const restaurantMemorySource = readFileSync(
  new URL("../services/domain/restaurantMemory.ts", import.meta.url),
  "utf8"
);
const restaurantMemoryUiSource = readFileSync(
  new URL("../app/more/restaurant-memory.tsx", import.meta.url),
  "utf8"
);
const presentationTypeIdentityPath = new URL(
  "../services/domain/presentationRestaurantMemoryTypeIdentity.ts",
  import.meta.url
);
const presentationStatusIdentityPath = new URL(
  "../services/domain/presentationRestaurantMemoryStatusIdentity.ts",
  import.meta.url
);
const activityCycleIdentityPath = new URL(
  "../services/domain/activityRecalculationCycleIdentity.ts",
  import.meta.url
);

const memoryType = "demand_pattern";
const em = "\u2003";
const nbsp = "\u00a0";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

function sampleMemory(
  overrides: Partial<RestaurantMemory> = {}
): RestaurantMemory {
  return {
    id: "memory-1",
    restaurantId: "restaurant-1",
    memoryType,
    statement: "Friday lunch demand runs about 18% higher than midweek.",
    evidence: [],
    confidence: 0.72,
    firstObservedAt: "2026-10-01T12:00:00.000Z",
    lastUpdatedAt: "2026-11-10T12:00:00.000Z",
    scope: "restaurant",
    source: "mise_learning",
    status: "confirmed",
    affectsRecommendations: true,
    affectsAutomation: false,
    correctionNote: null,
    ...overrides
  };
}

test("MISE-005ABX pins convertMemoryToRule title to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABX/);
  assert.match(restaurantMemorySource, /MISE-005ABX/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantMemoryRuleTitleType\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    restaurantMemorySource,
    /from "\.\/restaurantMemoryRuleTitleIdentity"/
  );
  assert.match(restaurantMemorySource, /normalizeRestaurantMemoryRuleTitleType\(/);
  assert.match(restaurantMemorySource, /restaurantMemoryRuleDisplayType/);
  assert.match(
    restaurantMemorySource,
    /normalizeRestaurantMemoryRuleTitleType\(\s*memory\.memoryType\s*\)\s*\?\?\s*"unknown"/
  );
  assert.match(
    restaurantMemorySource,
    /title: restaurantMemoryRuleDisplayType\.replace\(\/_\/g, " "\)/
  );
  assert.doesNotMatch(
    restaurantMemorySource,
    /title: memory\.memoryType\.replace\(\/_\/g, " "\)/
  );

  // Leave hub presentation/i18n tips alone (open #1230 / #1231).
  assert.doesNotMatch(restaurantMemorySource, /presentationRestaurantMemoryTypeIdentity/);
  assert.doesNotMatch(restaurantMemorySource, /presentationRestaurantMemoryStatusIdentity/);
  assert.doesNotMatch(identitySource, /presentationRestaurantMemoryTypeIdentity/);
  assert.doesNotMatch(identitySource, /memory\.typeCode\./);
  assert.doesNotMatch(identitySource, /memory\.statusCode\./);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(presentationTypeIdentityPath), "absent");
  assert.equal(filePresence(presentationStatusIdentityPath), "absent");
  assert.equal(filePresence(activityCycleIdentityPath), "absent");

  // Hub UI memoryType humanize remains for open #1230 to own.
  assert.match(
    restaurantMemoryUiSource,
    /memory\.memoryType\.replace\(\/_\/g, " "\)/
  );

  assert.equal(normalizeRestaurantMemoryRuleTitleType(memoryType), memoryType);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(` ${memoryType} `), memoryType);
  assert.equal(normalizeRestaurantMemoryRuleTitleType("supplier_reliability"), "supplier_reliability");
  assert.equal(normalizeRestaurantMemoryRuleTitleType("waste_pattern"), "waste_pattern");
  assert.equal(normalizeRestaurantMemoryRuleTitleType("action_outcome"), "action_outcome");
});

test("Unicode padding invents via trim and is soft-nulled for convertMemoryToRule title", () => {
  const padded = `${em}${memoryType}${em}`;
  const nbspName = `${nbsp}${memoryType}${nbsp}`;
  const internalEm = `demand${em}pattern`;
  const internalNbsp = `demand${nbsp}pattern`;

  // Inventing proof: Unicode trim would invent the clean memory type.
  assert.equal(padded.trim(), memoryType);
  assert.equal(nbspName.trim(), memoryType);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // Prior always-pass path would still humanize a padded type into
  // blank-looking / padded display copy (em-space preserved; underscore
  // replaced), inventing clean equality only via Unicode trim.
  assert.equal(Boolean(padded.trim()), true);
  assert.equal(padded.replace(/_/g, " "), `${em}demand pattern${em}`);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRestaurantMemoryRuleTitleType(padded), padded);
  assert.equal(canonicalizeRestaurantMemoryRuleTitleType(padded), null);
  assert.equal(canonicalizeRestaurantMemoryRuleTitleType(nbspName), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(padded), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(nbspName), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(padded) ?? "unknown", "unknown");

  // Internal Unicode spaces are not stripped; they fail allowlist rather than
  // inventing a clean snake_case type via Unicode trim.
  assert.equal(canonicalizeRestaurantMemoryRuleTitleType(internalEm), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(internalNbsp), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(internalEm), null);
});

test("soft empty, controls, unknown, and non-strings fail closed for convertMemoryToRule title", () => {
  assert.equal(normalizeRestaurantMemoryRuleTitleType(undefined), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(null), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(""), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType("   "), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(123 as unknown as string), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(`\u0001${memoryType}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRestaurantMemoryRuleTitleType(`${memoryType}\t`), memoryType);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(`${memoryType}\u0007`), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(em), null);
  // Unknown machine tokens must not invent underscore-humanized titles.
  assert.equal(normalizeRestaurantMemoryRuleTitleType("not_a_real_memory_type"), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType("DEMAND_PATTERN"), null);
});

test("convertMemoryToRule title bypass proof: empty and Unicode-only-space soft-null to unknown", () => {
  // Prior always-pass path still rendered blank-looking title identity
  // (`" "`). Soft-null restores the intentional "unknown" title fallthrough.
  assert.equal(normalizeRestaurantMemoryRuleTitleType(""), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(em), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(nbsp), null);
  assert.match(
    restaurantMemorySource,
    /normalizeRestaurantMemoryRuleTitleType\(\s*memory\.memoryType\s*\)\s*\?\?\s*"unknown"/
  );
  assert.match(
    restaurantMemorySource,
    /title: restaurantMemoryRuleDisplayType\.replace\(\/_\/g, " "\)/
  );

  const blankLooking = convertMemoryToRule(
    sampleMemory({ memoryType: em as RestaurantMemoryType })
  );
  assert.equal(blankLooking.title, "unknown");
  assert.doesNotMatch(blankLooking.title, /\u2003/);

  const ordinary = convertMemoryToRule(
    sampleMemory({ memoryType: "supplier_reliability" })
  );
  assert.equal(ordinary.title, "supplier reliability");
  assert.equal(ordinary.enabled, false);
  assert.equal(ordinary.memoryId, "memory-1");
});

test("convertMemoryToRule title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${memoryType}${em}`;
  assert.notEqual(asciiTrimRestaurantMemoryRuleTitleType(padded), padded.trim());
  assert.equal(normalizeRestaurantMemoryRuleTitleType(padded), null);
  assert.equal(normalizeRestaurantMemoryRuleTitleType(`\t${memoryType}\n`), memoryType);

  const paddedRule = convertMemoryToRule(
    sampleMemory({ memoryType: padded as RestaurantMemoryType })
  );
  assert.equal(paddedRule.title, "unknown");
  assert.doesNotMatch(paddedRule.title, /demand pattern/);

  const unknownRule = convertMemoryToRule(
    sampleMemory({ memoryType: "invented_token" as RestaurantMemoryType })
  );
  assert.equal(unknownRule.title, "unknown");
  assert.doesNotMatch(unknownRule.title, /invented token/);
});

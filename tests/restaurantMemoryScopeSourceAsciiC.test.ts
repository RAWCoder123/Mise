import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createMemory,
  restaurantMemoryFromPersistedRow,
  type PersistedRestaurantMemoryRow
} from "../services/domain/restaurantMemory";
import {
  asciiTrimRestaurantMemoryScopeSourceToken,
  canonicalizeRestaurantMemoryScopeSourceToken,
  normalizeCanonicalRestaurantMemoryScope,
  normalizeCanonicalRestaurantMemorySource,
  requireCanonicalRestaurantMemoryScope,
  requireCanonicalRestaurantMemorySource
} from "../services/domain/restaurantMemoryScopeSourceIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantMemoryScopeSourceIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantMemory.ts", import.meta.url),
  "utf8"
);

const scope = "restaurant";
const source = "mise_learning";
const locationScope = "location";
const learningSource = "learning_memory_summary";
const em = "\u2003";
const nbsp = "\u00a0";

const baseEvidence = [
  {
    type: "sales_window",
    id: "fri_4w",
    summary: "Last four Fridays above weekday baseline",
    observedAt: "2026-08-01T12:00:00.000Z"
  }
] as const;

const baseRow: PersistedRestaurantMemoryRow = {
  id: "memory-1",
  restaurant_id: "restaurant-a",
  memory_type: "demand_pattern",
  statement: "Friday dinner demand is typically 18% higher.",
  evidence: [...baseEvidence],
  confidence: 0.55,
  first_observed_at: "2026-08-01T12:00:00.000Z",
  last_updated_at: "2026-08-02T12:00:00.000Z",
  scope,
  source,
  status: "active",
  affects_recommendations: true,
  affects_automation: false,
  correction: null
};

test("MISE-005PG pins restaurant-memory scope and source to ASCII C", () => {
  assert.match(identitySource, /MISE-005PG/);
  assert.match(domainSource, /MISE-005PG/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantMemoryScopeSourceToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /scope: normalizeCanonicalRestaurantMemoryScope\(input\.scope\) \?\? "restaurant"/
  );
  assert.match(
    domainSource,
    /source: normalizeCanonicalRestaurantMemorySource\(input\.source\) \?\? "mise_learning"/
  );
  assert.match(
    domainSource,
    /scope: requireCanonicalRestaurantMemoryScope\(row\.scope\)/
  );
  assert.match(
    domainSource,
    /source: requireCanonicalRestaurantMemorySource\(row\.source\)/
  );
  assert.match(domainSource, /from "\.\/restaurantMemoryScopeSourceIdentity"/);

  // Leave sibling statement / restaurantId / learning-signal surfaces alone.
  assert.match(domainSource, /const normalized = restaurantId\.trim\(\);/);
  assert.match(
    domainSource,
    /const normalized = value\.trim\(\)\.replace\(\/\\s\+\/g, " "\);/
  );
  assert.match(
    domainSource,
    /\.filter\(\(signal\) => signal\.label\.trim\(\) && signal\.detail\.trim\(\)\)/
  );
  assert.match(
    domainSource,
    /statement: row\.correction\?\.trim\(\) \|\| row\.statement/
  );

  // Do not import or rewrite the open statement free-text tip module.
  assert.doesNotMatch(domainSource, /restaurantMemoryStatementIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryStatementIdentity/);
});

test("ASCII C prep keeps ordinary restaurant-memory scope and source stable", () => {
  assert.equal(asciiTrimRestaurantMemoryScopeSourceToken(`  ${scope}  `), scope);
  assert.equal(asciiTrimRestaurantMemoryScopeSourceToken(`\t${source}\n`), source);
  assert.equal(canonicalizeRestaurantMemoryScopeSourceToken(`  ${scope}  `), scope);
  assert.equal(normalizeCanonicalRestaurantMemoryScope(`  ${locationScope}  `), locationScope);
  assert.equal(normalizeCanonicalRestaurantMemorySource(`  ${learningSource}  `), learningSource);
  assert.equal(requireCanonicalRestaurantMemoryScope(`  ${scope}  `), scope);
  assert.equal(requireCanonicalRestaurantMemorySource(`  ${source}  `), source);

  const memory = createMemory({
    restaurantId: "restaurant-a",
    memoryType: "demand_pattern",
    statement: "Friday dinner demand is typically 18% higher.",
    evidence: baseEvidence,
    scope: `  ${locationScope}  `,
    source: `  ${learningSource}  `,
    now: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(memory.scope, locationScope);
  assert.equal(memory.source, learningSource);

  const hydrated = restaurantMemoryFromPersistedRow({
    ...baseRow,
    scope: `  ${scope}  `,
    source: `  ${source}  `
  });
  assert.equal(hydrated.scope, scope);
  assert.equal(hydrated.source, source);
});

test("Unicode em-space / NBSP padding cannot invent clean scope or source keys", () => {
  const paddedScope = `${em}${scope}${em}`;
  const paddedSource = `${em}${source}${em}`;
  const nbspScope = `${nbsp}${scope}${nbsp}`;
  const nbspSource = `${nbsp}${source}${nbsp}`;

  // Inventing proof: Unicode trim would invent the clean key.
  assert.equal(paddedScope.trim(), scope);
  assert.equal(paddedSource.trim(), source);
  assert.equal(nbspScope.trim(), scope);
  assert.equal(nbspSource.trim(), source);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRestaurantMemoryScopeSourceToken(paddedScope), paddedScope);
  assert.equal(canonicalizeRestaurantMemoryScopeSourceToken(paddedScope), null);
  assert.equal(canonicalizeRestaurantMemoryScopeSourceToken(nbspScope), null);
  assert.equal(canonicalizeRestaurantMemoryScopeSourceToken(paddedSource), null);
  assert.equal(canonicalizeRestaurantMemoryScopeSourceToken(nbspSource), null);

  assert.throws(
    () => normalizeCanonicalRestaurantMemoryScope(paddedScope),
    /Restaurant memory scope is invalid\./
  );
  assert.throws(
    () => normalizeCanonicalRestaurantMemorySource(paddedSource),
    /Restaurant memory source is invalid\./
  );
  assert.throws(
    () => requireCanonicalRestaurantMemoryScope(nbspScope),
    /Restaurant memory scope is invalid\./
  );
  assert.throws(
    () => requireCanonicalRestaurantMemorySource(nbspSource),
    /Restaurant memory source is invalid\./
  );

  assert.throws(
    () =>
      createMemory({
        restaurantId: "restaurant-a",
        memoryType: "demand_pattern",
        statement: "Friday dinner demand is typically 18% higher.",
        evidence: baseEvidence,
        scope: paddedScope,
        now: "2026-08-02T12:00:00.000Z"
      }),
    /Restaurant memory scope is invalid\./
  );
  assert.throws(
    () =>
      createMemory({
        restaurantId: "restaurant-a",
        memoryType: "demand_pattern",
        statement: "Friday dinner demand is typically 18% higher.",
        evidence: baseEvidence,
        source: paddedSource,
        now: "2026-08-02T12:00:00.000Z"
      }),
    /Restaurant memory source is invalid\./
  );
  assert.throws(
    () =>
      restaurantMemoryFromPersistedRow({
        ...baseRow,
        scope: paddedScope
      }),
    /Restaurant memory scope is invalid\./
  );
  assert.throws(
    () =>
      restaurantMemoryFromPersistedRow({
        ...baseRow,
        source: paddedSource
      }),
    /Restaurant memory source is invalid\./
  );
});

test("soft empty scope and source preserve create defaults without inventing on hydrate", () => {
  assert.equal(normalizeCanonicalRestaurantMemoryScope(undefined), null);
  assert.equal(normalizeCanonicalRestaurantMemoryScope(""), null);
  assert.equal(normalizeCanonicalRestaurantMemoryScope("   "), null);
  assert.equal(normalizeCanonicalRestaurantMemoryScope(`${em}${em}`), null);
  assert.equal(normalizeCanonicalRestaurantMemorySource(undefined), null);
  assert.equal(normalizeCanonicalRestaurantMemorySource(`${nbsp}`), null);

  const defaulted = createMemory({
    restaurantId: "restaurant-a",
    memoryType: "demand_pattern",
    statement: "Friday dinner demand is typically 18% higher.",
    evidence: baseEvidence,
    scope: `${em}${em}`,
    source: "   ",
    now: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(defaulted.scope, "restaurant");
  assert.equal(defaulted.source, "mise_learning");

  const omitted = createMemory({
    restaurantId: "restaurant-a",
    memoryType: "demand_pattern",
    statement: "Friday dinner demand is typically 18% higher.",
    evidence: baseEvidence,
    now: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(omitted.scope, "restaurant");
  assert.equal(omitted.source, "mise_learning");

  // Hydrate must not invent create-time defaults from soft empty.
  assert.throws(
    () => requireCanonicalRestaurantMemoryScope(`${em}${em}`),
    /Restaurant memory scope is invalid\./
  );
  assert.throws(
    () => requireCanonicalRestaurantMemorySource("   "),
    /Restaurant memory source is invalid\./
  );
  assert.throws(
    () =>
      restaurantMemoryFromPersistedRow({
        ...baseRow,
        scope: `${em}${em}`
      }),
    /Restaurant memory scope is invalid\./
  );
});

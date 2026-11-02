import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildTodaySummary } from "../services/domain/miseDomain";
import {
  asciiTrimTodayAttentionWhyItMatters,
  canonicalizeTodayAttentionWhyItMatters,
  normalizeTodayAttentionWhyItMatters
} from "../services/domain/presentationTodayAttentionWhyItMattersIdentity";
import type { Insight, Restaurant } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/presentationTodayAttentionWhyItMattersIdentity.ts", import.meta.url),
  "utf8"
);
const miseDomainSource = readFileSync(
  new URL("../services/domain/miseDomain.ts", import.meta.url),
  "utf8"
);
const dailyOpsReportSource = readFileSync(
  new URL("../services/domain/dailyOpsReport.ts", import.meta.url),
  "utf8"
);
const operatingBriefSource = readFileSync(
  new URL("../services/domain/operatingBrief.ts", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");

const whyProse = "Sales spike on weekends";
const accentedWhy = "Préparation accélérée avant le rush";
const FALLBACK = "Mise is learning this pattern.";
const em = "\u2003";
const nbsp = "\u00a0";
const restaurantId = "rest_ascii_c_today_attention_why";
const operatingDate = "2026-11-02";

function restaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: restaurantId,
    name: "Harbor Bistro",
    address: null,
    cuisine_type: "Coastal",
    brand_color: "#C4553D",
    accent_color: "#C4553D",
    logo_url: null,
    service_style: "full_service",
    timezone: "America/New_York",
    currency: "USD",
    operational_profile: {
      serviceStyle: "full_service",
      orderCadence: [],
      prepWindows: [],
      primarySuppliers: [],
      inventoryReviewDays: [],
      notes: null
    },
    created_at: "2026-11-02T07:00:00.000Z",
    ...overrides
  };
}

/**
 * Higher-severity non-sales insight so `importantInsight` owns the
 * `why_it_matters ?? undefined` attention row and does not swallow the
 * sales-spike English-fallback tip under the same title.
 */
function blockingInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "insight_ascii_c_blocking",
    restaurant_id: restaurantId,
    insight_type: "inventory",
    title: "Walk-in variance needs a count",
    description: "Physical counts disagree with projected on-hand.",
    why_it_matters: "Count before approving the next order.",
    recommended_action: "Start an inventory count for high-risk items.",
    severity: "urgent",
    created_at: "2026-11-02T07:00:00.000Z",
    ...overrides
  };
}

function salesInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "insight_ascii_c_sales_spike",
    restaurant_id: restaurantId,
    insight_type: "sales",
    title: "Weekend sales are climbing",
    description: "Recorded covers rose versus the prior weekend.",
    why_it_matters: whyProse,
    recommended_action: "Prep extra herb garnish before Friday service.",
    severity: "warning",
    created_at: "2026-11-02T07:00:00.000Z",
    ...overrides
  };
}

function spikeAttentionContext(summary: ReturnType<typeof buildTodaySummary>) {
  return summary.attentionCards.find((card) => card.id === "attention_insight_ascii_c_sales_spike")
    ?.context;
}

function buildSpikeSummary(why: string | null | undefined) {
  return buildTodaySummary(
    restaurant(),
    [],
    [],
    [],
    [blockingInsight(), salesInsight({ why_it_matters: why })],
    [],
    operatingDate
  );
}

test("MISE-005WB pins miseDomain TodaySummary sales-spike why_it_matters to ASCII C", () => {
  assert.match(identitySource, /MISE-005WB/);
  assert.match(miseDomainSource, /MISE-005WB/);

  assert.match(
    identitySource,
    /export function asciiTrimTodayAttentionWhyItMatters\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Attention why tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimTodayAttentionWhyItMatters("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    miseDomainSource,
    /from "\.\/presentationTodayAttentionWhyItMattersIdentity"/
  );
  assert.match(miseDomainSource, /normalizeTodayAttentionWhyItMatters\(/);
  assert.match(
    miseDomainSource,
    /normalizeTodayAttentionWhyItMatters\(spikeInsight\.why_it_matters\)\s*\?\?\s*"Mise is learning this pattern\."/
  );
  assert.doesNotMatch(
    miseDomainSource,
    /context:\s*spikeInsight\.why_it_matters\s*\?\?\s*"Mise is learning this pattern\."/
  );

  // Leave sibling why_it_matters / ApprovalsSection tips alone.
  assert.doesNotMatch(identitySource, /from ["'].*dailyOpsSignalLineIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*operationalFindingsExplanationIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*homeStatusApprovalTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  // importantInsight still uses ?? undefined (no English inventing path).
  assert.match(
    miseDomainSource,
    /context:\s*importantInsight\.why_it_matters\s*\?\?\s*undefined/
  );
  // Daily Ops pickSignalLine and Home ApprovalsSection why remain on their contracts.
  assert.match(dailyOpsReportSource, /best\.why_it_matters\?\.trim\(\)/);
  assert.match(homeSource, /\{card\.whyItMatters\}/);
  assert.match(operatingBriefSource, /whyItMatters:\s*recommendation\.reason/);
});

test("ASCII C prep keeps ordinary TodaySummary attention why_it_matters stable", () => {
  assert.equal(asciiTrimTodayAttentionWhyItMatters(`  ${whyProse}  `), whyProse);
  assert.equal(asciiTrimTodayAttentionWhyItMatters(`\t${whyProse}\n`), whyProse);
  assert.equal(canonicalizeTodayAttentionWhyItMatters(`  ${whyProse}  `), whyProse);
  assert.equal(normalizeTodayAttentionWhyItMatters(`  ${whyProse}  `), whyProse);
  assert.equal(normalizeTodayAttentionWhyItMatters(accentedWhy), accentedWhy);
});

test("Unicode-only space and empty string bypass learning fallback via ?? until ASCII C soft-null restores it", () => {
  const emOnly = em;
  const nbspOnly = nbsp;
  const paddedSpaces = "   ";
  const empty = "";

  // Prior truthy / `??` bypass proofs.
  assert.equal(Boolean(emOnly), true);
  assert.equal(Boolean(emOnly.trim()), false);
  assert.equal(emOnly ?? FALLBACK, emOnly);
  assert.notEqual(emOnly ?? FALLBACK, FALLBACK);
  assert.equal(empty ?? FALLBACK, empty);
  assert.notEqual(empty ?? FALLBACK, FALLBACK);

  assert.equal(normalizeTodayAttentionWhyItMatters(emOnly), null);
  assert.equal(normalizeTodayAttentionWhyItMatters(emOnly) ?? FALLBACK, FALLBACK);
  assert.equal(Boolean(normalizeTodayAttentionWhyItMatters(emOnly)), false);
  assert.equal(normalizeTodayAttentionWhyItMatters(nbspOnly), null);
  assert.equal(normalizeTodayAttentionWhyItMatters(paddedSpaces), null);
  assert.equal(normalizeTodayAttentionWhyItMatters(empty), null);
  assert.equal(normalizeTodayAttentionWhyItMatters(null), null);
  assert.equal(normalizeTodayAttentionWhyItMatters(undefined), null);
  assert.equal(normalizeTodayAttentionWhyItMatters(null) ?? FALLBACK, FALLBACK);
});

test("NBSP/em-space padding cannot invent clean TodaySummary attention why_it_matters", () => {
  const emWhy = `${em}${whyProse}${em}`;
  const nbspWhy = `${nbsp}${whyProse}${nbsp}`;

  // Inventing proof on Unicode trim.
  assert.equal(emWhy.trim(), whyProse);
  assert.equal(nbspWhy.trim(), whyProse);

  // Attention why tips preserve NBSP: ASCII trim leaves Unicode padding alone.
  assert.equal(asciiTrimTodayAttentionWhyItMatters(emWhy), emWhy);
  assert.equal(asciiTrimTodayAttentionWhyItMatters(nbspWhy), nbspWhy);

  // Soft-null refuses to invent clean why prose.
  assert.equal(canonicalizeTodayAttentionWhyItMatters(emWhy), null);
  assert.equal(canonicalizeTodayAttentionWhyItMatters(nbspWhy), null);
  assert.equal(normalizeTodayAttentionWhyItMatters(emWhy), null);
  assert.equal(normalizeTodayAttentionWhyItMatters(nbspWhy), null);
  assert.equal(normalizeTodayAttentionWhyItMatters(emWhy) ?? FALLBACK, FALLBACK);
});

test("Unsafe single-line controls soft-null for TodaySummary attention why_it_matters", () => {
  assert.equal(normalizeTodayAttentionWhyItMatters(`${whyProse}\u0000`), null);
  assert.equal(normalizeTodayAttentionWhyItMatters(`\u0007${whyProse}`), null);
  assert.equal(normalizeTodayAttentionWhyItMatters(`${whyProse}\u007f`), null);
  // Single-line attention context rejects embedded LF/CR.
  assert.equal(normalizeTodayAttentionWhyItMatters(`${whyProse}\nnext`), null);
  assert.equal(normalizeTodayAttentionWhyItMatters(`${whyProse}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeTodayAttentionWhyItMatters(`${whyProse}\t`), whyProse);
  assert.equal(normalizeTodayAttentionWhyItMatters(whyProse), whyProse);
});

test("buildTodaySummary fails closed on Unicode-only-space sales-spike why_it_matters", () => {
  const summary = buildSpikeSummary(em);

  assert.ok(
    summary.attentionCards.some((card) => card.id === "attention_insight_ascii_c_sales_spike"),
    "sales-spike attention card must be present beside the importantInsight card"
  );
  assert.equal(spikeAttentionContext(summary), FALLBACK);
  assert.doesNotMatch(spikeAttentionContext(summary) ?? "", new RegExp(em));
});

test("buildTodaySummary refuses Unicode-padded sales-spike why_it_matters inventing", () => {
  const padded = `${em}${whyProse}${em}`;
  const summary = buildSpikeSummary(padded);

  // Fail closed to intentional fallback rather than inventing clean prose.
  assert.equal(spikeAttentionContext(summary), FALLBACK);
  assert.notEqual(padded.trim(), FALLBACK);
  assert.equal(padded.trim(), whyProse);
});

test("buildTodaySummary keeps ordinary sales-spike why_it_matters and ASCII-trimmed prose", () => {
  const summary = buildSpikeSummary(`  ${whyProse}  `);
  assert.equal(spikeAttentionContext(summary), whyProse);

  const accentedSummary = buildSpikeSummary(accentedWhy);
  assert.equal(spikeAttentionContext(accentedSummary), accentedWhy);
});

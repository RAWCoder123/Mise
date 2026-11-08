import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsInsightWhyItMatters,
  canonicalizeInsightsInsightWhyItMatters,
  normalizeInsightsInsightWhyItMatters
} from "../services/domain/presentationInsightsInsightWhyItMattersIdentity";
import { presentInsight } from "../services/presentation/operationsPresentation";
import type { Insight } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInsightsInsightWhyItMattersIdentity.ts", import.meta.url),
  "utf8"
);
const insightsSource = readFileSync(
  new URL("../app/(tabs)/insights.tsx", import.meta.url),
  "utf8"
);
const presentationSource = readFileSync(
  new URL("../services/presentation/operationsPresentation.ts", import.meta.url),
  "utf8"
);
const insightsInsightTitleIdentityPath = new URL(
  "../services/domain/presentationInsightsInsightTitleIdentity.ts",
  import.meta.url
);
const insightsInsightDescriptionIdentityPath = new URL(
  "../services/domain/presentationInsightsInsightDescriptionIdentity.ts",
  import.meta.url
);
const insightsInsightRecommendedActionIdentityPath = new URL(
  "../services/domain/presentationInsightsInsightRecommendedActionIdentity.ts",
  import.meta.url
);
const homeStatusWhyItMattersIdentityPath = new URL(
  "../services/domain/homeStatusWhyItMattersIdentity.ts",
  import.meta.url
);
const homeApprovalsWhyItMattersIdentityPath = new URL(
  "../services/domain/homeApprovalsWhyItMattersIdentity.ts",
  import.meta.url
);

const why = "Stock may not cover service.";
const opaqueWhy = "Lunch usage was 24% above forecast.";
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

function stockRiskInsight(): Insight {
  return {
    id: "insight-stock-risk-why-1",
    restaurant_id: "restaurant-insights-why",
    insight_type: "inventory",
    title: "Raw title remains unchanged",
    description: "Raw description remains unchanged",
    why_it_matters: "Raw why remains unchanged",
    recommended_action: "Raw action remains unchanged",
    severity: "urgent",
    created_at: "2026-11-08T15:00:00.000Z",
    presentation: {
      code: "insight.rule.inventory.stock_risk",
      values: {
        itemName: "Roma Tomatoes",
        projectedQuantity: 1.25,
        unit: "kg",
        supplierName: "Sysco",
        suggestedOrderQuantity: 12,
        status: "Critical"
      }
    }
  };
}

function opaqueInsight(overrides: {
  title?: string;
  description?: string;
  why_it_matters?: string | null;
  recommended_action?: string;
}): Insight {
  return {
    id: "insight-opaque-why-1",
    restaurant_id: "restaurant-insights-why",
    insight_type: "inventory",
    title: overrides.title ?? "Opaque title",
    description: overrides.description ?? "Opaque description",
    why_it_matters: overrides.why_it_matters === undefined ? opaqueWhy : overrides.why_it_matters,
    recommended_action: overrides.recommended_action ?? "Count Roma Tomatoes",
    severity: "warning",
    created_at: "2026-11-08T15:00:00.000Z"
  };
}

test("MISE-005AAB pins Insights InsightListRow presentation.whyItMatters to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAB/);
  assert.match(insightsSource, /MISE-005AAB/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsInsightWhyItMatters\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsInsightWhyItMattersIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsInsightWhyItMatters\(/);
  assert.match(
    insightsSource,
    /const whyItMatters = normalizeInsightsInsightWhyItMatters\(presentation\.whyItMatters\);/
  );
  assert.match(insightsSource, /\{whyItMatters \? \(/);
  assert.match(
    insightsSource,
    /\{t\("insights\.whyItMatters"\)\}\s*<\/Text>\s*\{whyItMatters\}/
  );
  assert.doesNotMatch(
    insightsSource,
    /\{t\("insights\.whyItMatters"\)\}\s*<\/Text>\s*\{presentation\.whyItMatters\}/
  );

  // Leave title / description / recommendedAction as raw pass-through on this tip.
  assert.match(
    insightsSource,
    /styles\.insightTitle[^>]*>\s*\{presentation\.title\}\s*<\/Text>/
  );
  assert.match(
    insightsSource,
    /styles\.insightDescription[^>]*>\s*\{presentation\.description\}\s*<\/Text>/
  );
  assert.match(
    insightsSource,
    /styles\.actionText[^>]*>\s*\{presentation\.recommendedAction\}\s*<\/Text>/
  );

  // Opaque inventing path still embeds raw why_it_matters into presentation.whyItMatters.
  assert.match(
    presentationSource,
    /whyItMatters: values\.rawWhyItMatters\s*\?\s*`\$\{copy\.evidenceLabel\}: \$\{values\.rawWhyItMatters\}`\s*:\s*null/
  );

  // Do not pull in InsightListRow title / description / recommendedAction / Home why helpers.
  assert.doesNotMatch(insightsSource, /normalizeInsightsInsightTitle\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsInsightDescription\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsInsightRecommendedAction\(/);
  assert.doesNotMatch(insightsSource, /normalizeHomeStatusWhyItMatters\(/);
  assert.doesNotMatch(insightsSource, /normalizeHomeApprovalsWhyItMatters\(/);
  assert.doesNotMatch(insightsSource, /presentationInsightsInsightTitleIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsInsightDescriptionIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsInsightRecommendedActionIdentity/);
  assert.doesNotMatch(insightsSource, /homeStatusWhyItMattersIdentity/);
  assert.doesNotMatch(insightsSource, /homeApprovalsWhyItMattersIdentity/);
  assert.equal(filePresence(insightsInsightTitleIdentityPath), "absent");
  assert.equal(filePresence(insightsInsightDescriptionIdentityPath), "absent");
  assert.equal(filePresence(insightsInsightRecommendedActionIdentityPath), "absent");
  assert.equal(filePresence(homeStatusWhyItMattersIdentityPath), "absent");
  assert.equal(filePresence(homeApprovalsWhyItMattersIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsInsightTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsInsightDescriptionIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsInsightRecommendedActionIdentity/);
  assert.doesNotMatch(identityCode, /homeStatusWhyItMattersIdentity/);
  assert.doesNotMatch(identityCode, /homeApprovalsWhyItMattersIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeInsightsInsightWhyItMatters(why), why);
  assert.equal(normalizeInsightsInsightWhyItMatters(` ${why} `), why);
  assert.equal(normalizeInsightsInsightWhyItMatters(`Case-${why}`), `Case-${why}`);
  assert.equal(
    normalizeInsightsInsightWhyItMatters(`Evidence: ${opaqueWhy}`),
    `Evidence: ${opaqueWhy}`
  );
  assert.equal(normalizeInsightsInsightWhyItMatters(`café ${why}`), `café ${why}`);

  // Structured controlled why still passes through the same InsightListRow gate.
  const structured = presentInsight("en", stockRiskInsight());
  assert.equal(
    structured.whyItMatters,
    "This can interrupt prep or force an 86 mid-service."
  );
  assert.equal(
    normalizeInsightsInsightWhyItMatters(structured.whyItMatters),
    structured.whyItMatters
  );
});

test("opaque presentInsight inventing embeds padded raw why_it_matters into InsightListRow why", () => {
  const paddedWhy = `${em}${opaqueWhy}${em}`;
  const presented = presentInsight("en", opaqueInsight({ why_it_matters: paddedWhy }));

  // Inventing proof: no presentation descriptor → evidence-prefixed raw why.
  assert.equal(presented.whyItMatters, `Evidence: ${paddedWhy}`);
  assert.equal(paddedWhy.trim(), opaqueWhy);
  assert.equal(Boolean(presented.whyItMatters), true);

  // ASCII C prep refuses that inventing equality before InsightListRow why render.
  assert.equal(asciiTrimInsightsInsightWhyItMatters(presented.whyItMatters!), presented.whyItMatters);
  assert.equal(canonicalizeInsightsInsightWhyItMatters(presented.whyItMatters!), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(presented.whyItMatters), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(presented.whyItMatters) ? "OPEN" : "HIDE", "HIDE");
});

test("Unicode padding invents via trim and is soft-nulled for Insights InsightListRow why", () => {
  const padded = `${em}${why}${em}`;
  const nbspWhy = `${nbsp}${why}${nbsp}`;
  const internalEm = `Stock may not${em}cover service.`;
  const internalNbsp = `Stock may not${nbsp}cover service.`;

  // Inventing proof: Unicode trim would invent the clean InsightListRow why.
  assert.equal(padded.trim(), why);
  assert.equal(nbspWhy.trim(), why);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspWhy), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsInsightWhyItMatters(padded), padded);
  assert.equal(canonicalizeInsightsInsightWhyItMatters(padded), null);
  assert.equal(canonicalizeInsightsInsightWhyItMatters(nbspWhy), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(padded), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(nbspWhy), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(padded) ? "OPEN" : "HIDE", "HIDE");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsInsightWhyItMatters(internalEm), internalEm);
  assert.equal(normalizeInsightsInsightWhyItMatters(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsInsightWhyItMatters(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights InsightListRow why", () => {
  assert.equal(normalizeInsightsInsightWhyItMatters(undefined), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(null), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(""), null);
  assert.equal(normalizeInsightsInsightWhyItMatters("   "), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(123 as unknown as string), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(`\u0001${why}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsInsightWhyItMatters(`${why}\t`), why);
  assert.equal(normalizeInsightsInsightWhyItMatters(`${why}\u0007`), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(em), null);
  // LF/TAB/CR are rejected for single-line why copy (full cntrl; no multiline allowlist).
  assert.equal(normalizeInsightsInsightWhyItMatters(`Stock\tmay not cover`), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(`Stock\nmay not cover`), null);
});

test("Insights InsightListRow whyItMatters bypass proof: empty and Unicode-only-space soft-null closes truthy gate", () => {
  // Prior truthy-gated why path still opened blank-looking insightEvidence Text.
  assert.equal(normalizeInsightsInsightWhyItMatters(""), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(em), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(nbsp), null);

  // Descriptor-absent evidence prefix with Unicode-only free-text still soft-nulls.
  const blankLooking = presentInsight("en", opaqueInsight({ why_it_matters: em }));
  assert.equal(blankLooking.whyItMatters, `Evidence: ${em}`);
  assert.equal(Boolean(blankLooking.whyItMatters), true);
  assert.equal(normalizeInsightsInsightWhyItMatters(blankLooking.whyItMatters), null);

  // Null raw why already hides; soft-null must keep that hide semantics.
  const missingWhy = presentInsight("en", opaqueInsight({ why_it_matters: null }));
  assert.equal(missingWhy.whyItMatters, null);
  assert.equal(normalizeInsightsInsightWhyItMatters(missingWhy.whyItMatters), null);

  const missingWhyToken: string | null | undefined = undefined;
  const unicodeOnlyWhy: string | null | undefined = em;
  assert.equal(missingWhyToken ?? "", "");
  assert.equal(unicodeOnlyWhy ?? "", em);
  assert.notEqual(unicodeOnlyWhy ?? "", "");
  assert.equal(Boolean(unicodeOnlyWhy), true);
  assert.match(
    insightsSource,
    /const whyItMatters = normalizeInsightsInsightWhyItMatters\(presentation\.whyItMatters\);/
  );
  assert.match(insightsSource, /\{whyItMatters \? \(/);
});

test("Insights InsightListRow presentation.whyItMatters identity refuses Unicode inventing equality", () => {
  const padded = `${em}${why}${em}`;
  assert.notEqual(asciiTrimInsightsInsightWhyItMatters(padded), padded.trim());
  assert.equal(normalizeInsightsInsightWhyItMatters(padded), null);
  assert.equal(normalizeInsightsInsightWhyItMatters(padded) ? "OPEN" : "HIDE", "HIDE");
  assert.equal(normalizeInsightsInsightWhyItMatters(`\t${why}\n`), why);
});

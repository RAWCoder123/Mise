import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsInsightDescription,
  canonicalizeInsightsInsightDescription,
  normalizeInsightsInsightDescription
} from "../services/domain/presentationInsightsInsightDescriptionIdentity";
import { presentInsight } from "../services/presentation/operationsPresentation";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationInsightsInsightDescriptionIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const insightsSource = readFileSync(
  new URL("../app/(tabs)/insights.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const presentationSource = readFileSync(
  new URL("../services/presentation/operationsPresentation.ts", import.meta.url),
  "utf8"
);
const insightsSignalDetailIdentityPath = new URL(
  "../services/domain/presentationInsightsSignalDetailIdentity.ts",
  import.meta.url
);
const dailyBriefFindingExplanationIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardFindingExplanationIdentity.ts",
  import.meta.url
);
const homeApprovalsRecommendedActionIdentityPath = new URL(
  "../services/domain/presentationHomeApprovalsRecommendedActionIdentity.ts",
  import.meta.url
);

const description = "Roma Tomatoes is projected at 12 each after mapped POS demand.";
const opaqueTitle = "Roma Tomatoes low";
const opaqueDescription = "Check the walk-in";
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

function opaqueInsight(overrides: {
  title?: string;
  description?: string;
  why_it_matters?: string | null;
  recommended_action?: string;
}) {
  return {
    id: "insight-opaque-1",
    restaurant_id: "restaurant-insights-description",
    insight_type: "inventory" as const,
    title: overrides.title ?? opaqueTitle,
    description: overrides.description ?? opaqueDescription,
    why_it_matters: overrides.why_it_matters === undefined ? "Stock risk" : overrides.why_it_matters,
    recommended_action: overrides.recommended_action ?? "Count Roma Tomatoes",
    severity: "warning" as const,
    created_at: "2026-11-08T12:00:00.000Z"
  };
}

test("MISE-005ZY pins Insights InsightListRow presentation.description to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZY/);
  assert.match(insightsSource, /MISE-005ZY/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsInsightDescription\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsInsightDescriptionIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsInsightDescription\(/);
  assert.match(
    insightsSource,
    /normalizeInsightsInsightDescription\(presentation\.description\)\s*\|\|\s*t\("insights\.insight\.description\.none"\)/
  );
  assert.doesNotMatch(
    insightsSource,
    /styles\.insightDescription[^>]*>\s*\{presentation\.description\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"insights\.insight\.description\.none": "Description"/);
  assert.match(catalogSource, /"insights\.insight\.description\.none": "Descripción"/);
  assert.match(catalogSource, /"insights\.insight\.description\.none": "说明"/);

  // Leave title / whyItMatters / recommendedAction as raw pass-through on this tip.
  assert.match(
    insightsSource,
    /styles\.insightTitle[^>]*>\s*\{presentation\.title\}\s*<\/Text>/
  );
  assert.match(
    insightsSource,
    /\{t\("insights\.whyItMatters"\)\}\s*<\/Text>\s*\{presentation\.whyItMatters\}/
  );
  assert.match(
    insightsSource,
    /styles\.actionText[^>]*>\s*\{presentation\.recommendedAction\}\s*<\/Text>/
  );

  // Descriptor-absent inventing path still embeds raw title/description into presentation.description.
  assert.match(
    presentationSource,
    /description: `\$\{copy\.evidenceLabel\}: \$\{values\.rawTitle\}\. \$\{values\.rawDescription\}`/
  );

  // Do not pull in Insights signal detail / Daily Brief explanation / Home Approvals helpers.
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalDetail\(/);
  assert.doesNotMatch(insightsSource, /normalizeDailyBriefBoardFindingExplanation\(/);
  assert.doesNotMatch(insightsSource, /normalizeHomeApprovalsRecommendedAction\(/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(insightsSource, /presentationDailyBriefBoardFindingExplanationIdentity/);
  assert.doesNotMatch(insightsSource, /presentationHomeApprovalsRecommendedActionIdentity/);
  assert.equal(filePresence(insightsSignalDetailIdentityPath), "absent");
  assert.equal(filePresence(dailyBriefFindingExplanationIdentityPath), "absent");
  assert.equal(filePresence(homeApprovalsRecommendedActionIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardFindingExplanationIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeInsightsInsightDescription(description), description);
  assert.equal(normalizeInsightsInsightDescription(` ${description} `), description);
  assert.equal(normalizeInsightsInsightDescription(`Case-${description}`), `Case-${description}`);
  assert.equal(
    normalizeInsightsInsightDescription(`Evidence: ${opaqueTitle}. ${opaqueDescription}`),
    `Evidence: ${opaqueTitle}. ${opaqueDescription}`
  );
  assert.equal(normalizeInsightsInsightDescription(`café ${description}`), `café ${description}`);
});

test("opaque presentInsight inventing embeds padded raw title/description into InsightListRow description", () => {
  const paddedTitle = `${em}${opaqueTitle}${em}`;
  const paddedDescription = `${em}${opaqueDescription}${em}`;
  const presented = presentInsight(
    "en",
    opaqueInsight({ title: paddedTitle, description: paddedDescription })
  );

  // Inventing proof: no presentation descriptor → evidence-prefixed raw title/description.
  assert.equal(presented.description, `Evidence: ${paddedTitle}. ${paddedDescription}`);
  assert.equal(paddedTitle.trim(), opaqueTitle);
  assert.equal(paddedDescription.trim(), opaqueDescription);
  assert.equal(Boolean(presented.description), true);

  // ASCII C prep refuses that inventing equality before InsightListRow description render.
  assert.equal(asciiTrimInsightsInsightDescription(presented.description), presented.description);
  assert.equal(canonicalizeInsightsInsightDescription(presented.description), null);
  assert.equal(normalizeInsightsInsightDescription(presented.description), null);
  assert.equal(
    normalizeInsightsInsightDescription(presented.description) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Insights InsightListRow descriptions", () => {
  const padded = `${em}${description}${em}`;
  const nbspDescription = `${nbsp}${description}${nbsp}`;
  const internalEm = `Roma${em}Tomatoes is projected at 12 each after mapped POS demand.`;
  const internalNbsp = `Roma${nbsp}Tomatoes is projected at 12 each after mapped POS demand.`;

  // Inventing proof: Unicode trim would invent the clean InsightListRow description.
  assert.equal(padded.trim(), description);
  assert.equal(nbspDescription.trim(), description);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspDescription), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsInsightDescription(padded), padded);
  assert.equal(canonicalizeInsightsInsightDescription(padded), null);
  assert.equal(canonicalizeInsightsInsightDescription(nbspDescription), null);
  assert.equal(normalizeInsightsInsightDescription(padded), null);
  assert.equal(normalizeInsightsInsightDescription(nbspDescription), null);
  assert.equal(normalizeInsightsInsightDescription(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsInsightDescription(internalEm), internalEm);
  assert.equal(normalizeInsightsInsightDescription(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsInsightDescription(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights InsightListRow descriptions", () => {
  assert.equal(normalizeInsightsInsightDescription(undefined), null);
  assert.equal(normalizeInsightsInsightDescription(null), null);
  assert.equal(normalizeInsightsInsightDescription(""), null);
  assert.equal(normalizeInsightsInsightDescription("   "), null);
  assert.equal(normalizeInsightsInsightDescription(123 as unknown as string), null);
  assert.equal(normalizeInsightsInsightDescription(`\u0001${description}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsInsightDescription(`${description}\t`), description);
  assert.equal(normalizeInsightsInsightDescription(`${description}\u0007`), null);
  assert.equal(normalizeInsightsInsightDescription(em), null);
  // LF/TAB/CR are rejected for single-line descriptions (full cntrl; no multiline allowlist).
  assert.equal(normalizeInsightsInsightDescription(`Roma\tTomatoes projected`), null);
  assert.equal(normalizeInsightsInsightDescription(`Roma\nTomatoes projected`), null);
});

test("Insights InsightListRow description bypass proof: empty and Unicode-only-space soft-null to localized none", () => {
  // Prior always-pass-description path still rendered blank-looking insightDescription Text.
  assert.equal(normalizeInsightsInsightDescription(""), null);
  assert.equal(normalizeInsightsInsightDescription(em), null);
  assert.equal(normalizeInsightsInsightDescription(nbsp), null);

  // Descriptor-absent evidence prefix with Unicode-only free-text still soft-nulls.
  const blankLooking = presentInsight(
    "en",
    opaqueInsight({ title: em, description: em, why_it_matters: em, recommended_action: em })
  );
  assert.equal(blankLooking.description, `Evidence: ${em}. ${em}`);
  assert.equal(Boolean(blankLooking.description), true);
  assert.equal(normalizeInsightsInsightDescription(blankLooking.description), null);

  const missingDescription: string | null | undefined = undefined;
  const unicodeOnlyDescription: string | null | undefined = em;
  assert.equal(missingDescription ?? "", "");
  assert.equal(unicodeOnlyDescription ?? "", em);
  assert.notEqual(unicodeOnlyDescription ?? "", "");
  assert.equal(Boolean(unicodeOnlyDescription), true);
  assert.match(
    insightsSource,
    /normalizeInsightsInsightDescription\(presentation\.description\)\s*\|\|\s*t\("insights\.insight\.description\.none"\)/
  );
});

test("Insights InsightListRow presentation.description identity refuses Unicode inventing equality", () => {
  const padded = `${em}${description}${em}`;
  assert.notEqual(asciiTrimInsightsInsightDescription(padded), padded.trim());
  assert.equal(normalizeInsightsInsightDescription(padded), null);
  assert.equal(normalizeInsightsInsightDescription(padded) || "Description", "Description");
  assert.equal(normalizeInsightsInsightDescription(`\t${description}\n`), description);
});

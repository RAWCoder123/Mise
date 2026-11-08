import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsInsightTitle,
  canonicalizeInsightsInsightTitle,
  normalizeInsightsInsightTitle
} from "../services/domain/presentationInsightsInsightTitleIdentity";
import { presentInsight } from "../services/presentation/operationsPresentation";
import type { Insight } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInsightsInsightTitleIdentity.ts", import.meta.url),
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
const insightsInsightDescriptionIdentityPath = new URL(
  "../services/domain/presentationInsightsInsightDescriptionIdentity.ts",
  import.meta.url
);
const insightsSignalDetailIdentityPath = new URL(
  "../services/domain/presentationInsightsSignalDetailIdentity.ts",
  import.meta.url
);
const dailyBriefBoardFindingTitleIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardFindingTitleIdentity.ts",
  import.meta.url
);

const title = "Roma Tomatoes may run out today";
const itemName = "Roma Tomatoes";
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

function stockRiskInsight(itemNameValue: string): Insight {
  return {
    id: "insight-stock-risk-1",
    restaurant_id: "restaurant-insights-title",
    insight_type: "inventory",
    title: "Raw title remains unchanged",
    description: "Raw description remains unchanged",
    why_it_matters: "Raw why remains unchanged",
    recommended_action: "Raw action remains unchanged",
    severity: "urgent",
    created_at: "2026-11-08T13:00:00.000Z",
    presentation: {
      code: "insight.rule.inventory.stock_risk",
      values: {
        itemName: itemNameValue,
        projectedQuantity: 1.25,
        unit: "kg",
        supplierName: "Sysco",
        suggestedOrderQuantity: 12,
        status: "Critical"
      }
    }
  };
}

test("MISE-005ZZ pins Insights InsightListRow presentation.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZZ/);
  assert.match(insightsSource, /MISE-005ZZ/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsInsightTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsInsightTitleIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsInsightTitle\(/);
  assert.match(
    insightsSource,
    /normalizeInsightsInsightTitle\(presentation\.title\)\s*\|\|\s*t\("insights\.insight\.title\.none"\)/
  );
  assert.doesNotMatch(
    insightsSource,
    /styles\.insightTitle[^>]*>\s*\{presentation\.title\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"insights\.insight\.title\.none": "Title"/);
  assert.match(catalogSource, /"insights\.insight\.title\.none": "Título"/);
  assert.match(catalogSource, /"insights\.insight\.title\.none": "标题"/);

  // Leave description / whyItMatters / recommendedAction as raw pass-through on this tip.
  assert.match(
    insightsSource,
    /styles\.insightDescription[^>]*>\s*\{presentation\.description\}\s*<\/Text>/
  );
  assert.match(
    insightsSource,
    /\{t\("insights\.whyItMatters"\)\}\s*<\/Text>\s*\{presentation\.whyItMatters\}/
  );
  assert.match(
    insightsSource,
    /styles\.actionText[^>]*>\s*\{presentation\.recommendedAction\}\s*<\/Text>/
  );

  // Structured inventing path still embeds free-form itemName into presentation.title.
  assert.match(
    presentationSource,
    /inventoryCriticalTitle: \(itemName\) => `\$\{itemName\} may run out today`/
  );
  assert.match(
    presentationSource,
    /title: values\.status === "Critical"\s*\?\s*copy\.insight\.inventoryCriticalTitle\(values\.itemName\)/
  );

  // Do not pull in InsightListRow description / Insights signal detail / Daily Brief finding title helpers.
  assert.doesNotMatch(insightsSource, /normalizeInsightsInsightDescription\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalDetail\(/);
  assert.doesNotMatch(insightsSource, /normalizeDailyBriefBoardFindingTitle\(/);
  assert.doesNotMatch(insightsSource, /presentationInsightsInsightDescriptionIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(insightsSource, /presentationDailyBriefBoardFindingTitleIdentity/);
  assert.equal(filePresence(insightsInsightDescriptionIdentityPath), "absent");
  assert.equal(filePresence(insightsSignalDetailIdentityPath), "absent");
  assert.equal(filePresence(dailyBriefBoardFindingTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsInsightDescriptionIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardFindingTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeInsightsInsightTitle(title), title);
  assert.equal(normalizeInsightsInsightTitle(` ${title} `), title);
  assert.equal(normalizeInsightsInsightTitle(`Case-${title}`), `Case-${title}`);
  assert.equal(normalizeInsightsInsightTitle(`café ${title}`), `café ${title}`);
});

test("structured presentInsight inventing embeds padded itemName into InsightListRow title", () => {
  const paddedItemName = `${em}${itemName}${em}`;
  const presented = presentInsight("en", stockRiskInsight(paddedItemName));

  // Inventing proof: structured stock_risk title embeds free-form itemName.
  assert.equal(presented.title, `${paddedItemName} may run out today`);
  assert.equal(paddedItemName.trim(), itemName);
  assert.equal(Boolean(presented.title), true);

  // ASCII C prep refuses that inventing equality before InsightListRow title render.
  assert.equal(asciiTrimInsightsInsightTitle(presented.title), presented.title);
  assert.equal(canonicalizeInsightsInsightTitle(presented.title), null);
  assert.equal(normalizeInsightsInsightTitle(presented.title), null);
  assert.equal(normalizeInsightsInsightTitle(presented.title) || "FALLBACK", "FALLBACK");
});

test("Unicode padding invents via trim and is soft-nulled for Insights InsightListRow titles", () => {
  const padded = `${em}${title}${em}`;
  const nbspTitle = `${nbsp}${title}${nbsp}`;
  const internalEm = `Roma${em}Tomatoes may run out today`;
  const internalNbsp = `Roma${nbsp}Tomatoes may run out today`;

  // Inventing proof: Unicode trim would invent the clean InsightListRow title.
  assert.equal(padded.trim(), title);
  assert.equal(nbspTitle.trim(), title);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspTitle), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsInsightTitle(padded), padded);
  assert.equal(canonicalizeInsightsInsightTitle(padded), null);
  assert.equal(canonicalizeInsightsInsightTitle(nbspTitle), null);
  assert.equal(normalizeInsightsInsightTitle(padded), null);
  assert.equal(normalizeInsightsInsightTitle(nbspTitle), null);
  assert.equal(normalizeInsightsInsightTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsInsightTitle(internalEm), internalEm);
  assert.equal(normalizeInsightsInsightTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsInsightTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights InsightListRow titles", () => {
  assert.equal(normalizeInsightsInsightTitle(undefined), null);
  assert.equal(normalizeInsightsInsightTitle(null), null);
  assert.equal(normalizeInsightsInsightTitle(""), null);
  assert.equal(normalizeInsightsInsightTitle("   "), null);
  assert.equal(normalizeInsightsInsightTitle(123 as unknown as string), null);
  assert.equal(normalizeInsightsInsightTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsInsightTitle(`${title}\t`), title);
  assert.equal(normalizeInsightsInsightTitle(`${title}\u0007`), null);
  assert.equal(normalizeInsightsInsightTitle(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeInsightsInsightTitle(`Roma\tTomatoes may run out`), null);
  assert.equal(normalizeInsightsInsightTitle(`Roma\nTomatoes may run out`), null);
});

test("Insights InsightListRow title bypass proof: empty and Unicode-only-space soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking insightTitle Text.
  assert.equal(normalizeInsightsInsightTitle(""), null);
  assert.equal(normalizeInsightsInsightTitle(em), null);
  assert.equal(normalizeInsightsInsightTitle(nbsp), null);

  // Structured title with Unicode-only free-text item name still soft-nulls.
  const blankLooking = presentInsight("en", stockRiskInsight(em));
  assert.equal(blankLooking.title, `${em} may run out today`);
  assert.equal(Boolean(blankLooking.title), true);
  assert.equal(normalizeInsightsInsightTitle(blankLooking.title), null);

  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    insightsSource,
    /normalizeInsightsInsightTitle\(presentation\.title\)\s*\|\|\s*t\("insights\.insight\.title\.none"\)/
  );
});

test("Insights InsightListRow presentation.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimInsightsInsightTitle(padded), padded.trim());
  assert.equal(normalizeInsightsInsightTitle(padded), null);
  assert.equal(normalizeInsightsInsightTitle(padded) || "Title", "Title");
  assert.equal(normalizeInsightsInsightTitle(`\t${title}\n`), title);
});

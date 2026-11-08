import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsInsightRecommendedAction,
  canonicalizeInsightsInsightRecommendedAction,
  normalizeInsightsInsightRecommendedAction
} from "../services/domain/presentationInsightsInsightRecommendedActionIdentity";
import { presentInsight } from "../services/presentation/operationsPresentation";
import type { Insight } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInsightsInsightRecommendedActionIdentity.ts", import.meta.url),
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
const insightsInsightTitleIdentityPath = new URL(
  "../services/domain/presentationInsightsInsightTitleIdentity.ts",
  import.meta.url
);
const insightsInsightDescriptionIdentityPath = new URL(
  "../services/domain/presentationInsightsInsightDescriptionIdentity.ts",
  import.meta.url
);
const insightsInsightWhyItMattersIdentityPath = new URL(
  "../services/domain/presentationInsightsInsightWhyItMattersIdentity.ts",
  import.meta.url
);
const dailyBriefBoardRecommendedActionIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardRecommendedActionIdentity.ts",
  import.meta.url
);
const homeApprovalsRecommendedActionIdentityPath = new URL(
  "../services/domain/presentationHomeApprovalsRecommendedActionIdentity.ts",
  import.meta.url
);

const action = "Check the walk-in, then add 12 kg on the next Sysco ticket.";
const opaqueAction = "Check the walk-in before prep.";
const itemName = "Roma Tomatoes";
const supplierName = "Sysco";
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

function stockRiskInsight(supplierNameValue: string): Insight {
  return {
    id: "insight-stock-risk-action-1",
    restaurant_id: "restaurant-insights-action",
    insight_type: "inventory",
    title: "Raw title remains unchanged",
    description: "Raw description remains unchanged",
    why_it_matters: "Raw why remains unchanged",
    recommended_action: "Raw action remains unchanged",
    severity: "urgent",
    created_at: "2026-11-08T14:00:00.000Z",
    presentation: {
      code: "insight.rule.inventory.stock_risk",
      values: {
        itemName: "Roma Tomatoes",
        projectedQuantity: 1.25,
        unit: "kg",
        supplierName: supplierNameValue,
        suggestedOrderQuantity: 12,
        status: "Critical"
      }
    }
  };
}

function salesDemandInsight(itemNameValue: string): Insight {
  return {
    id: "insight-sales-action-1",
    restaurant_id: "restaurant-insights-action",
    insight_type: "sales",
    title: "Raw title remains unchanged",
    description: "Raw description remains unchanged",
    why_it_matters: "Raw why remains unchanged",
    recommended_action: "Raw action remains unchanged",
    severity: "warning",
    created_at: "2026-11-08T14:00:00.000Z",
    presentation: {
      code: "insight.rule.sales.demand_rising",
      values: {
        itemName: itemNameValue,
        liftPercent: 18
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
    id: "insight-opaque-action-1",
    restaurant_id: "restaurant-insights-action",
    insight_type: "inventory",
    title: overrides.title ?? "Opaque title",
    description: overrides.description ?? "Opaque description",
    why_it_matters: overrides.why_it_matters === undefined ? "Opaque why" : overrides.why_it_matters,
    recommended_action: overrides.recommended_action ?? opaqueAction,
    severity: "warning",
    created_at: "2026-11-08T14:00:00.000Z"
  };
}

test("MISE-005AAA pins Insights InsightListRow presentation.recommendedAction to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAA/);
  assert.match(insightsSource, /MISE-005AAA/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsInsightRecommendedAction\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsInsightRecommendedActionIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsInsightRecommendedAction\(/);
  assert.match(
    insightsSource,
    /normalizeInsightsInsightRecommendedAction\(presentation\.recommendedAction\)\s*\|\|\s*t\("insights\.insight\.recommendedAction\.none"\)/
  );
  assert.doesNotMatch(
    insightsSource,
    /styles\.actionText[^>]*>\s*\{presentation\.recommendedAction\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"insights\.insight\.recommendedAction\.none": "Next action"/);
  assert.match(catalogSource, /"insights\.insight\.recommendedAction\.none": "Próxima acción"/);
  assert.match(catalogSource, /"insights\.insight\.recommendedAction\.none": "下一步"/);

  // Leave title / description / whyItMatters as raw pass-through on this tip.
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
    /\{t\("insights\.whyItMatters"\)\}\s*<\/Text>\s*\{presentation\.whyItMatters\}/
  );

  // Structured inventing path still embeds free-form supplier / item names into recommendedAction.
  assert.match(
    presentationSource,
    /inventoryAction: \(supplierName, quantity, unit\) => `Check the walk-in, then add \$\{quantity\} \$\{unit\} on the next \$\{supplierName\} ticket\.`/
  );
  assert.match(
    presentationSource,
    /salesAction: \(itemName\) => `Before the next prep window, confirm walk-in counts for ingredients tied to \$\{itemName\}\.`/
  );
  assert.match(
    presentationSource,
    /recommendedAction: `\$\{copy\.sourceRecommendationLabel\}: \$\{values\.rawRecommendedAction\}`/
  );

  // Do not pull in InsightListRow title / description / why / Daily Brief / Home Approvals helpers.
  assert.doesNotMatch(insightsSource, /normalizeInsightsInsightTitle\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsInsightDescription\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsInsightWhyItMatters\(/);
  assert.doesNotMatch(insightsSource, /normalizeDailyBriefBoardRecommendedAction\(/);
  assert.doesNotMatch(insightsSource, /normalizeHomeApprovalsRecommendedAction\(/);
  assert.doesNotMatch(insightsSource, /presentationInsightsInsightTitleIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsInsightDescriptionIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsInsightWhyItMattersIdentity/);
  assert.doesNotMatch(insightsSource, /presentationDailyBriefBoardRecommendedActionIdentity/);
  assert.doesNotMatch(insightsSource, /presentationHomeApprovalsRecommendedActionIdentity/);
  assert.equal(filePresence(insightsInsightTitleIdentityPath), "absent");
  assert.equal(filePresence(insightsInsightDescriptionIdentityPath), "absent");
  assert.equal(filePresence(insightsInsightWhyItMattersIdentityPath), "absent");
  assert.equal(filePresence(dailyBriefBoardRecommendedActionIdentityPath), "absent");
  assert.equal(filePresence(homeApprovalsRecommendedActionIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsInsightTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsInsightDescriptionIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeInsightsInsightRecommendedAction(action), action);
  assert.equal(normalizeInsightsInsightRecommendedAction(` ${action} `), action);
  assert.equal(normalizeInsightsInsightRecommendedAction(`Case-${action}`), `Case-${action}`);
  assert.equal(normalizeInsightsInsightRecommendedAction(`café ${action}`), `café ${action}`);
});

test("structured presentInsight inventing embeds padded free-text into InsightListRow recommendedAction", () => {
  const paddedSupplier = `${em}${supplierName}${em}`;
  const stockPresented = presentInsight("en", stockRiskInsight(paddedSupplier));
  assert.equal(
    stockPresented.recommendedAction,
    `Check the walk-in, then add 12 kg on the next ${paddedSupplier} ticket.`
  );
  assert.equal(paddedSupplier.trim(), supplierName);
  assert.equal(Boolean(stockPresented.recommendedAction), true);

  const paddedItem = `${em}${itemName}${em}`;
  const salesPresented = presentInsight("en", salesDemandInsight(paddedItem));
  assert.equal(
    salesPresented.recommendedAction,
    `Before the next prep window, confirm walk-in counts for ingredients tied to ${paddedItem}.`
  );
  assert.equal(paddedItem.trim(), itemName);
  assert.equal(Boolean(salesPresented.recommendedAction), true);

  // Whole-string Unicode padding on the composed action invents via trim and soft-nulls.
  const paddedComposed = `${em}${stockPresented.recommendedAction}${em}`;
  assert.equal(paddedComposed.trim(), stockPresented.recommendedAction);
  assert.equal(asciiTrimInsightsInsightRecommendedAction(paddedComposed), paddedComposed);
  assert.equal(canonicalizeInsightsInsightRecommendedAction(paddedComposed), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(paddedComposed), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(paddedComposed) || "FALLBACK", "FALLBACK");
});

test("opaque presentInsight inventing embeds padded raw recommended_action into InsightListRow action", () => {
  const paddedAction = `${em}${opaqueAction}${em}`;
  const presented = presentInsight(
    "en",
    opaqueInsight({ recommended_action: paddedAction })
  );

  // Inventing proof: no presentation descriptor → source-recommendation-prefixed raw action.
  assert.equal(presented.recommendedAction, `Source recommendation: ${paddedAction}`);
  assert.equal(paddedAction.trim(), opaqueAction);
  assert.equal(Boolean(presented.recommendedAction), true);

  // ASCII C prep refuses that inventing equality before InsightListRow action render.
  assert.equal(
    asciiTrimInsightsInsightRecommendedAction(presented.recommendedAction),
    presented.recommendedAction
  );
  assert.equal(canonicalizeInsightsInsightRecommendedAction(presented.recommendedAction), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(presented.recommendedAction), null);
  assert.equal(
    normalizeInsightsInsightRecommendedAction(presented.recommendedAction) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Insights InsightListRow recommended actions", () => {
  const padded = `${em}${action}${em}`;
  const nbspAction = `${nbsp}${action}${nbsp}`;
  const internalEm = `Check the walk-in, then add 12 kg on the next Roma${em}Tomatoes ticket.`;
  const internalNbsp = `Check the walk-in, then add 12 kg on the next Roma${nbsp}Tomatoes ticket.`;

  // Inventing proof: Unicode trim would invent the clean InsightListRow recommended action.
  assert.equal(padded.trim(), action);
  assert.equal(nbspAction.trim(), action);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspAction), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsInsightRecommendedAction(padded), padded);
  assert.equal(canonicalizeInsightsInsightRecommendedAction(padded), null);
  assert.equal(canonicalizeInsightsInsightRecommendedAction(nbspAction), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(padded), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(nbspAction), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsInsightRecommendedAction(internalEm), internalEm);
  assert.equal(normalizeInsightsInsightRecommendedAction(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsInsightRecommendedAction(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights InsightListRow recommended actions", () => {
  assert.equal(normalizeInsightsInsightRecommendedAction(undefined), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(null), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(""), null);
  assert.equal(normalizeInsightsInsightRecommendedAction("   "), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(123 as unknown as string), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(`\u0001${action}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsInsightRecommendedAction(`${action}\t`), action);
  assert.equal(normalizeInsightsInsightRecommendedAction(`${action}\u0007`), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(em), null);
  // LF/TAB/CR are rejected for single-line actions (full cntrl; no multiline allowlist).
  assert.equal(normalizeInsightsInsightRecommendedAction(`Check\twalk-in`), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(`Check\nwalk-in`), null);
});

test("Insights InsightListRow recommendedAction bypass proof: empty and Unicode-only-space soft-null to localized none", () => {
  // Prior always-pass-action path still rendered blank-looking actionText Text.
  assert.equal(normalizeInsightsInsightRecommendedAction(""), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(em), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(nbsp), null);

  // Descriptor-absent evidence prefix with Unicode-only free-text still soft-nulls.
  const blankLooking = presentInsight(
    "en",
    opaqueInsight({ recommended_action: em })
  );
  assert.equal(blankLooking.recommendedAction, `Source recommendation: ${em}`);
  assert.equal(Boolean(blankLooking.recommendedAction), true);
  assert.equal(normalizeInsightsInsightRecommendedAction(blankLooking.recommendedAction), null);

  const missingAction: string | null | undefined = undefined;
  const unicodeOnlyAction: string | null | undefined = em;
  assert.equal(missingAction ?? "", "");
  assert.equal(unicodeOnlyAction ?? "", em);
  assert.notEqual(unicodeOnlyAction ?? "", "");
  assert.equal(Boolean(unicodeOnlyAction), true);
  assert.match(
    insightsSource,
    /normalizeInsightsInsightRecommendedAction\(presentation\.recommendedAction\)\s*\|\|\s*t\("insights\.insight\.recommendedAction\.none"\)/
  );
});

test("Insights InsightListRow presentation.recommendedAction identity refuses Unicode inventing equality", () => {
  const padded = `${em}${action}${em}`;
  assert.notEqual(asciiTrimInsightsInsightRecommendedAction(padded), padded.trim());
  assert.equal(normalizeInsightsInsightRecommendedAction(padded), null);
  assert.equal(normalizeInsightsInsightRecommendedAction(padded) || "Next action", "Next action");
  assert.equal(normalizeInsightsInsightRecommendedAction(`\t${action}\n`), action);
});

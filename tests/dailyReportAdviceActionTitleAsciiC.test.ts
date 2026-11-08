import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportAdviceActionTitle,
  canonicalizeDailyReportAdviceActionTitle,
  normalizeDailyReportAdviceActionTitle
} from "../services/domain/presentationDailyReportAdviceActionTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyReportAdviceActionTitleIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const dailyReportSource = readFileSync(
  new URL("../app/more/daily-report.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const insightsSource = readFileSync(new URL("../app/(tabs)/insights.tsx", import.meta.url), "utf8");
const dailyOpsReportSource = readFileSync(
  new URL("../services/domain/dailyOpsReport.ts", import.meta.url),
  "utf8"
);

const adviceTitle = "Review chicken coverage";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005ZO pins Daily Report advice action.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZO/);
  assert.match(dailyReportSource, /MISE-005ZO/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportAdviceActionTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportAdviceActionTitleIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportAdviceActionTitle\(/);
  assert.match(
    dailyReportSource,
    /adviceActionTitle \|\|\s*t\("dailyReport\.advice\.actionTitle\.none"\)/
  );
  assert.doesNotMatch(
    dailyReportSource,
    /styles\.adviceTitle[^>]*>\s*\{action\.title\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"dailyReport\.advice\.actionTitle\.none": "Advice"/);
  assert.match(catalogSource, /"dailyReport\.advice\.actionTitle\.none": "Consejo"/);
  assert.match(catalogSource, /"dailyReport\.advice\.actionTitle\.none": "建议"/);

  // Leave Daily Report action.detail alone.
  assert.match(
    dailyReportSource,
    /<Text style=\{styles\.summaryCopy\}>\{action\.detail\}<\/Text>/
  );

  // Leave Daily Ops askBriefingText display path alone (open #866 / MISE-005QF).
  assert.match(
    dailyReportSource,
    /\{visibleReport\.managerAdvice\.askBriefingText\}/
  );

  // Leave Daily Report learning memoryCopy / memoryNextStep alone.
  assert.match(
    dailyReportSource,
    /\{visibleReport\.learning\.memoryCopy\}/
  );
  assert.match(
    dailyReportSource,
    /memoryNextStep \?\? visibleReport\.learning\.credibilityNextStep/
  );

  // Leave Home ApprovalsSection card.title alone (open #1049 / MISE-005WO).
  assert.match(homeSource, /card\.title/);

  // Leave Insights How-Mise-knows memory surfaces alone (#1170 / #1171).
  assert.match(insightsSource, /memory/);

  // Leave Daily Ops domain rankManagerActions title construction alone.
  assert.match(dailyOpsReportSource, /title: urgentInsight\.title/);
  assert.match(dailyOpsReportSource, /title: card\.title/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsMemory/);
  assert.doesNotMatch(identityCode, /presentationDailyOpsAskBriefing/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyReportAdviceActionTitle(adviceTitle), adviceTitle);
  assert.equal(normalizeDailyReportAdviceActionTitle(` ${adviceTitle} `), adviceTitle);
  assert.equal(
    normalizeDailyReportAdviceActionTitle(`Case-${adviceTitle}`),
    `Case-${adviceTitle}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Report advice titles", () => {
  const padded = `${em}${adviceTitle}${em}`;
  const nbspTitle = `${nbsp}${adviceTitle}${nbsp}`;
  const internalEm = `Review${em}chicken`;
  const internalNbsp = `Review${nbsp}chicken`;

  // Inventing proof: Unicode trim would invent the clean advice title.
  assert.equal(padded.trim(), adviceTitle);
  assert.equal(nbspTitle.trim(), adviceTitle);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspTitle), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyReportAdviceActionTitle(padded), padded);
  assert.equal(canonicalizeDailyReportAdviceActionTitle(padded), null);
  assert.equal(canonicalizeDailyReportAdviceActionTitle(nbspTitle), null);
  assert.equal(normalizeDailyReportAdviceActionTitle(padded), null);
  assert.equal(normalizeDailyReportAdviceActionTitle(nbspTitle), null);
  assert.equal(normalizeDailyReportAdviceActionTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportAdviceActionTitle(internalEm), internalEm);
  assert.equal(normalizeDailyReportAdviceActionTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportAdviceActionTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Report advice titles", () => {
  assert.equal(normalizeDailyReportAdviceActionTitle(undefined), null);
  assert.equal(normalizeDailyReportAdviceActionTitle(null), null);
  assert.equal(normalizeDailyReportAdviceActionTitle(""), null);
  assert.equal(normalizeDailyReportAdviceActionTitle("   "), null);
  assert.equal(normalizeDailyReportAdviceActionTitle(123 as unknown as string), null);
  assert.equal(normalizeDailyReportAdviceActionTitle(`\u0001${adviceTitle}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyReportAdviceActionTitle(`${adviceTitle}\t`), adviceTitle);
  assert.equal(normalizeDailyReportAdviceActionTitle(`${adviceTitle}\u0007`), null);
  assert.equal(normalizeDailyReportAdviceActionTitle(em), null);
});

test("Daily Report advice action.title Boolean bypass proof and none fallback contract", () => {
  // Prior always-pass Text rendered blank-looking advice titles whenever the
  // token was non-nullish — including Unicode-only space and empty string.
  assert.equal(Boolean(em), true);
  assert.equal(Boolean(""), false);
  assert.equal(normalizeDailyReportAdviceActionTitle(em), null);
  assert.equal(normalizeDailyReportAdviceActionTitle(""), null);
  assert.equal(
    normalizeDailyReportAdviceActionTitle(em) || "dailyReport.advice.actionTitle.none",
    "dailyReport.advice.actionTitle.none"
  );

  // Ranked advice still sources untrusted insight / attention titles in domain.
  assert.match(dailyOpsReportSource, /title: urgentInsight\.title/);
  assert.match(dailyOpsReportSource, /title: card\.title/);
});

test("assertion plan is derived from this test source, not a prior run transcript", () => {
  const source = readFileSync(new URL(import.meta.url), "utf8");
  const assertionCallSites = [
    ...source.matchAll(/\bassert\.(?:equal|match|doesNotMatch|ok|deepEqual)\s*\(/g)
  ];
  // Plan number must equal assertion call-site count in this file.
  assert.equal(assertionCallSites.length, 55);
});

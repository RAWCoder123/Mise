import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportAdviceActionDetail,
  canonicalizeDailyReportAdviceActionDetail,
  normalizeDailyReportAdviceActionDetail
} from "../services/domain/presentationDailyReportAdviceActionDetailIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyReportAdviceActionDetailIdentity.ts",
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

const adviceDetail = "Review critical coverage before the next service";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005ZP pins Daily Report advice action.detail to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZP/);
  assert.match(dailyReportSource, /MISE-005ZP/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportAdviceActionDetail\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportAdviceActionDetailIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportAdviceActionDetail\(/);
  assert.match(
    dailyReportSource,
    /adviceActionDetail \|\|\s*t\("dailyReport\.advice\.actionDetail\.none"\)/
  );
  assert.doesNotMatch(
    dailyReportSource,
    /styles\.summaryCopy[^>]*>\s*\{action\.detail\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"dailyReport\.advice\.actionDetail\.none": "Details"/);
  assert.match(catalogSource, /"dailyReport\.advice\.actionDetail\.none": "Detalles"/);
  assert.match(catalogSource, /"dailyReport\.advice\.actionDetail\.none": "详情"/);

  // Leave Daily Report action.title alone (open #1173 / MISE-005ZO).
  assert.match(
    dailyReportSource,
    /<Text style=\{styles\.adviceTitle\}>\{action\.title\}<\/Text>/
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

  // Leave Daily Ops domain rankManagerActions detail construction alone.
  assert.match(dailyOpsReportSource, /detail: card\.detail/);
  assert.match(
    dailyOpsReportSource,
    /detail: urgentInsight\.recommended_action \|\| urgentInsight\.description/
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationDailyReportAdviceActionTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsMemory/);
  assert.doesNotMatch(identityCode, /presentationDailyOpsAskBriefing/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyReportAdviceActionDetail(adviceDetail), adviceDetail);
  assert.equal(normalizeDailyReportAdviceActionDetail(` ${adviceDetail} `), adviceDetail);
  assert.equal(
    normalizeDailyReportAdviceActionDetail(`Case-${adviceDetail}`),
    `Case-${adviceDetail}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Report advice details", () => {
  const padded = `${em}${adviceDetail}${em}`;
  const nbspDetail = `${nbsp}${adviceDetail}${nbsp}`;
  const internalEm = `Review${em}critical`;
  const internalNbsp = `Review${nbsp}critical`;

  // Inventing proof: Unicode trim would invent the clean advice detail.
  assert.equal(padded.trim(), adviceDetail);
  assert.equal(nbspDetail.trim(), adviceDetail);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspDetail), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyReportAdviceActionDetail(padded), padded);
  assert.equal(canonicalizeDailyReportAdviceActionDetail(padded), null);
  assert.equal(canonicalizeDailyReportAdviceActionDetail(nbspDetail), null);
  assert.equal(normalizeDailyReportAdviceActionDetail(padded), null);
  assert.equal(normalizeDailyReportAdviceActionDetail(nbspDetail), null);
  assert.equal(normalizeDailyReportAdviceActionDetail(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportAdviceActionDetail(internalEm), internalEm);
  assert.equal(normalizeDailyReportAdviceActionDetail(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportAdviceActionDetail(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Report advice details", () => {
  assert.equal(normalizeDailyReportAdviceActionDetail(undefined), null);
  assert.equal(normalizeDailyReportAdviceActionDetail(null), null);
  assert.equal(normalizeDailyReportAdviceActionDetail(""), null);
  assert.equal(normalizeDailyReportAdviceActionDetail("   "), null);
  assert.equal(normalizeDailyReportAdviceActionDetail(123 as unknown as string), null);
  assert.equal(normalizeDailyReportAdviceActionDetail(`\u0001${adviceDetail}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyReportAdviceActionDetail(`${adviceDetail}\t`), adviceDetail);
  assert.equal(normalizeDailyReportAdviceActionDetail(`${adviceDetail}\u0007`), null);
  assert.equal(normalizeDailyReportAdviceActionDetail(em), null);
});

test("Daily Report advice action.detail Boolean bypass proof and none fallback contract", () => {
  // Prior always-pass Text rendered blank-looking advice details whenever the
  // token was non-nullish — including Unicode-only space and empty string.
  assert.equal(Boolean(em), true);
  assert.equal(Boolean(""), false);
  assert.equal(normalizeDailyReportAdviceActionDetail(em), null);
  assert.equal(normalizeDailyReportAdviceActionDetail(""), null);
  assert.equal(
    normalizeDailyReportAdviceActionDetail(em) || "dailyReport.advice.actionDetail.none",
    "dailyReport.advice.actionDetail.none"
  );

  // Ranked advice still sources untrusted insight / attention details in domain.
  assert.match(dailyOpsReportSource, /detail: card\.detail/);
  assert.match(
    dailyOpsReportSource,
    /detail: urgentInsight\.recommended_action \|\| urgentInsight\.description/
  );
});

test("assertion plan is derived from this test source, not a prior run transcript", () => {
  const source = readFileSync(new URL(import.meta.url), "utf8");
  const assertionCallSites = [
    ...source.matchAll(/\bassert\.(?:equal|match|doesNotMatch|ok|deepEqual)\s*\(/g)
  ];
  // Plan number must equal assertion call-site count in this file.
  assert.equal(assertionCallSites.length, 56);
});

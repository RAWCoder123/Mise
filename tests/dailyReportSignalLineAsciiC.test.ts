import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportSignalLine,
  canonicalizeDailyReportSignalLine,
  normalizeDailyReportSignalLine
} from "../services/domain/presentationDailyReportSignalLineIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyReportSignalLineIdentity.ts",
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

const signalLine = "Review waste before closeout";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005ZU pins Daily Report signal.line to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZU/);
  assert.match(dailyReportSource, /MISE-005ZU/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportSignalLine\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportSignalLineIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportSignalLine\(/);
  assert.match(
    dailyReportSource,
    /normalizeDailyReportSignalLine\(signal\.line\)\s*\|\|\s*\n?\s*t\("dailyReport\.signal\.line\.none"\)/
  );
  assert.doesNotMatch(
    dailyReportSource,
    /styles\.signalLine[^>]*>\s*\{signal\.line\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"dailyReport\.signal\.line\.none": "Signal"/);
  assert.match(catalogSource, /"dailyReport\.signal\.line\.none": "Señal"/);
  assert.match(catalogSource, /"dailyReport\.signal\.line\.none": "信号"/);

  // Inventing path still composes free-form insight fields into signal.line.
  assert.match(dailyOpsReportSource, /best\.recommended_action\?\.trim\(\)/);
  assert.match(dailyOpsReportSource, /best\.why_it_matters\?\.trim\(\)/);
  assert.match(
    dailyOpsReportSource,
    /why \|\| best\.description \|\| best\.title/
  );

  // Leave Daily Report advice action.title alone (open #1173 / MISE-005ZO).
  assert.match(
    dailyReportSource,
    /<Text style=\{styles\.adviceTitle\}>\{action\.title\}<\/Text>/
  );

  // Leave Daily Report advice action.detail alone (open #1174 / MISE-005ZP).
  assert.match(
    dailyReportSource,
    /<Text style=\{styles\.summaryCopy\}>\{action\.detail\}<\/Text>/
  );

  // Leave Daily Ops askBriefingText display path alone (open #866 / MISE-005QF).
  assert.match(
    dailyReportSource,
    /\{visibleReport\.managerAdvice\.askBriefingText\}/
  );

  // Leave Daily Report learning memoryCopy / memoryNextStep /
  // credibilityNextStep alone (#1175 / #1176 / #1177).
  assert.match(
    dailyReportSource,
    /\{visibleReport\.learning\.memoryCopy\}/
  );
  assert.match(
    dailyReportSource,
    /memoryNextStep \?\? visibleReport\.learning\.credibilityNextStep/
  );

  // Leave learning credibilityLabel alone (coordinate with open #258).
  assert.match(
    dailyReportSource,
    /\{visibleReport\.learning\.credibilityLabel\}/
  );

  // Leave Insights signal presentation surfaces alone (#1166 / #1167 / #1168).
  assert.match(insightsSource, /signal/);

  // Leave Home ApprovalsSection card.title alone (open #1049).
  assert.match(homeSource, /card\.title/);

  // Leave empty closeout placeholder construction alone (open #258).
  assert.match(
    dailyOpsReportSource,
    /No \$\{type\} signal for closeout\./
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationDailyReportAdviceActionDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyReportAdviceActionTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSignal/);
  assert.doesNotMatch(identityCode, /presentationDailyOpsAskBriefing/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyReportSignalLine(signalLine), signalLine);
  assert.equal(normalizeDailyReportSignalLine(` ${signalLine} `), signalLine);
  assert.equal(
    normalizeDailyReportSignalLine(`Señal ${signalLine}`),
    `Señal ${signalLine}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Report signal lines", () => {
  const padded = `${em}${signalLine}${em}`;
  const nbspLine = `${nbsp}${signalLine}${nbsp}`;
  const internalEm = `Review${em}waste`;
  const internalNbsp = `Review${nbsp}waste`;

  // Inventing proof: Unicode trim would invent the clean signal line.
  assert.equal(padded.trim(), signalLine);
  assert.equal(nbspLine.trim(), signalLine);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspLine), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyReportSignalLine(padded), padded);
  assert.equal(canonicalizeDailyReportSignalLine(padded), null);
  assert.equal(canonicalizeDailyReportSignalLine(nbspLine), null);
  assert.equal(normalizeDailyReportSignalLine(padded), null);
  assert.equal(normalizeDailyReportSignalLine(nbspLine), null);
  assert.equal(normalizeDailyReportSignalLine(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportSignalLine(internalEm), internalEm);
  assert.equal(normalizeDailyReportSignalLine(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportSignalLine(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Report signal lines", () => {
  assert.equal(normalizeDailyReportSignalLine(undefined), null);
  assert.equal(normalizeDailyReportSignalLine(null), null);
  assert.equal(normalizeDailyReportSignalLine(""), null);
  assert.equal(normalizeDailyReportSignalLine("   "), null);
  assert.equal(normalizeDailyReportSignalLine(123 as unknown as string), null);
  assert.equal(normalizeDailyReportSignalLine(`\u0001${signalLine}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyReportSignalLine(`${signalLine}\t`), signalLine);
  assert.equal(normalizeDailyReportSignalLine(`${signalLine}\u0007`), null);
  assert.equal(normalizeDailyReportSignalLine(em), null);
});

test("Daily Report signal.line Boolean bypass proof and none fallback contract", () => {
  // Prior always-pass Text rendered blank-looking signal lines whenever the
  // token was non-nullish — including Unicode-only space and empty string.
  assert.equal(Boolean(em), true);
  assert.equal(Boolean(""), false);
  assert.equal(normalizeDailyReportSignalLine(em), null);
  assert.equal(normalizeDailyReportSignalLine(""), null);
  assert.equal(
    normalizeDailyReportSignalLine(em) || "dailyReport.signal.line.none",
    "dailyReport.signal.line.none"
  );

  // Domain still Unicode-trims action/why and falls through to description/title.
  assert.match(dailyOpsReportSource, /best\.recommended_action\?\.trim\(\)/);
  assert.match(dailyOpsReportSource, /why \|\| best\.description \|\| best\.title/);
  assert.match(
    dailyReportSource,
    /normalizeDailyReportSignalLine\(signal\.line\)\s*\|\|\s*\n?\s*t\("dailyReport\.signal\.line\.none"\)/
  );
});

test("assertion plan is derived from this test source, not a prior run transcript", () => {
  const source = readFileSync(new URL(import.meta.url), "utf8");
  const assertionCallSites = [
    ...source.matchAll(/\bassert\.(?:equal|match|doesNotMatch|ok|deepEqual)\s*\(/g)
  ];
  // Plan number must equal assertion call-site count in this file.
  assert.equal(assertionCallSites.length, 61);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyBriefMissingDataItem,
  canonicalizeDailyBriefMissingDataItem,
  normalizeDailyBriefMissingDataItem
} from "../services/domain/presentationDailyBriefMissingDataItemIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyBriefMissingDataItemIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const boardSource = readFileSync(
  new URL("../components/dailyBrief/DailyBriefBoard.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const findingsSource = readFileSync(
  new URL("../services/domain/operationalFindings.ts", import.meta.url),
  "utf8"
);
const dailyReportSource = readFileSync(
  new URL("../app/more/daily-report.tsx", import.meta.url),
  "utf8"
);
const dailyBriefSource = readFileSync(
  new URL("../app/more/daily-brief.tsx", import.meta.url),
  "utf8"
);

const safeToken = "menu_mapping:Chicken Breast";
const controlledToken = "verified_physical_count";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005ZV pins Daily Brief missingData items to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZV/);
  assert.match(boardSource, /MISE-005ZV/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyBriefMissingDataItem\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    boardSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyBriefMissingDataItemIdentity"/
  );
  assert.match(boardSource, /normalizeDailyBriefMissingDataItem\(/);
  assert.match(
    boardSource,
    /normalizeDailyBriefMissingDataItem\(item\)\s*\|\|\s*\n?\s*t\("dailyBrief\.missingData\.item\.none"\)/
  );
  assert.doesNotMatch(
    boardSource,
    /dailyBrief\.missingData",\s*\{\s*items:\s*finding\.freshness\.missingData\.join\(", "\)\s*\}/
  );

  assert.match(catalogSource, /"dailyBrief\.missingData\.item\.none": "Data"/);
  assert.match(catalogSource, /"dailyBrief\.missingData\.item\.none": "Dato"/);
  assert.match(catalogSource, /"dailyBrief\.missingData\.item\.none": "数据"/);

  // Inventing path still embeds free-form POS item names into missingData.
  assert.match(findingsSource, /menu_mapping:\$\{name\}/);
  assert.match(findingsSource, /boundedText\(sale\.item_name,/);
  assert.match(findingsSource, /value\.trim\(\)\.replace\(\/\\s\+\/g/);

  // Leave Daily Brief finding.title alone (open #1145 / MISE-005YM).
  assert.match(boardSource, /\{finding\.title\}/);

  // Leave Daily Brief finding.explanation alone (open #1142 / MISE-005YJ).
  assert.match(boardSource, /\{finding\.explanation\}/);

  // Leave affectedWorkflow meta interpolation alone (deferred).
  assert.match(
    boardSource,
    /t\("dailyBrief\.workflow", \{ workflow: finding\.affectedWorkflow \}\)/
  );

  // Leave recommendedAction body alone.
  assert.match(boardSource, /\{finding\.recommendedAction\}/);

  // Leave Daily Report signal.line alone (open #1179 / MISE-005ZU).
  assert.match(dailyReportSource, /signal\.line/);

  // Leave Phase Brief FindingRow title / interpretation alone (#1156 / #1157).
  assert.match(dailyBriefSource, /\{finding\.interpretation\}/);
  assert.match(dailyBriefSource, /\{finding\.title\}/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationDailyReportSignalLineIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyPhaseBrief/);
  assert.doesNotMatch(identityCode, /presentationInsightsSignal/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyBriefMissingDataItem(safeToken), safeToken);
  assert.equal(normalizeDailyBriefMissingDataItem(` ${safeToken} `), safeToken);
  assert.equal(normalizeDailyBriefMissingDataItem(controlledToken), controlledToken);
  assert.equal(
    normalizeDailyBriefMissingDataItem(`Señal ${safeToken}`),
    `Señal ${safeToken}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Brief missingData items", () => {
  const padded = `${em}${safeToken}${em}`;
  const nbspToken = `${nbsp}${safeToken}${nbsp}`;
  const internalEm = `menu_mapping:Chicken${em}Breast`;
  const internalNbsp = `menu_mapping:Chicken${nbsp}Breast`;
  const paddedName = `${em}Chicken Breast${em}`;

  // Inventing proof: Unicode trim would invent the clean missing-data token /
  // free-form menu item name before Board join (and domain boundedText).
  assert.equal(padded.trim(), safeToken);
  assert.equal(nbspToken.trim(), safeToken);
  assert.equal(paddedName.trim(), "Chicken Breast");
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspToken), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyBriefMissingDataItem(padded), padded);
  assert.equal(canonicalizeDailyBriefMissingDataItem(padded), null);
  assert.equal(canonicalizeDailyBriefMissingDataItem(nbspToken), null);
  assert.equal(normalizeDailyBriefMissingDataItem(padded), null);
  assert.equal(normalizeDailyBriefMissingDataItem(nbspToken), null);
  assert.equal(normalizeDailyBriefMissingDataItem(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyBriefMissingDataItem(internalEm), internalEm);
  assert.equal(normalizeDailyBriefMissingDataItem(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyBriefMissingDataItem(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Brief missingData items", () => {
  assert.equal(normalizeDailyBriefMissingDataItem(undefined), null);
  assert.equal(normalizeDailyBriefMissingDataItem(null), null);
  assert.equal(normalizeDailyBriefMissingDataItem(""), null);
  assert.equal(normalizeDailyBriefMissingDataItem("   "), null);
  assert.equal(normalizeDailyBriefMissingDataItem(123 as unknown as string), null);
  assert.equal(normalizeDailyBriefMissingDataItem(`\u0001${safeToken}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyBriefMissingDataItem(`${safeToken}\t`), safeToken);
  assert.equal(normalizeDailyBriefMissingDataItem(`${safeToken}\u0007`), null);
  assert.equal(normalizeDailyBriefMissingDataItem(em), null);
});

test("Daily Brief missingData Boolean bypass proof and none fallback contract", () => {
  // Prior always-pass join rendered blank-looking Missing entries whenever the
  // token was non-nullish — including Unicode-only space and empty string.
  assert.equal(Boolean(em), true);
  assert.equal(Boolean(""), false);
  assert.equal(normalizeDailyBriefMissingDataItem(em), null);
  assert.equal(normalizeDailyBriefMissingDataItem(""), null);
  assert.equal(
    normalizeDailyBriefMissingDataItem(em) || "dailyBrief.missingData.item.none",
    "dailyBrief.missingData.item.none"
  );

  // Domain still Unicode-trims free-form item names before menu_mapping embed.
  assert.match(findingsSource, /value\.trim\(\)/);
  assert.match(findingsSource, /menu_mapping:\$\{name\}/);
  assert.match(
    boardSource,
    /normalizeDailyBriefMissingDataItem\(item\)\s*\|\|\s*\n?\s*t\("dailyBrief\.missingData\.item\.none"\)/
  );

  // Controlled freshness tokens remain durable when already ASCII-safe.
  assert.equal(normalizeDailyBriefMissingDataItem("inventory_item"), "inventory_item");
  assert.equal(normalizeDailyBriefMissingDataItem("menu_mapping"), "menu_mapping");
  assert.equal(
    normalizeDailyBriefMissingDataItem("verified_canonical_unit"),
    "verified_canonical_unit"
  );
});

test("assertion plan is derived from this test source, not a prior run transcript", () => {
  const source = readFileSync(new URL(import.meta.url), "utf8");
  const assertionCallSites = [
    ...source.matchAll(/\bassert\.(?:equal|match|doesNotMatch|ok|deepEqual)\s*\(/g)
  ];
  // Plan number must equal assertion call-site count in this file.
  assert.equal(assertionCallSites.length, 63);
});

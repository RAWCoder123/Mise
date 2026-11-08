import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalRecommendationDecisionRowReason,
  normalizeRecommendationDecisionRowReason
} from "../services/domain/presentationRecommendationDecisionRowReasonIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationRecommendationDecisionRowReasonIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const rowSource = readFileSync(
  new URL("../components/RecommendationDecisionRow.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const miseDomainSource = readFileSync(
  new URL("../services/domain/miseDomain.ts", import.meta.url),
  "utf8"
);
const operatingPlanSource = readFileSync(
  new URL("../services/domain/operatingPlan.ts", import.meta.url),
  "utf8"
);
const itemNameIdentityPath = new URL(
  "../services/domain/presentationRecommendationDecisionRowItemNameIdentity.ts",
  import.meta.url
);

const reason = "Roma Tomatoes is below reorder level. Mise recommends bringing it back to par before the next rush.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005ZX pins RecommendationDecisionRow recommendation.reason to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZX/);
  assert.match(rowSource, /MISE-005ZX/);

  assert.match(
    identitySource,
    /export function canonicalRecommendationDecisionRowReason\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    rowSource,
    /from "\.\.\/services\/domain\/presentationRecommendationDecisionRowReasonIdentity"/
  );
  assert.match(rowSource, /normalizeRecommendationDecisionRowReason\(/);
  assert.match(
    rowSource,
    /normalizeRecommendationDecisionRowReason\(recommendation\.reason\)\s*\|\|\s*t\("orders\.recommendation\.reason\.none"\)/
  );
  assert.doesNotMatch(
    rowSource,
    /<Text style=\{styles\.reason\}>\{recommendation\.reason\}<\/Text>/
  );

  assert.match(catalogSource, /"orders\.recommendation\.reason\.none": "Reason"/);
  assert.match(catalogSource, /"orders\.recommendation\.reason\.none": "Motivo"/);
  assert.match(catalogSource, /"orders\.recommendation\.reason\.none": "原因"/);

  // Inventing paths still Unicode-trim / embed free-form item_name into reason.
  assert.match(
    miseDomainSource,
    /return `\$\{item\.item_name\} \$\{verbForItem\(item\.item_name\)\} below reorder level/
  );
  assert.match(
    miseDomainSource,
    /return `\$\{item\.item_name\} may move faster than your usual ordering rhythm\.`;/
  );
  assert.match(operatingPlanSource, /recommendation\?\.reason\?\.trim\(\)/);

  // Leave RecommendationDecisionRow item_name alone (open #1055 / MISE-005WU).
  assert.match(rowSource, /\{recommendation\.item_name\}/);
  assert.doesNotMatch(rowSource, /normalizeRecommendationDecisionRowItemName\(/);
  assert.equal(
    (() => {
      try {
        readFileSync(itemNameIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  // Leave unit / quantity suggested meta on raw recommendation fields.
  assert.match(rowSource, /unit: recommendation\.unit/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationRecommendationDecisionRowItemNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyReportSignalLineIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsWhyItMattersIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeRecommendationDecisionRowReason(reason), reason);
  assert.equal(normalizeRecommendationDecisionRowReason(` ${reason} `), reason);
  assert.equal(
    normalizeRecommendationDecisionRowReason(`Context: ${reason}`),
    `Context: ${reason}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for RecommendationDecisionRow reasons", () => {
  const padded = `${em}${reason}${em}`;
  const nbspReason = `${nbsp}${reason}${nbsp}`;
  const internalEm = `Roma${em}Tomatoes is below reorder level.`;
  const internalNbsp = `Roma${nbsp}Tomatoes is below reorder level.`;
  const multiline = `Roma Tomatoes is below reorder level.\nBring it back to par before the next rush.`;

  // Inventing proof: Unicode trim would invent the clean reason.
  assert.equal(padded.trim(), reason);
  assert.equal(nbspReason.trim(), reason);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspReason), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalRecommendationDecisionRowReason(padded), padded);
  assert.equal(normalizeRecommendationDecisionRowReason(padded), null);
  assert.equal(normalizeRecommendationDecisionRowReason(padded) || "FALLBACK", "FALLBACK");

  // End NBSP folds to plain space then C-trims to the clean reason (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeRecommendationDecisionRowReason(nbspReason), reason);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeRecommendationDecisionRowReason(internalEm), internalEm);
  assert.equal(
    normalizeRecommendationDecisionRowReason(internalNbsp),
    "Roma Tomatoes is below reorder level."
  );
  assert.equal(normalizeRecommendationDecisionRowReason(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for RecommendationDecisionRow reasons", () => {
  assert.equal(normalizeRecommendationDecisionRowReason(undefined), null);
  assert.equal(normalizeRecommendationDecisionRowReason(null), null);
  assert.equal(normalizeRecommendationDecisionRowReason(""), null);
  assert.equal(normalizeRecommendationDecisionRowReason("   "), null);
  assert.equal(normalizeRecommendationDecisionRowReason(123 as unknown as string), null);
  assert.equal(normalizeRecommendationDecisionRowReason(`\u0001${reason}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRecommendationDecisionRowReason(`${reason}\t`), reason);
  assert.equal(normalizeRecommendationDecisionRowReason(`${reason}\u0007`), null);
  assert.equal(normalizeRecommendationDecisionRowReason(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist / #662).
  assert.equal(
    normalizeRecommendationDecisionRowReason(`Roma Tomatoes\tis below reorder level.`),
    `Roma Tomatoes\tis below reorder level.`
  );
});

test("RecommendationDecisionRow bypass proof: empty and Unicode-only-space reasons soft-null to localized none", () => {
  // Prior always-pass-reason path still rendered blank-looking Text when expanded.
  assert.equal(normalizeRecommendationDecisionRowReason(""), null);
  assert.equal(normalizeRecommendationDecisionRowReason(em), null);
  assert.equal(normalizeRecommendationDecisionRowReason(nbsp), null);
  const missingReason: string | null | undefined = undefined;
  const unicodeOnlyReason: string | null | undefined = em;
  assert.equal(missingReason ?? "", "");
  assert.equal(unicodeOnlyReason ?? "", em);
  assert.notEqual(unicodeOnlyReason ?? "", "");
  assert.equal(Boolean(unicodeOnlyReason), true);
  assert.match(
    rowSource,
    /normalizeRecommendationDecisionRowReason\(recommendation\.reason\)\s*\|\|\s*t\("orders\.recommendation\.reason\.none"\)/
  );
});

test("RecommendationDecisionRow reason identity refuses Unicode inventing equality", () => {
  const padded = `${em}${reason}${em}`;
  assert.notEqual(canonicalRecommendationDecisionRowReason(padded), padded.trim());
  assert.equal(normalizeRecommendationDecisionRowReason(padded), null);
  assert.equal(normalizeRecommendationDecisionRowReason(`\t${reason}\n`), reason);
});

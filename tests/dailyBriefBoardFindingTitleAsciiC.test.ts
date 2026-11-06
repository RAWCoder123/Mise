import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyBriefBoardFindingTitle,
  canonicalizeDailyBriefBoardFindingTitle,
  normalizeDailyBriefBoardFindingTitle
} from "../services/domain/presentationDailyBriefBoardFindingTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyBriefBoardFindingTitleIdentity.ts",
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
const domainTitleIdentityPath = new URL(
  "../services/domain/operationalFindingTitleIdentity.ts",
  import.meta.url
);
const cardHeaderTitleIdentityPath = new URL(
  "../services/domain/presentationDailyBriefCardHeaderTitleIdentity.ts",
  import.meta.url
);
const actionTitleIdentityPath = new URL(
  "../services/domain/presentationDailyBriefActionTitleIdentity.ts",
  import.meta.url
);
const boardExplanationIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardExplanationIdentity.ts",
  import.meta.url
);
const boardRecommendedActionIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardRecommendedActionIdentity.ts",
  import.meta.url
);

const title = "Low stock risk";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YM pins Daily Brief Board finding.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005YM/);
  assert.match(boardSource, /MISE-005YM/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyBriefBoardFindingTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    boardSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyBriefBoardFindingTitleIdentity"/
  );
  assert.match(boardSource, /normalizeDailyBriefBoardFindingTitle\(/);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardFindingTitle\(finding\.title\)\s*\|\|\s*t\("dailyBrief\.findingTitle\.none"\)/
  );
  assert.doesNotMatch(
    boardSource,
    />\s*\{finding\.title\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"dailyBrief\.findingTitle\.none": "Review the finding"/);
  assert.match(catalogSource, /"dailyBrief\.findingTitle\.none": "Revisa el hallazgo"/);
  assert.match(catalogSource, /"dailyBrief\.findingTitle\.none": "查看发现"/);

  // Leave compact preview / a11y title interpolations as raw pass-through on this tip.
  assert.match(boardSource, /\{firstFinding\.title\}/);
  assert.match(boardSource, /accessibilityLabel=\{`\$\{finding\.title\}\. \$\{severityLabel\}`\}/);
  assert.match(boardSource, /dailyBrief\.approveAccessibility", \{ title: finding\.title \}/);

  // Leave Board explanation / recommendedAction / annotation as raw pass-through.
  assert.match(boardSource, /\{finding\.explanation\}/);
  assert.match(boardSource, /\{finding\.recommendedAction\}/);
  assert.match(boardSource, /\{finding\.managerFeedback\.effectiveRecommendedAction\}/);

  // Leave sibling title tips alone (#920 / #1074 / #1075).
  assert.doesNotMatch(boardSource, /presentationDailyBriefCardHeaderTitleIdentity/);
  assert.doesNotMatch(boardSource, /normalizeDailyBriefCardHeaderTitle/);
  assert.doesNotMatch(boardSource, /presentationDailyBriefActionTitleIdentity/);
  assert.doesNotMatch(boardSource, /operationalFindingTitleIdentity/);
  assert.match(findingsSource, /function boundedText\(/);
  assert.equal(
    (() => {
      try {
        readFileSync(domainTitleIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );
  assert.equal(
    (() => {
      try {
        readFileSync(cardHeaderTitleIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );
  assert.equal(
    (() => {
      try {
        readFileSync(actionTitleIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );
  assert.equal(
    (() => {
      try {
        readFileSync(boardExplanationIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );
  assert.equal(
    (() => {
      try {
        readFileSync(boardRecommendedActionIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationDailyBriefCardHeaderTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefActionTitleIdentity/);
  assert.doesNotMatch(identityCode, /operationalFindingTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyBriefBoardFindingTitle(title), title);
  assert.equal(normalizeDailyBriefBoardFindingTitle(` ${title} `), title);
  assert.equal(normalizeDailyBriefBoardFindingTitle(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Daily Brief Board finding titles", () => {
  const padded = `${em}${title}${em}`;
  const nbspTitle = `${nbsp}${title}${nbsp}`;
  const internalEm = `Low${em}stock`;
  const internalNbsp = `Low${nbsp}stock`;

  // Inventing proof: Unicode trim would invent the clean finding title.
  assert.equal(padded.trim(), title);
  assert.equal(nbspTitle.trim(), title);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspTitle), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyBriefBoardFindingTitle(padded), padded);
  assert.equal(canonicalizeDailyBriefBoardFindingTitle(padded), null);
  assert.equal(canonicalizeDailyBriefBoardFindingTitle(nbspTitle), null);
  assert.equal(normalizeDailyBriefBoardFindingTitle(padded), null);
  assert.equal(normalizeDailyBriefBoardFindingTitle(nbspTitle), null);
  assert.equal(normalizeDailyBriefBoardFindingTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyBriefBoardFindingTitle(internalEm), internalEm);
  assert.equal(normalizeDailyBriefBoardFindingTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyBriefBoardFindingTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Brief Board finding titles", () => {
  assert.equal(normalizeDailyBriefBoardFindingTitle(undefined), null);
  assert.equal(normalizeDailyBriefBoardFindingTitle(null), null);
  assert.equal(normalizeDailyBriefBoardFindingTitle(""), null);
  assert.equal(normalizeDailyBriefBoardFindingTitle("   "), null);
  assert.equal(normalizeDailyBriefBoardFindingTitle(123 as unknown as string), null);
  assert.equal(normalizeDailyBriefBoardFindingTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyBriefBoardFindingTitle(`${title}\t`), title);
  assert.equal(normalizeDailyBriefBoardFindingTitle(`${title}\u0007`), null);
  assert.equal(normalizeDailyBriefBoardFindingTitle(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeDailyBriefBoardFindingTitle(`Low\tstock`), null);
  assert.equal(normalizeDailyBriefBoardFindingTitle(`Low\nstock`), null);
});

test("Daily Brief Board bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking cardTitle Text.
  assert.equal(normalizeDailyBriefBoardFindingTitle(""), null);
  assert.equal(normalizeDailyBriefBoardFindingTitle(em), null);
  assert.equal(normalizeDailyBriefBoardFindingTitle(nbsp), null);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardFindingTitle\(finding\.title\)\s*\|\|\s*t\("dailyBrief\.findingTitle\.none"\)/
  );
});

test("Daily Brief Board finding.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimDailyBriefBoardFindingTitle(padded), padded.trim());
  assert.equal(normalizeDailyBriefBoardFindingTitle(padded), null);
  assert.equal(normalizeDailyBriefBoardFindingTitle(`\t${title}\n`), title);
});

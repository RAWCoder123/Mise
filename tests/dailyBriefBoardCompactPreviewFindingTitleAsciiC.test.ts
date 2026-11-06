import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyBriefBoardCompactPreviewFindingTitle,
  canonicalizeDailyBriefBoardCompactPreviewFindingTitle,
  normalizeDailyBriefBoardCompactPreviewFindingTitle
} from "../services/domain/presentationDailyBriefBoardCompactPreviewFindingTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyBriefBoardCompactPreviewFindingTitleIdentity.ts",
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
const boardFindingTitleIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardFindingTitleIdentity.ts",
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

test("MISE-005YN pins Daily Brief Board compact-preview firstFinding.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005YN/);
  assert.match(boardSource, /MISE-005YN/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyBriefBoardCompactPreviewFindingTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    boardSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyBriefBoardCompactPreviewFindingTitleIdentity"/
  );
  assert.match(boardSource, /normalizeDailyBriefBoardCompactPreviewFindingTitle\(/);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardCompactPreviewFindingTitle\(firstFinding\.title\)\s*\|\|\s*t\("dailyBrief\.compactPreview\.findingTitle\.none"\)/
  );
  assert.doesNotMatch(boardSource, />\s*\{firstFinding\.title\}\s*<\/Text>/);

  assert.match(
    catalogSource,
    /"dailyBrief\.compactPreview\.findingTitle\.none": "Review the finding"/
  );
  assert.match(
    catalogSource,
    /"dailyBrief\.compactPreview\.findingTitle\.none": "Revisa el hallazgo"/
  );
  assert.match(catalogSource, /"dailyBrief\.compactPreview\.findingTitle\.none": "查看发现"/);

  // Leave compact preview explanation and Board card title as raw pass-through.
  assert.match(boardSource, /\{firstFinding\.explanation\}/);
  assert.match(boardSource, />\s*\{finding\.title\}\s*<\/Text>/);
  assert.match(boardSource, /accessibilityLabel=\{`\$\{finding\.title\}\. \$\{severityLabel\}`\}/);
  assert.match(boardSource, /dailyBrief\.approveAccessibility", \{ title: finding\.title \}/);

  // Leave Board explanation / recommendedAction / annotation as raw pass-through.
  assert.match(boardSource, /\{finding\.explanation\}/);
  assert.match(boardSource, /\{finding\.recommendedAction\}/);
  assert.match(boardSource, /\{finding\.managerFeedback\.effectiveRecommendedAction\}/);

  // Leave sibling title tips alone (#920 / #1074 / #1075 / #1145).
  assert.doesNotMatch(boardSource, /presentationDailyBriefBoardFindingTitleIdentity/);
  assert.doesNotMatch(boardSource, /normalizeDailyBriefBoardFindingTitle/);
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
        readFileSync(boardFindingTitleIdentityPath, "utf8");
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
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardFindingTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefCardHeaderTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefActionTitleIdentity/);
  assert.doesNotMatch(identityCode, /operationalFindingTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(title), title);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(` ${title} `), title);
  assert.equal(
    normalizeDailyBriefBoardCompactPreviewFindingTitle(`Case-${title}`),
    `Case-${title}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Brief Board compact-preview finding titles", () => {
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
  assert.equal(asciiTrimDailyBriefBoardCompactPreviewFindingTitle(padded), padded);
  assert.equal(canonicalizeDailyBriefBoardCompactPreviewFindingTitle(padded), null);
  assert.equal(canonicalizeDailyBriefBoardCompactPreviewFindingTitle(nbspTitle), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(padded), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(nbspTitle), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyBriefBoardCompactPreviewFindingTitle(internalEm), internalEm);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Brief Board compact-preview finding titles", () => {
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(undefined), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(null), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(""), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle("   "), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(123 as unknown as string), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(`${title}\t`), title);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(`${title}\u0007`), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(`Low\tstock`), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(`Low\nstock`), null);
});

test("Daily Brief Board compact-preview bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking previewFinding Text.
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(""), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(em), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(nbsp), null);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardCompactPreviewFindingTitle\(firstFinding\.title\)\s*\|\|\s*t\("dailyBrief\.compactPreview\.findingTitle\.none"\)/
  );
});

test("Daily Brief Board compact-preview firstFinding.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(
    asciiTrimDailyBriefBoardCompactPreviewFindingTitle(padded),
    padded.trim()
  );
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(padded), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingTitle(`\t${title}\n`), title);
});

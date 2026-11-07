import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyPhaseBriefFindingTitleDisplay,
  canonicalizeDailyPhaseBriefFindingTitleDisplay,
  normalizeDailyPhaseBriefFindingTitleDisplay
} from "../services/domain/presentationDailyPhaseBriefFindingTitleDisplayIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyPhaseBriefFindingTitleDisplayIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const dailyBriefSource = readFileSync(
  new URL("../app/more/daily-brief.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const boardSource = readFileSync(
  new URL("../components/dailyBrief/DailyBriefBoard.tsx", import.meta.url),
  "utf8"
);
const phaseTitleA11yIdentityPath = new URL(
  "../services/domain/presentationDailyPhaseBriefFindingTitleIdentity.ts",
  import.meta.url
);
const phaseInterpretationA11yIdentityPath = new URL(
  "../services/domain/presentationDailyPhaseBriefFindingInterpretationIdentity.ts",
  import.meta.url
);
const boardFindingTitleIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardFindingTitleIdentity.ts",
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

const title = "Verify produce count";
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

test("MISE-005YX pins Daily Phase Brief FindingRow finding.title display to ASCII C", () => {
  assert.match(identitySource, /MISE-005YX/);
  assert.match(dailyBriefSource, /MISE-005YX/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyPhaseBriefFindingTitleDisplay\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    dailyBriefSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyPhaseBriefFindingTitleDisplayIdentity"/
  );
  assert.match(dailyBriefSource, /normalizeDailyPhaseBriefFindingTitleDisplay\(/);
  assert.match(
    dailyBriefSource,
    /normalizeDailyPhaseBriefFindingTitleDisplay\(finding\.title\)\s*\|\|\s*t\("dailyPhaseBrief\.findingTitle\.none"\)/
  );
  assert.doesNotMatch(
    dailyBriefSource,
    /styles\.findingTitle\}>\s*\{finding\.title\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"dailyPhaseBrief\.findingTitle\.none": "Finding"/);
  assert.match(catalogSource, /"dailyPhaseBrief\.findingTitle\.none": "Hallazgo"/);
  assert.match(catalogSource, /"dailyPhaseBrief\.findingTitle\.none": "发现"/);

  // Leave finding-row a11y title / interpretation interpolations as raw
  // pass-through on this tip (owned by #1076 / #1085).
  assert.match(
    dailyBriefSource,
    /accessibilityLabel=\{`\$\{finding\.title\}\. \$\{finding\.interpretation\}`\}/
  );
  // Leave interpretation display Text alone.
  assert.match(dailyBriefSource, /\{finding\.interpretation\}/);

  // Leave sibling Board / a11y title tips alone.
  assert.doesNotMatch(dailyBriefSource, /presentationDailyPhaseBriefFindingTitleIdentity/);
  assert.doesNotMatch(dailyBriefSource, /normalizeDailyPhaseBriefFindingTitle\(/);
  assert.doesNotMatch(
    dailyBriefSource,
    /presentationDailyPhaseBriefFindingInterpretationIdentity/
  );
  assert.doesNotMatch(dailyBriefSource, /presentationDailyBriefBoardFindingTitleIdentity/);
  assert.doesNotMatch(boardSource, /presentationDailyPhaseBriefFindingTitleDisplayIdentity/);
  assert.equal(filePresence(phaseTitleA11yIdentityPath), "absent");
  assert.equal(filePresence(phaseInterpretationA11yIdentityPath), "absent");
  assert.equal(filePresence(boardFindingTitleIdentityPath), "absent");
  assert.equal(filePresence(cardHeaderTitleIdentityPath), "absent");
  assert.equal(filePresence(actionTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationDailyPhaseBriefFindingTitleIdentity/);
  assert.doesNotMatch(
    identityCode,
    /presentationDailyPhaseBriefFindingInterpretationIdentity/
  );
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardFindingTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefCardHeaderTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefActionTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(title), title);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(` ${title} `), title);
  assert.equal(
    normalizeDailyPhaseBriefFindingTitleDisplay(`Case-${title}`),
    `Case-${title}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Phase Brief FindingRow finding titles", () => {
  const padded = `${em}${title}${em}`;
  const nbspTitle = `${nbsp}${title}${nbsp}`;
  const internalEm = `Verify${em}produce`;
  const internalNbsp = `Verify${nbsp}produce`;

  // Inventing proof: Unicode trim would invent the clean finding title.
  assert.equal(padded.trim(), title);
  assert.equal(nbspTitle.trim(), title);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspTitle), true);
  // Blank-body bypass proof: Unicode-only space is truthy and previously still
  // rendered as the findingTitle Text.
  assert.equal(Boolean(em), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyPhaseBriefFindingTitleDisplay(padded), padded);
  assert.equal(canonicalizeDailyPhaseBriefFindingTitleDisplay(padded), null);
  assert.equal(canonicalizeDailyPhaseBriefFindingTitleDisplay(nbspTitle), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(padded), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(nbspTitle), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyPhaseBriefFindingTitleDisplay(internalEm), internalEm);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Phase Brief FindingRow finding titles", () => {
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(undefined), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(null), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(""), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay("   "), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(123 as unknown as string), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(`${title}\t`), title);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(`${title}\u0007`), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(`Verify\tproduce`), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(`Verify\nproduce`), null);
});

test("Daily Phase Brief FindingRow bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking findingTitle Text.
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(""), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(em), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(nbsp), null);
  assert.match(
    dailyBriefSource,
    /normalizeDailyPhaseBriefFindingTitleDisplay\(finding\.title\)\s*\|\|\s*t\("dailyPhaseBrief\.findingTitle\.none"\)/
  );
});

test("Daily Phase Brief FindingRow finding.title display identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimDailyPhaseBriefFindingTitleDisplay(padded), padded.trim());
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(padded), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitleDisplay(`\t${title}\n`), title);
});

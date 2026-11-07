import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsSignalDetail,
  canonicalizeInsightsSignalDetail,
  normalizeInsightsSignalDetail
} from "../services/domain/presentationInsightsSignalDetailIdentity";
import { presentLearningMemorySignal } from "../services/presentation/operationsPresentation";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationInsightsSignalDetailIdentity.ts",
    import.meta.url
  ),
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
const taskDetailOperationalDetailIdentityPath = new URL(
  "../services/domain/presentationTaskDetailOperationalDetailIdentity.ts",
  import.meta.url
);
const operatingPlanDetailIdentityPath = new URL(
  "../services/domain/presentationOperatingPlanTaskDetailIdentity.ts",
  import.meta.url
);
const restaurantMemoryEvidenceSummaryIdentityPath = new URL(
  "../services/domain/presentationRestaurantMemoryEvidenceSummaryIdentity.ts",
  import.meta.url
);

const detail = "Friday dinner demand is typically higher.";
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

test("MISE-005ZH pins Insights signal presentation.detail to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZH/);
  assert.match(insightsSource, /MISE-005ZH/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsSignalDetail\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsSignalDetailIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsSignalDetail\(/);
  assert.match(
    insightsSource,
    /normalizeInsightsSignalDetail\(presentation\.detail\)\s*\|\|\s*t\("insights\.signal\.detail\.none"\)/
  );
  assert.doesNotMatch(
    insightsSource,
    /styles\.signalDetail[^>]*>\s*\{presentation\.detail\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"insights\.signal\.detail\.none": "Details"/);
  assert.match(catalogSource, /"insights\.signal\.detail\.none": "Detalles"/);
  assert.match(catalogSource, /"insights\.signal\.detail\.none": "详情"/);

  // Leave presentation.label / presentation.value as raw pass-through on this tip.
  assert.match(
    insightsSource,
    /styles\.signalLabel[^>]*>\s*\{presentation\.label\}\s*<\/Text>/
  );
  assert.match(
    insightsSource,
    /styles\.signalValue[^>]*>\s*\{presentation\.value\}\s*<\/Text>/
  );

  // Descriptor-absent inventing path still embeds raw signal.detail into presentation.detail.
  assert.match(
    presentationSource,
    /if \(!descriptor\) \{\s*return \{\s*label: signal\.label,\s*value: signal\.value,\s*detail: `\$\{copy\.evidenceLabel\}: \$\{signal\.detail\}`/
  );

  // Do not pull in Task detail / Timeline / Restaurant Memory helpers on this tip.
  assert.doesNotMatch(insightsSource, /normalizeTaskDetailOperationalDetail\(/);
  assert.doesNotMatch(insightsSource, /normalizeOperatingPlanTaskDetail\(/);
  assert.doesNotMatch(insightsSource, /normalizeRestaurantMemoryEvidenceSummary\(/);
  assert.doesNotMatch(insightsSource, /presentationTaskDetailOperationalDetailIdentity/);
  assert.doesNotMatch(insightsSource, /presentationOperatingPlanTaskDetailIdentity/);
  assert.doesNotMatch(insightsSource, /presentationRestaurantMemoryEvidenceSummaryIdentity/);
  assert.equal(filePresence(taskDetailOperationalDetailIdentityPath), "absent");
  assert.equal(filePresence(operatingPlanDetailIdentityPath), "absent");
  assert.equal(filePresence(restaurantMemoryEvidenceSummaryIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationTaskDetailOperationalDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationOperatingPlanTaskDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationRestaurantMemoryEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeInsightsSignalDetail(detail), detail);
  assert.equal(normalizeInsightsSignalDetail(` ${detail} `), detail);
  assert.equal(normalizeInsightsSignalDetail(`Case-${detail}`), `Case-${detail}`);
  assert.equal(
    normalizeInsightsSignalDetail(`Evidence: ${detail}`),
    `Evidence: ${detail}`
  );
});

test("descriptor-absent signal.detail pass-through invents via trim and is soft-nulled on Insights", () => {
  const padded = `${em}${detail}${em}`;
  const presented = presentLearningMemorySignal("en", {
    label: "Friday demand",
    value: "+18%",
    detail: padded,
    tone: "brand"
  });

  // Inventing proof: no presentation descriptor → evidence-prefixed raw signal.detail.
  assert.equal(presented.detail, `Evidence: ${padded}`);
  assert.equal(padded.trim(), detail);
  assert.equal(presented.detail.trim(), `Evidence: ${em}${detail}`);
  assert.equal(Boolean(presented.detail), true);

  // ASCII C prep refuses that inventing equality before Insights signalDetail render.
  assert.equal(asciiTrimInsightsSignalDetail(presented.detail), presented.detail);
  assert.equal(canonicalizeInsightsSignalDetail(presented.detail), null);
  assert.equal(normalizeInsightsSignalDetail(presented.detail), null);
  assert.equal(
    normalizeInsightsSignalDetail(presented.detail) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Insights signal details", () => {
  const padded = `${em}${detail}${em}`;
  const nbspDetail = `${nbsp}${detail}${nbsp}`;
  const internalEm = `Friday${em}dinner demand is typically higher.`;
  const internalNbsp = `Friday${nbsp}dinner demand is typically higher.`;

  // Inventing proof: Unicode trim would invent the clean signal detail.
  assert.equal(padded.trim(), detail);
  assert.equal(nbspDetail.trim(), detail);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspDetail), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsSignalDetail(padded), padded);
  assert.equal(canonicalizeInsightsSignalDetail(padded), null);
  assert.equal(canonicalizeInsightsSignalDetail(nbspDetail), null);
  assert.equal(normalizeInsightsSignalDetail(padded), null);
  assert.equal(normalizeInsightsSignalDetail(nbspDetail), null);
  assert.equal(normalizeInsightsSignalDetail(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsSignalDetail(internalEm), internalEm);
  assert.equal(normalizeInsightsSignalDetail(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsSignalDetail(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights signal details", () => {
  assert.equal(normalizeInsightsSignalDetail(undefined), null);
  assert.equal(normalizeInsightsSignalDetail(null), null);
  assert.equal(normalizeInsightsSignalDetail(""), null);
  assert.equal(normalizeInsightsSignalDetail("   "), null);
  assert.equal(normalizeInsightsSignalDetail(123 as unknown as string), null);
  assert.equal(normalizeInsightsSignalDetail(`\u0001${detail}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsSignalDetail(`${detail}\t`), detail);
  assert.equal(normalizeInsightsSignalDetail(`${detail}\u0007`), null);
  assert.equal(normalizeInsightsSignalDetail(em), null);
  // LF/TAB/CR are rejected for single-line details (full cntrl; no multiline allowlist).
  assert.equal(normalizeInsightsSignalDetail(`Friday\tdinner demand`), null);
  assert.equal(normalizeInsightsSignalDetail(`Friday\ndinner demand`), null);
});

test("Insights signal detail bypass proof: empty and Unicode-only-space details soft-null to localized none", () => {
  // Prior always-pass-detail path still rendered blank-looking signalDetail Text.
  assert.equal(normalizeInsightsSignalDetail(""), null);
  assert.equal(normalizeInsightsSignalDetail(em), null);
  assert.equal(normalizeInsightsSignalDetail(nbsp), null);

  // Descriptor-absent evidence prefix with Unicode-only free-text still soft-nulls.
  const blankLooking = presentLearningMemorySignal("en", {
    label: "Friday demand",
    value: "+18%",
    detail: em,
    tone: "brand"
  });
  assert.equal(blankLooking.detail, `Evidence: ${em}`);
  assert.equal(Boolean(blankLooking.detail), true);
  assert.equal(normalizeInsightsSignalDetail(blankLooking.detail), null);

  const missingDetail: string | null | undefined = undefined;
  const unicodeOnlyDetail: string | null | undefined = em;
  assert.equal(missingDetail ?? "", "");
  assert.equal(unicodeOnlyDetail ?? "", em);
  assert.notEqual(unicodeOnlyDetail ?? "", "");
  assert.equal(Boolean(unicodeOnlyDetail), true);
  assert.match(
    insightsSource,
    /normalizeInsightsSignalDetail\(presentation\.detail\)\s*\|\|\s*t\("insights\.signal\.detail\.none"\)/
  );
});

test("Insights signal presentation.detail identity refuses Unicode inventing equality", () => {
  const padded = `${em}${detail}${em}`;
  assert.notEqual(asciiTrimInsightsSignalDetail(padded), padded.trim());
  assert.equal(normalizeInsightsSignalDetail(padded), null);
  assert.equal(normalizeInsightsSignalDetail(padded) || "Details", "Details");
  assert.equal(normalizeInsightsSignalDetail(`\t${detail}\n`), detail);
});

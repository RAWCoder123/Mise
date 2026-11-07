import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsMemoryOperatorCopy,
  canonicalizeInsightsMemoryOperatorCopy,
  normalizeInsightsMemoryOperatorCopy
} from "../services/domain/presentationInsightsMemoryOperatorCopyIdentity";
import { presentLearningMemory } from "../services/presentation/operationsPresentation";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationInsightsMemoryOperatorCopyIdentity.ts",
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
const insightsMemoryLabelIdentityPath = new URL(
  "../services/domain/presentationInsightsMemoryLabelIdentity.ts",
  import.meta.url
);
const insightsSignalValueIdentityPath = new URL(
  "../services/domain/presentationInsightsSignalValueIdentity.ts",
  import.meta.url
);
const insightsSignalLabelIdentityPath = new URL(
  "../services/domain/presentationInsightsSignalLabelIdentity.ts",
  import.meta.url
);
const insightsSignalDetailIdentityPath = new URL(
  "../services/domain/presentationInsightsSignalDetailIdentity.ts",
  import.meta.url
);
const taskDetailOperationalTitleIdentityPath = new URL(
  "../services/domain/presentationTaskDetailOperationalTitleIdentity.ts",
  import.meta.url
);
const homeTaskRowTitleIdentityPath = new URL(
  "../services/domain/presentationHomeTaskRowTitleIdentity.ts",
  import.meta.url
);

const operatorCopy = "Recipe baselines give Mise enough evidence.";
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

test("MISE-005ZL pins Insights memory evidenceIntro presentation.operatorCopy to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZL/);
  assert.match(insightsSource, /MISE-005ZL/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsMemoryOperatorCopy\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsMemoryOperatorCopyIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsMemoryOperatorCopy\(/);
  assert.match(
    insightsSource,
    /normalizeInsightsMemoryOperatorCopy\(presentation\.operatorCopy\)\s*\|\|\s*t\("insights\.memory\.copy\.none"\)/
  );
  assert.doesNotMatch(
    insightsSource,
    /styles\.evidenceIntro[^>]*>\s*\{presentation\.operatorCopy\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"insights\.memory\.copy\.none": "Summary"/);
  assert.match(catalogSource, /"insights\.memory\.copy\.none": "Resumen"/);
  assert.match(catalogSource, /"insights\.memory\.copy\.none": "摘要"/);

  // Leave subtitle label, nextStep, and EvidenceRow signal fields as raw
  // pass-through on this tip.
  assert.match(
    insightsSource,
    /t\("insights\.memory\.subtitle", \{ label: presentation\.label, score: formatNumber\(memory\.score\) \}\)/
  );
  assert.match(
    insightsSource,
    /styles\.evidenceNext[^>]*>\s*\{presentation\.nextStep\}\s*<\/Text>/
  );
  assert.match(
    insightsSource,
    /styles\.signalLabel[^>]*>\s*\{presentation\.label\}\s*<\/Text>/
  );
  assert.match(
    insightsSource,
    /styles\.signalDetail[^>]*>\s*\{presentation\.detail\}\s*<\/Text>/
  );
  assert.match(
    insightsSource,
    /styles\.signalValue[^>]*>\s*\{presentation\.value\}\s*<\/Text>/
  );

  // Descriptor-absent inventing path still embeds raw memory.operatorCopy into
  // presentation.operatorCopy.
  assert.match(
    presentationSource,
    /const operatorCopy = presentation\s*\?\s*presentation\.operatorCopyCode === "memory\.copy\.reliable"\s*\?\s*copy\.memory\.reliableCopy\s*:\s*copy\.memory\.buildingCopy\s*:\s*memory\.operatorCopy;/
  );

  // Do not pull in Insights memory label / signal / Task detail title / Home
  // task row helpers on this tip.
  assert.doesNotMatch(insightsSource, /normalizeInsightsMemoryLabel\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalValue\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalLabel\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalDetail\(/);
  assert.doesNotMatch(insightsSource, /normalizeTaskDetailOperationalTitle\(/);
  assert.doesNotMatch(insightsSource, /normalizeHomeTaskRowTitle\(/);
  assert.doesNotMatch(insightsSource, /presentationInsightsMemoryLabelIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalValueIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalLabelIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(insightsSource, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(insightsSource, /presentationHomeTaskRowTitleIdentity/);
  assert.equal(filePresence(insightsMemoryLabelIdentityPath), "absent");
  assert.equal(filePresence(insightsSignalValueIdentityPath), "absent");
  assert.equal(filePresence(insightsSignalLabelIdentityPath), "absent");
  assert.equal(filePresence(insightsSignalDetailIdentityPath), "absent");
  assert.equal(filePresence(taskDetailOperationalTitleIdentityPath), "absent");
  assert.equal(filePresence(homeTaskRowTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsMemoryLabelIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSignalValueIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSignalLabelIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeTaskRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeInsightsMemoryOperatorCopy(operatorCopy), operatorCopy);
  assert.equal(normalizeInsightsMemoryOperatorCopy(` ${operatorCopy} `), operatorCopy);
  assert.equal(normalizeInsightsMemoryOperatorCopy(`Case-${operatorCopy}`), `Case-${operatorCopy}`);
  assert.equal(normalizeInsightsMemoryOperatorCopy("Summary"), "Summary");
});

test("descriptor-absent memory.operatorCopy pass-through invents via trim and is soft-nulled on Insights", () => {
  const padded = `${em}${operatorCopy}${em}`;
  const presented = presentLearningMemory("en", {
    score: 90,
    label: "Mise memory is reliable",
    operatorCopy: padded,
    nextStep: "Keep collecting manager decisions.",
    signals: []
  });

  // Inventing proof: no presentation descriptor → raw memory.operatorCopy pass-through.
  assert.equal(presented.operatorCopy, padded);
  assert.equal(padded.trim(), operatorCopy);
  assert.equal(presented.operatorCopy.trim(), operatorCopy);
  assert.equal(Boolean(presented.operatorCopy), true);

  // ASCII C prep refuses that inventing equality before Insights evidenceIntro render.
  assert.equal(asciiTrimInsightsMemoryOperatorCopy(presented.operatorCopy), presented.operatorCopy);
  assert.equal(canonicalizeInsightsMemoryOperatorCopy(presented.operatorCopy), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy(presented.operatorCopy), null);
  assert.equal(
    normalizeInsightsMemoryOperatorCopy(presented.operatorCopy) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Insights memory operator copies", () => {
  const padded = `${em}${operatorCopy}${em}`;
  const nbspCopy = `${nbsp}${operatorCopy}${nbsp}`;
  const internalEm = `Recipe${em}baselines`;
  const internalNbsp = `Recipe${nbsp}baselines`;

  // Inventing proof: Unicode trim would invent the clean memory operator copy.
  assert.equal(padded.trim(), operatorCopy);
  assert.equal(nbspCopy.trim(), operatorCopy);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspCopy), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsMemoryOperatorCopy(padded), padded);
  assert.equal(canonicalizeInsightsMemoryOperatorCopy(padded), null);
  assert.equal(canonicalizeInsightsMemoryOperatorCopy(nbspCopy), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy(padded), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy(nbspCopy), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsMemoryOperatorCopy(internalEm), internalEm);
  assert.equal(normalizeInsightsMemoryOperatorCopy(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsMemoryOperatorCopy(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights memory operator copies", () => {
  assert.equal(normalizeInsightsMemoryOperatorCopy(undefined), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy(null), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy(""), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy("   "), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy(123 as unknown as string), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy(`\u0001${operatorCopy}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsMemoryOperatorCopy(`${operatorCopy}\t`), operatorCopy);
  assert.equal(normalizeInsightsMemoryOperatorCopy(`${operatorCopy}\u0007`), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy(em), null);
  // LF/TAB/CR are rejected for single-line operator copies (full cntrl; no multiline allowlist).
  assert.equal(normalizeInsightsMemoryOperatorCopy(`Recipe\tbaselines`), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy(`Recipe\nbaselines`), null);
});

test("Insights memory operatorCopy bypass proof: empty and Unicode-only-space values soft-null to localized none", () => {
  // Prior always-pass-operatorCopy path still rendered blank-looking evidenceIntro bodies.
  assert.equal(normalizeInsightsMemoryOperatorCopy(""), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy(em), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy(nbsp), null);

  // Descriptor-absent raw Unicode-only free-text still soft-nulls.
  const blankLooking = presentLearningMemory("en", {
    score: 40,
    label: "Mise memory is building",
    operatorCopy: em,
    nextStep: "Keep recording counts.",
    signals: []
  });
  assert.equal(blankLooking.operatorCopy, em);
  assert.equal(Boolean(blankLooking.operatorCopy), true);
  assert.equal(normalizeInsightsMemoryOperatorCopy(blankLooking.operatorCopy), null);

  const missingCopy: string | null | undefined = undefined;
  const unicodeOnlyCopy: string | null | undefined = em;
  assert.equal(missingCopy ?? "", "");
  assert.equal(unicodeOnlyCopy ?? "", em);
  assert.notEqual(unicodeOnlyCopy ?? "", "");
  assert.equal(Boolean(unicodeOnlyCopy), true);
  assert.match(
    insightsSource,
    /normalizeInsightsMemoryOperatorCopy\(presentation\.operatorCopy\)\s*\|\|\s*t\("insights\.memory\.copy\.none"\)/
  );
});

test("Insights memory evidenceIntro presentation.operatorCopy identity refuses Unicode inventing equality", () => {
  const padded = `${em}${operatorCopy}${em}`;
  assert.notEqual(asciiTrimInsightsMemoryOperatorCopy(padded), padded.trim());
  assert.equal(normalizeInsightsMemoryOperatorCopy(padded), null);
  assert.equal(normalizeInsightsMemoryOperatorCopy(padded) || "Summary", "Summary");
  assert.equal(normalizeInsightsMemoryOperatorCopy(`\t${operatorCopy}\n`), operatorCopy);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsMemoryNextStep,
  canonicalizeInsightsMemoryNextStep,
  normalizeInsightsMemoryNextStep
} from "../services/domain/presentationInsightsMemoryNextStepIdentity";
import { presentLearningMemory } from "../services/presentation/operationsPresentation";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationInsightsMemoryNextStepIdentity.ts",
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
const insightsMemoryOperatorCopyIdentityPath = new URL(
  "../services/domain/presentationInsightsMemoryOperatorCopyIdentity.ts",
  import.meta.url
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

const nextStep = "Keep recording counts.";
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

test("MISE-005ZM pins Insights memory evidenceNext presentation.nextStep to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZM/);
  assert.match(insightsSource, /MISE-005ZM/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsMemoryNextStep\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsMemoryNextStepIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsMemoryNextStep\(/);
  assert.match(
    insightsSource,
    /normalizeInsightsMemoryNextStep\(presentation\.nextStep\)\s*\|\|\s*t\("insights\.memory\.nextStep\.none"\)/
  );
  assert.doesNotMatch(
    insightsSource,
    /styles\.evidenceNext[^>]*>\s*\{presentation\.nextStep\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"insights\.memory\.nextStep\.none": "Next step"/);
  assert.match(catalogSource, /"insights\.memory\.nextStep\.none": "Siguiente"/);
  assert.match(catalogSource, /"insights\.memory\.nextStep\.none": "下一步"/);

  // Leave subtitle label, operatorCopy, and EvidenceRow signal fields as raw
  // pass-through on this tip.
  assert.match(
    insightsSource,
    /t\("insights\.memory\.subtitle", \{ label: presentation\.label, score: formatNumber\(memory\.score\) \}\)/
  );
  assert.match(
    insightsSource,
    /styles\.evidenceIntro[^>]*>\s*\{presentation\.operatorCopy\}\s*<\/Text>/
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

  // Descriptor-absent inventing path still embeds raw memory.nextStep into
  // presentation.nextStep under the localized evidence label.
  assert.match(
    presentationSource,
    /const nextStep = presentation\s*\?\s*copy\.memory\.nextSteps\[presentation\.nextStepCode\]\s*:\s*`\$\{copy\.evidenceLabel\}: \$\{memory\.nextStep\}`;/
  );

  // Do not pull in Insights memory operatorCopy / label / signal / Task detail
  // title / Home task row helpers on this tip.
  assert.doesNotMatch(insightsSource, /normalizeInsightsMemoryOperatorCopy\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsMemoryLabel\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalValue\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalLabel\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalDetail\(/);
  assert.doesNotMatch(insightsSource, /normalizeTaskDetailOperationalTitle\(/);
  assert.doesNotMatch(insightsSource, /normalizeHomeTaskRowTitle\(/);
  assert.doesNotMatch(insightsSource, /presentationInsightsMemoryOperatorCopyIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsMemoryLabelIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalValueIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalLabelIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(insightsSource, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(insightsSource, /presentationHomeTaskRowTitleIdentity/);
  assert.equal(filePresence(insightsMemoryOperatorCopyIdentityPath), "absent");
  assert.equal(filePresence(insightsMemoryLabelIdentityPath), "absent");
  assert.equal(filePresence(insightsSignalValueIdentityPath), "absent");
  assert.equal(filePresence(insightsSignalLabelIdentityPath), "absent");
  assert.equal(filePresence(insightsSignalDetailIdentityPath), "absent");
  assert.equal(filePresence(taskDetailOperationalTitleIdentityPath), "absent");
  assert.equal(filePresence(homeTaskRowTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsMemoryOperatorCopyIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsMemoryLabelIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSignalValueIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSignalLabelIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeTaskRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeInsightsMemoryNextStep(nextStep), nextStep);
  assert.equal(normalizeInsightsMemoryNextStep(` ${nextStep} `), nextStep);
  assert.equal(normalizeInsightsMemoryNextStep(`Case-${nextStep}`), `Case-${nextStep}`);
  assert.equal(normalizeInsightsMemoryNextStep("Next step"), "Next step");
});

test("descriptor-absent memory.nextStep pass-through invents via trim and is soft-nulled on Insights", () => {
  const padded = `${em}${nextStep}${em}`;
  const presented = presentLearningMemory("en", {
    score: 90,
    label: "Mise memory is reliable",
    operatorCopy: "Recipe baselines give Mise enough evidence.",
    nextStep: padded,
    signals: []
  });

  // Inventing proof: no presentation descriptor → raw memory.nextStep embed.
  assert.equal(presented.nextStep, `Evidence: ${padded}`);
  assert.equal(padded.trim(), nextStep);
  assert.equal(presented.nextStep.trim(), `Evidence: ${em}${nextStep}`);
  assert.equal(Boolean(presented.nextStep), true);

  // ASCII C prep refuses that inventing equality before Insights evidenceNext render.
  assert.equal(asciiTrimInsightsMemoryNextStep(presented.nextStep), presented.nextStep);
  assert.equal(canonicalizeInsightsMemoryNextStep(presented.nextStep), null);
  assert.equal(normalizeInsightsMemoryNextStep(presented.nextStep), null);
  assert.equal(
    normalizeInsightsMemoryNextStep(presented.nextStep) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Insights memory next steps", () => {
  const padded = `${em}${nextStep}${em}`;
  const nbspCopy = `${nbsp}${nextStep}${nbsp}`;
  const internalEm = `Keep${em}recording`;
  const internalNbsp = `Keep${nbsp}recording`;

  // Inventing proof: Unicode trim would invent the clean memory next step.
  assert.equal(padded.trim(), nextStep);
  assert.equal(nbspCopy.trim(), nextStep);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspCopy), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsMemoryNextStep(padded), padded);
  assert.equal(canonicalizeInsightsMemoryNextStep(padded), null);
  assert.equal(canonicalizeInsightsMemoryNextStep(nbspCopy), null);
  assert.equal(normalizeInsightsMemoryNextStep(padded), null);
  assert.equal(normalizeInsightsMemoryNextStep(nbspCopy), null);
  assert.equal(normalizeInsightsMemoryNextStep(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsMemoryNextStep(internalEm), internalEm);
  assert.equal(normalizeInsightsMemoryNextStep(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsMemoryNextStep(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights memory next steps", () => {
  assert.equal(normalizeInsightsMemoryNextStep(undefined), null);
  assert.equal(normalizeInsightsMemoryNextStep(null), null);
  assert.equal(normalizeInsightsMemoryNextStep(""), null);
  assert.equal(normalizeInsightsMemoryNextStep("   "), null);
  assert.equal(normalizeInsightsMemoryNextStep(123 as unknown as string), null);
  assert.equal(normalizeInsightsMemoryNextStep(`\u0001${nextStep}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsMemoryNextStep(`${nextStep}\t`), nextStep);
  assert.equal(normalizeInsightsMemoryNextStep(`${nextStep}\u0007`), null);
  assert.equal(normalizeInsightsMemoryNextStep(em), null);
  // LF/TAB/CR are rejected for single-line next steps (full cntrl; no multiline allowlist).
  assert.equal(normalizeInsightsMemoryNextStep(`Keep\trecording`), null);
  assert.equal(normalizeInsightsMemoryNextStep(`Keep\nrecording`), null);
});

test("Insights memory nextStep bypass proof: empty and Unicode-only-space values soft-null to localized none", () => {
  // Prior always-pass-nextStep path still rendered blank-looking evidenceNext bodies.
  assert.equal(normalizeInsightsMemoryNextStep(""), null);
  assert.equal(normalizeInsightsMemoryNextStep(em), null);
  assert.equal(normalizeInsightsMemoryNextStep(nbsp), null);

  // Descriptor-absent raw Unicode-only free-text still soft-nulls after embed.
  const blankLooking = presentLearningMemory("en", {
    score: 40,
    label: "Mise memory is building",
    operatorCopy: "Mise is collecting evidence.",
    nextStep: em,
    signals: []
  });
  assert.equal(blankLooking.nextStep, `Evidence: ${em}`);
  assert.equal(Boolean(blankLooking.nextStep), true);
  assert.equal(normalizeInsightsMemoryNextStep(blankLooking.nextStep), null);

  const missingStep: string | null | undefined = undefined;
  const unicodeOnlyStep: string | null | undefined = em;
  assert.equal(missingStep ?? "", "");
  assert.equal(unicodeOnlyStep ?? "", em);
  assert.notEqual(unicodeOnlyStep ?? "", "");
  assert.equal(Boolean(unicodeOnlyStep), true);
  assert.match(
    insightsSource,
    /normalizeInsightsMemoryNextStep\(presentation\.nextStep\)\s*\|\|\s*t\("insights\.memory\.nextStep\.none"\)/
  );
});

test("Insights memory evidenceNext presentation.nextStep identity refuses Unicode inventing equality", () => {
  const padded = `${em}${nextStep}${em}`;
  assert.notEqual(asciiTrimInsightsMemoryNextStep(padded), padded.trim());
  assert.equal(normalizeInsightsMemoryNextStep(padded), null);
  assert.equal(normalizeInsightsMemoryNextStep(padded) || "Next step", "Next step");
  assert.equal(normalizeInsightsMemoryNextStep(`\t${nextStep}\n`), nextStep);
});

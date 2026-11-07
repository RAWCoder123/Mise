import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsMemoryLabel,
  canonicalizeInsightsMemoryLabel,
  normalizeInsightsMemoryLabel
} from "../services/domain/presentationInsightsMemoryLabelIdentity";
import { presentLearningMemory } from "../services/presentation/operationsPresentation";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationInsightsMemoryLabelIdentity.ts",
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

const label = "Mise memory is reliable";
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

test("MISE-005ZK pins Insights memory subtitle presentation.label to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZK/);
  assert.match(insightsSource, /MISE-005ZK/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsMemoryLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsMemoryLabelIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsMemoryLabel\(/);
  assert.match(
    insightsSource,
    /normalizeInsightsMemoryLabel\(presentation\.label\)\s*\|\|\s*t\("insights\.memory\.label\.none"\)/
  );
  assert.doesNotMatch(
    insightsSource,
    /t\("insights\.memory\.subtitle", \{ label: presentation\.label, score: formatNumber\(memory\.score\) \}\)/
  );

  assert.match(catalogSource, /"insights\.memory\.label\.none": "Memory"/);
  assert.match(catalogSource, /"insights\.memory\.label\.none": "Memoria"/);
  assert.match(catalogSource, /"insights\.memory\.label\.none": "记忆"/);

  // Leave EvidenceRow signal fields as raw pass-through on this tip.
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

  // Descriptor-absent inventing path still embeds raw memory.label into presentation.label.
  assert.match(
    presentationSource,
    /const label = presentation\s*\?\s*presentation\.labelCode === "memory\.label\.reliable"\s*\?\s*copy\.memory\.reliableLabel\s*:\s*presentation\.labelCode === "memory\.label\.building"\s*\?\s*copy\.memory\.buildingLabel\s*:\s*copy\.memory\.needsProofLabel\s*:\s*memory\.label;/
  );

  // Do not pull in Insights signal / Task detail title / Home task row helpers on this tip.
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalValue\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalLabel\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalDetail\(/);
  assert.doesNotMatch(insightsSource, /normalizeTaskDetailOperationalTitle\(/);
  assert.doesNotMatch(insightsSource, /normalizeHomeTaskRowTitle\(/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalValueIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalLabelIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(insightsSource, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(insightsSource, /presentationHomeTaskRowTitleIdentity/);
  assert.equal(filePresence(insightsSignalValueIdentityPath), "absent");
  assert.equal(filePresence(insightsSignalLabelIdentityPath), "absent");
  assert.equal(filePresence(insightsSignalDetailIdentityPath), "absent");
  assert.equal(filePresence(taskDetailOperationalTitleIdentityPath), "absent");
  assert.equal(filePresence(homeTaskRowTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsSignalValueIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSignalLabelIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeTaskRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeInsightsMemoryLabel(label), label);
  assert.equal(normalizeInsightsMemoryLabel(` ${label} `), label);
  assert.equal(normalizeInsightsMemoryLabel(`Case-${label}`), `Case-${label}`);
  assert.equal(normalizeInsightsMemoryLabel("Learning"), "Learning");
});

test("descriptor-absent memory.label pass-through invents via trim and is soft-nulled on Insights", () => {
  const padded = `${em}${label}${em}`;
  const presented = presentLearningMemory("en", {
    score: 90,
    label: padded,
    operatorCopy: "Recipe baselines give Mise enough evidence.",
    nextStep: "Keep collecting manager decisions.",
    signals: []
  });

  // Inventing proof: no presentation descriptor → raw memory.label pass-through.
  assert.equal(presented.label, padded);
  assert.equal(padded.trim(), label);
  assert.equal(presented.label.trim(), label);
  assert.equal(Boolean(presented.label), true);

  // ASCII C prep refuses that inventing equality before Insights subtitle render.
  assert.equal(asciiTrimInsightsMemoryLabel(presented.label), presented.label);
  assert.equal(canonicalizeInsightsMemoryLabel(presented.label), null);
  assert.equal(normalizeInsightsMemoryLabel(presented.label), null);
  assert.equal(
    normalizeInsightsMemoryLabel(presented.label) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Insights memory labels", () => {
  const padded = `${em}${label}${em}`;
  const nbspLabel = `${nbsp}${label}${nbsp}`;
  const internalEm = `Mise${em}memory`;
  const internalNbsp = `Mise${nbsp}memory`;

  // Inventing proof: Unicode trim would invent the clean memory label.
  assert.equal(padded.trim(), label);
  assert.equal(nbspLabel.trim(), label);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspLabel), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsMemoryLabel(padded), padded);
  assert.equal(canonicalizeInsightsMemoryLabel(padded), null);
  assert.equal(canonicalizeInsightsMemoryLabel(nbspLabel), null);
  assert.equal(normalizeInsightsMemoryLabel(padded), null);
  assert.equal(normalizeInsightsMemoryLabel(nbspLabel), null);
  assert.equal(normalizeInsightsMemoryLabel(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsMemoryLabel(internalEm), internalEm);
  assert.equal(normalizeInsightsMemoryLabel(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsMemoryLabel(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights memory labels", () => {
  assert.equal(normalizeInsightsMemoryLabel(undefined), null);
  assert.equal(normalizeInsightsMemoryLabel(null), null);
  assert.equal(normalizeInsightsMemoryLabel(""), null);
  assert.equal(normalizeInsightsMemoryLabel("   "), null);
  assert.equal(normalizeInsightsMemoryLabel(123 as unknown as string), null);
  assert.equal(normalizeInsightsMemoryLabel(`\u0001${label}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsMemoryLabel(`${label}\t`), label);
  assert.equal(normalizeInsightsMemoryLabel(`${label}\u0007`), null);
  assert.equal(normalizeInsightsMemoryLabel(em), null);
  // LF/TAB/CR are rejected for single-line labels (full cntrl; no multiline allowlist).
  assert.equal(normalizeInsightsMemoryLabel(`Mise\tmemory`), null);
  assert.equal(normalizeInsightsMemoryLabel(`Mise\nmemory`), null);
});

test("Insights memory label bypass proof: empty and Unicode-only-space values soft-null to localized none", () => {
  // Prior always-pass-label path still interpolated blank-looking subtitle labels.
  assert.equal(normalizeInsightsMemoryLabel(""), null);
  assert.equal(normalizeInsightsMemoryLabel(em), null);
  assert.equal(normalizeInsightsMemoryLabel(nbsp), null);

  // Descriptor-absent raw Unicode-only free-text still soft-nulls.
  const blankLooking = presentLearningMemory("en", {
    score: 40,
    label: em,
    operatorCopy: "Mise is still collecting evidence.",
    nextStep: "Keep recording counts.",
    signals: []
  });
  assert.equal(blankLooking.label, em);
  assert.equal(Boolean(blankLooking.label), true);
  assert.equal(normalizeInsightsMemoryLabel(blankLooking.label), null);

  const missingLabel: string | null | undefined = undefined;
  const unicodeOnlyLabel: string | null | undefined = em;
  assert.equal(missingLabel ?? "", "");
  assert.equal(unicodeOnlyLabel ?? "", em);
  assert.notEqual(unicodeOnlyLabel ?? "", "");
  assert.equal(Boolean(unicodeOnlyLabel), true);
  assert.match(
    insightsSource,
    /normalizeInsightsMemoryLabel\(presentation\.label\)\s*\|\|\s*t\("insights\.memory\.label\.none"\)/
  );
});

test("Insights memory subtitle presentation.label identity refuses Unicode inventing equality", () => {
  const padded = `${em}${label}${em}`;
  assert.notEqual(asciiTrimInsightsMemoryLabel(padded), padded.trim());
  assert.equal(normalizeInsightsMemoryLabel(padded), null);
  assert.equal(normalizeInsightsMemoryLabel(padded) || "Memory", "Memory");
  assert.equal(normalizeInsightsMemoryLabel(`\t${label}\n`), label);
});

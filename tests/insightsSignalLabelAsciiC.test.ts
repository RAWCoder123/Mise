import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsSignalLabel,
  canonicalizeInsightsSignalLabel,
  normalizeInsightsSignalLabel
} from "../services/domain/presentationInsightsSignalLabelIdentity";
import { presentLearningMemorySignal } from "../services/presentation/operationsPresentation";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationInsightsSignalLabelIdentity.ts",
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

const label = "Friday demand";
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

test("MISE-005ZI pins Insights signal presentation.label to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZI/);
  assert.match(insightsSource, /MISE-005ZI/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsSignalLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsSignalLabelIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsSignalLabel\(/);
  assert.match(
    insightsSource,
    /normalizeInsightsSignalLabel\(presentation\.label\)\s*\|\|\s*t\("insights\.signal\.label\.none"\)/
  );
  assert.doesNotMatch(
    insightsSource,
    /styles\.signalLabel[^>]*>\s*\{presentation\.label\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"insights\.signal\.label\.none": "Signal"/);
  assert.match(catalogSource, /"insights\.signal\.label\.none": "Señal"/);
  assert.match(catalogSource, /"insights\.signal\.label\.none": "信号"/);

  // Leave presentation.detail / presentation.value as raw pass-through on this tip.
  assert.match(
    insightsSource,
    /styles\.signalDetail[^>]*>\s*\{presentation\.detail\}\s*<\/Text>/
  );
  assert.match(
    insightsSource,
    /styles\.signalValue[^>]*>\s*\{presentation\.value\}\s*<\/Text>/
  );

  // How-Mise-knows memory subtitle still interpolates presentLearningMemory label.
  assert.match(
    insightsSource,
    /t\("insights\.memory\.subtitle", \{ label: presentation\.label, score: formatNumber\(memory\.score\) \}\)/
  );

  // Descriptor-absent inventing path still embeds raw signal.label into presentation.label.
  assert.match(
    presentationSource,
    /if \(!descriptor\) \{\s*return \{\s*label: signal\.label,\s*value: signal\.value,\s*detail: `\$\{copy\.evidenceLabel\}: \$\{signal\.detail\}`/
  );

  // Do not pull in Insights detail / Task detail title / Home task row helpers on this tip.
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalDetail\(/);
  assert.doesNotMatch(insightsSource, /normalizeTaskDetailOperationalTitle\(/);
  assert.doesNotMatch(insightsSource, /normalizeHomeTaskRowTitle\(/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(insightsSource, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(insightsSource, /presentationHomeTaskRowTitleIdentity/);
  assert.equal(filePresence(insightsSignalDetailIdentityPath), "absent");
  assert.equal(filePresence(taskDetailOperationalTitleIdentityPath), "absent");
  assert.equal(filePresence(homeTaskRowTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeTaskRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeInsightsSignalLabel(label), label);
  assert.equal(normalizeInsightsSignalLabel(` ${label} `), label);
  assert.equal(normalizeInsightsSignalLabel(`Case-${label}`), `Case-${label}`);
  assert.equal(normalizeInsightsSignalLabel("Demand memory"), "Demand memory");
});

test("descriptor-absent signal.label pass-through invents via trim and is soft-nulled on Insights", () => {
  const padded = `${em}${label}${em}`;
  const presented = presentLearningMemorySignal("en", {
    label: padded,
    value: "+18%",
    detail: "Friday dinner demand is typically higher.",
    tone: "brand"
  });

  // Inventing proof: no presentation descriptor → raw signal.label pass-through.
  assert.equal(presented.label, padded);
  assert.equal(padded.trim(), label);
  assert.equal(presented.label.trim(), label);
  assert.equal(Boolean(presented.label), true);

  // ASCII C prep refuses that inventing equality before Insights signalLabel render.
  assert.equal(asciiTrimInsightsSignalLabel(presented.label), presented.label);
  assert.equal(canonicalizeInsightsSignalLabel(presented.label), null);
  assert.equal(normalizeInsightsSignalLabel(presented.label), null);
  assert.equal(
    normalizeInsightsSignalLabel(presented.label) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Insights signal labels", () => {
  const padded = `${em}${label}${em}`;
  const nbspLabel = `${nbsp}${label}${nbsp}`;
  const internalEm = `Friday${em}demand`;
  const internalNbsp = `Friday${nbsp}demand`;

  // Inventing proof: Unicode trim would invent the clean signal label.
  assert.equal(padded.trim(), label);
  assert.equal(nbspLabel.trim(), label);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspLabel), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsSignalLabel(padded), padded);
  assert.equal(canonicalizeInsightsSignalLabel(padded), null);
  assert.equal(canonicalizeInsightsSignalLabel(nbspLabel), null);
  assert.equal(normalizeInsightsSignalLabel(padded), null);
  assert.equal(normalizeInsightsSignalLabel(nbspLabel), null);
  assert.equal(normalizeInsightsSignalLabel(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsSignalLabel(internalEm), internalEm);
  assert.equal(normalizeInsightsSignalLabel(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsSignalLabel(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights signal labels", () => {
  assert.equal(normalizeInsightsSignalLabel(undefined), null);
  assert.equal(normalizeInsightsSignalLabel(null), null);
  assert.equal(normalizeInsightsSignalLabel(""), null);
  assert.equal(normalizeInsightsSignalLabel("   "), null);
  assert.equal(normalizeInsightsSignalLabel(123 as unknown as string), null);
  assert.equal(normalizeInsightsSignalLabel(`\u0001${label}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsSignalLabel(`${label}\t`), label);
  assert.equal(normalizeInsightsSignalLabel(`${label}\u0007`), null);
  assert.equal(normalizeInsightsSignalLabel(em), null);
  // LF/TAB/CR are rejected for single-line labels (full cntrl; no multiline allowlist).
  assert.equal(normalizeInsightsSignalLabel(`Friday\tdemand`), null);
  assert.equal(normalizeInsightsSignalLabel(`Friday\ndemand`), null);
});

test("Insights signal label bypass proof: empty and Unicode-only-space labels soft-null to localized none", () => {
  // Prior always-pass-label path still rendered blank-looking signalLabel Text.
  assert.equal(normalizeInsightsSignalLabel(""), null);
  assert.equal(normalizeInsightsSignalLabel(em), null);
  assert.equal(normalizeInsightsSignalLabel(nbsp), null);

  // Descriptor-absent raw Unicode-only free-text still soft-nulls.
  const blankLooking = presentLearningMemorySignal("en", {
    label: em,
    value: "+18%",
    detail: "Friday dinner demand is typically higher.",
    tone: "brand"
  });
  assert.equal(blankLooking.label, em);
  assert.equal(Boolean(blankLooking.label), true);
  assert.equal(normalizeInsightsSignalLabel(blankLooking.label), null);

  const missingLabel: string | null | undefined = undefined;
  const unicodeOnlyLabel: string | null | undefined = em;
  assert.equal(missingLabel ?? "", "");
  assert.equal(unicodeOnlyLabel ?? "", em);
  assert.notEqual(unicodeOnlyLabel ?? "", "");
  assert.equal(Boolean(unicodeOnlyLabel), true);
  assert.match(
    insightsSource,
    /normalizeInsightsSignalLabel\(presentation\.label\)\s*\|\|\s*t\("insights\.signal\.label\.none"\)/
  );
});

test("Insights signal presentation.label identity refuses Unicode inventing equality", () => {
  const padded = `${em}${label}${em}`;
  assert.notEqual(asciiTrimInsightsSignalLabel(padded), padded.trim());
  assert.equal(normalizeInsightsSignalLabel(padded), null);
  assert.equal(normalizeInsightsSignalLabel(padded) || "Signal", "Signal");
  assert.equal(normalizeInsightsSignalLabel(`\t${label}\n`), label);
});

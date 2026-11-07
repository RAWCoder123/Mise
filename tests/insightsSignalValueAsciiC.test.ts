import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsSignalValue,
  canonicalizeInsightsSignalValue,
  normalizeInsightsSignalValue
} from "../services/domain/presentationInsightsSignalValueIdentity";
import { presentLearningMemorySignal } from "../services/presentation/operationsPresentation";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationInsightsSignalValueIdentity.ts",
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

const value = "+18%";
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

test("MISE-005ZJ pins Insights signal presentation.value to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZJ/);
  assert.match(insightsSource, /MISE-005ZJ/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsSignalValue\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsSignalValueIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsSignalValue\(/);
  assert.match(
    insightsSource,
    /normalizeInsightsSignalValue\(presentation\.value\)\s*\|\|\s*t\("insights\.signal\.value\.none"\)/
  );
  assert.doesNotMatch(
    insightsSource,
    /styles\.signalValue[^>]*>\s*\{presentation\.value\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"insights\.signal\.value\.none": "Value"/);
  assert.match(catalogSource, /"insights\.signal\.value\.none": "Valor"/);
  assert.match(catalogSource, /"insights\.signal\.value\.none": "数值"/);

  // Leave presentation.label / presentation.detail as raw pass-through on this tip.
  assert.match(
    insightsSource,
    /styles\.signalLabel[^>]*>\s*\{presentation\.label\}\s*<\/Text>/
  );
  assert.match(
    insightsSource,
    /styles\.signalDetail[^>]*>\s*\{presentation\.detail\}\s*<\/Text>/
  );

  // How-Mise-knows memory subtitle still interpolates presentLearningMemory label.
  assert.match(
    insightsSource,
    /t\("insights\.memory\.subtitle", \{ label: presentation\.label, score: formatNumber\(memory\.score\) \}\)/
  );

  // Descriptor-absent inventing path still embeds raw signal.value into presentation.value.
  assert.match(
    presentationSource,
    /if \(!descriptor\) \{\s*return \{\s*label: signal\.label,\s*value: signal\.value,\s*detail: `\$\{copy\.evidenceLabel\}: \$\{signal\.detail\}`/
  );

  // Do not pull in Insights label / detail / Task detail title / Home task row helpers on this tip.
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalLabel\(/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsSignalDetail\(/);
  assert.doesNotMatch(insightsSource, /normalizeTaskDetailOperationalTitle\(/);
  assert.doesNotMatch(insightsSource, /normalizeHomeTaskRowTitle\(/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalLabelIdentity/);
  assert.doesNotMatch(insightsSource, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(insightsSource, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(insightsSource, /presentationHomeTaskRowTitleIdentity/);
  assert.equal(filePresence(insightsSignalLabelIdentityPath), "absent");
  assert.equal(filePresence(insightsSignalDetailIdentityPath), "absent");
  assert.equal(filePresence(taskDetailOperationalTitleIdentityPath), "absent");
  assert.equal(filePresence(homeTaskRowTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsSignalLabelIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSignalDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeTaskRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeInsightsSignalValue(value), value);
  assert.equal(normalizeInsightsSignalValue(` ${value} `), value);
  assert.equal(normalizeInsightsSignalValue(`Case-${value}`), `Case-${value}`);
  assert.equal(normalizeInsightsSignalValue("Learning"), "Learning");
});

test("descriptor-absent signal.value pass-through invents via trim and is soft-nulled on Insights", () => {
  const padded = `${em}${value}${em}`;
  const presented = presentLearningMemorySignal("en", {
    label: "Friday demand",
    value: padded,
    detail: "Friday dinner demand is typically higher.",
    tone: "brand"
  });

  // Inventing proof: no presentation descriptor → raw signal.value pass-through.
  assert.equal(presented.value, padded);
  assert.equal(padded.trim(), value);
  assert.equal(presented.value.trim(), value);
  assert.equal(Boolean(presented.value), true);

  // ASCII C prep refuses that inventing equality before Insights signalValue render.
  assert.equal(asciiTrimInsightsSignalValue(presented.value), presented.value);
  assert.equal(canonicalizeInsightsSignalValue(presented.value), null);
  assert.equal(normalizeInsightsSignalValue(presented.value), null);
  assert.equal(
    normalizeInsightsSignalValue(presented.value) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Insights signal values", () => {
  const padded = `${em}${value}${em}`;
  const nbspValue = `${nbsp}${value}${nbsp}`;
  const internalEm = `+18${em}%`;
  const internalNbsp = `+18${nbsp}%`;

  // Inventing proof: Unicode trim would invent the clean signal value.
  assert.equal(padded.trim(), value);
  assert.equal(nbspValue.trim(), value);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspValue), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsSignalValue(padded), padded);
  assert.equal(canonicalizeInsightsSignalValue(padded), null);
  assert.equal(canonicalizeInsightsSignalValue(nbspValue), null);
  assert.equal(normalizeInsightsSignalValue(padded), null);
  assert.equal(normalizeInsightsSignalValue(nbspValue), null);
  assert.equal(normalizeInsightsSignalValue(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsSignalValue(internalEm), internalEm);
  assert.equal(normalizeInsightsSignalValue(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsSignalValue(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights signal values", () => {
  assert.equal(normalizeInsightsSignalValue(undefined), null);
  assert.equal(normalizeInsightsSignalValue(null), null);
  assert.equal(normalizeInsightsSignalValue(""), null);
  assert.equal(normalizeInsightsSignalValue("   "), null);
  assert.equal(normalizeInsightsSignalValue(123 as unknown as string), null);
  assert.equal(normalizeInsightsSignalValue(`\u0001${value}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsSignalValue(`${value}\t`), value);
  assert.equal(normalizeInsightsSignalValue(`${value}\u0007`), null);
  assert.equal(normalizeInsightsSignalValue(em), null);
  // LF/TAB/CR are rejected for single-line values (full cntrl; no multiline allowlist).
  assert.equal(normalizeInsightsSignalValue(`+18\t%`), null);
  assert.equal(normalizeInsightsSignalValue(`+18\n%`), null);
});

test("Insights signal value bypass proof: empty and Unicode-only-space values soft-null to localized none", () => {
  // Prior always-pass-value path still rendered blank-looking signalValue Text.
  assert.equal(normalizeInsightsSignalValue(""), null);
  assert.equal(normalizeInsightsSignalValue(em), null);
  assert.equal(normalizeInsightsSignalValue(nbsp), null);

  // Descriptor-absent raw Unicode-only free-text still soft-nulls.
  const blankLooking = presentLearningMemorySignal("en", {
    label: "Friday demand",
    value: em,
    detail: "Friday dinner demand is typically higher.",
    tone: "brand"
  });
  assert.equal(blankLooking.value, em);
  assert.equal(Boolean(blankLooking.value), true);
  assert.equal(normalizeInsightsSignalValue(blankLooking.value), null);

  const missingValue: string | null | undefined = undefined;
  const unicodeOnlyValue: string | null | undefined = em;
  assert.equal(missingValue ?? "", "");
  assert.equal(unicodeOnlyValue ?? "", em);
  assert.notEqual(unicodeOnlyValue ?? "", "");
  assert.equal(Boolean(unicodeOnlyValue), true);
  assert.match(
    insightsSource,
    /normalizeInsightsSignalValue\(presentation\.value\)\s*\|\|\s*t\("insights\.signal\.value\.none"\)/
  );
});

test("Insights signal presentation.value identity refuses Unicode inventing equality", () => {
  const padded = `${em}${value}${em}`;
  assert.notEqual(asciiTrimInsightsSignalValue(padded), padded.trim());
  assert.equal(normalizeInsightsSignalValue(padded), null);
  assert.equal(normalizeInsightsSignalValue(padded) || "Value", "Value");
  assert.equal(normalizeInsightsSignalValue(`\t${value}\n`), value);
});

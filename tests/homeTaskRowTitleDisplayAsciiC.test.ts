import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimHomeTaskRowTitleDisplay,
  canonicalizeHomeTaskRowTitleDisplay,
  normalizeHomeTaskRowTitleDisplay
} from "../services/domain/presentationHomeTaskRowTitleDisplayIdentity";
import { presentOperationalTodayTask } from "../services/presentation/operationsPresentation";

const identitySource = readFileSync(
  new URL("../services/domain/presentationHomeTaskRowTitleDisplayIdentity.ts", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const presentationSource = readFileSync(
  new URL("../services/presentation/operationsPresentation.ts", import.meta.url),
  "utf8"
);
const askMiseSource = readFileSync(new URL("../app/ask-mise.tsx", import.meta.url), "utf8");
const timelineSource = readFileSync(
  new URL("../components/operations/OperatingPlanTimeline.tsx", import.meta.url),
  "utf8"
);
const operatingPlanDisplayIdentityPath = new URL(
  "../services/domain/presentationOperatingPlanTaskTitleDisplayIdentity.ts",
  import.meta.url
);
const taskDetailOperationalTitleIdentityPath = new URL(
  "../services/domain/presentationTaskDetailOperationalTitleIdentity.ts",
  import.meta.url
);
const askMisePriorityTitleIdentityPath = new URL(
  "../services/domain/presentationAskMisePriorityTitleIdentity.ts",
  import.meta.url
);
const homeActivityRowTitleIdentityPath = new URL(
  "../services/domain/presentationHomeActivityRowTitleIdentity.ts",
  import.meta.url
);

const title = "Count walk-in";
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

test("MISE-005ZD pins Home HomeTaskRow display presentation.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZD/);
  assert.match(homeSource, /MISE-005ZD/);

  assert.match(
    identitySource,
    /export function asciiTrimHomeTaskRowTitleDisplay\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    homeSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationHomeTaskRowTitleDisplayIdentity"/
  );
  assert.match(homeSource, /normalizeHomeTaskRowTitleDisplay\(/);
  assert.match(
    homeSource,
    /normalizeHomeTaskRowTitleDisplay\(presentation\.title\)\s*\|\|\s*t\("home\.tasks\.row\.title\.none"\)/
  );
  assert.doesNotMatch(homeSource, /title=\{presentation\.title\}/);

  assert.match(catalogSource, /"home\.tasks\.row\.title\.none": "Task"/);
  assert.match(catalogSource, /"home\.tasks\.row\.title\.none": "Tarea"/);
  assert.match(catalogSource, /"home\.tasks\.row\.title\.none": "任务"/);

  // Leave Ask Mise priority presentation.title as raw pass-through on this tip.
  assert.match(askMiseSource, /\{presentation\.title\}/);
  assert.doesNotMatch(askMiseSource, /normalizeHomeTaskRowTitleDisplay/);
  assert.doesNotMatch(askMiseSource, /presentationHomeTaskRowTitleDisplayIdentity/);

  // Leave Operating Plan Timeline display presentation.title alone (#1161).
  assert.match(timelineSource, /\{presentation\.title\}/);
  assert.doesNotMatch(homeSource, /normalizeOperatingPlanTaskTitleDisplay\(/);
  assert.doesNotMatch(homeSource, /presentationOperatingPlanTaskTitleDisplayIdentity/);
  assert.doesNotMatch(homeSource, /normalizeTaskDetailOperationalTitle\(/);
  assert.doesNotMatch(homeSource, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(homeSource, /normalizeAskMisePriorityTitle\(/);
  assert.doesNotMatch(homeSource, /presentationAskMisePriorityTitleIdentity/);
  assert.doesNotMatch(homeSource, /normalizeHomeActivityRowTitle\(/);
  assert.doesNotMatch(homeSource, /presentationHomeActivityRowTitleIdentity/);
  assert.equal(filePresence(operatingPlanDisplayIdentityPath), "absent");
  assert.equal(filePresence(taskDetailOperationalTitleIdentityPath), "absent");
  assert.equal(filePresence(askMisePriorityTitleIdentityPath), "absent");
  assert.equal(filePresence(homeActivityRowTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationOperatingPlanTaskTitleDisplayIdentity/);
  assert.doesNotMatch(identityCode, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMisePriorityTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeActivityRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Descriptor-absent inventing path still lives in presentOperationalTodayTask.
  assert.match(
    presentationSource,
    /if \(!descriptor\) \{\s*return \{\s*title: task\.title,/
  );

  assert.equal(normalizeHomeTaskRowTitleDisplay(title), title);
  assert.equal(normalizeHomeTaskRowTitleDisplay(` ${title} `), title);
  assert.equal(normalizeHomeTaskRowTitleDisplay(`Case-${title}`), `Case-${title}`);
});

test("descriptor-absent task.title pass-through invents via trim and is soft-nulled on HomeTaskRow display", () => {
  const padded = `${em}${title}${em}`;
  const presented = presentOperationalTodayTask("en", {
    title: padded,
    detail: "Walk-in cooler count"
  });

  // Inventing proof: no presentation descriptor → raw task.title pass-through.
  // HomeTaskRow projects that title into OperationalRow title.
  assert.equal(presented.title, padded);
  assert.equal(presented.evidenceOnly, true);
  assert.equal(presented.title.trim(), title);
  assert.equal(Boolean(presented.title), true);
  assert.match(
    presentationSource,
    /if \(!descriptor\) \{\s*return \{\s*title: task\.title,/
  );

  // ASCII C prep refuses that inventing equality before HomeTaskRow display render.
  assert.equal(asciiTrimHomeTaskRowTitleDisplay(presented.title), padded);
  assert.equal(canonicalizeHomeTaskRowTitleDisplay(presented.title), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(presented.title), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(presented.title) || "FALLBACK", "FALLBACK");
});

test("Unicode padding invents via trim and is soft-nulled for Home HomeTaskRow display titles", () => {
  const padded = `${em}${title}${em}`;
  const nbspTitle = `${nbsp}${title}${nbsp}`;
  const internalEm = `Count${em}walk-in`;
  const internalNbsp = `Count${nbsp}walk-in`;

  // Inventing proof: Unicode trim would invent the clean task title.
  assert.equal(padded.trim(), title);
  assert.equal(nbspTitle.trim(), title);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspTitle), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimHomeTaskRowTitleDisplay(padded), padded);
  assert.equal(canonicalizeHomeTaskRowTitleDisplay(padded), null);
  assert.equal(canonicalizeHomeTaskRowTitleDisplay(nbspTitle), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(padded), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(nbspTitle), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeHomeTaskRowTitleDisplay(internalEm), internalEm);
  assert.equal(normalizeHomeTaskRowTitleDisplay(internalNbsp), internalNbsp);
  assert.equal(normalizeHomeTaskRowTitleDisplay(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Home HomeTaskRow display titles", () => {
  assert.equal(normalizeHomeTaskRowTitleDisplay(undefined), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(null), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(""), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay("   "), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(123 as unknown as string), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeHomeTaskRowTitleDisplay(`${title}\t`), title);
  assert.equal(normalizeHomeTaskRowTitleDisplay(`${title}\u0007`), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeHomeTaskRowTitleDisplay(`Count\twalk-in`), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(`Count\nwalk-in`), null);
});

test("Home HomeTaskRow display bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking title Text.
  assert.equal(normalizeHomeTaskRowTitleDisplay(""), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(em), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    homeSource,
    /normalizeHomeTaskRowTitleDisplay\(presentation\.title\)\s*\|\|\s*t\("home\.tasks\.row\.title\.none"\)/
  );
});

test("Home HomeTaskRow display presentation.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimHomeTaskRowTitleDisplay(padded), padded.trim());
  assert.equal(normalizeHomeTaskRowTitleDisplay(padded), null);
  assert.equal(normalizeHomeTaskRowTitleDisplay(padded) || "Task", "Task");
  assert.equal(normalizeHomeTaskRowTitleDisplay(`\t${title}\n`), title);
});

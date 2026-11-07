import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimAskMisePriorityTitle,
  canonicalizeAskMisePriorityTitle,
  normalizeAskMisePriorityTitle
} from "../services/domain/presentationAskMisePriorityTitleIdentity";
import { presentOperationalTodayTask } from "../services/presentation/operationsPresentation";

const identitySource = readFileSync(
  new URL("../services/domain/presentationAskMisePriorityTitleIdentity.ts", import.meta.url),
  "utf8"
);
const askMiseSource = readFileSync(new URL("../app/ask-mise.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const presentationSource = readFileSync(
  new URL("../services/presentation/operationsPresentation.ts", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const timelineSource = readFileSync(
  new URL("../components/operations/OperatingPlanTimeline.tsx", import.meta.url),
  "utf8"
);
const askMiseAnswerSource = readFileSync(new URL("../services/ai/askMise.ts", import.meta.url), "utf8");
const homeTaskRowTitleIdentityPath = new URL(
  "../services/domain/presentationHomeTaskRowTitleDisplayIdentity.ts",
  import.meta.url
);
const operatingPlanDisplayIdentityPath = new URL(
  "../services/domain/presentationOperatingPlanTaskTitleDisplayIdentity.ts",
  import.meta.url
);
const taskDetailOperationalTitleIdentityPath = new URL(
  "../services/domain/presentationTaskDetailOperationalTitleIdentity.ts",
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

test("MISE-005ZE pins Ask Mise priority presentation.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZE/);
  assert.match(askMiseSource, /MISE-005ZE/);

  assert.match(
    identitySource,
    /export function asciiTrimAskMisePriorityTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    askMiseSource,
    /from "\.\.\/services\/domain\/presentationAskMisePriorityTitleIdentity"/
  );
  assert.match(askMiseSource, /normalizeAskMisePriorityTitle\(/);
  assert.match(
    askMiseSource,
    /normalizeAskMisePriorityTitle\(presentation\.title\)\s*\|\|\s*t\("ask\.priority\.title\.none"\)/
  );
  assert.doesNotMatch(askMiseSource, /\{presentation\.title\}/);

  assert.match(catalogSource, /"ask\.priority\.title\.none": "Task"/);
  assert.match(catalogSource, /"ask\.priority\.title\.none": "Tarea"/);
  assert.match(catalogSource, /"ask\.priority\.title\.none": "任务"/);

  // Leave Home HomeTaskRow presentation.title as raw pass-through on this tip.
  assert.match(homeSource, /title=\{presentation\.title\}/);
  assert.doesNotMatch(homeSource, /normalizeAskMisePriorityTitle/);
  assert.doesNotMatch(homeSource, /presentationAskMisePriorityTitleIdentity/);
  assert.doesNotMatch(askMiseSource, /normalizeHomeTaskRowTitleDisplay/);
  assert.doesNotMatch(askMiseSource, /presentationHomeTaskRowTitleDisplayIdentity/);

  // Leave Operating Plan Timeline display presentation.title alone (#1161).
  assert.match(timelineSource, /\{presentation\.title\}/);
  assert.doesNotMatch(askMiseSource, /normalizeOperatingPlanTaskTitleDisplay\(/);
  assert.doesNotMatch(askMiseSource, /presentationOperatingPlanTaskTitleDisplayIdentity/);
  assert.doesNotMatch(askMiseSource, /normalizeTaskDetailOperationalTitle\(/);
  assert.doesNotMatch(askMiseSource, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(askMiseSource, /normalizeHomeActivityRowTitle\(/);
  assert.doesNotMatch(askMiseSource, /presentationHomeActivityRowTitleIdentity/);
  assert.equal(filePresence(homeTaskRowTitleIdentityPath), "absent");
  assert.equal(filePresence(operatingPlanDisplayIdentityPath), "absent");
  assert.equal(filePresence(taskDetailOperationalTitleIdentityPath), "absent");
  assert.equal(filePresence(homeActivityRowTitleIdentityPath), "absent");

  // Leave askMise answer-text topTaskTitles alone (separate tip).
  assert.match(
    askMiseAnswerSource,
    /presentOperationalTodayTask\(helpers\.locale, task\)\.title/
  );
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMisePriorityTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMisePriorityTitleIdentity/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationHomeTaskRowTitleDisplayIdentity/);
  assert.doesNotMatch(identityCode, /presentationOperatingPlanTaskTitleDisplayIdentity/);
  assert.doesNotMatch(identityCode, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeActivityRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Descriptor-absent inventing path still lives in presentOperationalTodayTask.
  assert.match(
    presentationSource,
    /if \(!descriptor\) \{\s*return \{\s*title: task\.title,/
  );

  assert.equal(normalizeAskMisePriorityTitle(title), title);
  assert.equal(normalizeAskMisePriorityTitle(` ${title} `), title);
  assert.equal(normalizeAskMisePriorityTitle(`Case-${title}`), `Case-${title}`);
});

test("descriptor-absent task.title pass-through invents via trim and is soft-nulled on Ask Mise priority display", () => {
  const padded = `${em}${title}${em}`;
  const presented = presentOperationalTodayTask("en", {
    title: padded,
    detail: "Walk-in cooler count"
  });

  // Inventing proof: no presentation descriptor → raw task.title pass-through.
  // Ask Mise priority cards project that title into priorityTitle Text.
  assert.equal(presented.title, padded);
  assert.equal(presented.evidenceOnly, true);
  assert.equal(presented.title.trim(), title);
  assert.equal(Boolean(presented.title), true);
  assert.match(
    presentationSource,
    /if \(!descriptor\) \{\s*return \{\s*title: task\.title,/
  );

  // ASCII C prep refuses that inventing equality before Ask Mise priority render.
  assert.equal(asciiTrimAskMisePriorityTitle(presented.title), padded);
  assert.equal(canonicalizeAskMisePriorityTitle(presented.title), null);
  assert.equal(normalizeAskMisePriorityTitle(presented.title), null);
  assert.equal(normalizeAskMisePriorityTitle(presented.title) || "FALLBACK", "FALLBACK");
});

test("Unicode padding invents via trim and is soft-nulled for Ask Mise priority display titles", () => {
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
  assert.equal(asciiTrimAskMisePriorityTitle(padded), padded);
  assert.equal(canonicalizeAskMisePriorityTitle(padded), null);
  assert.equal(canonicalizeAskMisePriorityTitle(nbspTitle), null);
  assert.equal(normalizeAskMisePriorityTitle(padded), null);
  assert.equal(normalizeAskMisePriorityTitle(nbspTitle), null);
  assert.equal(normalizeAskMisePriorityTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeAskMisePriorityTitle(internalEm), internalEm);
  assert.equal(normalizeAskMisePriorityTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeAskMisePriorityTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Ask Mise priority display titles", () => {
  assert.equal(normalizeAskMisePriorityTitle(undefined), null);
  assert.equal(normalizeAskMisePriorityTitle(null), null);
  assert.equal(normalizeAskMisePriorityTitle(""), null);
  assert.equal(normalizeAskMisePriorityTitle("   "), null);
  assert.equal(normalizeAskMisePriorityTitle(123 as unknown as string), null);
  assert.equal(normalizeAskMisePriorityTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeAskMisePriorityTitle(`${title}\t`), title);
  assert.equal(normalizeAskMisePriorityTitle(`${title}\u0007`), null);
  assert.equal(normalizeAskMisePriorityTitle(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeAskMisePriorityTitle(`Count\twalk-in`), null);
  assert.equal(normalizeAskMisePriorityTitle(`Count\nwalk-in`), null);
});

test("Ask Mise priority display bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking title Text.
  assert.equal(normalizeAskMisePriorityTitle(""), null);
  assert.equal(normalizeAskMisePriorityTitle(em), null);
  assert.equal(normalizeAskMisePriorityTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    askMiseSource,
    /normalizeAskMisePriorityTitle\(presentation\.title\)\s*\|\|\s*t\("ask\.priority\.title\.none"\)/
  );
});

test("Ask Mise priority presentation.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimAskMisePriorityTitle(padded), padded.trim());
  assert.equal(normalizeAskMisePriorityTitle(padded), null);
  assert.equal(normalizeAskMisePriorityTitle(padded) || "Task", "Task");
  assert.equal(normalizeAskMisePriorityTitle(`\t${title}\n`), title);
});

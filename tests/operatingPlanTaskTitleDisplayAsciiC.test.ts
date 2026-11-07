import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOperatingPlanTaskTitleDisplay,
  canonicalizeOperatingPlanTaskTitleDisplay,
  normalizeOperatingPlanTaskTitleDisplay
} from "../services/domain/presentationOperatingPlanTaskTitleDisplayIdentity";
import { presentOperationalTodayTask } from "../services/presentation/operationsPresentation";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationOperatingPlanTaskTitleDisplayIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../components/operations/OperatingPlanTimeline.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const presentationSource = readFileSync(
  new URL("../services/presentation/operationsPresentation.ts", import.meta.url),
  "utf8"
);
const a11yTitleIdentityPath = new URL(
  "../services/domain/presentationOperatingPlanTaskTitleIdentity.ts",
  import.meta.url
);
const a11yDetailIdentityPath = new URL(
  "../services/domain/presentationOperatingPlanTaskDetailIdentity.ts",
  import.meta.url
);
const taskDetailOperationalTitleIdentityPath = new URL(
  "../services/domain/presentationTaskDetailOperationalTitleIdentity.ts",
  import.meta.url
);
const createTaskListRowTitleIdentityPath = new URL(
  "../services/domain/presentationCreateTaskListRowTitleIdentity.ts",
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

test("MISE-005ZC pins Operating Plan Timeline display presentation.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZC/);
  assert.match(screenSource, /MISE-005ZC/);

  assert.match(
    identitySource,
    /export function asciiTrimOperatingPlanTaskTitleDisplay\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationOperatingPlanTaskTitleDisplayIdentity"/
  );
  assert.match(screenSource, /normalizeOperatingPlanTaskTitleDisplay\(/);
  assert.match(
    screenSource,
    /normalizeOperatingPlanTaskTitleDisplay\(presentation\.title\)\s*\|\|\s*t\("today\.task\.title\.none"\)/
  );
  assert.doesNotMatch(
    screenSource,
    /styles\.taskTitle[^>]*>\s*\{presentation\.title\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"today\.task\.title\.none": "Task"/);
  assert.match(catalogSource, /"today\.task\.title\.none": "Tarea"/);
  assert.match(catalogSource, /"today\.task\.title\.none": "任务"/);

  // Leave a11y title interpolation as raw pass-through on this tip (#1077 owns that surface).
  assert.match(
    screenSource,
    /t\("today\.task\.accessibility", \{\s*title: presentation\.title,\s*detail: presentation\.detail,\s*action: actionLabel\s*\}\)/
  );
  assert.match(screenSource, /detail: presentation\.detail,/);

  // Leave sibling tipped modules alone on this tip.
  assert.doesNotMatch(screenSource, /normalizeOperatingPlanTaskTitle\(/);
  assert.doesNotMatch(screenSource, /normalizeOperatingPlanTaskDetail\(/);
  assert.doesNotMatch(screenSource, /presentationOperatingPlanTaskTitleIdentity/);
  assert.doesNotMatch(screenSource, /presentationOperatingPlanTaskDetailIdentity/);
  assert.doesNotMatch(screenSource, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(screenSource, /presentationCreateTaskListRowTitleIdentity/);
  assert.equal(filePresence(a11yTitleIdentityPath), "absent");
  assert.equal(filePresence(a11yDetailIdentityPath), "absent");
  assert.equal(filePresence(taskDetailOperationalTitleIdentityPath), "absent");
  assert.equal(filePresence(createTaskListRowTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationOperatingPlanTaskTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationOperatingPlanTaskDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationCreateTaskListRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Source-task-absent inventing path still lives in presentOperatingPlanItem.
  assert.match(
    presentationSource,
    /title: item\.title,\s*detail: item\.detail,/
  );

  assert.equal(normalizeOperatingPlanTaskTitleDisplay(title), title);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(` ${title} `), title);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(`Case-${title}`), `Case-${title}`);
});

test("descriptor-absent task.title pass-through invents via trim and is soft-nulled on Timeline display", () => {
  const padded = `${em}${title}${em}`;
  const presented = presentOperationalTodayTask("en", {
    title: padded,
    detail: "Walk-in cooler count"
  });

  // Inventing proof: no presentation descriptor → raw task.title pass-through.
  // presentOperatingPlanItem forwards that title into timeline presentation.title.
  assert.equal(presented.title, padded);
  assert.equal(presented.evidenceOnly, true);
  assert.equal(presented.title.trim(), title);
  assert.equal(Boolean(presented.title), true);
  assert.match(
    presentationSource,
    /const taskCopy = item\.sourceTask\s*\?\s*presentOperationalTodayTask\(locale, item\.sourceTask\)/
  );
  assert.match(
    presentationSource,
    /title: item\.title,\s*detail: item\.detail,/
  );

  // ASCII C prep refuses that inventing equality before Timeline display render.
  assert.equal(asciiTrimOperatingPlanTaskTitleDisplay(presented.title), padded);
  assert.equal(canonicalizeOperatingPlanTaskTitleDisplay(presented.title), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(presented.title), null);
  assert.equal(
    normalizeOperatingPlanTaskTitleDisplay(presented.title) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Operating Plan Timeline display titles", () => {
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
  assert.equal(asciiTrimOperatingPlanTaskTitleDisplay(padded), padded);
  assert.equal(canonicalizeOperatingPlanTaskTitleDisplay(padded), null);
  assert.equal(canonicalizeOperatingPlanTaskTitleDisplay(nbspTitle), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(padded), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(nbspTitle), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeOperatingPlanTaskTitleDisplay(internalEm), internalEm);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(internalNbsp), internalNbsp);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Operating Plan Timeline display titles", () => {
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(undefined), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(null), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(""), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay("   "), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(123 as unknown as string), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(`${title}\t`), title);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(`${title}\u0007`), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(`Count\twalk-in`), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(`Count\nwalk-in`), null);
});

test("Operating Plan Timeline display bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking title Text.
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(""), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(em), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    screenSource,
    /normalizeOperatingPlanTaskTitleDisplay\(presentation\.title\)\s*\|\|\s*t\("today\.task\.title\.none"\)/
  );
});

test("Operating Plan Timeline display presentation.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimOperatingPlanTaskTitleDisplay(padded), padded.trim());
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(padded), null);
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(padded) || "Task", "Task");
  assert.equal(normalizeOperatingPlanTaskTitleDisplay(`\t${title}\n`), title);
});

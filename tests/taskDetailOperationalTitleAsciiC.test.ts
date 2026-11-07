import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimTaskDetailOperationalTitle,
  canonicalizeTaskDetailOperationalTitle,
  normalizeTaskDetailOperationalTitle
} from "../services/domain/presentationTaskDetailOperationalTitleIdentity";
import { presentOperationalTodayTask } from "../services/presentation/operationsPresentation";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationTaskDetailOperationalTitleIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const taskDetailSource = readFileSync(
  new URL("../app/tasks/[id].tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const presentationSource = readFileSync(
  new URL("../services/presentation/operationsPresentation.ts", import.meta.url),
  "utf8"
);
const sharedTitleIdentityPath = new URL(
  "../services/domain/presentationTaskDetailSharedTitleIdentity.ts",
  import.meta.url
);
const createTaskListDisplayTitleIdentityPath = new URL(
  "../services/domain/presentationCreateTaskListDisplayTitleIdentity.ts",
  import.meta.url
);
const createTaskChoiceRowTitleIdentityPath = new URL(
  "../services/domain/presentationCreateTaskChoiceRowTitleIdentity.ts",
  import.meta.url
);
const restaurantTasksTitleIdentityPath = new URL(
  "../services/domain/restaurantTasksTitleIdentity.ts",
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

test("MISE-005ZB pins Task detail operational presentation.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZB/);
  assert.match(taskDetailSource, /MISE-005ZB/);

  assert.match(
    identitySource,
    /export function asciiTrimTaskDetailOperationalTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    taskDetailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationTaskDetailOperationalTitleIdentity"/
  );
  assert.match(taskDetailSource, /normalizeTaskDetailOperationalTitle\(/);
  assert.match(
    taskDetailSource,
    /normalizeTaskDetailOperationalTitle\(presentation\.title\)\s*\|\|\s*t\("tasks\.operational\.title\.none"\)/
  );
  assert.doesNotMatch(
    taskDetailSource,
    /styles\.title[^>]*>\s*\{presentation\.title\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"tasks\.operational\.title\.none": "Task"/);
  assert.match(catalogSource, /"tasks\.operational\.title\.none": "Tarea"/);
  assert.match(catalogSource, /"tasks\.operational\.title\.none": "任务"/);

  // Leave sharedTask.title as raw pass-through on this tip (#1159 owns that surface).
  assert.match(
    taskDetailSource,
    /styles\.title[^>]*>\s*\{sharedTask\.title\}\s*<\/Text>/
  );

  // Leave presentation.detail as raw pass-through on this tip.
  assert.match(
    taskDetailSource,
    /styles\.instructionsBody[^>]*>\s*\{presentation\.detail\}\s*<\/Text>/
  );

  // Descriptor-absent inventing path still lives in presentOperationalTodayTask.
  assert.match(
    presentationSource,
    /if \(!descriptor\) \{\s*return \{\s*title: task\.title,/
  );

  // Do not pull in shared-title, Create Task, or domain-writer helpers on this tip.
  assert.doesNotMatch(taskDetailSource, /normalizeTaskDetailSharedTitle\(/);
  assert.doesNotMatch(taskDetailSource, /normalizeCreateTaskListDisplayTitle\(/);
  assert.doesNotMatch(taskDetailSource, /normalizeCreateTaskChoiceRowTitle\(/);
  assert.doesNotMatch(taskDetailSource, /presentationTaskDetailSharedTitleIdentity/);
  assert.doesNotMatch(taskDetailSource, /presentationCreateTaskListDisplayTitleIdentity/);
  assert.doesNotMatch(taskDetailSource, /presentationCreateTaskChoiceRowTitleIdentity/);
  assert.doesNotMatch(taskDetailSource, /restaurantTasksTitleIdentity/);
  assert.equal(filePresence(sharedTitleIdentityPath), "absent");
  assert.equal(filePresence(createTaskListDisplayTitleIdentityPath), "absent");
  assert.equal(filePresence(createTaskChoiceRowTitleIdentityPath), "absent");
  assert.equal(filePresence(restaurantTasksTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationTaskDetailSharedTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationCreateTaskListDisplayTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationCreateTaskChoiceRowTitleIdentity/);
  assert.doesNotMatch(identityCode, /restaurantTasksTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeTaskDetailOperationalTitle(title), title);
  assert.equal(normalizeTaskDetailOperationalTitle(` ${title} `), title);
  assert.equal(normalizeTaskDetailOperationalTitle(`Case-${title}`), `Case-${title}`);
});

test("descriptor-absent task.title pass-through invents via trim and is soft-nulled on Task detail", () => {
  const padded = `${em}${title}${em}`;
  const presented = presentOperationalTodayTask("en", {
    title: padded,
    detail: "Walk-in cooler count"
  });

  // Inventing proof: no presentation descriptor → raw task.title pass-through.
  assert.equal(presented.title, padded);
  assert.equal(presented.evidenceOnly, true);
  assert.equal(presented.title.trim(), title);
  assert.equal(Boolean(presented.title), true);

  // ASCII C prep refuses that inventing equality before Task detail hero render.
  assert.equal(asciiTrimTaskDetailOperationalTitle(presented.title), padded);
  assert.equal(canonicalizeTaskDetailOperationalTitle(presented.title), null);
  assert.equal(normalizeTaskDetailOperationalTitle(presented.title), null);
  assert.equal(
    normalizeTaskDetailOperationalTitle(presented.title) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Task detail operational titles", () => {
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
  assert.equal(asciiTrimTaskDetailOperationalTitle(padded), padded);
  assert.equal(canonicalizeTaskDetailOperationalTitle(padded), null);
  assert.equal(canonicalizeTaskDetailOperationalTitle(nbspTitle), null);
  assert.equal(normalizeTaskDetailOperationalTitle(padded), null);
  assert.equal(normalizeTaskDetailOperationalTitle(nbspTitle), null);
  assert.equal(normalizeTaskDetailOperationalTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeTaskDetailOperationalTitle(internalEm), internalEm);
  assert.equal(normalizeTaskDetailOperationalTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeTaskDetailOperationalTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Task detail operational titles", () => {
  assert.equal(normalizeTaskDetailOperationalTitle(undefined), null);
  assert.equal(normalizeTaskDetailOperationalTitle(null), null);
  assert.equal(normalizeTaskDetailOperationalTitle(""), null);
  assert.equal(normalizeTaskDetailOperationalTitle("   "), null);
  assert.equal(normalizeTaskDetailOperationalTitle(123 as unknown as string), null);
  assert.equal(normalizeTaskDetailOperationalTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeTaskDetailOperationalTitle(`${title}\t`), title);
  assert.equal(normalizeTaskDetailOperationalTitle(`${title}\u0007`), null);
  assert.equal(normalizeTaskDetailOperationalTitle(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeTaskDetailOperationalTitle(`Count\twalk-in`), null);
  assert.equal(normalizeTaskDetailOperationalTitle(`Count\nwalk-in`), null);
});

test("Task detail operational title bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking title Text.
  assert.equal(normalizeTaskDetailOperationalTitle(""), null);
  assert.equal(normalizeTaskDetailOperationalTitle(em), null);
  assert.equal(normalizeTaskDetailOperationalTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    taskDetailSource,
    /normalizeTaskDetailOperationalTitle\(presentation\.title\)\s*\|\|\s*t\("tasks\.operational\.title\.none"\)/
  );
});

test("Task detail operational presentation.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimTaskDetailOperationalTitle(padded), padded.trim());
  assert.equal(normalizeTaskDetailOperationalTitle(padded), null);
  assert.equal(normalizeTaskDetailOperationalTitle(padded) || "Task", "Task");
  assert.equal(normalizeTaskDetailOperationalTitle(`\t${title}\n`), title);
});

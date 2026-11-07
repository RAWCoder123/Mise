import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimTaskDetailSharedTitle,
  canonicalizeTaskDetailSharedTitle,
  normalizeTaskDetailSharedTitle
} from "../services/domain/presentationTaskDetailSharedTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationTaskDetailSharedTitleIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const taskDetailSource = readFileSync(
  new URL("../app/tasks/[id].tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
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

test("MISE-005ZA pins Task detail sharedTask.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZA/);
  assert.match(taskDetailSource, /MISE-005ZA/);

  assert.match(
    identitySource,
    /export function asciiTrimTaskDetailSharedTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    taskDetailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationTaskDetailSharedTitleIdentity"/
  );
  assert.match(taskDetailSource, /normalizeTaskDetailSharedTitle\(/);
  assert.match(
    taskDetailSource,
    /normalizeTaskDetailSharedTitle\(sharedTask\.title\)\s*\|\|\s*t\("tasks\.shared\.title\.none"\)/
  );
  assert.doesNotMatch(
    taskDetailSource,
    /styles\.title[^>]*>\s*\{sharedTask\.title\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"tasks\.shared\.title\.none": "Task"/);
  assert.match(catalogSource, /"tasks\.shared\.title\.none": "Tarea"/);
  assert.match(catalogSource, /"tasks\.shared\.title\.none": "任务"/);

  // Leave operational presentation.title as raw pass-through on this tip.
  assert.match(
    taskDetailSource,
    /styles\.title[^>]*>\s*\{presentation\.title\}\s*<\/Text>/
  );

  // Leave sharedTask.detail soft-null path alone (multiline instructions).
  assert.match(
    taskDetailSource,
    /sharedTask\.detail \?\? t\("tasks\.shared\.noInstructions"\)/
  );

  // Do not pull in Create Task or domain-writer helpers on this tip.
  assert.doesNotMatch(taskDetailSource, /normalizeCreateTaskListDisplayTitle\(/);
  assert.doesNotMatch(taskDetailSource, /normalizeCreateTaskChoiceRowTitle\(/);
  assert.doesNotMatch(taskDetailSource, /presentationCreateTaskListDisplayTitleIdentity/);
  assert.doesNotMatch(taskDetailSource, /presentationCreateTaskChoiceRowTitleIdentity/);
  assert.doesNotMatch(taskDetailSource, /restaurantTasksTitleIdentity/);
  assert.equal(
    (() => {
      try {
        readFileSync(createTaskListDisplayTitleIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );
  assert.equal(
    (() => {
      try {
        readFileSync(createTaskChoiceRowTitleIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );
  assert.equal(
    (() => {
      try {
        readFileSync(restaurantTasksTitleIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationCreateTaskListDisplayTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationCreateTaskChoiceRowTitleIdentity/);
  assert.doesNotMatch(identityCode, /restaurantTasksTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeTaskDetailSharedTitle(title), title);
  assert.equal(normalizeTaskDetailSharedTitle(` ${title} `), title);
  assert.equal(normalizeTaskDetailSharedTitle(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Task detail shared titles", () => {
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
  assert.equal(asciiTrimTaskDetailSharedTitle(padded), padded);
  assert.equal(canonicalizeTaskDetailSharedTitle(padded), null);
  assert.equal(canonicalizeTaskDetailSharedTitle(nbspTitle), null);
  assert.equal(normalizeTaskDetailSharedTitle(padded), null);
  assert.equal(normalizeTaskDetailSharedTitle(nbspTitle), null);
  assert.equal(normalizeTaskDetailSharedTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeTaskDetailSharedTitle(internalEm), internalEm);
  assert.equal(normalizeTaskDetailSharedTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeTaskDetailSharedTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Task detail shared titles", () => {
  assert.equal(normalizeTaskDetailSharedTitle(undefined), null);
  assert.equal(normalizeTaskDetailSharedTitle(null), null);
  assert.equal(normalizeTaskDetailSharedTitle(""), null);
  assert.equal(normalizeTaskDetailSharedTitle("   "), null);
  assert.equal(normalizeTaskDetailSharedTitle(123 as unknown as string), null);
  assert.equal(normalizeTaskDetailSharedTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeTaskDetailSharedTitle(`${title}\t`), title);
  assert.equal(normalizeTaskDetailSharedTitle(`${title}\u0007`), null);
  assert.equal(normalizeTaskDetailSharedTitle(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeTaskDetailSharedTitle(`Count\twalk-in`), null);
  assert.equal(normalizeTaskDetailSharedTitle(`Count\nwalk-in`), null);
});

test("Task detail shared title bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking title Text.
  assert.equal(normalizeTaskDetailSharedTitle(""), null);
  assert.equal(normalizeTaskDetailSharedTitle(em), null);
  assert.equal(normalizeTaskDetailSharedTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    taskDetailSource,
    /normalizeTaskDetailSharedTitle\(sharedTask\.title\)\s*\|\|\s*t\("tasks\.shared\.title\.none"\)/
  );
});

test("Task detail sharedTask.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimTaskDetailSharedTitle(padded), padded.trim());
  assert.equal(normalizeTaskDetailSharedTitle(padded), null);
  assert.equal(normalizeTaskDetailSharedTitle(padded) || "Task", "Task");
  assert.equal(normalizeTaskDetailSharedTitle(`\t${title}\n`), title);
});

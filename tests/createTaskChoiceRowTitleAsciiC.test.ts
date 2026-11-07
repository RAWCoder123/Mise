import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimCreateTaskChoiceRowTitle,
  canonicalizeCreateTaskChoiceRowTitle,
  normalizeCreateTaskChoiceRowTitle
} from "../services/domain/presentationCreateTaskChoiceRowTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationCreateTaskChoiceRowTitleIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const createTaskSource = readFileSync(
  new URL("../app/more/create-task.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const createTaskListDisplayTitleIdentityPath = new URL(
  "../services/domain/presentationCreateTaskListDisplayTitleIdentity.ts",
  import.meta.url
);

const title = "Count walk-in";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YU pins Create Task dependency ChoiceRow task.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005YU/);
  assert.match(createTaskSource, /MISE-005YU/);

  assert.match(
    identitySource,
    /export function asciiTrimCreateTaskChoiceRowTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    createTaskSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationCreateTaskChoiceRowTitleIdentity"/
  );
  assert.match(createTaskSource, /normalizeCreateTaskChoiceRowTitle\(/);
  assert.match(
    createTaskSource,
    /normalizeCreateTaskChoiceRowTitle\(task\.title\)\s*\|\|\s*t\("operatorTasks\.dependency\.title\.none"\)/
  );
  assert.doesNotMatch(createTaskSource, /label=\{task\.title\}/);

  assert.match(catalogSource, /"operatorTasks\.dependency\.title\.none": "Task"/);
  assert.match(catalogSource, /"operatorTasks\.dependency\.title\.none": "Tarea"/);
  assert.match(catalogSource, /"operatorTasks\.dependency\.title\.none": "任务"/);

  // Leave list-row a11y and list display title as raw pass-through on this tip
  // (#1072 / #1152 own those surfaces).
  assert.match(
    createTaskSource,
    /accessibilityLabel=\{t\("operatorTasks\.list\.rowAccessibility", \{ title: task\.title \}\)/
  );
  assert.match(
    createTaskSource,
    /accessibilityLabel=\{t\("operatorTasks\.list\.rowAccessibility", \{\s*title: task\.title\s*\}\)/
  );
  assert.match(createTaskSource, /taskTitle[^>]*>\s*\{task\.title\}\s*<\/Text>/);

  // Leave list-display identity module, form save-path, and assignee trim alone.
  assert.doesNotMatch(createTaskSource, /normalizeCreateTaskListDisplayTitle\(/);
  assert.doesNotMatch(createTaskSource, /normalizeCreateTaskListRowTitle\(/);
  assert.doesNotMatch(createTaskSource, /normalizeCreateTaskTitle\(/);
  assert.doesNotMatch(createTaskSource, /presentationCreateTaskListDisplayTitleIdentity/);
  assert.match(
    createTaskSource,
    /label=\{member\.name\?\.trim\(\) \|\| member\.email\?\.trim\(\) \|\| t\("operatorTasks\.assignee\.teammate"\)\}/
  );
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

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationCreateTaskListDisplayTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeCreateTaskChoiceRowTitle(title), title);
  assert.equal(normalizeCreateTaskChoiceRowTitle(` ${title} `), title);
  assert.equal(normalizeCreateTaskChoiceRowTitle(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Create Task ChoiceRow titles", () => {
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
  assert.equal(asciiTrimCreateTaskChoiceRowTitle(padded), padded);
  assert.equal(canonicalizeCreateTaskChoiceRowTitle(padded), null);
  assert.equal(canonicalizeCreateTaskChoiceRowTitle(nbspTitle), null);
  assert.equal(normalizeCreateTaskChoiceRowTitle(padded), null);
  assert.equal(normalizeCreateTaskChoiceRowTitle(nbspTitle), null);
  assert.equal(normalizeCreateTaskChoiceRowTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeCreateTaskChoiceRowTitle(internalEm), internalEm);
  assert.equal(normalizeCreateTaskChoiceRowTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeCreateTaskChoiceRowTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Create Task ChoiceRow titles", () => {
  assert.equal(normalizeCreateTaskChoiceRowTitle(undefined), null);
  assert.equal(normalizeCreateTaskChoiceRowTitle(null), null);
  assert.equal(normalizeCreateTaskChoiceRowTitle(""), null);
  assert.equal(normalizeCreateTaskChoiceRowTitle("   "), null);
  assert.equal(normalizeCreateTaskChoiceRowTitle(123 as unknown as string), null);
  assert.equal(normalizeCreateTaskChoiceRowTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeCreateTaskChoiceRowTitle(`${title}\t`), title);
  assert.equal(normalizeCreateTaskChoiceRowTitle(`${title}\u0007`), null);
  assert.equal(normalizeCreateTaskChoiceRowTitle(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeCreateTaskChoiceRowTitle(`Count\twalk-in`), null);
  assert.equal(normalizeCreateTaskChoiceRowTitle(`Count\nwalk-in`), null);
});

test("Create Task ChoiceRow bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking ChoiceRow labels.
  assert.equal(normalizeCreateTaskChoiceRowTitle(""), null);
  assert.equal(normalizeCreateTaskChoiceRowTitle(em), null);
  assert.equal(normalizeCreateTaskChoiceRowTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    createTaskSource,
    /normalizeCreateTaskChoiceRowTitle\(task\.title\)\s*\|\|\s*t\("operatorTasks\.dependency\.title\.none"\)/
  );
});

test("Create Task dependency ChoiceRow task.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimCreateTaskChoiceRowTitle(padded), padded.trim());
  assert.equal(normalizeCreateTaskChoiceRowTitle(padded), null);
  assert.equal(normalizeCreateTaskChoiceRowTitle(padded) || "Task", "Task");
  assert.equal(normalizeCreateTaskChoiceRowTitle(`\t${title}\n`), title);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimCreateTaskListRowTitle,
  canonicalizeCreateTaskListRowTitle,
  normalizeCreateTaskListRowTitle
} from "../services/domain/presentationCreateTaskListRowTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationCreateTaskListRowTitleIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const createTaskSource = readFileSync(
  new URL("../app/more/create-task.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const title = "Count walk-in";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XL pins Create Task list-row a11y task.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005XL/);
  assert.match(createTaskSource, /MISE-005XL/);

  assert.match(
    identitySource,
    /export function asciiTrimCreateTaskListRowTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    createTaskSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationCreateTaskListRowTitleIdentity"/
  );
  assert.match(createTaskSource, /normalizeCreateTaskListRowTitle\(/);
  assert.match(
    createTaskSource,
    /normalizeCreateTaskListRowTitle\(task\.title\)\s*\|\|\s*t\("operatorTasks\.list\.rowTitle\.none"\)/
  );
  assert.match(
    createTaskSource,
    /t\("operatorTasks\.list\.rowAccessibility", \{\s*(?:\/\/[^\n]*\n\s*)*title:\s*normalizeCreateTaskListRowTitle\(task\.title\)\s*\|\|\s*t\("operatorTasks\.list\.rowTitle\.none"\)\s*\}\)/
  );
  assert.doesNotMatch(
    createTaskSource,
    /accessibilityLabel=\{t\("operatorTasks\.list\.rowAccessibility", \{ title: task\.title \}\)/
  );

  assert.match(catalogSource, /"operatorTasks\.list\.rowTitle\.none": "Task"/);
  assert.match(catalogSource, /"operatorTasks\.list\.rowTitle\.none": "Tarea"/);
  assert.match(catalogSource, /"operatorTasks\.list\.rowTitle\.none": "任务"/);

  // Leave display Text, dependency ChoiceRow labels, and form save-path alone.
  assert.match(createTaskSource, /\{task\.title\}/);
  assert.match(createTaskSource, /label=\{task\.title\}/);
  assert.doesNotMatch(createTaskSource, /normalizeCreateTaskTitle\(/);
  assert.doesNotMatch(identitySource, /createTaskTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityExpandTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeCreateTaskListRowTitle(title), title);
  assert.equal(normalizeCreateTaskListRowTitle(` ${title} `), title);
  assert.equal(normalizeCreateTaskListRowTitle(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Create Task list-row a11y titles", () => {
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
  assert.equal(asciiTrimCreateTaskListRowTitle(padded), padded);
  assert.equal(canonicalizeCreateTaskListRowTitle(padded), null);
  assert.equal(canonicalizeCreateTaskListRowTitle(nbspTitle), null);
  assert.equal(normalizeCreateTaskListRowTitle(padded), null);
  assert.equal(normalizeCreateTaskListRowTitle(nbspTitle), null);
  assert.equal(normalizeCreateTaskListRowTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeCreateTaskListRowTitle(internalEm), internalEm);
  assert.equal(normalizeCreateTaskListRowTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeCreateTaskListRowTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Create Task list-row a11y titles", () => {
  assert.equal(normalizeCreateTaskListRowTitle(undefined), null);
  assert.equal(normalizeCreateTaskListRowTitle(null), null);
  assert.equal(normalizeCreateTaskListRowTitle(""), null);
  assert.equal(normalizeCreateTaskListRowTitle("   "), null);
  assert.equal(normalizeCreateTaskListRowTitle(123 as unknown as string), null);
  assert.equal(normalizeCreateTaskListRowTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeCreateTaskListRowTitle(`${title}\t`), title);
  assert.equal(normalizeCreateTaskListRowTitle(`${title}\u0007`), null);
  assert.equal(normalizeCreateTaskListRowTitle(em), null);
});

test("Create Task list-row a11y bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking title into a11y.
  assert.equal(normalizeCreateTaskListRowTitle(""), null);
  assert.equal(normalizeCreateTaskListRowTitle(em), null);
  assert.equal(normalizeCreateTaskListRowTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    createTaskSource,
    /normalizeCreateTaskListRowTitle\(task\.title\)\s*\|\|\s*t\("operatorTasks\.list\.rowTitle\.none"\)/
  );
});

test("Create Task list-row a11y task.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimCreateTaskListRowTitle(padded), padded.trim());
  assert.equal(normalizeCreateTaskListRowTitle(padded), null);
  assert.equal(normalizeCreateTaskListRowTitle(`\t${title}\n`), title);
});

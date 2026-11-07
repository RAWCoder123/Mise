import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimCreateTaskListDisplayTitle,
  canonicalizeCreateTaskListDisplayTitle,
  normalizeCreateTaskListDisplayTitle
} from "../services/domain/presentationCreateTaskListDisplayTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationCreateTaskListDisplayTitleIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const createTaskSource = readFileSync(
  new URL("../app/more/create-task.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const createTaskListRowTitleIdentityPath = new URL(
  "../services/domain/presentationCreateTaskListRowTitleIdentity.ts",
  import.meta.url
);

const title = "Count walk-in";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YT pins Create Task list display task.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005YT/);
  assert.match(createTaskSource, /MISE-005YT/);

  assert.match(
    identitySource,
    /export function asciiTrimCreateTaskListDisplayTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    createTaskSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationCreateTaskListDisplayTitleIdentity"/
  );
  assert.match(createTaskSource, /normalizeCreateTaskListDisplayTitle\(/);
  assert.match(
    createTaskSource,
    /normalizeCreateTaskListDisplayTitle\(task\.title\)\s*\|\|\s*t\("operatorTasks\.list\.title\.none"\)/
  );
  assert.doesNotMatch(
    createTaskSource,
    /taskTitle[^>]*>\s*\{task\.title\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"operatorTasks\.list\.title\.none": "Task"/);
  assert.match(catalogSource, /"operatorTasks\.list\.title\.none": "Tarea"/);
  assert.match(catalogSource, /"operatorTasks\.list\.title\.none": "任务"/);

  // Leave list-row a11y as raw pass-through on this tip (#1072 owns that surface).
  assert.match(
    createTaskSource,
    /accessibilityLabel=\{t\("operatorTasks\.list\.rowAccessibility", \{ title: task\.title \}\)/
  );
  assert.match(
    createTaskSource,
    /accessibilityLabel=\{t\("operatorTasks\.list\.rowAccessibility", \{\s*title: task\.title\s*\}\)/
  );

  // Leave dependency ChoiceRow labels and form save-path alone.
  assert.match(createTaskSource, /label=\{task\.title\}/);
  assert.doesNotMatch(createTaskSource, /normalizeCreateTaskListRowTitle\(/);
  assert.doesNotMatch(createTaskSource, /normalizeCreateTaskTitle\(/);
  assert.doesNotMatch(createTaskSource, /presentationCreateTaskListRowTitleIdentity/);
  assert.equal(
    (() => {
      try {
        readFileSync(createTaskListRowTitleIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationCreateTaskListRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeCreateTaskListDisplayTitle(title), title);
  assert.equal(normalizeCreateTaskListDisplayTitle(` ${title} `), title);
  assert.equal(normalizeCreateTaskListDisplayTitle(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Create Task list display titles", () => {
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
  assert.equal(asciiTrimCreateTaskListDisplayTitle(padded), padded);
  assert.equal(canonicalizeCreateTaskListDisplayTitle(padded), null);
  assert.equal(canonicalizeCreateTaskListDisplayTitle(nbspTitle), null);
  assert.equal(normalizeCreateTaskListDisplayTitle(padded), null);
  assert.equal(normalizeCreateTaskListDisplayTitle(nbspTitle), null);
  assert.equal(normalizeCreateTaskListDisplayTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeCreateTaskListDisplayTitle(internalEm), internalEm);
  assert.equal(normalizeCreateTaskListDisplayTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeCreateTaskListDisplayTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Create Task list display titles", () => {
  assert.equal(normalizeCreateTaskListDisplayTitle(undefined), null);
  assert.equal(normalizeCreateTaskListDisplayTitle(null), null);
  assert.equal(normalizeCreateTaskListDisplayTitle(""), null);
  assert.equal(normalizeCreateTaskListDisplayTitle("   "), null);
  assert.equal(normalizeCreateTaskListDisplayTitle(123 as unknown as string), null);
  assert.equal(normalizeCreateTaskListDisplayTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeCreateTaskListDisplayTitle(`${title}\t`), title);
  assert.equal(normalizeCreateTaskListDisplayTitle(`${title}\u0007`), null);
  assert.equal(normalizeCreateTaskListDisplayTitle(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeCreateTaskListDisplayTitle(`Count\twalk-in`), null);
  assert.equal(normalizeCreateTaskListDisplayTitle(`Count\nwalk-in`), null);
});

test("Create Task list display bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking title Text.
  assert.equal(normalizeCreateTaskListDisplayTitle(""), null);
  assert.equal(normalizeCreateTaskListDisplayTitle(em), null);
  assert.equal(normalizeCreateTaskListDisplayTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    createTaskSource,
    /normalizeCreateTaskListDisplayTitle\(task\.title\)\s*\|\|\s*t\("operatorTasks\.list\.title\.none"\)/
  );
});

test("Create Task list display task.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimCreateTaskListDisplayTitle(padded), padded.trim());
  assert.equal(normalizeCreateTaskListDisplayTitle(padded), null);
  assert.equal(normalizeCreateTaskListDisplayTitle(padded) || "Task", "Task");
  assert.equal(normalizeCreateTaskListDisplayTitle(`\t${title}\n`), title);
});

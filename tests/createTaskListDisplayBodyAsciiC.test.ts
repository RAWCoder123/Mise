import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCreateTaskListDisplayBody,
  normalizeCreateTaskListDisplayBody
} from "../services/domain/presentationCreateTaskListDisplayBodyIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationCreateTaskListDisplayBodyIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const createTaskSource = readFileSync(
  new URL("../app/more/create-task.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const floorNotesSource = readFileSync(
  new URL("../services/application/floorNotes.ts", import.meta.url),
  "utf8"
);
const restaurantTasksSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);
const createTaskListDisplayTitleIdentityPath = new URL(
  "../services/domain/presentationCreateTaskListDisplayTitleIdentity.ts",
  import.meta.url
);
const createTaskListRowTitleIdentityPath = new URL(
  "../services/domain/presentationCreateTaskListRowTitleIdentity.ts",
  import.meta.url
);

const body = "Check walk-in cooler before open";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005ZW pins Create Task list display task.detail / task.body to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZW/);
  assert.match(createTaskSource, /MISE-005ZW/);

  assert.match(
    identitySource,
    /export function canonicalCreateTaskListDisplayBody\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    createTaskSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationCreateTaskListDisplayBodyIdentity"/
  );
  assert.match(createTaskSource, /normalizeCreateTaskListDisplayBody\(/);
  assert.match(
    createTaskSource,
    /normalizeCreateTaskListDisplayBody\(rawDetail\)/
  );
  assert.match(
    createTaskSource,
    /normalizeCreateTaskListDisplayBody\(rawBody\)/
  );
  assert.match(
    createTaskSource,
    /listBody \|\| t\("operatorTasks\.list\.body\.none"\)/
  );
  assert.doesNotMatch(
    createTaskSource,
    /taskBody[^>]*>\s*\{task\.detail\}\s*<\/Text>/
  );
  assert.doesNotMatch(
    createTaskSource,
    /taskBody[^>]*>\s*\{task\.body\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"operatorTasks\.list\.body\.none": "Note"/);
  assert.match(catalogSource, /"operatorTasks\.list\.body\.none": "Nota"/);
  assert.match(catalogSource, /"operatorTasks\.list\.body\.none": "说明"/);

  // Inventing paths still Unicode-trim free-form body before list display.
  assert.match(restaurantTasksSource, /optionalText\(row\.detail, 2000, "Task detail"\)/);
  assert.match(floorNotesSource, /value\.replace\(\/\^\\s\+\//);
  assert.match(floorNotesSource, /\.replace\(\/\\s\+\$\//);

  // Leave Create Task list display task.title alone (open #1152 / MISE-005YT).
  assert.match(createTaskSource, /\{task\.title\}/);
  assert.doesNotMatch(createTaskSource, /normalizeCreateTaskListDisplayTitle\(/);
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
  assert.doesNotMatch(identityCode, /presentationCreateTaskListDisplayTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationCreateTaskListRowTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationActivityEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeCreateTaskListDisplayBody(body), body);
  assert.equal(normalizeCreateTaskListDisplayBody(` ${body} `), body);
  assert.equal(
    normalizeCreateTaskListDisplayBody(`Context: ${body}`),
    `Context: ${body}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Create Task list display bodies", () => {
  const padded = `${em}${body}${em}`;
  const nbspBody = `${nbsp}${body}${nbsp}`;
  const internalEm = `Check${em}walk-in cooler before open`;
  const internalNbsp = `Check${nbsp}walk-in cooler before open`;
  const multiline = `Check walk-in cooler before open.\nConfirm dairy first.`;

  // Inventing proof: Unicode trim / \s end-trim would invent the clean body.
  assert.equal(padded.trim(), body);
  assert.equal(nbspBody.trim(), body);
  assert.equal(padded.replace(/^\s+/, "").replace(/\s+$/, ""), body);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspBody), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalCreateTaskListDisplayBody(padded), padded);
  assert.equal(normalizeCreateTaskListDisplayBody(padded), null);
  assert.equal(normalizeCreateTaskListDisplayBody(padded) || "FALLBACK", "FALLBACK");

  // End NBSP folds to plain space then C-trims to the clean body (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeCreateTaskListDisplayBody(nbspBody), body);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeCreateTaskListDisplayBody(internalEm), internalEm);
  assert.equal(
    normalizeCreateTaskListDisplayBody(internalNbsp),
    "Check walk-in cooler before open"
  );
  assert.equal(normalizeCreateTaskListDisplayBody(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Create Task list display bodies", () => {
  assert.equal(normalizeCreateTaskListDisplayBody(undefined), null);
  assert.equal(normalizeCreateTaskListDisplayBody(null), null);
  assert.equal(normalizeCreateTaskListDisplayBody(""), null);
  assert.equal(normalizeCreateTaskListDisplayBody("   "), null);
  assert.equal(normalizeCreateTaskListDisplayBody(123 as unknown as string), null);
  assert.equal(normalizeCreateTaskListDisplayBody(`\u0001${body}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeCreateTaskListDisplayBody(`${body}\t`), body);
  assert.equal(normalizeCreateTaskListDisplayBody(`${body}\u0007`), null);
  assert.equal(normalizeCreateTaskListDisplayBody(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeCreateTaskListDisplayBody(`Check walk-in\tcooler before open`),
    `Check walk-in\tcooler before open`
  );
});

test("Create Task list display bypass proof: empty and Unicode-only-space bodies soft-null to localized none", () => {
  // Prior truthy-gated always-pass-body path still rendered blank-looking Text.
  assert.equal(normalizeCreateTaskListDisplayBody(""), null);
  assert.equal(normalizeCreateTaskListDisplayBody(em), null);
  assert.equal(normalizeCreateTaskListDisplayBody(nbsp), null);
  const missingBody: string | null | undefined = undefined;
  const unicodeOnlyBody: string | null | undefined = em;
  assert.equal(missingBody ?? "", "");
  assert.equal(unicodeOnlyBody ?? "", em);
  assert.notEqual(unicodeOnlyBody ?? "", "");
  assert.equal(Boolean(unicodeOnlyBody), true);
  assert.match(
    createTaskSource,
    /listBody \|\| t\("operatorTasks\.list\.body\.none"\)/
  );
  // Present-but-unsafe still renders the Text with none fallback; null/empty omits.
  assert.match(
    createTaskSource,
    /if \(rawDetail == null \|\| rawDetail === ""\) return null;/
  );
  assert.match(
    createTaskSource,
    /if \(rawBody == null \|\| rawBody === ""\) return null;/
  );
});

test("Create Task list display body identity refuses Unicode inventing equality", () => {
  const padded = `${em}${body}${em}`;
  assert.notEqual(canonicalCreateTaskListDisplayBody(padded), padded.trim());
  assert.equal(normalizeCreateTaskListDisplayBody(padded), null);
  assert.equal(normalizeCreateTaskListDisplayBody(`\t${body}\n`), body);
});

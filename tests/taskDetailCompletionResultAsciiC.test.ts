import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiPrepTaskDetailCompletionResult,
  canonicalizeTaskDetailCompletionResult,
  normalizeTaskDetailCompletionResult
} from "../services/domain/presentationTaskDetailCompletionResultIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationTaskDetailCompletionResultIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const taskDetailSource = readFileSync(
  new URL("../app/tasks/[id].tsx", import.meta.url),
  "utf8"
);
const restaurantTasksSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const result = "Counted 18 lb";
const accentedResult = "Conteo verificado · 18 lb";
const multilineResult = "Counted 18 lb.\nShift lead signed.\tPhoto attached.";

const restaurantTasksCompletionResultIdentityPath = new URL(
  "../services/domain/restaurantTasksCompletionResultIdentity.ts",
  import.meta.url
);
const operatingPlanTimelineCompletionResultIdentityPath = new URL(
  "../services/domain/presentationOperatingPlanTimelineCompletionResultIdentity.ts",
  import.meta.url
);
const tasksSharedDetailNoInstructionsIdentityPath = new URL(
  "../services/domain/presentationTasksSharedDetailNoInstructionsIdentity.ts",
  import.meta.url
);
const ordersDetailDeliveryEvidenceNotesIdentityPath = new URL(
  "../services/domain/ordersDetailDeliveryEvidenceNotesIdentity.ts",
  import.meta.url
);

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005ABM pins Task detail sharedTask.completionResult display to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005ABM/);
  assert.match(taskDetailSource, /MISE-005ABM/);

  assert.ok(identitySource.includes("C_LEADING_WHITESPACE = /^[ \\t\\n\\v\\f\\r]+/;"));
  assert.ok(identitySource.includes("C_TRAILING_WHITESPACE = /[ \\t\\n\\v\\f\\r]+$/;"));
  assert.ok(identitySource.includes('.replace(/\\u00a0/g, " ")'));
  assert.ok(
    identitySource.includes(
      "UNSAFE_MULTILINE_CONTROL = /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/;"
    )
  );

  const prepBody = identitySource.slice(
    identitySource.indexOf("export function asciiPrepTaskDetailCompletionResult("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(prepBody, /\.trim\(\)/);
  assert.doesNotMatch(prepBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\\s/);

  assert.match(
    taskDetailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationTaskDetailCompletionResultIdentity"/
  );
  assert.match(
    taskDetailSource,
    /const taskDetailCompletionResult = normalizeTaskDetailCompletionResult\(\s*sharedTask\.completionResult\s*\)/
  );
  assert.match(
    taskDetailSource,
    /\{taskDetailCompletionResult \? \(\s*<Text style=\{styles\.instructionsBody\}>\{taskDetailCompletionResult\}<\/Text>\s*\) : null\}/
  );
  assert.doesNotMatch(
    taskDetailSource,
    /<Text style=\{styles\.instructionsBody\}>\{sharedTask\.completionResult\}<\/Text>/
  );

  // Inventing substrate: domain Unicode-trims / \s-collapses completionResult
  // on complete + hydrate before the Task detail always-pass Text.
  assert.match(
    restaurantTasksSource,
    /completionResult: requiredText\(input\.completionResult, 1000, "Completion result"\)/
  );
  assert.match(
    restaurantTasksSource,
    /completionResult: optionalText\(row\.completion_result, 1000, "Task completion result"\)/
  );
  assert.match(
    restaurantTasksSource,
    /const normalized = value\.trim\(\)\.replace\(\/\\s\+\/g, " "\);/
  );
  assert.match(
    restaurantTasksSource,
    /function optionalText\(value: unknown, max: number, label: string\): string \| null \{[\s\S]*?const normalized = value\.trim\(\);/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /from ["'].*restaurantTasksCompletionResultIdentity/);
  assert.doesNotMatch(
    identitySource,
    /from ["'].*presentationOperatingPlanTimelineCompletionResultIdentity/
  );
  assert.doesNotMatch(
    identitySource,
    /from ["'].*presentationTasksSharedDetailNoInstructionsIdentity/
  );
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailDeliveryEvidenceNotesIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.doesNotMatch(taskDetailSource, /normalizeCanonicalRestaurantTasksCompletionResult\b/);
  assert.doesNotMatch(taskDetailSource, /normalizeOperatingPlanTimelineCompletionResult\b/);
  assert.doesNotMatch(taskDetailSource, /normalizeTasksSharedDetailNoInstructions\b/);
  assert.doesNotMatch(taskDetailSource, /normalizeOrdersDetailDeliveryEvidenceNotes\b/);
  assert.equal(filePresence(restaurantTasksCompletionResultIdentityPath), "absent");
  assert.equal(filePresence(operatingPlanTimelineCompletionResultIdentityPath), "absent");
  assert.equal(filePresence(tasksSharedDetailNoInstructionsIdentityPath), "absent");
  assert.equal(filePresence(ordersDetailDeliveryEvidenceNotesIdentityPath), "absent");
});

test("ASCII C multiline prep keeps ordinary Task detail completionResult stable", () => {
  assert.equal(asciiPrepTaskDetailCompletionResult(`  ${result}  `), result);
  assert.equal(asciiPrepTaskDetailCompletionResult(`\t${result}\n`), result);
  assert.equal(canonicalizeTaskDetailCompletionResult(`  ${result}  `), result);
  assert.equal(normalizeTaskDetailCompletionResult(`  ${result}  `), result);

  assert.equal(asciiPrepTaskDetailCompletionResult(accentedResult), accentedResult);
  assert.equal(normalizeTaskDetailCompletionResult(accentedResult), accentedResult);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(asciiPrepTaskDetailCompletionResult(multilineResult), multilineResult);
  assert.equal(normalizeTaskDetailCompletionResult(multilineResult), multilineResult);
});

test("Unicode-only space cannot always-pass into Task detail Result chrome", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";

  // Bypass proof: raw truthiness previously always-passed blank-looking Result bodies.
  assert.equal(Boolean(emOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.equal(Boolean(paddedSpaces), true);
  assert.notEqual(emOnly.trim(), emOnly);
  assert.equal(emOnly.trim(), "");

  // Soft-null restores the intentional hide branch.
  assert.equal(normalizeTaskDetailCompletionResult(emOnly), null);
  assert.equal(normalizeTaskDetailCompletionResult(nbspOnly), null);
  assert.equal(normalizeTaskDetailCompletionResult(paddedSpaces), null);
  assert.equal(normalizeTaskDetailCompletionResult(null), null);
  assert.equal(normalizeTaskDetailCompletionResult(undefined), null);
  assert.equal(normalizeTaskDetailCompletionResult(""), null);
  assert.equal(Boolean(normalizeTaskDetailCompletionResult(emOnly)), false);
});

test("NBSP folds and em-space padding cannot invent clean Task detail completionResult", () => {
  const nbspResult = `\u00a0${result}\u00a0`;
  const emResult = `\u2003${result}\u2003`;
  const internalEm = `Counted\u200318 lb`;
  const internalNbsp = `Counted\u00a018 lb`;
  const emMultiline = `\u2003${multilineResult}\u2003`;

  // Domain inventing proof: Unicode trim / \s collapse invents a clean body.
  assert.equal(emResult.trim(), result);
  assert.equal(emResult.trim().replace(/\s+/g, " "), result);
  assert.equal(nbspResult.trim().replace(/\s+/g, " "), result);

  // Pasted NBSP folds like sibling multiline free-text prep.
  assert.equal(asciiPrepTaskDetailCompletionResult(nbspResult), result);
  assert.equal(normalizeTaskDetailCompletionResult(nbspResult), result);

  // ASCII C soft-null refuses to invent from em-space padding.
  assert.notEqual(asciiPrepTaskDetailCompletionResult(emResult), result);
  assert.equal(normalizeTaskDetailCompletionResult(emResult), null);
  assert.equal(Boolean(normalizeTaskDetailCompletionResult(emResult)), false);
  assert.equal(normalizeTaskDetailCompletionResult(emMultiline), null);

  // Internal em-space / folded NBSP stay (no inventing strip of interior).
  assert.equal(normalizeTaskDetailCompletionResult(internalEm), internalEm);
  assert.equal(normalizeTaskDetailCompletionResult(internalNbsp), "Counted 18 lb");
});

test("Unsafe multiline controls soft-null for Task detail completionResult display", () => {
  assert.equal(normalizeTaskDetailCompletionResult(`${result}\u0000`), null);
  assert.equal(normalizeTaskDetailCompletionResult(`${result}\u0007`), null);
  assert.equal(normalizeTaskDetailCompletionResult(`${result}\u007f`), null);
  assert.equal(normalizeTaskDetailCompletionResult(123 as unknown as string), null);
  // LF/TAB/CR remain allowed.
  assert.equal(
    normalizeTaskDetailCompletionResult("Line one\nLine two\tTabbed\r"),
    "Line one\nLine two\tTabbed"
  );
});

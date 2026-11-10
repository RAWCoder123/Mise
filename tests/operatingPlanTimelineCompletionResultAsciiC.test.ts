import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiPrepOperatingPlanTimelineCompletionResult,
  canonicalizeOperatingPlanTimelineCompletionResult,
  normalizeOperatingPlanTimelineCompletionResult
} from "../services/domain/presentationOperatingPlanTimelineCompletionResultIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationOperatingPlanTimelineCompletionResultIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const timelineSource = readFileSync(
  new URL("../components/operations/OperatingPlanTimeline.tsx", import.meta.url),
  "utf8"
);
const operatingPlanSource = readFileSync(
  new URL("../services/domain/operatingPlan.ts", import.meta.url),
  "utf8"
);

const result = "Counted 18 lb";
const accentedResult = "Conteo verificado · 18 lb";
const multilineResult = "Counted 18 lb.\nShift lead signed.\tPhoto attached.";

const restaurantTasksCompletionResultIdentityPath = new URL(
  "../services/domain/restaurantTasksCompletionResultIdentity.ts",
  import.meta.url
);
const operatingPlanTaskTitleDisplayIdentityPath = new URL(
  "../services/domain/presentationOperatingPlanTaskTitleDisplayIdentity.ts",
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

test("MISE-005ABL pins Operating Plan Timeline completionResult display to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005ABL/);
  assert.match(timelineSource, /MISE-005ABL/);

  assert.ok(identitySource.includes("C_LEADING_WHITESPACE = /^[ \\t\\n\\v\\f\\r]+/;"));
  assert.ok(identitySource.includes("C_TRAILING_WHITESPACE = /[ \\t\\n\\v\\f\\r]+$/;"));
  assert.ok(identitySource.includes('.replace(/\\u00a0/g, " ")'));
  assert.ok(
    identitySource.includes(
      "UNSAFE_MULTILINE_CONTROL = /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/;"
    )
  );

  const prepBody = identitySource.slice(
    identitySource.indexOf("export function asciiPrepOperatingPlanTimelineCompletionResult("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(prepBody, /\.trim\(\)/);
  assert.doesNotMatch(prepBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\\s/);

  assert.match(
    timelineSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationOperatingPlanTimelineCompletionResultIdentity"/
  );
  assert.match(
    timelineSource,
    /const timelineCompletionResult = normalizeOperatingPlanTimelineCompletionResult\(\s*presentation\.completionResult\s*\)/
  );
  assert.match(
    timelineSource,
    /\{isDone && timelineCompletionResult \? \(\s*<Text numberOfLines=\{1\} style=\{styles\.result\}>\s*\{t\("today\.plan\.result", \{\s*result: timelineCompletionResult\s*\}\)\}\s*<\/Text>\s*\) : null\}/
  );
  assert.doesNotMatch(
    timelineSource,
    /\{isDone && presentation\.completionResult \? \(\s*<Text numberOfLines=\{1\} style=\{styles\.result\}>\s*\{t\("today\.plan\.result", \{\s*result: presentation\.completionResult\s*\}\)\}\s*<\/Text>\s*\) : null\}/
  );

  // Inventing / bypass substrate: domain Unicode-trims activity summary/title
  // into completionResult, and the prior Timeline gate always-passed raw
  // presentation.completionResult into today.plan.result.
  assert.match(
    operatingPlanSource,
    /if \(matched\?\.summary\?\.trim\(\)\) return matched\.summary\.trim\(\);/
  );
  assert.match(
    operatingPlanSource,
    /if \(matched\?\.title\?\.trim\(\)\) return matched\.title\.trim\(\);/
  );
  assert.match(
    operatingPlanSource,
    /completionResult: completed \? task\.completionResult : null,/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /from ["'].*restaurantTasksCompletionResultIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationOperatingPlanTaskTitleDisplayIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailDeliveryEvidenceNotesIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.doesNotMatch(timelineSource, /normalizeCanonicalRestaurantTasksCompletionResult\b/);
  assert.doesNotMatch(timelineSource, /normalizeOperatingPlanTaskTitleDisplay\b/);
  assert.doesNotMatch(timelineSource, /normalizeOrdersDetailDeliveryEvidenceNotes\b/);
  assert.equal(filePresence(restaurantTasksCompletionResultIdentityPath), "absent");
  assert.equal(filePresence(operatingPlanTaskTitleDisplayIdentityPath), "absent");
  assert.equal(filePresence(ordersDetailDeliveryEvidenceNotesIdentityPath), "absent");
});

test("ASCII C multiline prep keeps ordinary Timeline completionResult stable", () => {
  assert.equal(asciiPrepOperatingPlanTimelineCompletionResult(`  ${result}  `), result);
  assert.equal(asciiPrepOperatingPlanTimelineCompletionResult(`\t${result}\n`), result);
  assert.equal(canonicalizeOperatingPlanTimelineCompletionResult(`  ${result}  `), result);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(`  ${result}  `), result);

  assert.equal(asciiPrepOperatingPlanTimelineCompletionResult(accentedResult), accentedResult);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(accentedResult), accentedResult);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(asciiPrepOperatingPlanTimelineCompletionResult(multilineResult), multilineResult);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(multilineResult), multilineResult);
});

test("Unicode-only space cannot bypass Timeline completionResult hide branch", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";

  // Bypass proof: raw truthiness previously rendered blank-looking Result lines.
  assert.equal(Boolean(emOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.equal(Boolean(paddedSpaces), true);
  assert.notEqual(emOnly.trim(), emOnly);
  assert.equal(emOnly.trim(), "");

  // Soft-null restores the intentional hide branch.
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(emOnly), null);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(nbspOnly), null);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(paddedSpaces), null);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(null), null);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(undefined), null);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(""), null);
  assert.equal(Boolean(normalizeOperatingPlanTimelineCompletionResult(emOnly)), false);
});

test("NBSP folds and em-space padding cannot invent clean Timeline completionResult", () => {
  const nbspResult = `\u00a0${result}\u00a0`;
  const emResult = `\u2003${result}\u2003`;
  const internalEm = `Counted\u200318 lb`;
  const internalNbsp = `Counted\u00a018 lb`;
  const emMultiline = `\u2003${multilineResult}\u2003`;

  // Pasted NBSP folds like sibling multiline free-text prep.
  assert.equal(nbspResult.trim(), result);
  assert.equal(asciiPrepOperatingPlanTimelineCompletionResult(nbspResult), result);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(nbspResult), result);

  // Unicode trim invents a clean body; ASCII C soft-null refuses to invent.
  assert.equal(emResult.trim(), result);
  assert.notEqual(asciiPrepOperatingPlanTimelineCompletionResult(emResult), result);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(emResult), null);
  assert.equal(Boolean(normalizeOperatingPlanTimelineCompletionResult(emResult)), false);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(emMultiline), null);

  // Internal em-space / folded NBSP stay (no inventing strip of interior).
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(internalEm), internalEm);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(internalNbsp), "Counted 18 lb");
});

test("Unsafe multiline controls soft-null for Timeline completionResult display", () => {
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(`${result}\u0000`), null);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(`${result}\u0007`), null);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(`${result}\u007f`), null);
  assert.equal(normalizeOperatingPlanTimelineCompletionResult(123 as unknown as string), null);
  // LF/TAB/CR remain allowed.
  assert.equal(
    normalizeOperatingPlanTimelineCompletionResult("Line one\nLine two\tTabbed\r"),
    "Line one\nLine two\tTabbed"
  );
});

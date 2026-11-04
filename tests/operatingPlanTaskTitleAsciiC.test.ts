import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOperatingPlanTaskTitle,
  canonicalizeOperatingPlanTaskTitle,
  normalizeOperatingPlanTaskTitle
} from "../services/domain/presentationOperatingPlanTaskTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationOperatingPlanTaskTitleIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../components/operations/OperatingPlanTimeline.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const title = "Count walk-in";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XQ pins Operating Plan Timeline a11y presentation.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005XQ/);
  assert.match(screenSource, /MISE-005XQ/);

  assert.match(
    identitySource,
    /export function asciiTrimOperatingPlanTaskTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationOperatingPlanTaskTitleIdentity"/
  );
  assert.match(screenSource, /normalizeOperatingPlanTaskTitle\(/);
  assert.match(
    screenSource,
    /normalizeOperatingPlanTaskTitle\(presentation\.title\)\s*\|\|\s*t\("today\.task\.title\.none"\)/
  );
  assert.match(
    screenSource,
    /t\("today\.task\.accessibility", \{\s*(?:\/\/[^\n]*\n\s*)*title:\s*normalizeOperatingPlanTaskTitle\(presentation\.title\)\s*\|\|\s*t\("today\.task\.title\.none"\),\s*detail: presentation\.detail,\s*action: actionLabel\s*\}\)/
  );
  assert.doesNotMatch(
    screenSource,
    /accessibilityLabel=\{t\("today\.task\.accessibility", \{\s*title: presentation\.title,/
  );

  assert.match(catalogSource, /"today\.task\.title\.none": "Task"/);
  assert.match(catalogSource, /"today\.task\.title\.none": "Tarea"/);
  assert.match(catalogSource, /"today\.task\.title\.none": "任务"/);

  // Leave display Text, detail a11y chrome, and sibling tipped modules alone.
  assert.match(screenSource, /\{presentation\.title\}/);
  assert.match(screenSource, /detail: presentation\.detail,/);
  assert.doesNotMatch(screenSource, /normalizeOperatingPlanTaskDetail\(/);
  assert.doesNotMatch(screenSource, /normalizeCreateTaskListRowTitle\(/);
  assert.doesNotMatch(identitySource, /presentationCreateTaskListRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyPhaseBriefFindingTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityExpandTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeOperatingPlanTaskTitle(title), title);
  assert.equal(normalizeOperatingPlanTaskTitle(` ${title} `), title);
  assert.equal(normalizeOperatingPlanTaskTitle(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Operating Plan Timeline a11y titles", () => {
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
  assert.equal(asciiTrimOperatingPlanTaskTitle(padded), padded);
  assert.equal(canonicalizeOperatingPlanTaskTitle(padded), null);
  assert.equal(canonicalizeOperatingPlanTaskTitle(nbspTitle), null);
  assert.equal(normalizeOperatingPlanTaskTitle(padded), null);
  assert.equal(normalizeOperatingPlanTaskTitle(nbspTitle), null);
  assert.equal(normalizeOperatingPlanTaskTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeOperatingPlanTaskTitle(internalEm), internalEm);
  assert.equal(normalizeOperatingPlanTaskTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeOperatingPlanTaskTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Operating Plan Timeline a11y titles", () => {
  assert.equal(normalizeOperatingPlanTaskTitle(undefined), null);
  assert.equal(normalizeOperatingPlanTaskTitle(null), null);
  assert.equal(normalizeOperatingPlanTaskTitle(""), null);
  assert.equal(normalizeOperatingPlanTaskTitle("   "), null);
  assert.equal(normalizeOperatingPlanTaskTitle(123 as unknown as string), null);
  assert.equal(normalizeOperatingPlanTaskTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeOperatingPlanTaskTitle(`${title}\t`), title);
  assert.equal(normalizeOperatingPlanTaskTitle(`${title}\u0007`), null);
  assert.equal(normalizeOperatingPlanTaskTitle(em), null);
});

test("Operating Plan Timeline a11y bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking title into a11y.
  assert.equal(normalizeOperatingPlanTaskTitle(""), null);
  assert.equal(normalizeOperatingPlanTaskTitle(em), null);
  assert.equal(normalizeOperatingPlanTaskTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    screenSource,
    /normalizeOperatingPlanTaskTitle\(presentation\.title\)\s*\|\|\s*t\("today\.task\.title\.none"\)/
  );
});

test("Operating Plan Timeline a11y presentation.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimOperatingPlanTaskTitle(padded), padded.trim());
  assert.equal(normalizeOperatingPlanTaskTitle(padded), null);
  assert.equal(normalizeOperatingPlanTaskTitle(`\t${title}\n`), title);
});

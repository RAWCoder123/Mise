import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimTodayFloorNotesRowTitle,
  canonicalizeTodayFloorNotesRowTitle,
  normalizeTodayFloorNotesRowTitle
} from "../services/domain/presentationTodayFloorNotesRowTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationTodayFloorNotesRowTitleIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const todaySource = readFileSync(
  new URL("../app/(tabs)/today.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const title = "Check walk-in";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XX pins Today floor-notes row a11y note.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005XX/);
  assert.match(todaySource, /MISE-005XX/);

  assert.match(
    identitySource,
    /export function asciiTrimTodayFloorNotesRowTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    todaySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationTodayFloorNotesRowTitleIdentity"/
  );
  assert.match(todaySource, /normalizeTodayFloorNotesRowTitle\(/);
  assert.match(
    todaySource,
    /normalizeTodayFloorNotesRowTitle\(note\.title\)\s*\|\|\s*t\("today\.floorNotes\.rowTitle\.none"\)/
  );
  assert.match(
    todaySource,
    /t\("today\.floorNotes\.rowAccessibility", \{\s*(?:\/\/[^\n]*\n\s*)*title:\s*normalizeTodayFloorNotesRowTitle\(note\.title\)\s*\|\|\s*t\("today\.floorNotes\.rowTitle\.none"\)\s*\}\)/
  );
  assert.doesNotMatch(
    todaySource,
    /accessibilityLabel=\{t\("today\.floorNotes\.rowAccessibility", \{ title: note\.title \}\)/
  );

  assert.match(catalogSource, /"today\.floorNotes\.rowTitle\.none": "Task"/);
  assert.match(catalogSource, /"today\.floorNotes\.rowTitle\.none": "Tarea"/);
  assert.match(catalogSource, /"today\.floorNotes\.rowTitle\.none": "任务"/);

  // Leave display Text, body, and create-path normalize alone.
  assert.match(todaySource, /\{note\.title\}/);
  assert.doesNotMatch(todaySource, /normalizeFloorNoteTitle\(/);
  assert.doesNotMatch(identitySource, /floorNotesTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationCreateTaskListRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityExpandTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeTodayFloorNotesRowTitle(title), title);
  assert.equal(normalizeTodayFloorNotesRowTitle(` ${title} `), title);
  assert.equal(normalizeTodayFloorNotesRowTitle(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Today floor-notes row a11y titles", () => {
  const padded = `${em}${title}${em}`;
  const nbspTitle = `${nbsp}${title}${nbsp}`;
  const internalEm = `Check${em}walk-in`;
  const internalNbsp = `Check${nbsp}walk-in`;

  // Inventing proof: Unicode trim would invent the clean floor-note title.
  assert.equal(padded.trim(), title);
  assert.equal(nbspTitle.trim(), title);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspTitle), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimTodayFloorNotesRowTitle(padded), padded);
  assert.equal(canonicalizeTodayFloorNotesRowTitle(padded), null);
  assert.equal(canonicalizeTodayFloorNotesRowTitle(nbspTitle), null);
  assert.equal(normalizeTodayFloorNotesRowTitle(padded), null);
  assert.equal(normalizeTodayFloorNotesRowTitle(nbspTitle), null);
  assert.equal(normalizeTodayFloorNotesRowTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeTodayFloorNotesRowTitle(internalEm), internalEm);
  assert.equal(normalizeTodayFloorNotesRowTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeTodayFloorNotesRowTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Today floor-notes row a11y titles", () => {
  assert.equal(normalizeTodayFloorNotesRowTitle(undefined), null);
  assert.equal(normalizeTodayFloorNotesRowTitle(null), null);
  assert.equal(normalizeTodayFloorNotesRowTitle(""), null);
  assert.equal(normalizeTodayFloorNotesRowTitle("   "), null);
  assert.equal(normalizeTodayFloorNotesRowTitle(123 as unknown as string), null);
  assert.equal(normalizeTodayFloorNotesRowTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeTodayFloorNotesRowTitle(`${title}\t`), title);
  assert.equal(normalizeTodayFloorNotesRowTitle(`${title}\u0007`), null);
  assert.equal(normalizeTodayFloorNotesRowTitle(em), null);
});

test("Today floor-notes row a11y bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking title into a11y.
  assert.equal(normalizeTodayFloorNotesRowTitle(""), null);
  assert.equal(normalizeTodayFloorNotesRowTitle(em), null);
  assert.equal(normalizeTodayFloorNotesRowTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    todaySource,
    /normalizeTodayFloorNotesRowTitle\(note\.title\)\s*\|\|\s*t\("today\.floorNotes\.rowTitle\.none"\)/
  );
});

test("Today floor-notes row a11y note.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimTodayFloorNotesRowTitle(padded), padded.trim());
  assert.equal(normalizeTodayFloorNotesRowTitle(padded), null);
  assert.equal(normalizeTodayFloorNotesRowTitle(`\t${title}\n`), title);
});

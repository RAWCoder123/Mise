import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimTodayFloorNotesTitleDisplay,
  canonicalizeTodayFloorNotesTitleDisplay,
  normalizeTodayFloorNotesTitleDisplay
} from "../services/domain/presentationTodayFloorNotesTitleDisplayIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationTodayFloorNotesTitleDisplayIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const todaySource = readFileSync(
  new URL("../app/(tabs)/today.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const floorNotesRowTitleIdentityPath = new URL(
  "../services/domain/presentationTodayFloorNotesRowTitleIdentity.ts",
  import.meta.url
);
const floorNotesTitleIdentityPath = new URL(
  "../services/application/floorNotesTitleIdentity.ts",
  import.meta.url
);
const floorNotesBodyIdentityPath = new URL(
  "../services/application/floorNotesBodyIdentity.ts",
  import.meta.url
);
const homeTaskRowTitleDisplayIdentityPath = new URL(
  "../services/domain/presentationHomeTaskRowTitleDisplayIdentity.ts",
  import.meta.url
);
const operatingPlanTaskTitleDisplayIdentityPath = new URL(
  "../services/domain/presentationOperatingPlanTaskTitleDisplayIdentity.ts",
  import.meta.url
);

const title = "Check walk-in";
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

test("MISE-005ABY pins Today floor-notes display note.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABY/);
  assert.match(todaySource, /MISE-005ABY/);

  assert.match(
    identitySource,
    /export function asciiTrimTodayFloorNotesTitleDisplay\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    todaySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationTodayFloorNotesTitleDisplayIdentity"/
  );
  assert.match(todaySource, /normalizeTodayFloorNotesTitleDisplay\(/);
  assert.match(
    todaySource,
    /normalizeTodayFloorNotesTitleDisplay\(note\.title\)\s*\|\|\s*t\("today\.floorNotes\.noteTitle\.none"\)/
  );
  assert.doesNotMatch(
    todaySource,
    /<Text style=\{styles\.floorNoteTitle\}>\{note\.title\}<\/Text>/
  );

  assert.match(catalogSource, /"today\.floorNotes\.noteTitle\.none": "Task"/);
  assert.match(catalogSource, /"today\.floorNotes\.noteTitle\.none": "Tarea"/);
  assert.match(catalogSource, /"today\.floorNotes\.noteTitle\.none": "任务"/);

  // Leave row a11y note.title always-pass alone on this tip (#1084 owns it).
  assert.match(
    todaySource,
    /accessibilityLabel=\{t\("today\.floorNotes\.rowAccessibility", \{ title: note\.title \}\)/
  );
  assert.doesNotMatch(todaySource, /normalizeTodayFloorNotesRowTitle\(/);
  assert.doesNotMatch(todaySource, /presentationTodayFloorNotesRowTitleIdentity/);
  assert.doesNotMatch(todaySource, /normalizeFloorNoteTitle\(/);
  assert.doesNotMatch(todaySource, /floorNotesTitleIdentity/);
  assert.doesNotMatch(todaySource, /normalizeFloorNoteBody\(/);
  assert.doesNotMatch(todaySource, /floorNotesBodyIdentity/);
  assert.doesNotMatch(todaySource, /normalizeHomeTaskRowTitleDisplay\(/);
  assert.doesNotMatch(todaySource, /normalizeOperatingPlanTaskTitleDisplay\(/);

  assert.equal(filePresence(floorNotesRowTitleIdentityPath), "absent");
  assert.equal(filePresence(floorNotesTitleIdentityPath), "absent");
  assert.equal(filePresence(floorNotesBodyIdentityPath), "absent");
  assert.equal(filePresence(homeTaskRowTitleDisplayIdentityPath), "absent");
  assert.equal(filePresence(operatingPlanTaskTitleDisplayIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationTodayFloorNotesRowTitleIdentity/);
  assert.doesNotMatch(identityCode, /floorNotesTitleIdentity/);
  assert.doesNotMatch(identityCode, /floorNotesBodyIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeTaskRowTitleDisplayIdentity/);
  assert.doesNotMatch(identityCode, /presentationOperatingPlanTaskTitleDisplayIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeTodayFloorNotesTitleDisplay(title), title);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(` ${title} `), title);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Today floor-notes display titles", () => {
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
  assert.equal(asciiTrimTodayFloorNotesTitleDisplay(padded), padded);
  assert.equal(canonicalizeTodayFloorNotesTitleDisplay(padded), null);
  assert.equal(canonicalizeTodayFloorNotesTitleDisplay(nbspTitle), null);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(padded), null);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(nbspTitle), null);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeTodayFloorNotesTitleDisplay(internalEm), internalEm);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(internalNbsp), internalNbsp);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Today floor-notes display titles", () => {
  assert.equal(normalizeTodayFloorNotesTitleDisplay(undefined), null);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(null), null);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(""), null);
  assert.equal(normalizeTodayFloorNotesTitleDisplay("   "), null);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(123 as unknown as string), null);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeTodayFloorNotesTitleDisplay(`${title}\t`), title);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(`${title}\u0007`), null);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(em), null);
});

test("Today floor-notes display bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass path still rendered blank-looking title into card Text.
  assert.equal(normalizeTodayFloorNotesTitleDisplay(""), null);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(em), null);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    todaySource,
    /normalizeTodayFloorNotesTitleDisplay\(note\.title\)\s*\|\|\s*t\("today\.floorNotes\.noteTitle\.none"\)/
  );
});

test("Today floor-notes display note.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimTodayFloorNotesTitleDisplay(padded), padded.trim());
  assert.equal(normalizeTodayFloorNotesTitleDisplay(padded), null);
  assert.equal(normalizeTodayFloorNotesTitleDisplay(`\t${title}\n`), title);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalTodayFloorNotesBodyDisplay,
  normalizeTodayFloorNotesBodyDisplay
} from "../services/domain/presentationTodayFloorNotesBodyDisplayIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationTodayFloorNotesBodyDisplayIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const todaySource = readFileSync(
  new URL("../app/(tabs)/today.tsx", import.meta.url),
  "utf8"
);
const floorNotesSource = readFileSync(
  new URL("../services/application/floorNotes.ts", import.meta.url),
  "utf8"
);

const floorNotesTitleDisplayIdentityPath = new URL(
  "../services/domain/presentationTodayFloorNotesTitleDisplayIdentity.ts",
  import.meta.url
);
const floorNotesRowTitleIdentityPath = new URL(
  "../services/domain/presentationTodayFloorNotesRowTitleIdentity.ts",
  import.meta.url
);
const floorNotesBodyIdentityPath = new URL(
  "../services/application/floorNotesBodyIdentity.ts",
  import.meta.url
);
const floorNotesTitleIdentityPath = new URL(
  "../services/application/floorNotesTitleIdentity.ts",
  import.meta.url
);
const createTaskListDisplayBodyIdentityPath = new URL(
  "../services/domain/presentationCreateTaskListDisplayBodyIdentity.ts",
  import.meta.url
);

const body = "Ask prep before open";
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

test("MISE-005ABZ pins Today floor-notes display note.body to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABZ/);
  assert.match(todaySource, /MISE-005ABZ/);

  assert.match(
    identitySource,
    /export function canonicalTodayFloorNotesBodyDisplay\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    todaySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationTodayFloorNotesBodyDisplayIdentity"/
  );
  assert.match(todaySource, /normalizeTodayFloorNotesBodyDisplay\(/);
  assert.match(
    todaySource,
    /const displayBody = normalizeTodayFloorNotesBodyDisplay\(note\.body\);/
  );
  assert.match(
    todaySource,
    /\{displayBody \? \(\s*<Text numberOfLines=\{2\} style=\{styles\.floorNoteDetail\}>\s*\{displayBody\}\s*<\/Text>\s*\) : null\}/
  );
  assert.doesNotMatch(
    todaySource,
    /\{note\.body \? \(\s*<Text numberOfLines=\{2\} style=\{styles\.floorNoteDetail\}>\s*\{note\.body\}\s*<\/Text>\s*\) : null\}/
  );

  // Inventing write-path still Unicode end-trims free-form floor-note bodies.
  assert.match(floorNotesSource, /value\.replace\(\/\^\\s\+\//);
  assert.match(floorNotesSource, /\.replace\(\/\\s\+\$\//);

  // Leave display title always-pass alone on this tip (#1235 owns it).
  assert.match(
    todaySource,
    /<Text style=\{styles\.floorNoteTitle\}>\{note\.title\}<\/Text>/
  );
  assert.doesNotMatch(todaySource, /normalizeTodayFloorNotesTitleDisplay\(/);
  assert.doesNotMatch(todaySource, /presentationTodayFloorNotesTitleDisplayIdentity/);

  // Leave row a11y note.title always-pass alone on this tip (#1084 owns it).
  assert.match(
    todaySource,
    /accessibilityLabel=\{t\("today\.floorNotes\.rowAccessibility", \{ title: note\.title \}\)/
  );
  assert.doesNotMatch(todaySource, /normalizeTodayFloorNotesRowTitle\(/);
  assert.doesNotMatch(todaySource, /presentationTodayFloorNotesRowTitleIdentity/);
  assert.doesNotMatch(todaySource, /normalizeFloorNoteBody\(/);
  assert.doesNotMatch(todaySource, /floorNotesBodyIdentity/);
  assert.doesNotMatch(todaySource, /normalizeFloorNoteTitle\(/);
  assert.doesNotMatch(todaySource, /floorNotesTitleIdentity/);
  assert.doesNotMatch(todaySource, /normalizeCreateTaskListDisplayBody\(/);
  assert.doesNotMatch(todaySource, /presentationCreateTaskListDisplayBodyIdentity/);

  assert.equal(filePresence(floorNotesTitleDisplayIdentityPath), "absent");
  assert.equal(filePresence(floorNotesRowTitleIdentityPath), "absent");
  assert.equal(filePresence(floorNotesBodyIdentityPath), "absent");
  assert.equal(filePresence(floorNotesTitleIdentityPath), "absent");
  assert.equal(filePresence(createTaskListDisplayBodyIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationTodayFloorNotesTitleDisplayIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayFloorNotesRowTitleIdentity/);
  assert.doesNotMatch(identityCode, /floorNotesBodyIdentity/);
  assert.doesNotMatch(identityCode, /floorNotesTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationCreateTaskListDisplayBodyIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeTodayFloorNotesBodyDisplay(body), body);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(` ${body} `), body);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(`Case-${body}`), `Case-${body}`);
});

test("Unicode padding invents via trim and is soft-nulled for Today floor-notes display bodies", () => {
  const padded = `${em}${body}${em}`;
  const nbspBody = `${nbsp}${body}${nbsp}`;
  const internalEm = `Ask${em}prep before open`;
  const internalNbsp = `Ask${nbsp}prep before open`;
  const multiline = `Ask prep\nbefore open`;

  // Inventing proof: Unicode trim / write-path \s end-trim invent clean body.
  assert.equal(padded.trim(), body);
  assert.equal(nbspBody.trim(), body);
  assert.equal(padded.replace(/^\s+/, "").replace(/\s+$/, ""), body);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspBody), true);
  assert.equal(Boolean(em), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalTodayFloorNotesBodyDisplay(padded), padded);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(padded), null);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(padded) || null, null);

  // End NBSP folds to plain space then C-trims to the clean body (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeTodayFloorNotesBodyDisplay(nbspBody), body);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeTodayFloorNotesBodyDisplay(internalEm), internalEm);
  assert.equal(
    normalizeTodayFloorNotesBodyDisplay(internalNbsp),
    "Ask prep before open"
  );
  assert.equal(normalizeTodayFloorNotesBodyDisplay(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Today floor-notes display bodies", () => {
  assert.equal(normalizeTodayFloorNotesBodyDisplay(undefined), null);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(null), null);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(""), null);
  assert.equal(normalizeTodayFloorNotesBodyDisplay("   "), null);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(123 as unknown as string), null);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(`\u0001${body}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeTodayFloorNotesBodyDisplay(`${body}\t`), body);
  // Allowed multiline controls survive; other C0 / DEL soft-null.
  assert.equal(normalizeTodayFloorNotesBodyDisplay(`${body}\nnext`), `${body}\nnext`);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(`${body}\u0007`), null);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(em), null);
});

test("Today floor-notes display bypass proof: empty and Unicode-only-space bodies soft-null to omit", () => {
  // Prior truthy always-pass path still rendered blank-looking body into detail Text.
  assert.equal(normalizeTodayFloorNotesBodyDisplay(""), null);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(em), null);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(nbsp), null);
  const missingBody: string | null | undefined = undefined;
  const unicodeOnlyBody: string | null | undefined = em;
  assert.equal(missingBody ? "shown" : "hidden", "hidden");
  assert.equal(unicodeOnlyBody ? "shown" : "hidden", "shown");
  assert.equal(Boolean(unicodeOnlyBody), true);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(unicodeOnlyBody) ? "shown" : "hidden", "hidden");
  assert.match(
    todaySource,
    /const displayBody = normalizeTodayFloorNotesBodyDisplay\(note\.body\);/
  );
  assert.match(
    todaySource,
    /\{displayBody \? \(\s*<Text numberOfLines=\{2\} style=\{styles\.floorNoteDetail\}>\s*\{displayBody\}\s*<\/Text>\s*\) : null\}/
  );
});

test("Today floor-notes display note.body identity refuses Unicode inventing equality", () => {
  const padded = `${em}${body}${em}`;
  assert.notEqual(canonicalTodayFloorNotesBodyDisplay(padded), padded.trim());
  assert.equal(normalizeTodayFloorNotesBodyDisplay(padded), null);
  assert.equal(normalizeTodayFloorNotesBodyDisplay(`\t${body}\n`), body);
});

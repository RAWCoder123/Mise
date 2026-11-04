import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOperatingPlanTaskDetail,
  canonicalizeOperatingPlanTaskDetail,
  normalizeOperatingPlanTaskDetail
} from "../services/domain/presentationOperatingPlanTaskDetailIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationOperatingPlanTaskDetailIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../components/operations/OperatingPlanTimeline.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const detail = "Walk fridge before open";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XR pins Operating Plan Timeline a11y presentation.detail to ASCII C", () => {
  assert.match(identitySource, /MISE-005XR/);
  assert.match(screenSource, /MISE-005XR/);

  assert.match(
    identitySource,
    /export function asciiTrimOperatingPlanTaskDetail\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationOperatingPlanTaskDetailIdentity"/
  );
  assert.match(screenSource, /normalizeOperatingPlanTaskDetail\(/);
  assert.match(
    screenSource,
    /normalizeOperatingPlanTaskDetail\(presentation\.detail\)\s*\|\|\s*t\("today\.task\.detail\.none"\)/
  );
  assert.match(
    screenSource,
    /t\("today\.task\.accessibility", \{\s*title: presentation\.title,\s*(?:\/\/[^\n]*\n\s*)*detail:\s*normalizeOperatingPlanTaskDetail\(presentation\.detail\)\s*\|\|\s*t\("today\.task\.detail\.none"\),\s*action: actionLabel\s*\}\)/
  );
  assert.doesNotMatch(
    screenSource,
    /accessibilityLabel=\{t\("today\.task\.accessibility", \{\s*title: presentation\.title,\s*detail: presentation\.detail,/
  );

  assert.match(catalogSource, /"today\.task\.detail\.none": "Details"/);
  assert.match(catalogSource, /"today\.task\.detail\.none": "Detalles"/);
  assert.match(catalogSource, /"today\.task\.detail\.none": "详情"/);

  // Leave display Text, title a11y chrome, and sibling tipped modules alone.
  assert.match(screenSource, /\{presentation\.title\}/);
  assert.match(screenSource, /title: presentation\.title,/);
  assert.doesNotMatch(screenSource, /normalizeOperatingPlanTaskTitle\(/);
  assert.doesNotMatch(screenSource, /normalizeCreateTaskListRowTitle\(/);
  assert.doesNotMatch(identitySource, /presentationOperatingPlanTaskTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationCreateTaskListRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyPhaseBriefFindingTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityExpandTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeOperatingPlanTaskDetail(detail), detail);
  assert.equal(normalizeOperatingPlanTaskDetail(` ${detail} `), detail);
  assert.equal(normalizeOperatingPlanTaskDetail(`Case-${detail}`), `Case-${detail}`);
});

test("Unicode padding invents via trim and is soft-nulled for Operating Plan Timeline a11y details", () => {
  const padded = `${em}${detail}${em}`;
  const nbspDetail = `${nbsp}${detail}${nbsp}`;
  const internalEm = `Walk${em}fridge before open`;
  const internalNbsp = `Walk${nbsp}fridge before open`;

  // Inventing proof: Unicode trim would invent the clean task detail.
  assert.equal(padded.trim(), detail);
  assert.equal(nbspDetail.trim(), detail);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspDetail), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimOperatingPlanTaskDetail(padded), padded);
  assert.equal(canonicalizeOperatingPlanTaskDetail(padded), null);
  assert.equal(canonicalizeOperatingPlanTaskDetail(nbspDetail), null);
  assert.equal(normalizeOperatingPlanTaskDetail(padded), null);
  assert.equal(normalizeOperatingPlanTaskDetail(nbspDetail), null);
  assert.equal(normalizeOperatingPlanTaskDetail(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeOperatingPlanTaskDetail(internalEm), internalEm);
  assert.equal(normalizeOperatingPlanTaskDetail(internalNbsp), internalNbsp);
  assert.equal(normalizeOperatingPlanTaskDetail(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Operating Plan Timeline a11y details", () => {
  assert.equal(normalizeOperatingPlanTaskDetail(undefined), null);
  assert.equal(normalizeOperatingPlanTaskDetail(null), null);
  assert.equal(normalizeOperatingPlanTaskDetail(""), null);
  assert.equal(normalizeOperatingPlanTaskDetail("   "), null);
  assert.equal(normalizeOperatingPlanTaskDetail(123 as unknown as string), null);
  assert.equal(normalizeOperatingPlanTaskDetail(`\u0001${detail}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeOperatingPlanTaskDetail(`${detail}\t`), detail);
  assert.equal(normalizeOperatingPlanTaskDetail(`${detail}\u0007`), null);
  assert.equal(normalizeOperatingPlanTaskDetail(em), null);
});

test("Operating Plan Timeline a11y bypass proof: empty and Unicode-only-space details soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking detail into a11y.
  assert.equal(normalizeOperatingPlanTaskDetail(""), null);
  assert.equal(normalizeOperatingPlanTaskDetail(em), null);
  assert.equal(normalizeOperatingPlanTaskDetail(nbsp), null);
  const missingDetail: string | null | undefined = undefined;
  const unicodeOnlyDetail: string | null | undefined = em;
  assert.equal(missingDetail ?? "", "");
  assert.equal(unicodeOnlyDetail ?? "", em);
  assert.notEqual(unicodeOnlyDetail ?? "", "");
  assert.equal(Boolean(unicodeOnlyDetail), true);
  assert.match(
    screenSource,
    /normalizeOperatingPlanTaskDetail\(presentation\.detail\)\s*\|\|\s*t\("today\.task\.detail\.none"\)/
  );
});

test("Operating Plan Timeline a11y presentation.detail identity refuses Unicode inventing equality", () => {
  const padded = `${em}${detail}${em}`;
  assert.notEqual(asciiTrimOperatingPlanTaskDetail(padded), padded.trim());
  assert.equal(normalizeOperatingPlanTaskDetail(padded), null);
  assert.equal(normalizeOperatingPlanTaskDetail(`\t${detail}\n`), detail);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOutreachString,
  requireCanonicalOutreachString
} from "../supabase/functions/_shared/outreachStringIdentity.ts";

const outreachStringIdentitySource = readFileSync(
  new URL("../supabase/functions/_shared/outreachStringIdentity.ts", import.meta.url),
  "utf8"
);
const outreachSource = readFileSync(
  new URL("../supabase/functions/outreach-agent/index.ts", import.meta.url),
  "utf8"
);
const miseSource = readFileSync(
  new URL("../supabase/functions/_shared/mise.ts", import.meta.url),
  "utf8"
);

const ACTION = "create_campaign" as const;
const CAMPAIGN_NAME = "Pilot outreach" as const;

test("MISE-005KU pins outreach-agent local requireString to ASCII C", () => {
  assert.match(outreachStringIdentitySource, /MISE-005KU/);
  assert.match(outreachSource, /MISE-005KU/);
  assert.match(outreachSource, /requireCanonicalOutreachString/);

  const requireBody = outreachSource.slice(
    outreachSource.indexOf(
      "function requireString(value: unknown, fieldName: string, maximumLength: number)"
    ),
    outreachSource.indexOf(
      "function optionalString(value: unknown, fieldName: string, maximumLength: number)"
    )
  );
  assert.match(requireBody, /requireCanonicalOutreachString\(value, fieldName, maximumLength\)/);
  assert.doesNotMatch(requireBody, /\.trim\(\)/);
  assert.doesNotMatch(requireBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(requireBody, /\.toLocaleLowerCase\(\)/);

  // Do not retarget shared mise.ts requireString from this tip (MISE-005KT).
  const miseRequireBody = miseSource.slice(
    miseSource.indexOf("export function requireString(value: unknown, fieldName: string)"),
    miseSource.indexOf("export function requireUuid(value: unknown, fieldName: string)")
  );
  assert.match(miseRequireBody, /\.trim\(\)/);
  assert.doesNotMatch(miseRequireBody, /requireCanonicalOutreachString/);
  assert.doesNotMatch(miseRequireBody, /requireCanonicalEdgeString/);

  // Do not retarget local requireUuid from this tip (MISE-005KQ).
  const uuidBody = outreachSource.slice(
    outreachSource.indexOf("function requireUuid(value: unknown, fieldName: string)"),
    outreachSource.indexOf("function requireUuidArray")
  );
  assert.match(uuidBody, /requireString\(/);
  assert.doesNotMatch(uuidBody, /requireCanonicalEdgeUuid/);
});

test("ASCII trim keeps ordinary outreach string identity stable", () => {
  assert.equal(asciiTrimOutreachString(`  ${ACTION}  `), ACTION);
  assert.equal(requireCanonicalOutreachString(`  ${ACTION}  `, "action", 60), ACTION);
  assert.equal(
    requireCanonicalOutreachString(`  ${CAMPAIGN_NAME}  `, "campaign.name", 160),
    CAMPAIGN_NAME
  );
});

test("ASCII string trim ignores NBSP; Unicode trim would invent outreach identity", () => {
  const nbspPaddedAction = `\u00a0${ACTION}\u00a0`;
  // Unicode trim invents an exact match against the outreach action.
  assert.equal(nbspPaddedAction.trim(), ACTION);
  assert.notEqual(asciiTrimOutreachString(nbspPaddedAction), ACTION);
  assert.equal(requireCanonicalOutreachString(nbspPaddedAction, "action", 60), nbspPaddedAction);

  const emSpacePaddedName = `\u2003${CAMPAIGN_NAME}\u2003`;
  assert.equal(emSpacePaddedName.trim(), CAMPAIGN_NAME);
  assert.notEqual(asciiTrimOutreachString(emSpacePaddedName), CAMPAIGN_NAME);
  assert.equal(
    requireCanonicalOutreachString(emSpacePaddedName, "campaign.name", 160),
    emSpacePaddedName
  );

  // Length budget counts preserved Unicode padding — padded inventing paths
  // that collapse under Unicode trim stay fail-closed when over budget.
  const overBudget = `\u00a0${"x".repeat(60)}\u00a0`;
  assert.equal(overBudget.trim().length, 60);
  assert.throws(
    () => requireCanonicalOutreachString(overBudget, "action", 60),
    (error: unknown) =>
      error instanceof Error && /must contain 1-60 characters/i.test(error.message)
  );
});

test("empty-after-ASCII-trim still fails closed as required", () => {
  assert.throws(
    () => requireCanonicalOutreachString("   ", "action", 60),
    (error: unknown) =>
      error instanceof Error && /must contain 1-60 characters/i.test(error.message)
  );
  assert.throws(
    () => requireCanonicalOutreachString(null, "action", 60),
    (error: unknown) => error instanceof Error && /is required/i.test(error.message)
  );
});

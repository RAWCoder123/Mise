import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimActivityRelatedEntityType,
  canonicalizeActivityRelatedEntityType,
  normalizeActivityRelatedEntityType
} from "../services/domain/presentationActivityRelatedEntityTypeIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationActivityRelatedEntityTypeIdentity.ts", import.meta.url),
  "utf8"
);
const activitySource = readFileSync(
  new URL("../app/more/activity.tsx", import.meta.url),
  "utf8"
);
const relatedEntityIdIdentityPath = new URL(
  "../services/domain/presentationActivityRelatedEntityIdIdentity.ts",
  import.meta.url
);
const actionIdIdentityPath = new URL(
  "../services/domain/presentationActivityActionIdIdentity.ts",
  import.meta.url
);
const triggerReferenceIdentityPath = new URL(
  "../services/domain/presentationActivityTriggerReferenceIdentity.ts",
  import.meta.url
);
const relatedEntityTypeCntrlLocalePinPath = new URL(
  "../tests/activityEventsRelatedEntityTypeCntrlLocalePin.test.ts",
  import.meta.url
);

const relatedEntityType = "purchase_order";
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

test("MISE-005AAO pins Activity relatedEntityType to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAO/);
  assert.match(activitySource, /MISE-005AAO/);

  assert.match(
    identitySource,
    /export function asciiTrimActivityRelatedEntityType\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    activitySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationActivityRelatedEntityTypeIdentity"/
  );
  assert.match(activitySource, /normalizeActivityRelatedEntityType\(/);
  assert.match(activitySource, /activityRelatedDisplayEntityType/);
  assert.match(
    activitySource,
    /activityRelatedDisplayEntityType\s*\?\s*\(\s*<Text[\s\S]*?\{activityRelatedDisplayEntityType\.replace\(\/_\/g, " "\)\}[\s\S]*?\)\s*:\s*null/
  );
  assert.doesNotMatch(
    activitySource,
    /event\.relatedEntityType \? \(\s*<Text[\s\S]*?\{event\.relatedEntityType\.replace/
  );

  // Leave sibling relatedEntityId / actionId / triggerReference tips alone.
  assert.doesNotMatch(activitySource, /normalizeActivityRelatedEntityId/);
  assert.doesNotMatch(activitySource, /normalizeActivityActionId/);
  assert.doesNotMatch(activitySource, /normalizeActivityTriggerReference/);
  assert.doesNotMatch(identitySource, /presentationActivityRelatedEntityIdIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityActionIdIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityTriggerReferenceIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(relatedEntityIdIdentityPath), "absent");
  assert.equal(filePresence(actionIdIdentityPath), "absent");
  assert.equal(filePresence(triggerReferenceIdentityPath), "absent");
  // #572 cntrl CHECK tip stays a separate migration tip and is not landed on
  // main; this presentation tip must not ship or depend on that test module.
  assert.equal(filePresence(relatedEntityTypeCntrlLocalePinPath), "absent");

  // Leave relatedEntityId / actionId / triggerReference still on prior always-pass paths (main).
  assert.match(activitySource, /event\.relatedEntityId \? ` · \$\{event\.relatedEntityId\}` : ""/);
  assert.match(activitySource, /event\.actionId \? \(\s*<Text[\s\S]*?\{event\.actionId\}/);
  assert.match(activitySource, /event\.triggerReference \? ` · \$\{event\.triggerReference\}` : ""/);

  assert.equal(normalizeActivityRelatedEntityType(relatedEntityType), relatedEntityType);
  assert.equal(normalizeActivityRelatedEntityType(` ${relatedEntityType} `), relatedEntityType);
  assert.equal(
    normalizeActivityRelatedEntityType(`type ${relatedEntityType}`),
    `type ${relatedEntityType}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Activity relatedEntityType", () => {
  const padded = `${em}${relatedEntityType}${em}`;
  const nbspName = `${nbsp}${relatedEntityType}${nbsp}`;
  const internalEm = `purchase${em}order`;
  const internalNbsp = `purchase${nbsp}order`;

  // Inventing proof: Unicode trim would invent the clean related-entity type.
  assert.equal(padded.trim(), relatedEntityType);
  assert.equal(nbspName.trim(), relatedEntityType);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // Prior always-pass truthy gate would still render blank-looking / padded type.
  assert.equal(Boolean(padded.trim()), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimActivityRelatedEntityType(padded), padded);
  assert.equal(canonicalizeActivityRelatedEntityType(padded), null);
  assert.equal(canonicalizeActivityRelatedEntityType(nbspName), null);
  assert.equal(normalizeActivityRelatedEntityType(padded), null);
  assert.equal(normalizeActivityRelatedEntityType(nbspName), null);
  assert.equal(normalizeActivityRelatedEntityType(padded) || "", "");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeActivityRelatedEntityType(internalEm), internalEm);
  assert.equal(normalizeActivityRelatedEntityType(internalNbsp), internalNbsp);
  assert.equal(normalizeActivityRelatedEntityType(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Activity relatedEntityType", () => {
  assert.equal(normalizeActivityRelatedEntityType(undefined), null);
  assert.equal(normalizeActivityRelatedEntityType(null), null);
  assert.equal(normalizeActivityRelatedEntityType(""), null);
  assert.equal(normalizeActivityRelatedEntityType("   "), null);
  assert.equal(normalizeActivityRelatedEntityType(123 as unknown as string), null);
  assert.equal(normalizeActivityRelatedEntityType(`\u0001${relatedEntityType}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeActivityRelatedEntityType(`${relatedEntityType}\t`), relatedEntityType);
  assert.equal(normalizeActivityRelatedEntityType(`${relatedEntityType}\u0007`), null);
  assert.equal(normalizeActivityRelatedEntityType(em), null);
});

test("Activity relatedEntityType bypass proof: empty and Unicode-only-space soft-null to omit", () => {
  // Prior always-pass truthy path still rendered blank-looking related
  // identity in related detail (`"Related:  "`). Soft-null restores omit.
  assert.equal(normalizeActivityRelatedEntityType(""), null);
  assert.equal(normalizeActivityRelatedEntityType(em), null);
  assert.equal(normalizeActivityRelatedEntityType(nbsp), null);
  assert.match(
    activitySource,
    /activityRelatedDisplayEntityType\s*\?\s*\(\s*<Text[\s\S]*?\{activityRelatedDisplayEntityType\.replace/
  );
  assert.match(
    activitySource,
    /normalizeActivityRelatedEntityType\(\s*event\.relatedEntityType\s*\)/
  );
});

test("Activity relatedEntityType identity refuses Unicode inventing equality", () => {
  const padded = `${em}${relatedEntityType}${em}`;
  assert.notEqual(asciiTrimActivityRelatedEntityType(padded), padded.trim());
  assert.equal(normalizeActivityRelatedEntityType(padded), null);
  assert.equal(normalizeActivityRelatedEntityType(`\t${relatedEntityType}\n`), relatedEntityType);
});

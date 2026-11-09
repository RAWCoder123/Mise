import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimActivityTriggerType,
  canonicalizeActivityTriggerType,
  normalizeActivityTriggerType
} from "../services/domain/presentationActivityTriggerTypeIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationActivityTriggerTypeIdentity.ts", import.meta.url),
  "utf8"
);
const activitySource = readFileSync(
  new URL("../app/more/activity.tsx", import.meta.url),
  "utf8"
);
const triggerReferenceIdentityPath = new URL(
  "../services/domain/presentationActivityTriggerReferenceIdentity.ts",
  import.meta.url
);
const relatedEntityTypeIdentityPath = new URL(
  "../services/domain/presentationActivityRelatedEntityTypeIdentity.ts",
  import.meta.url
);
const relatedEntityIdIdentityPath = new URL(
  "../services/domain/presentationActivityRelatedEntityIdIdentity.ts",
  import.meta.url
);
const actionIdIdentityPath = new URL(
  "../services/domain/presentationActivityActionIdIdentity.ts",
  import.meta.url
);
const triggerTypeCntrlLocalePinPath = new URL(
  "../tests/activityEventsTriggerTypeCntrlLocalePin.test.ts",
  import.meta.url
);

const triggerType = "pos_sync";
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

test("MISE-005AAP pins Activity triggerType to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAP/);
  assert.match(activitySource, /MISE-005AAP/);

  assert.match(
    identitySource,
    /export function asciiTrimActivityTriggerType\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    activitySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationActivityTriggerTypeIdentity"/
  );
  assert.match(activitySource, /normalizeActivityTriggerType\(/);
  assert.match(activitySource, /activityTriggerDisplayType/);
  assert.match(
    activitySource,
    /normalizeActivityTriggerType\(\s*event\.triggerType\s*\)\s*\?\?\s*""/
  );
  assert.match(
    activitySource,
    /\{t\("activity\.detail\.trigger"\)\}: \{activityTriggerDisplayType\}/
  );
  assert.doesNotMatch(
    activitySource,
    /\{t\("activity\.detail\.trigger"\)\}: \{event\.triggerType\}/
  );

  // Leave sibling triggerReference / relatedEntityType / relatedEntityId /
  // actionId tips alone.
  assert.doesNotMatch(activitySource, /normalizeActivityTriggerReference/);
  assert.doesNotMatch(activitySource, /normalizeActivityRelatedEntityType/);
  assert.doesNotMatch(activitySource, /normalizeActivityRelatedEntityId/);
  assert.doesNotMatch(activitySource, /normalizeActivityActionId/);
  assert.doesNotMatch(identitySource, /presentationActivityTriggerReferenceIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityRelatedEntityTypeIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityRelatedEntityIdIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityActionIdIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(triggerReferenceIdentityPath), "absent");
  assert.equal(filePresence(relatedEntityTypeIdentityPath), "absent");
  assert.equal(filePresence(relatedEntityIdIdentityPath), "absent");
  assert.equal(filePresence(actionIdIdentityPath), "absent");
  // #568 cntrl CHECK tip stays a separate migration tip and is not landed on
  // main; this presentation tip must not ship or depend on that test module.
  assert.equal(filePresence(triggerTypeCntrlLocalePinPath), "absent");

  // Leave triggerReference / relatedEntityType / relatedEntityId / actionId
  // still on prior always-pass paths (main).
  assert.match(activitySource, /event\.triggerReference \? ` · \$\{event\.triggerReference\}` : ""/);
  assert.match(
    activitySource,
    /event\.relatedEntityType \? \(\s*<Text[\s\S]*?\{event\.relatedEntityType\.replace/
  );
  assert.match(activitySource, /event\.relatedEntityId \? ` · \$\{event\.relatedEntityId\}` : ""/);
  assert.match(activitySource, /event\.actionId \? \(\s*<Text[\s\S]*?\{event\.actionId\}/);

  assert.equal(normalizeActivityTriggerType(triggerType), triggerType);
  assert.equal(normalizeActivityTriggerType(` ${triggerType} `), triggerType);
  assert.equal(normalizeActivityTriggerType(`type ${triggerType}`), `type ${triggerType}`);
});

test("Unicode padding invents via trim and is soft-nulled for Activity triggerType", () => {
  const padded = `${em}${triggerType}${em}`;
  const nbspName = `${nbsp}${triggerType}${nbsp}`;
  const internalEm = `pos${em}sync`;
  const internalNbsp = `pos${nbsp}sync`;

  // Inventing proof: Unicode trim would invent the clean trigger type.
  assert.equal(padded.trim(), triggerType);
  assert.equal(nbspName.trim(), triggerType);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // Prior always-pass path would still render blank-looking / padded type.
  assert.equal(Boolean(padded.trim()), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimActivityTriggerType(padded), padded);
  assert.equal(canonicalizeActivityTriggerType(padded), null);
  assert.equal(canonicalizeActivityTriggerType(nbspName), null);
  assert.equal(normalizeActivityTriggerType(padded), null);
  assert.equal(normalizeActivityTriggerType(nbspName), null);
  assert.equal(normalizeActivityTriggerType(padded) || "", "");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeActivityTriggerType(internalEm), internalEm);
  assert.equal(normalizeActivityTriggerType(internalNbsp), internalNbsp);
  assert.equal(normalizeActivityTriggerType(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Activity triggerType", () => {
  assert.equal(normalizeActivityTriggerType(undefined), null);
  assert.equal(normalizeActivityTriggerType(null), null);
  assert.equal(normalizeActivityTriggerType(""), null);
  assert.equal(normalizeActivityTriggerType("   "), null);
  assert.equal(normalizeActivityTriggerType(123 as unknown as string), null);
  assert.equal(normalizeActivityTriggerType(`\u0001${triggerType}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeActivityTriggerType(`${triggerType}\t`), triggerType);
  assert.equal(normalizeActivityTriggerType(`${triggerType}\u0007`), null);
  assert.equal(normalizeActivityTriggerType(em), null);
});

test("Activity triggerType bypass proof: empty and Unicode-only-space soft-null to empty-type", () => {
  // Prior always-pass path still rendered blank-looking trigger identity in
  // trigger detail (`"Trigger:  "`). Soft-null restores empty-type display.
  assert.equal(normalizeActivityTriggerType(""), null);
  assert.equal(normalizeActivityTriggerType(em), null);
  assert.equal(normalizeActivityTriggerType(nbsp), null);
  assert.match(
    activitySource,
    /normalizeActivityTriggerType\(\s*event\.triggerType\s*\)\s*\?\?\s*""/
  );
  assert.match(
    activitySource,
    /\{t\("activity\.detail\.trigger"\)\}: \{activityTriggerDisplayType\}/
  );
});

test("Activity triggerType identity refuses Unicode inventing equality", () => {
  const padded = `${em}${triggerType}${em}`;
  assert.notEqual(asciiTrimActivityTriggerType(padded), padded.trim());
  assert.equal(normalizeActivityTriggerType(padded), null);
  assert.equal(normalizeActivityTriggerType(`\t${triggerType}\n`), triggerType);
});

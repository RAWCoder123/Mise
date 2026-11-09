import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimActivityActionId,
  canonicalizeActivityActionId,
  normalizeActivityActionId
} from "../services/domain/presentationActivityActionIdIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationActivityActionIdIdentity.ts", import.meta.url),
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
const triggerReferenceIdentityPath = new URL(
  "../services/domain/presentationActivityTriggerReferenceIdentity.ts",
  import.meta.url
);
const deliveriesLineUnitIdentityPath = new URL(
  "../services/domain/presentationDailyReportDeliveriesLineUnitIdentity.ts",
  import.meta.url
);

const actionId = "act_8e2b4f71";
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

test("MISE-005AAN pins Activity actionId to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAN/);
  assert.match(activitySource, /MISE-005AAN/);

  assert.match(
    identitySource,
    /export function asciiTrimActivityActionId\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    activitySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationActivityActionIdIdentity"/
  );
  assert.match(activitySource, /normalizeActivityActionId\(/);
  assert.match(activitySource, /activityActionDisplayId/);
  assert.match(
    activitySource,
    /activityActionDisplayId\s*\?\s*\(\s*<Text[\s\S]*?\{activityActionDisplayId\}[\s\S]*?\)\s*:\s*null/
  );
  assert.doesNotMatch(
    activitySource,
    /event\.actionId \? \(\s*<Text[\s\S]*?\{event\.actionId\}/
  );

  // Leave sibling relatedEntityId / triggerReference / deliveries unit tips alone.
  assert.doesNotMatch(activitySource, /normalizeActivityRelatedEntityId/);
  assert.doesNotMatch(activitySource, /normalizeActivityTriggerReference/);
  assert.doesNotMatch(activitySource, /normalizeDailyReportDeliveriesLineUnit/);
  assert.doesNotMatch(identitySource, /presentationActivityRelatedEntityIdIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityTriggerReferenceIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportDeliveriesLineUnitIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(relatedEntityIdIdentityPath), "absent");
  assert.equal(filePresence(triggerReferenceIdentityPath), "absent");
  assert.equal(filePresence(deliveriesLineUnitIdentityPath), "absent");

  // Leave relatedEntityId / triggerReference still on prior always-pass paths (main).
  assert.match(activitySource, /event\.relatedEntityId \? ` · \$\{event\.relatedEntityId\}` : ""/);
  assert.match(activitySource, /event\.triggerReference \? ` · \$\{event\.triggerReference\}` : ""/);

  assert.equal(normalizeActivityActionId(actionId), actionId);
  assert.equal(normalizeActivityActionId(` ${actionId} `), actionId);
  assert.equal(normalizeActivityActionId(`id ${actionId}`), `id ${actionId}`);
});

test("Unicode padding invents via trim and is soft-nulled for Activity actionId", () => {
  const padded = `${em}${actionId}${em}`;
  const nbspName = `${nbsp}${actionId}${nbsp}`;
  const internalEm = `act${em}8e2b4f71`;
  const internalNbsp = `act${nbsp}8e2b4f71`;

  // Inventing proof: Unicode trim would invent the clean action id.
  assert.equal(padded.trim(), actionId);
  assert.equal(nbspName.trim(), actionId);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // Prior always-pass truthy gate would still render blank-looking / padded id.
  assert.equal(Boolean(padded.trim()), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimActivityActionId(padded), padded);
  assert.equal(canonicalizeActivityActionId(padded), null);
  assert.equal(canonicalizeActivityActionId(nbspName), null);
  assert.equal(normalizeActivityActionId(padded), null);
  assert.equal(normalizeActivityActionId(nbspName), null);
  assert.equal(normalizeActivityActionId(padded) || "", "");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeActivityActionId(internalEm), internalEm);
  assert.equal(normalizeActivityActionId(internalNbsp), internalNbsp);
  assert.equal(normalizeActivityActionId(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Activity actionId", () => {
  assert.equal(normalizeActivityActionId(undefined), null);
  assert.equal(normalizeActivityActionId(null), null);
  assert.equal(normalizeActivityActionId(""), null);
  assert.equal(normalizeActivityActionId("   "), null);
  assert.equal(normalizeActivityActionId(123 as unknown as string), null);
  assert.equal(normalizeActivityActionId(`\u0001${actionId}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeActivityActionId(`${actionId}\t`), actionId);
  assert.equal(normalizeActivityActionId(`${actionId}\u0007`), null);
  assert.equal(normalizeActivityActionId(em), null);
});

test("Activity actionId bypass proof: empty and Unicode-only-space soft-null to omit", () => {
  // Prior always-pass truthy path still rendered blank-looking action
  // identity in action detail (`"Action:  "`). Soft-null restores omit.
  assert.equal(normalizeActivityActionId(""), null);
  assert.equal(normalizeActivityActionId(em), null);
  assert.equal(normalizeActivityActionId(nbsp), null);
  assert.match(
    activitySource,
    /activityActionDisplayId\s*\?\s*\(\s*<Text[\s\S]*?\{activityActionDisplayId\}/
  );
  assert.match(activitySource, /normalizeActivityActionId\(\s*event\.actionId\s*\)/);
});

test("Activity actionId identity refuses Unicode inventing equality", () => {
  const padded = `${em}${actionId}${em}`;
  assert.notEqual(asciiTrimActivityActionId(padded), padded.trim());
  assert.equal(normalizeActivityActionId(padded), null);
  assert.equal(normalizeActivityActionId(`\t${actionId}\n`), actionId);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimActivityRelatedEntityId,
  canonicalizeActivityRelatedEntityId,
  normalizeActivityRelatedEntityId
} from "../services/domain/presentationActivityRelatedEntityIdIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationActivityRelatedEntityIdIdentity.ts", import.meta.url),
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
const relatedEntityIdCntrlLocalePinPath = new URL(
  "../tests/activityEventsRelatedEntityIdCntrlLocalePin.test.ts",
  import.meta.url
);
const deliveriesLineUnitIdentityPath = new URL(
  "../services/domain/presentationDailyReportDeliveriesLineUnitIdentity.ts",
  import.meta.url
);

const relatedEntityId = "inv_9c4e1a02";
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

test("MISE-005AAM pins Activity relatedEntityId to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAM/);
  assert.match(activitySource, /MISE-005AAM/);

  assert.match(
    identitySource,
    /export function asciiTrimActivityRelatedEntityId\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    activitySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationActivityRelatedEntityIdIdentity"/
  );
  assert.match(activitySource, /normalizeActivityRelatedEntityId\(/);
  assert.match(activitySource, /activityRelatedDisplayEntityId/);
  assert.match(
    activitySource,
    /activityRelatedDisplayEntityId\s*\?\s*` · \$\{activityRelatedDisplayEntityId\}`\s*:\s*""/
  );
  assert.doesNotMatch(
    activitySource,
    /event\.relatedEntityId \? ` · \$\{event\.relatedEntityId\}` : ""/
  );

  // Leave sibling triggerReference display / deliveries unit tips alone.
  assert.doesNotMatch(activitySource, /normalizeActivityTriggerReference/);
  assert.doesNotMatch(activitySource, /normalizeDailyReportDeliveriesLineUnit/);
  assert.doesNotMatch(identitySource, /presentationActivityTriggerReferenceIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportDeliveriesLineUnitIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(triggerReferenceIdentityPath), "absent");
  assert.equal(filePresence(deliveriesLineUnitIdentityPath), "absent");
  // #573 cntrl CHECK tip stays a separate migration tip and is not landed on
  // main; this presentation tip must not ship or depend on that test module.
  assert.equal(filePresence(relatedEntityIdCntrlLocalePinPath), "absent");

  // Leave triggerReference still on the prior always-pass truthy path (main).
  assert.match(activitySource, /event\.triggerReference \? ` · \$\{event\.triggerReference\}` : ""/);

  assert.equal(normalizeActivityRelatedEntityId(relatedEntityId), relatedEntityId);
  assert.equal(normalizeActivityRelatedEntityId(` ${relatedEntityId} `), relatedEntityId);
  assert.equal(
    normalizeActivityRelatedEntityId(`id ${relatedEntityId}`),
    `id ${relatedEntityId}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Activity relatedEntityId", () => {
  const padded = `${em}${relatedEntityId}${em}`;
  const nbspName = `${nbsp}${relatedEntityId}${nbsp}`;
  const internalEm = `inv${em}9c4e1a02`;
  const internalNbsp = `inv${nbsp}9c4e1a02`;

  // Inventing proof: Unicode trim would invent the clean related-entity id.
  assert.equal(padded.trim(), relatedEntityId);
  assert.equal(nbspName.trim(), relatedEntityId);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // Prior always-pass truthy gate would still render blank-looking / padded id.
  assert.equal(Boolean(padded.trim()), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimActivityRelatedEntityId(padded), padded);
  assert.equal(canonicalizeActivityRelatedEntityId(padded), null);
  assert.equal(canonicalizeActivityRelatedEntityId(nbspName), null);
  assert.equal(normalizeActivityRelatedEntityId(padded), null);
  assert.equal(normalizeActivityRelatedEntityId(nbspName), null);
  assert.equal(normalizeActivityRelatedEntityId(padded) || "", "");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeActivityRelatedEntityId(internalEm), internalEm);
  assert.equal(normalizeActivityRelatedEntityId(internalNbsp), internalNbsp);
  assert.equal(normalizeActivityRelatedEntityId(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Activity relatedEntityId", () => {
  assert.equal(normalizeActivityRelatedEntityId(undefined), null);
  assert.equal(normalizeActivityRelatedEntityId(null), null);
  assert.equal(normalizeActivityRelatedEntityId(""), null);
  assert.equal(normalizeActivityRelatedEntityId("   "), null);
  assert.equal(normalizeActivityRelatedEntityId(123 as unknown as string), null);
  assert.equal(normalizeActivityRelatedEntityId(`\u0001${relatedEntityId}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeActivityRelatedEntityId(`${relatedEntityId}\t`), relatedEntityId);
  assert.equal(normalizeActivityRelatedEntityId(`${relatedEntityId}\u0007`), null);
  assert.equal(normalizeActivityRelatedEntityId(em), null);
});

test("Activity relatedEntityId bypass proof: empty and Unicode-only-space soft-null to omit", () => {
  // Prior always-pass truthy path still rendered blank-looking related-entity
  // identity in related detail (`"Related: inventory_item ·  "`). Soft-null
  // restores related-entity-type-only omit.
  assert.equal(normalizeActivityRelatedEntityId(""), null);
  assert.equal(normalizeActivityRelatedEntityId(em), null);
  assert.equal(normalizeActivityRelatedEntityId(nbsp), null);
  assert.match(
    activitySource,
    /activityRelatedDisplayEntityId\s*\?\s*` · \$\{activityRelatedDisplayEntityId\}`\s*:\s*""/
  );
  assert.match(
    activitySource,
    /normalizeActivityRelatedEntityId\(\s*event\.relatedEntityId\s*\)/
  );
});

test("Activity relatedEntityId identity refuses Unicode inventing equality", () => {
  const padded = `${em}${relatedEntityId}${em}`;
  assert.notEqual(asciiTrimActivityRelatedEntityId(padded), padded.trim());
  assert.equal(normalizeActivityRelatedEntityId(padded), null);
  assert.equal(normalizeActivityRelatedEntityId(`\t${relatedEntityId}\n`), relatedEntityId);
});

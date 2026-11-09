import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimActivityTriggerReference,
  canonicalizeActivityTriggerReference,
  normalizeActivityTriggerReference
} from "../services/domain/presentationActivityTriggerReferenceIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationActivityTriggerReferenceIdentity.ts", import.meta.url),
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
const triggerReferenceCntrlLocalePinPath = new URL(
  "../tests/activityEventsTriggerReferenceCntrlLocalePin.test.ts",
  import.meta.url
);
const deliveriesLineUnitIdentityPath = new URL(
  "../services/domain/presentationDailyReportDeliveriesLineUnitIdentity.ts",
  import.meta.url
);

const triggerReference = "rec_7f3a2b1c";
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

test("MISE-005AAL pins Activity triggerReference to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAL/);
  assert.match(activitySource, /MISE-005AAL/);

  assert.match(
    identitySource,
    /export function asciiTrimActivityTriggerReference\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    activitySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationActivityTriggerReferenceIdentity"/
  );
  assert.match(activitySource, /normalizeActivityTriggerReference\(/);
  assert.match(activitySource, /activityTriggerDisplayReference/);
  assert.match(
    activitySource,
    /activityTriggerDisplayReference\s*\?\s*` · \$\{activityTriggerDisplayReference\}`\s*:\s*""/
  );
  assert.doesNotMatch(
    activitySource,
    /event\.triggerReference \? ` · \$\{event\.triggerReference\}` : ""/
  );

  // Leave sibling relatedEntityId display / deliveries unit tips alone.
  assert.doesNotMatch(activitySource, /normalizeActivityRelatedEntityId/);
  assert.doesNotMatch(activitySource, /normalizeDailyReportDeliveriesLineUnit/);
  assert.doesNotMatch(identitySource, /presentationActivityRelatedEntityIdIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportDeliveriesLineUnitIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(relatedEntityIdIdentityPath), "absent");
  assert.equal(filePresence(deliveriesLineUnitIdentityPath), "absent");
  // #571 cntrl CHECK tip stays a separate migration tip and is not landed on
  // main; this presentation tip must not ship or depend on that test module.
  assert.equal(filePresence(triggerReferenceCntrlLocalePinPath), "absent");

  // Leave relatedEntityId still on the prior always-pass truthy path.
  assert.match(activitySource, /event\.relatedEntityId \? ` · \$\{event\.relatedEntityId\}` : ""/);

  assert.equal(normalizeActivityTriggerReference(triggerReference), triggerReference);
  assert.equal(normalizeActivityTriggerReference(` ${triggerReference} `), triggerReference);
  assert.equal(
    normalizeActivityTriggerReference(`ref ${triggerReference}`),
    `ref ${triggerReference}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Activity triggerReference", () => {
  const padded = `${em}${triggerReference}${em}`;
  const nbspName = `${nbsp}${triggerReference}${nbsp}`;
  const internalEm = `rec${em}7f3a2b1c`;
  const internalNbsp = `rec${nbsp}7f3a2b1c`;

  // Inventing proof: Unicode trim would invent the clean correlation ref.
  assert.equal(padded.trim(), triggerReference);
  assert.equal(nbspName.trim(), triggerReference);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // Prior always-pass truthy gate would still render blank-looking / padded ref.
  assert.equal(Boolean(padded.trim()), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimActivityTriggerReference(padded), padded);
  assert.equal(canonicalizeActivityTriggerReference(padded), null);
  assert.equal(canonicalizeActivityTriggerReference(nbspName), null);
  assert.equal(normalizeActivityTriggerReference(padded), null);
  assert.equal(normalizeActivityTriggerReference(nbspName), null);
  assert.equal(normalizeActivityTriggerReference(padded) || "", "");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeActivityTriggerReference(internalEm), internalEm);
  assert.equal(normalizeActivityTriggerReference(internalNbsp), internalNbsp);
  assert.equal(normalizeActivityTriggerReference(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Activity triggerReference", () => {
  assert.equal(normalizeActivityTriggerReference(undefined), null);
  assert.equal(normalizeActivityTriggerReference(null), null);
  assert.equal(normalizeActivityTriggerReference(""), null);
  assert.equal(normalizeActivityTriggerReference("   "), null);
  assert.equal(normalizeActivityTriggerReference(123 as unknown as string), null);
  assert.equal(normalizeActivityTriggerReference(`\u0001${triggerReference}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeActivityTriggerReference(`${triggerReference}\t`), triggerReference);
  assert.equal(normalizeActivityTriggerReference(`${triggerReference}\u0007`), null);
  assert.equal(normalizeActivityTriggerReference(em), null);
});

test("Activity triggerReference bypass proof: empty and Unicode-only-space soft-null to omit", () => {
  // Prior always-pass truthy path still rendered blank-looking correlation
  // identity in trigger detail (`"Trigger: schedule ·  "`). Soft-null restores
  // trigger-type-only omit.
  assert.equal(normalizeActivityTriggerReference(""), null);
  assert.equal(normalizeActivityTriggerReference(em), null);
  assert.equal(normalizeActivityTriggerReference(nbsp), null);
  assert.match(
    activitySource,
    /activityTriggerDisplayReference\s*\?\s*` · \$\{activityTriggerDisplayReference\}`\s*:\s*""/
  );
  assert.match(
    activitySource,
    /normalizeActivityTriggerReference\(\s*event\.triggerReference\s*\)/
  );
});

test("Activity triggerReference identity refuses Unicode inventing equality", () => {
  const padded = `${em}${triggerReference}${em}`;
  assert.notEqual(asciiTrimActivityTriggerReference(padded), padded.trim());
  assert.equal(normalizeActivityTriggerReference(padded), null);
  assert.equal(normalizeActivityTriggerReference(`\t${triggerReference}\n`), triggerReference);
});

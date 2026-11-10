import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimActivityEvidenceType,
  canonicalizeActivityEvidenceType,
  normalizeActivityEvidenceType
} from "../services/domain/presentationActivityEvidenceTypeIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationActivityEvidenceTypeIdentity.ts", import.meta.url),
  "utf8"
);
const activitySource = readFileSync(
  new URL("../app/more/activity.tsx", import.meta.url),
  "utf8"
);
const evidenceSummaryIdentityPath = new URL(
  "../services/domain/presentationActivityEvidenceSummaryIdentity.ts",
  import.meta.url
);
const relatedEntityTypeIdentityPath = new URL(
  "../services/domain/presentationActivityRelatedEntityTypeIdentity.ts",
  import.meta.url
);
const triggerTypeIdentityPath = new URL(
  "../services/domain/presentationActivityTriggerTypeIdentity.ts",
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
const triggerReferenceIdentityPath = new URL(
  "../services/domain/presentationActivityTriggerReferenceIdentity.ts",
  import.meta.url
);

const evidenceType = "inventory_item";
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

test("MISE-005ABN pins Activity evidence.type to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABN/);
  assert.match(activitySource, /MISE-005ABN/);

  assert.match(
    identitySource,
    /export function asciiTrimActivityEvidenceType\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    activitySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationActivityEvidenceTypeIdentity"/
  );
  assert.match(activitySource, /normalizeActivityEvidenceType\(/);
  assert.match(activitySource, /activityEvidenceDisplayType/);
  assert.match(
    activitySource,
    /normalizeActivityEvidenceType\(\s*evidence\.type\s*\)\s*\?\?\s*""/
  );
  assert.match(
    activitySource,
    /\{activityEvidenceDisplayType\.replace\(\/_\/g, " "\)\} —\{" "\}/
  );
  assert.doesNotMatch(
    activitySource,
    /\{evidence\.type\.replace\(\/_\/g, " "\)\} — \{evidence\.summary\}/
  );

  // Leave sibling evidence.summary / relatedEntityType / triggerType /
  // relatedEntityId / actionId / triggerReference tips alone.
  assert.doesNotMatch(activitySource, /normalizeActivityEvidenceSummary/);
  assert.doesNotMatch(activitySource, /normalizeActivityRelatedEntityType/);
  assert.doesNotMatch(activitySource, /normalizeActivityTriggerType/);
  assert.doesNotMatch(activitySource, /normalizeActivityRelatedEntityId/);
  assert.doesNotMatch(activitySource, /normalizeActivityActionId/);
  assert.doesNotMatch(activitySource, /normalizeActivityTriggerReference/);
  assert.doesNotMatch(identitySource, /presentationActivityEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityRelatedEntityTypeIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityTriggerTypeIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityRelatedEntityIdIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityActionIdIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityTriggerReferenceIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(evidenceSummaryIdentityPath), "absent");
  assert.equal(filePresence(relatedEntityTypeIdentityPath), "absent");
  assert.equal(filePresence(triggerTypeIdentityPath), "absent");
  assert.equal(filePresence(relatedEntityIdIdentityPath), "absent");
  assert.equal(filePresence(actionIdIdentityPath), "absent");
  assert.equal(filePresence(triggerReferenceIdentityPath), "absent");

  // Leave evidence.summary still on prior always-pass path (main).
  assert.match(
    activitySource,
    /\{activityEvidenceDisplayType\.replace\(\/_\/g, " "\)\} —\{" "\}\s*\{evidence\.summary\}/
  );

  assert.equal(normalizeActivityEvidenceType(evidenceType), evidenceType);
  assert.equal(normalizeActivityEvidenceType(` ${evidenceType} `), evidenceType);
  assert.equal(
    normalizeActivityEvidenceType(`type ${evidenceType}`),
    `type ${evidenceType}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Activity evidence.type", () => {
  const padded = `${em}${evidenceType}${em}`;
  const nbspName = `${nbsp}${evidenceType}${nbsp}`;
  const internalEm = `inventory${em}item`;
  const internalNbsp = `inventory${nbsp}item`;

  // Inventing proof: Unicode trim would invent the clean evidence type.
  assert.equal(padded.trim(), evidenceType);
  assert.equal(nbspName.trim(), evidenceType);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // Prior always-pass path would still render blank-looking / padded type.
  assert.equal(Boolean(padded.trim()), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimActivityEvidenceType(padded), padded);
  assert.equal(canonicalizeActivityEvidenceType(padded), null);
  assert.equal(canonicalizeActivityEvidenceType(nbspName), null);
  assert.equal(normalizeActivityEvidenceType(padded), null);
  assert.equal(normalizeActivityEvidenceType(nbspName), null);
  assert.equal(normalizeActivityEvidenceType(padded) || "", "");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeActivityEvidenceType(internalEm), internalEm);
  assert.equal(normalizeActivityEvidenceType(internalNbsp), internalNbsp);
  assert.equal(normalizeActivityEvidenceType(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Activity evidence.type", () => {
  assert.equal(normalizeActivityEvidenceType(undefined), null);
  assert.equal(normalizeActivityEvidenceType(null), null);
  assert.equal(normalizeActivityEvidenceType(""), null);
  assert.equal(normalizeActivityEvidenceType("   "), null);
  assert.equal(normalizeActivityEvidenceType(123 as unknown as string), null);
  assert.equal(normalizeActivityEvidenceType(`\u0001${evidenceType}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeActivityEvidenceType(`${evidenceType}\t`), evidenceType);
  assert.equal(normalizeActivityEvidenceType(`${evidenceType}\u0007`), null);
  assert.equal(normalizeActivityEvidenceType(em), null);
});

test("Activity evidence.type bypass proof: empty and Unicode-only-space soft-null to empty type", () => {
  // Prior always-pass path still rendered blank-looking evidence type
  // identity in the evidence line (`"  — …"`). Soft-null restores empty
  // type before the em-dash.
  assert.equal(normalizeActivityEvidenceType(""), null);
  assert.equal(normalizeActivityEvidenceType(em), null);
  assert.equal(normalizeActivityEvidenceType(nbsp), null);
  assert.match(
    activitySource,
    /normalizeActivityEvidenceType\(\s*evidence\.type\s*\)\s*\?\?\s*""/
  );
  assert.match(
    activitySource,
    /\{activityEvidenceDisplayType\.replace\(\/_\/g, " "\)\} —\{" "\}/
  );
});

test("Activity evidence.type identity refuses Unicode inventing equality", () => {
  const padded = `${em}${evidenceType}${em}`;
  assert.notEqual(asciiTrimActivityEvidenceType(padded), padded.trim());
  assert.equal(normalizeActivityEvidenceType(padded), null);
  assert.equal(normalizeActivityEvidenceType(`\t${evidenceType}\n`), evidenceType);
});

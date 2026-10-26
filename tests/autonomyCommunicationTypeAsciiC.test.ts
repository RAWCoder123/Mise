import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AUTONOMY_COMMUNICATION_TYPE_MAX_CHARACTERS,
  asciiTrimAutonomyCommunicationType,
  canonicalizeAutonomyCommunicationType,
  normalizeAutonomyCommunicationType
} from "../services/domain/autonomyCommunicationTypeIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/autonomyCommunicationTypeIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/settings/autonomy.tsx", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/autonomy.ts", import.meta.url),
  "utf8"
);

const channel = "email";

test("MISE-005QQ pins autonomy communicationType identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005QQ/);
  assert.match(screenSource, /MISE-005QQ/);

  assert.match(
    identitySource,
    /export function asciiTrimAutonomyCommunicationType\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/autonomyCommunicationTypeIdentity"/
  );
  assert.match(screenSource, /normalizeAutonomyCommunicationType\(draft\.communicationType\)/);
  assert.doesNotMatch(screenSource, /draft\.communicationType\.trim\(\)/);

  // Leave open autonomy restaurant-workspace tip #741 on its existing trim path.
  assert.match(applicationSource, /const normalizedRestaurantId = restaurantId\.trim\(\);/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /function normalizeTime\(/);
  assert.doesNotMatch(identitySource, /normalizeLoginEmail/);
  assert.doesNotMatch(identitySource, /from ["']\.\/restaurantAutonomy["']/);
  assert.doesNotMatch(screenSource, /from "\.\.\/\.\.\/services\/domain\/loginEmailIdentity"/);

  // Leave the screen's allowed-window prep on its existing Unicode-trim contract.
  assert.match(screenSource, /function normalizeTime\(value: string\): string \| null \{/);
  assert.match(screenSource, /const trimmed = value\.trim\(\);/);
});

test("ASCII trim keeps ordinary autonomy communication channels stable", () => {
  assert.equal(asciiTrimAutonomyCommunicationType(`  ${channel}  `), channel);
  assert.equal(canonicalizeAutonomyCommunicationType(`\t${channel}\n`), channel);
  assert.equal(normalizeAutonomyCommunicationType(`  ${channel}  `), channel);
  assert.equal(normalizeAutonomyCommunicationType(channel), channel);

  // Prior emptiness contract: ASCII-only whitespace softs to null.
  assert.equal(normalizeAutonomyCommunicationType("   "), null);
  assert.equal(normalizeAutonomyCommunicationType("\t\n"), null);
  assert.equal(normalizeAutonomyCommunicationType(""), null);
  assert.equal(normalizeAutonomyCommunicationType(null), null);
  assert.equal(normalizeAutonomyCommunicationType(undefined), null);
});

test("NBSP and em-space padding cannot invent a clean autonomy communication channel", () => {
  const nbspChannel = `\u00a0${channel}\u00a0`;
  const emChannel = `\u2003${channel}\u2003`;

  // Live inventing proof on Unicode trim (what autonomy.tsx used before this tip).
  assert.equal(nbspChannel.trim(), channel);
  assert.equal(emChannel.trim(), channel);

  assert.equal(canonicalizeAutonomyCommunicationType(nbspChannel), null);
  assert.equal(canonicalizeAutonomyCommunicationType(emChannel), null);
  assert.equal(normalizeAutonomyCommunicationType(nbspChannel), null);
  assert.equal(normalizeAutonomyCommunicationType(emChannel), null);

  // Soft empty Unicode-only padding falls through like prior `.trim()` emptiness.
  assert.equal(normalizeAutonomyCommunicationType("\u2003\u2003"), null);
  assert.equal(normalizeAutonomyCommunicationType("\u00a0\u00a0"), null);

  // Padded and clean stay distinct — do not invent channel equality.
  assert.notEqual(normalizeAutonomyCommunicationType(nbspChannel), channel);
  assert.notEqual(normalizeAutonomyCommunicationType(emChannel), channel);
});

test("ASCII controls and over-long channels fail closed without inventing", () => {
  assert.equal(canonicalizeAutonomyCommunicationType("ema\nil"), null);
  assert.equal(canonicalizeAutonomyCommunicationType("ema\ril"), null);
  assert.equal(canonicalizeAutonomyCommunicationType("ema\x01il"), null);
  assert.equal(canonicalizeAutonomyCommunicationType("ema\x7fil"), null);
  assert.equal(normalizeAutonomyCommunicationType("ema\nil"), null);
  assert.equal(normalizeAutonomyCommunicationType("ema\x7fil"), null);

  const tooLong = "e".repeat(AUTONOMY_COMMUNICATION_TYPE_MAX_CHARACTERS + 1);
  assert.equal(canonicalizeAutonomyCommunicationType(tooLong), null);
  assert.equal(normalizeAutonomyCommunicationType(tooLong), null);

  const atLimit = "e".repeat(AUTONOMY_COMMUNICATION_TYPE_MAX_CHARACTERS);
  assert.equal(canonicalizeAutonomyCommunicationType(atLimit), atLimit);
  assert.equal(normalizeAutonomyCommunicationType(atLimit), atLimit);
});

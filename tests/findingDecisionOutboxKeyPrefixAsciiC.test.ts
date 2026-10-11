import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimFindingDecisionOutboxKeyPrefixToken,
  canonicalizeFindingDecisionOutboxKeyPrefix,
  requireCanonicalFindingDecisionOutboxKeyPrefix
} from "../services/domain/findingDecisionOutboxKeyPrefixIdentity";
import {
  createFindingDecisionOutboxRepository,
  type FindingDecisionOutboxStorage
} from "../services/repositories/findingDecisionOutboxRepository";

const identitySource = readFileSync(
  new URL("../services/domain/findingDecisionOutboxKeyPrefixIdentity.ts", import.meta.url),
  "utf8"
);
const repositorySource = readFileSync(
  new URL("../services/repositories/findingDecisionOutboxRepository.ts", import.meta.url),
  "utf8"
);

const defaultKeyPrefix = "mise.finding-decision-outbox.v1";
const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function recordingStorage() {
  const values = new Map<string, string>();
  const seenKeys: string[] = [];
  const storage: FindingDecisionOutboxStorage = {
    async getItem(key) {
      seenKeys.push(key);
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      seenKeys.push(key);
      values.set(key, value);
    }
  };
  return { storage, seenKeys, values };
}

test("MISE-005ND pins finding decision outbox keyPrefix to ASCII C", () => {
  assert.match(identitySource, /MISE-005ND/);
  assert.match(repositorySource, /MISE-005ND/);

  assert.match(
    identitySource,
    /export function asciiTrimFindingDecisionOutboxKeyPrefixToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    repositorySource,
    /requireCanonicalFindingDecisionOutboxKeyPrefix\(keyPrefix\)/
  );
  assert.match(
    repositorySource,
    /from "\.\.\/domain\/findingDecisionOutboxKeyPrefixIdentity"/
  );
  assert.doesNotMatch(repositorySource, /keyPrefix\.trim\(\)/);

  // Do not rewrite sibling finding-decision outbox entry-id tip #785.
  assert.doesNotMatch(repositorySource, /findingDecisionOutboxIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxIdentity/);
  assert.doesNotMatch(identitySource, /requireCanonicalFindingDecisionOutboxId/);

  // Do not rewrite sibling inventory outbox key-prefix / entry-id paths.
  assert.doesNotMatch(repositorySource, /inventoryOutbox/);
  assert.doesNotMatch(identitySource, /inventoryOutbox/);
  assert.doesNotMatch(identitySource, /missing_outbox_key_prefix/);

  // Open sibling helper (when present on disk) must stay untouched by this tip.
  try {
    const entryIdIdentity = readFileSync(
      new URL("../services/domain/findingDecisionOutboxIdentity.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(entryIdIdentity, /MISE-005ND/);
    assert.doesNotMatch(entryIdIdentity, /KeyPrefix/);
  } catch {
    // Entry-id helper lands with #785; absence on main is expected.
  }
});

test("ASCII trim keeps ordinary finding decision outbox keyPrefix padding stable", async () => {
  assert.equal(
    asciiTrimFindingDecisionOutboxKeyPrefixToken(`  ${defaultKeyPrefix}  `),
    defaultKeyPrefix
  );
  assert.equal(
    canonicalizeFindingDecisionOutboxKeyPrefix(`\t${defaultKeyPrefix}\n`),
    defaultKeyPrefix
  );
  assert.equal(
    requireCanonicalFindingDecisionOutboxKeyPrefix(` ${defaultKeyPrefix} `),
    defaultKeyPrefix
  );

  const { storage, seenKeys } = recordingStorage();
  const repository = createFindingDecisionOutboxRepository(
    storage,
    `  ${defaultKeyPrefix}  `
  );
  await repository.list(restaurantId);
  assert.deepEqual(seenKeys, [`${defaultKeyPrefix}:${restaurantId}`]);
});

test("ASCII finding decision outbox keyPrefix trim ignores NBSP; Unicode trim would invent partition", async () => {
  const nbspPadded = `\u00a0${defaultKeyPrefix}\u00a0`;
  // Unicode trim invents an exact match against the unpadded storage prefix.
  assert.equal(nbspPadded.trim(), defaultKeyPrefix);
  // Emptiness check on main previously accepted this padded prefix.
  assert.equal(Boolean(nbspPadded.trim()), true);
  assert.notEqual(asciiTrimFindingDecisionOutboxKeyPrefixToken(nbspPadded), defaultKeyPrefix);
  assert.equal(canonicalizeFindingDecisionOutboxKeyPrefix(nbspPadded), null);
  assert.throws(
    () => requireCanonicalFindingDecisionOutboxKeyPrefix(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "missing_finding_decision_outbox_key_prefix"
  );

  const { storage, seenKeys } = recordingStorage();
  const repository = createFindingDecisionOutboxRepository(storage, nbspPadded);
  await assert.rejects(
    () => repository.list(restaurantId),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "missing_finding_decision_outbox_key_prefix"
  );
  assert.deepEqual(seenKeys, []);

  const emSpacePadded = `\u2003${defaultKeyPrefix}\u2003`;
  assert.equal(emSpacePadded.trim(), defaultKeyPrefix);
  assert.equal(canonicalizeFindingDecisionOutboxKeyPrefix(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalFindingDecisionOutboxKeyPrefix(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "missing_finding_decision_outbox_key_prefix"
  );
  await assert.rejects(
    () =>
      createFindingDecisionOutboxRepository(storage, emSpacePadded).list(restaurantId),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "missing_finding_decision_outbox_key_prefix"
  );
});

test("ASCII finding decision outbox keyPrefix canonicalize rejects empty, over-long, and control-bearing prefixes", async () => {
  assert.equal(canonicalizeFindingDecisionOutboxKeyPrefix(""), null);
  assert.equal(canonicalizeFindingDecisionOutboxKeyPrefix("   "), null);
  assert.equal(canonicalizeFindingDecisionOutboxKeyPrefix("a".repeat(129)), null);
  assert.equal(canonicalizeFindingDecisionOutboxKeyPrefix("bad\u0000prefix"), null);
  assert.throws(
    () => requireCanonicalFindingDecisionOutboxKeyPrefix(null),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "missing_finding_decision_outbox_key_prefix"
  );
  assert.throws(
    () => requireCanonicalFindingDecisionOutboxKeyPrefix(12),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "missing_finding_decision_outbox_key_prefix"
  );

  const { storage, seenKeys } = recordingStorage();
  await assert.rejects(
    () => createFindingDecisionOutboxRepository(storage, "").list(restaurantId),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "missing_finding_decision_outbox_key_prefix"
  );
  assert.deepEqual(seenKeys, []);
});

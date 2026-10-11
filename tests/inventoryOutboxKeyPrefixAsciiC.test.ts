import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryOutboxKeyPrefixToken,
  canonicalizeInventoryOutboxKeyPrefix,
  requireCanonicalInventoryOutboxKeyPrefix
} from "../services/domain/inventoryOutboxKeyPrefixIdentity";
import {
  createInventoryOutboxRepository,
  type InventoryOutboxStorage
} from "../services/repositories/inventoryOutboxRepository";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryOutboxKeyPrefixIdentity.ts", import.meta.url),
  "utf8"
);
const repositorySource = readFileSync(
  new URL("../services/repositories/inventoryOutboxRepository.ts", import.meta.url),
  "utf8"
);

const defaultKeyPrefix = "mise.inventory-outbox.v1";
const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function recordingStorage() {
  const values = new Map<string, string>();
  const seenKeys: string[] = [];
  const storage: InventoryOutboxStorage = {
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

test("MISE-005NE pins inventory outbox keyPrefix to ASCII C", () => {
  assert.match(identitySource, /MISE-005NE/);
  assert.match(repositorySource, /MISE-005NE/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryOutboxKeyPrefixToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    repositorySource,
    /requireCanonicalInventoryOutboxKeyPrefix\(keyPrefix\)/
  );
  assert.match(
    repositorySource,
    /from "\.\.\/domain\/inventoryOutboxKeyPrefixIdentity"/
  );
  assert.doesNotMatch(repositorySource, /keyPrefix\.trim\(\)/);

  // Do not rewrite sibling inventory outbox entry-id tip #784.
  assert.doesNotMatch(repositorySource, /inventoryOutboxIdentity/);
  assert.doesNotMatch(identitySource, /inventoryOutboxIdentity/);
  assert.doesNotMatch(identitySource, /requireCanonicalInventoryOutboxId/);
  assert.doesNotMatch(identitySource, /missing_outbox_id/);

  // Do not rewrite sibling finding-decision outbox key-prefix tip #786.
  assert.doesNotMatch(repositorySource, /findingDecisionOutbox/);
  assert.doesNotMatch(identitySource, /findingDecisionOutbox/);
  assert.doesNotMatch(identitySource, /missing_finding_decision_outbox_key_prefix/);

  // Open sibling helper (when present on disk) must stay untouched by this tip.
  try {
    const entryIdIdentity = readFileSync(
      new URL("../services/domain/inventoryOutboxIdentity.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(entryIdIdentity, /MISE-005NE/);
    assert.doesNotMatch(entryIdIdentity, /KeyPrefix/);
  } catch {
    // Entry-id helper lands with #784; absence on main is expected.
  }
});

test("ASCII trim keeps ordinary inventory outbox keyPrefix padding stable", async () => {
  assert.equal(
    asciiTrimInventoryOutboxKeyPrefixToken(`  ${defaultKeyPrefix}  `),
    defaultKeyPrefix
  );
  assert.equal(
    canonicalizeInventoryOutboxKeyPrefix(`\t${defaultKeyPrefix}\n`),
    defaultKeyPrefix
  );
  assert.equal(
    requireCanonicalInventoryOutboxKeyPrefix(` ${defaultKeyPrefix} `),
    defaultKeyPrefix
  );

  const { storage, seenKeys } = recordingStorage();
  const repository = createInventoryOutboxRepository(
    storage,
    `  ${defaultKeyPrefix}  `
  );
  await repository.list(restaurantId);
  assert.deepEqual(seenKeys, [`${defaultKeyPrefix}:${restaurantId}`]);
});

test("ASCII inventory outbox keyPrefix trim ignores NBSP; Unicode trim would invent partition", async () => {
  const nbspPadded = `\u00a0${defaultKeyPrefix}\u00a0`;
  // Unicode trim invents an exact match against the unpadded storage prefix.
  assert.equal(nbspPadded.trim(), defaultKeyPrefix);
  // Emptiness check on main previously accepted this padded prefix.
  assert.equal(Boolean(nbspPadded.trim()), true);
  assert.notEqual(asciiTrimInventoryOutboxKeyPrefixToken(nbspPadded), defaultKeyPrefix);
  assert.equal(canonicalizeInventoryOutboxKeyPrefix(nbspPadded), null);
  assert.throws(
    () => requireCanonicalInventoryOutboxKeyPrefix(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_outbox_key_prefix"
  );

  const { storage, seenKeys } = recordingStorage();
  const repository = createInventoryOutboxRepository(storage, nbspPadded);
  await assert.rejects(
    () => repository.list(restaurantId),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_outbox_key_prefix"
  );
  assert.deepEqual(seenKeys, []);

  const emSpacePadded = `\u2003${defaultKeyPrefix}\u2003`;
  assert.equal(emSpacePadded.trim(), defaultKeyPrefix);
  assert.equal(canonicalizeInventoryOutboxKeyPrefix(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalInventoryOutboxKeyPrefix(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_outbox_key_prefix"
  );
  await assert.rejects(
    () =>
      createInventoryOutboxRepository(storage, emSpacePadded).list(restaurantId),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_outbox_key_prefix"
  );
});

test("ASCII inventory outbox keyPrefix canonicalize rejects empty, over-long, and control-bearing prefixes", async () => {
  assert.equal(canonicalizeInventoryOutboxKeyPrefix(""), null);
  assert.equal(canonicalizeInventoryOutboxKeyPrefix("   "), null);
  assert.equal(canonicalizeInventoryOutboxKeyPrefix("a".repeat(129)), null);
  assert.equal(canonicalizeInventoryOutboxKeyPrefix("bad\u0000prefix"), null);
  assert.throws(
    () => requireCanonicalInventoryOutboxKeyPrefix(null),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_outbox_key_prefix"
  );
  assert.throws(
    () => requireCanonicalInventoryOutboxKeyPrefix(12),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_outbox_key_prefix"
  );

  const { storage, seenKeys } = recordingStorage();
  await assert.rejects(
    () => createInventoryOutboxRepository(storage, "").list(restaurantId),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_outbox_key_prefix"
  );
  assert.deepEqual(seenKeys, []);
});

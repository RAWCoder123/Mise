import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createInventoryOutboxEntry } from "../services/domain/inventoryOutbox";
import type { InventoryEventInput } from "../services/domain/inventoryLedger";
import {
  asciiTrimInventoryOutboxIdToken,
  canonicalizeInventoryOutboxId,
  requireCanonicalInventoryOutboxId
} from "../services/domain/inventoryOutboxIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryOutboxIdentity.ts", import.meta.url),
  "utf8"
);
const outboxSource = readFileSync(
  new URL("../services/domain/inventoryOutbox.ts", import.meta.url),
  "utf8"
);

const outboxId = "outbox-1";
const productionShapedId = "inventory_outbox_00000000-0000-4000-8000-000000000701";

function event(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "receipt",
    quantity: 1000,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: "receiving",
    sourceReference: "delivery-1",
    reasonCode: null,
    clientEventId: "device-event-1",
    idempotencyKey: "receiving:delivery-1:chicken",
    supersedesEventId: null,
    metadata: {},
    ...overrides
  };
}

test("MISE-005NB pins inventory outbox entry id to ASCII C", () => {
  assert.match(identitySource, /MISE-005NB/);
  assert.match(outboxSource, /MISE-005NB/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryOutboxIdToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(outboxSource, /requireCanonicalInventoryOutboxId\(input\.id\)/);
  assert.match(outboxSource, /from "\.\/inventoryOutboxIdentity"/);
  assert.doesNotMatch(outboxSource, /input\.id\.trim\(\)/);

  // Event object identities stay on Unicode trim for #771 / MISE-005MO.
  assert.match(outboxSource, /input\.event\.clientEventId\.trim\(\)/);
  assert.match(outboxSource, /input\.event\.idempotencyKey\.trim\(\)/);

  // Do not rewrite sibling ledger tips.
  assert.doesNotMatch(outboxSource, /inventoryLedgerObjectIdentity/);
  assert.doesNotMatch(outboxSource, /inventoryLedgerRestaurantIdentity/);
  assert.doesNotMatch(outboxSource, /inventoryLedgerSourceIdentity/);
  assert.doesNotMatch(identitySource, /inventoryLedgerObjectIdentity/);
  assert.doesNotMatch(identitySource, /inventoryLedgerRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryLedgerSourceIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxIdentity/);
  assert.doesNotMatch(identitySource, /RestaurantIdentity/);

  // Open sibling helpers (when present on disk) must stay untouched by this tip.
  try {
    const objectSource = readFileSync(
      new URL("../services/domain/inventoryLedgerObjectIdentity.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(objectSource, /MISE-005NB/);
    assert.doesNotMatch(objectSource, /OutboxIdentity/);
  } catch {
    // Object-identity helper lands with #771; absence on main is expected.
  }

  try {
    const sourceIdentity = readFileSync(
      new URL("../services/domain/inventoryLedgerSourceIdentity.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(sourceIdentity, /MISE-005NB/);
    assert.doesNotMatch(sourceIdentity, /OutboxIdentity/);
  } catch {
    // Source-identity helper lands with #783; absence on main is expected.
  }
});

test("ASCII trim keeps ordinary inventory outbox id padding stable", () => {
  assert.equal(asciiTrimInventoryOutboxIdToken(`  ${outboxId}  `), outboxId);
  assert.equal(canonicalizeInventoryOutboxId(`\t${outboxId}\n`), outboxId);
  assert.equal(requireCanonicalInventoryOutboxId(` ${outboxId} `), outboxId);

  assert.equal(
    asciiTrimInventoryOutboxIdToken(`  ${productionShapedId}  `),
    productionShapedId
  );
  assert.equal(
    canonicalizeInventoryOutboxId(`\t${productionShapedId}\n`),
    productionShapedId
  );
  assert.equal(
    requireCanonicalInventoryOutboxId(` ${productionShapedId} `),
    productionShapedId
  );

  const created = createInventoryOutboxEntry({
    id: `  ${outboxId}  `,
    event: event(),
    now: "2026-07-26T10:00:00.000Z"
  });
  assert.equal(created.id, outboxId);
});

test("ASCII inventory outbox id trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${outboxId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded outbox id.
  assert.equal(nbspPadded.trim(), outboxId);
  assert.notEqual(asciiTrimInventoryOutboxIdToken(nbspPadded), outboxId);
  assert.equal(canonicalizeInventoryOutboxId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalInventoryOutboxId(nbspPadded),
    (error: unknown) => error instanceof Error && error.message === "missing_outbox_id"
  );
  assert.throws(
    () =>
      createInventoryOutboxEntry({
        id: nbspPadded,
        event: event(),
        now: "2026-07-26T10:00:00.000Z"
      }),
    (error: unknown) => error instanceof Error && error.message === "missing_outbox_id"
  );

  const emSpacePadded = `\u2003${productionShapedId}\u2003`;
  assert.equal(emSpacePadded.trim(), productionShapedId);
  assert.equal(canonicalizeInventoryOutboxId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalInventoryOutboxId(emSpacePadded),
    (error: unknown) => error instanceof Error && error.message === "missing_outbox_id"
  );
  assert.throws(
    () =>
      createInventoryOutboxEntry({
        id: emSpacePadded,
        event: event(),
        now: "2026-07-26T10:00:00.000Z"
      }),
    (error: unknown) => error instanceof Error && error.message === "missing_outbox_id"
  );
});

test("ASCII inventory outbox id canonicalize rejects empty, over-long, and control-bearing ids", () => {
  assert.equal(canonicalizeInventoryOutboxId(""), null);
  assert.equal(canonicalizeInventoryOutboxId("   "), null);
  assert.equal(canonicalizeInventoryOutboxId("a".repeat(129)), null);
  assert.equal(canonicalizeInventoryOutboxId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalInventoryOutboxId(null),
    (error: unknown) => error instanceof Error && error.message === "missing_outbox_id"
  );
  assert.throws(
    () => requireCanonicalInventoryOutboxId(12),
    (error: unknown) => error instanceof Error && error.message === "missing_outbox_id"
  );
  assert.throws(
    () =>
      createInventoryOutboxEntry({
        id: "",
        event: event(),
        now: "2026-07-26T10:00:00.000Z"
      }),
    (error: unknown) => error instanceof Error && error.message === "missing_outbox_id"
  );
});

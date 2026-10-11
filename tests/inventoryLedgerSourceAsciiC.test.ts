import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  asciiTrimInventoryLedgerSourceToken,
  canonicalizeInventoryLedgerSource
} from "../services/domain/inventoryLedgerSourceIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryLedgerSourceIdentity.ts", import.meta.url),
  "utf8"
);
const ledgerSource = readFileSync(
  new URL("../services/domain/inventoryLedger.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant-a";
const demoInventoryItemId = "chicken";
const sourceLabel = "receiving";
const clientEventId = "device-event-1";
const idempotencyKey = "receiving:delivery-1:chicken";

function candidate(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: workspace,
    inventoryItemId: demoInventoryItemId,
    eventType: "receipt",
    quantity: 1000,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: sourceLabel,
    sourceReference: "delivery-1",
    reasonCode: null,
    clientEventId,
    idempotencyKey,
    supersedesEventId: null,
    metadata: {},
    ...overrides
  };
}

function accept(candidateInput: InventoryEventInput) {
  return acceptInventoryEvent({
    existingEvents: [],
    candidate: candidateInput,
    authority: {
      id: "event-1",
      actorUserId: "manager-1",
      recordedAt: "2026-07-26T10:01:00.000Z"
    }
  });
}

test("MISE-005NA pins inventory ledger source to ASCII C", () => {
  assert.match(identitySource, /MISE-005NA/);
  assert.match(ledgerSource, /MISE-005NA/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryLedgerSourceToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(ledgerSource, /canonicalizeInventoryLedgerSource\(input\.source\)/);
  assert.match(ledgerSource, /from "\.\/inventoryLedgerSourceIdentity"/);
  assert.doesNotMatch(ledgerSource, /input\.source\.trim\(\)/);

  // Restaurant and object identities stay on Unicode trim for #782 / #771.
  assert.match(ledgerSource, /input\.restaurantId\.trim\(\)/);
  assert.match(ledgerSource, /input\.inventoryItemId\.trim\(\)/);
  assert.match(ledgerSource, /input\.clientEventId\.trim\(\)/);
  assert.match(ledgerSource, /input\.idempotencyKey\.trim\(\)/);

  // Do not rewrite sibling ledger restaurant / object tips.
  assert.doesNotMatch(ledgerSource, /inventoryLedgerRestaurantIdentity/);
  assert.doesNotMatch(ledgerSource, /inventoryLedgerObjectIdentity/);
  assert.doesNotMatch(identitySource, /inventoryLedgerRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryLedgerObjectIdentity/);
  assert.doesNotMatch(identitySource, /inventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /RestaurantIdentity/);

  // Open sibling helpers (when present on disk) must stay untouched by this tip.
  try {
    const restaurantSource = readFileSync(
      new URL("../services/domain/inventoryLedgerRestaurantIdentity.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(restaurantSource, /MISE-005NA/);
    assert.doesNotMatch(restaurantSource, /SourceIdentity/);
  } catch {
    // Restaurant-identity helper lands with #782; absence on main is expected.
  }

  try {
    const objectSource = readFileSync(
      new URL("../services/domain/inventoryLedgerObjectIdentity.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(objectSource, /MISE-005NA/);
    assert.doesNotMatch(objectSource, /SourceIdentity/);
  } catch {
    // Object-identity helper lands with #771; absence on main is expected.
  }
});

test("ASCII trim keeps ordinary ledger source padding stable", () => {
  assert.equal(asciiTrimInventoryLedgerSourceToken(`  ${sourceLabel}  `), sourceLabel);
  assert.equal(canonicalizeInventoryLedgerSource(`\t${sourceLabel}\n`), sourceLabel);

  const accepted = accept(candidate({ source: `  ${sourceLabel}  ` }));
  assert.equal(accepted.status, "accepted");
  if (accepted.status === "accepted") {
    assert.equal(accepted.event.source, sourceLabel);
  }
});

test("ASCII ledger source trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${sourceLabel}\u00a0`;
  // Unicode trim invents an exact match against the unpadded source label.
  assert.equal(nbspPadded.trim(), sourceLabel);
  assert.notEqual(asciiTrimInventoryLedgerSourceToken(nbspPadded), sourceLabel);
  assert.equal(canonicalizeInventoryLedgerSource(nbspPadded), null);

  const nbspRejected = accept(candidate({ source: nbspPadded }));
  assert.equal(nbspRejected.status, "rejected");
  if (nbspRejected.status === "rejected") {
    assert.equal(nbspRejected.reason, "missing_source");
  }

  // Without ASCII-C, Unicode-padded source would pass emptiness via `.trim()`
  // and accept a parallel source identity beside the unpadded one.
  const existing = accept(candidate());
  assert.equal(existing.status, "accepted");
  if (existing.status === "accepted") {
    const parallel = acceptInventoryEvent({
      existingEvents: [existing.event],
      candidate: candidate({
        source: nbspPadded,
        clientEventId: "device-event-2",
        idempotencyKey: "receiving:delivery-2:chicken"
      }),
      authority: {
        id: "event-2",
        actorUserId: "manager-1",
        recordedAt: "2026-07-26T10:02:00.000Z"
      }
    });
    assert.equal(parallel.status, "rejected");
    if (parallel.status === "rejected") {
      assert.equal(parallel.reason, "missing_source");
    }
  }

  const emSpacePadded = `\u2003${sourceLabel}\u2003`;
  assert.equal(emSpacePadded.trim(), sourceLabel);
  assert.equal(canonicalizeInventoryLedgerSource(emSpacePadded), null);
  const emRejected = accept(candidate({ source: emSpacePadded }));
  assert.equal(emRejected.status, "rejected");
  if (emRejected.status === "rejected") {
    assert.equal(emRejected.reason, "missing_source");
  }
});

test("Inventory ledger source identities reject empty and control-bearing tokens", () => {
  assert.equal(canonicalizeInventoryLedgerSource(""), null);
  assert.equal(canonicalizeInventoryLedgerSource("   "), null);
  assert.equal(canonicalizeInventoryLedgerSource("a".repeat(81)), null);
  assert.equal(canonicalizeInventoryLedgerSource("bad\u0000source"), null);

  const empty = accept(candidate({ source: "" }));
  assert.equal(empty.status, "rejected");
  if (empty.status === "rejected") assert.equal(empty.reason, "missing_source");

  const control = accept(candidate({ source: "bad\u0000source" }));
  assert.equal(control.status, "rejected");
  if (control.status === "rejected") assert.equal(control.reason, "missing_source");
});

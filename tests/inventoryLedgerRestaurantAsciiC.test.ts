import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  asciiTrimInventoryLedgerRestaurantToken,
  canonicalizeInventoryLedgerRestaurantId
} from "../services/domain/inventoryLedgerRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryLedgerRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const ledgerSource = readFileSync(
  new URL("../services/domain/inventoryLedger.ts", import.meta.url),
  "utf8"
);
const inventoryApplicationSource = readFileSync(
  new URL("../services/application/inventory.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant-a";
const demoInventoryItemId = "chicken";
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
    source: "receiving",
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

test("MISE-005MZ pins inventory ledger restaurantId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MZ/);
  assert.match(ledgerSource, /MISE-005MZ/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryLedgerRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(ledgerSource, /canonicalizeInventoryLedgerRestaurantId\(input\.restaurantId\)/);
  assert.match(ledgerSource, /from "\.\/inventoryLedgerRestaurantIdentity"/);
  assert.doesNotMatch(ledgerSource, /input\.restaurantId\.trim\(\)/);

  // Object identities and source stay on Unicode trim for #771 / a later tip.
  assert.match(ledgerSource, /input\.inventoryItemId\.trim\(\)/);
  assert.match(ledgerSource, /input\.clientEventId\.trim\(\)/);
  assert.match(ledgerSource, /input\.idempotencyKey\.trim\(\)/);
  assert.match(ledgerSource, /if \(!input\.source\.trim\(\)\) return "missing_source";/);

  // Do not rewrite sibling object-identity or inventory-application restaurant tips.
  assert.doesNotMatch(ledgerSource, /inventoryLedgerObjectIdentity/);
  assert.doesNotMatch(identitySource, /inventoryLedgerObjectIdentity/);
  assert.doesNotMatch(identitySource, /inventoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountItemIdentity/);
  assert.doesNotMatch(identitySource, /wasteAnalysisRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierSpendRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /insightsSalesAnalyticsRestaurantIdentity/);
  assert.doesNotMatch(inventoryApplicationSource, /requireCanonicalInventoryLedgerRestaurant/);
  assert.doesNotMatch(inventoryApplicationSource, /MISE-005MZ/);
  assert.match(inventoryApplicationSource, /restaurantId\.trim\(\)/);

  // Open object tip helper (when present on disk) must stay untouched by this tip.
  try {
    const objectSource = readFileSync(
      new URL("../services/domain/inventoryLedgerObjectIdentity.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(objectSource, /MISE-005MZ/);
    assert.doesNotMatch(objectSource, /RestaurantIdentity/);
  } catch {
    // Object-identity helper lands with #771; absence on main is expected.
  }
});

test("ASCII trim keeps ordinary ledger restaurant padding stable", () => {
  assert.equal(asciiTrimInventoryLedgerRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeInventoryLedgerRestaurantId(`\t${workspace}\n`), workspace);

  const accepted = accept(candidate({ restaurantId: `  ${workspace}  ` }));
  assert.equal(accepted.status, "accepted");
  if (accepted.status === "accepted") {
    assert.equal(accepted.event.restaurantId, workspace);
  }
});

test("ASCII ledger restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimInventoryLedgerRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeInventoryLedgerRestaurantId(nbspPadded), null);

  const nbspRejected = accept(candidate({ restaurantId: nbspPadded }));
  assert.equal(nbspRejected.status, "rejected");
  if (nbspRejected.status === "rejected") {
    assert.equal(nbspRejected.reason, "missing_scope");
  }

  // Without ASCII-C, Unicode-padded restaurantId would pass emptiness via
  // `.trim()` and accept a parallel workspace identity beside the unpadded one.
  const existing = accept(candidate());
  assert.equal(existing.status, "accepted");
  if (existing.status === "accepted") {
    const parallel = acceptInventoryEvent({
      existingEvents: [existing.event],
      candidate: candidate({
        restaurantId: nbspPadded,
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
      assert.equal(parallel.reason, "missing_scope");
    }
  }

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeInventoryLedgerRestaurantId(emSpacePadded), null);
  const emRejected = accept(candidate({ restaurantId: emSpacePadded }));
  assert.equal(emRejected.status, "rejected");
  if (emRejected.status === "rejected") {
    assert.equal(emRejected.reason, "missing_scope");
  }
});

test("Inventory ledger restaurant identities reject empty and control-bearing tokens", () => {
  assert.equal(canonicalizeInventoryLedgerRestaurantId(""), null);
  assert.equal(canonicalizeInventoryLedgerRestaurantId("   "), null);
  assert.equal(canonicalizeInventoryLedgerRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeInventoryLedgerRestaurantId("bad\u0000id"), null);

  const empty = accept(candidate({ restaurantId: "" }));
  assert.equal(empty.status, "rejected");
  if (empty.status === "rejected") assert.equal(empty.reason, "missing_scope");

  const control = accept(candidate({ restaurantId: "bad\u0000id" }));
  assert.equal(control.status, "rejected");
  if (control.status === "rejected") assert.equal(control.reason, "missing_scope");
});

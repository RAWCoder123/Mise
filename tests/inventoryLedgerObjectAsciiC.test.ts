import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  asciiTrimInventoryLedgerObjectToken,
  canonicalizeInventoryLedgerObjectId
} from "../services/domain/inventoryLedgerObjectIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryLedgerObjectIdentity.ts", import.meta.url),
  "utf8"
);
const ledgerSource = readFileSync(
  new URL("../services/domain/inventoryLedger.ts", import.meta.url),
  "utf8"
);

const inventoryItemId = "00000000-0000-4000-8000-000000000801";
const demoInventoryItemId = "chicken";
const clientEventId = "device-event-1";
const idempotencyKey = "receiving:delivery-1:chicken";

function candidate(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
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

test("MISE-005MO pins inventory ledger object identities to ASCII C", () => {
  assert.match(identitySource, /MISE-005MO/);
  assert.match(ledgerSource, /MISE-005MO/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryLedgerObjectToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    ledgerSource,
    /canonicalizeInventoryLedgerObjectId\(input\.inventoryItemId\)/
  );
  assert.match(
    ledgerSource,
    /canonicalizeInventoryLedgerObjectId\(input\.clientEventId\)/
  );
  assert.match(
    ledgerSource,
    /canonicalizeInventoryLedgerObjectId\(input\.idempotencyKey\)/
  );
  assert.match(
    ledgerSource,
    /from "\.\/inventoryLedgerObjectIdentity"/
  );

  // Leave restaurant workspace and source on Unicode trim.
  assert.match(
    ledgerSource,
    /if \(!input\.restaurantId\.trim\(\) \|\| !inventoryItemId\)/
  );
  assert.match(ledgerSource, /if \(!input\.source\.trim\(\)\) return "missing_source";/);

  // Do not rewrite sibling inventoryItemId tips.
  assert.doesNotMatch(ledgerSource, /inventoryItemIdentity/);
  assert.doesNotMatch(ledgerSource, /inventoryCountItemIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/inventoryItemIdentity"/);
  assert.doesNotMatch(identitySource, /from "\.\/inventoryCountItemIdentity"/);

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /inventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountItemIdentity/);
  assert.doesNotMatch(identitySource, /inventoryMenuItemIdentity/);
  assert.doesNotMatch(identitySource, /inventoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesSupplierOrderIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesClientDeliveryIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLinesObjectIdentity/);
  assert.doesNotMatch(identitySource, /setupReferenceIdentity/);
  assert.doesNotMatch(identitySource, /orderAutomation/);
  assert.doesNotMatch(identitySource, /supplierDelivery/);
});

test("ASCII trim keeps ordinary ledger object padding stable", () => {
  assert.equal(asciiTrimInventoryLedgerObjectToken(`  ${inventoryItemId}  `), inventoryItemId);
  assert.equal(canonicalizeInventoryLedgerObjectId(`\t${inventoryItemId}\n`), inventoryItemId);

  assert.equal(asciiTrimInventoryLedgerObjectToken(`  ${demoInventoryItemId}  `), demoInventoryItemId);
  assert.equal(canonicalizeInventoryLedgerObjectId(`\t${demoInventoryItemId}\n`), demoInventoryItemId);

  assert.equal(asciiTrimInventoryLedgerObjectToken(`  ${clientEventId}  `), clientEventId);
  assert.equal(canonicalizeInventoryLedgerObjectId(`\t${clientEventId}\n`), clientEventId);

  assert.equal(asciiTrimInventoryLedgerObjectToken(`  ${idempotencyKey}  `), idempotencyKey);
  assert.equal(canonicalizeInventoryLedgerObjectId(`\t${idempotencyKey}\n`), idempotencyKey);

  const accepted = accept(
    candidate({
      inventoryItemId: `  ${demoInventoryItemId}  `,
      clientEventId: `  ${clientEventId}  `,
      idempotencyKey: `  ${idempotencyKey}  `
    })
  );
  assert.equal(accepted.status, "accepted");
  if (accepted.status === "accepted") {
    assert.equal(accepted.event.inventoryItemId, demoInventoryItemId);
    assert.equal(accepted.event.clientEventId, clientEventId);
    assert.equal(accepted.event.idempotencyKey, idempotencyKey);
  }
});

test("ASCII ledger object trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedItem = `\u00a0${demoInventoryItemId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded inventory item id.
  assert.equal(nbspPaddedItem.trim(), demoInventoryItemId);
  assert.notEqual(asciiTrimInventoryLedgerObjectToken(nbspPaddedItem), demoInventoryItemId);
  assert.equal(canonicalizeInventoryLedgerObjectId(nbspPaddedItem), null);

  const nbspRejected = accept(candidate({ inventoryItemId: nbspPaddedItem }));
  assert.equal(nbspRejected.status, "rejected");
  if (nbspRejected.status === "rejected") {
    assert.equal(nbspRejected.reason, "missing_scope");
  }

  const emSpacePaddedClient = `\u2003${clientEventId}\u2003`;
  assert.equal(emSpacePaddedClient.trim(), clientEventId);
  assert.equal(canonicalizeInventoryLedgerObjectId(emSpacePaddedClient), null);
  const clientRejected = accept(candidate({ clientEventId: emSpacePaddedClient }));
  assert.equal(clientRejected.status, "rejected");
  if (clientRejected.status === "rejected") {
    assert.equal(clientRejected.reason, "missing_idempotency");
  }

  const emSpacePaddedKey = `\u2003${idempotencyKey}\u2003`;
  assert.equal(emSpacePaddedKey.trim(), idempotencyKey);
  assert.equal(canonicalizeInventoryLedgerObjectId(emSpacePaddedKey), null);
  const keyRejected = accept(candidate({ idempotencyKey: emSpacePaddedKey }));
  assert.equal(keyRejected.status, "rejected");
  if (keyRejected.status === "rejected") {
    assert.equal(keyRejected.reason, "missing_idempotency");
  }
});

test("Inventory ledger object identities reject empty and control-bearing tokens", () => {
  assert.equal(canonicalizeInventoryLedgerObjectId(""), null);
  assert.equal(canonicalizeInventoryLedgerObjectId("   "), null);
  assert.equal(canonicalizeInventoryLedgerObjectId("a".repeat(129)), null);
  assert.equal(canonicalizeInventoryLedgerObjectId("bad\u0000id"), null);

  const emptyItem = accept(candidate({ inventoryItemId: "" }));
  assert.equal(emptyItem.status, "rejected");
  if (emptyItem.status === "rejected") assert.equal(emptyItem.reason, "missing_scope");

  const emptyClient = accept(candidate({ clientEventId: "" }));
  assert.equal(emptyClient.status, "rejected");
  if (emptyClient.status === "rejected") assert.equal(emptyClient.reason, "missing_idempotency");

  const controlKey = accept(candidate({ idempotencyKey: "bad\u0000key" }));
  assert.equal(controlKey.status, "rejected");
  if (controlKey.status === "rejected") assert.equal(controlKey.reason, "missing_idempotency");
});

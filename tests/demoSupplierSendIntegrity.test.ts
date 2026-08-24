import assert from "node:assert/strict";
import test from "node:test";

import {
  fingerprintSupplierSendSnapshot,
  serializeSupplierSendSnapshot,
  type CanonicalSupplierSendSnapshot
} from "../services/domain/supplierSendContent";
import {
  DEMO_RESTAURANT_ID,
  type DemoState
} from "../services/demoData";
import { GmailIntegrationError } from "../services/repositories/repositoryContracts";

const snapshotVector: CanonicalSupplierSendSnapshot = {
  version: "mise.supplier_send.v1",
  contentRevision: 7,
  restaurantId: "10000000-0000-4000-8000-000000000001",
  orderId: "20000000-0000-4000-8000-000000000001",
  supplierName: "Local Produce Co.",
  from: "orders@example.com",
  to: "produce@example.com",
  subject: "Mise Cafe order for Local Produce Co.",
  body: "Order draft for Local Produce Co.\n\nTomatoes - 4 each",
  deliveryDate: "2026-08-24",
  operatorNote: "Use the side entrance.",
  lines: [
    {
      recommendationId: "30000000-0000-4000-8000-000000000001",
      inventoryItemId: "40000000-0000-4000-8000-000000000001",
      itemName: "Tomatoes",
      quantity: 4,
      unit: "each",
      supplierName: "Local Produce Co."
    }
  ]
};

test("demo supplier-send serialization matches the PostgreSQL jsonb fingerprint vector", async () => {
  assert.equal(
    serializeSupplierSendSnapshot(snapshotVector),
    '{"to": "produce@example.com", "body": "Order draft for Local Produce Co.\\n\\nTomatoes - 4 each", "from": "orders@example.com", "lines": [{"unit": "each", "itemName": "Tomatoes", "quantity": 4, "supplierName": "Local Produce Co.", "inventoryItemId": "40000000-0000-4000-8000-000000000001", "recommendationId": "30000000-0000-4000-8000-000000000001"}], "orderId": "20000000-0000-4000-8000-000000000001", "subject": "Mise Cafe order for Local Produce Co.", "version": "mise.supplier_send.v1", "deliveryDate": "2026-08-24", "operatorNote": "Use the side entrance.", "restaurantId": "10000000-0000-4000-8000-000000000001", "supplierName": "Local Produce Co.", "contentRevision": 7}'
  );
  assert.equal(
    await fingerprintSupplierSendSnapshot(snapshotVector),
    "806f0d656046772f0c89840af2c7d64a979b77087b4e07e36f8ea01cf55206b1"
  );
});

test("supplier-send fingerprint binds every operator-reviewed delivery field", async () => {
  const baseline = await fingerprintSupplierSendSnapshot(snapshotVector);
  const variants: CanonicalSupplierSendSnapshot[] = [
    { ...snapshotVector, contentRevision: 8 },
    { ...snapshotVector, restaurantId: "10000000-0000-4000-8000-000000000002" },
    { ...snapshotVector, orderId: "20000000-0000-4000-8000-000000000002" },
    { ...snapshotVector, supplierName: "Changed Produce Co." },
    { ...snapshotVector, from: "other-sender@example.com" },
    { ...snapshotVector, to: "other-recipient@example.com" },
    { ...snapshotVector, subject: "Changed subject" },
    { ...snapshotVector, body: `${snapshotVector.body}\nChanged body` },
    { ...snapshotVector, deliveryDate: "2026-08-25" },
    { ...snapshotVector, operatorNote: "Changed note." },
    {
      ...snapshotVector,
      lines: [{ ...snapshotVector.lines[0]!, recommendationId: "30000000-0000-4000-8000-000000000009" }]
    },
    {
      ...snapshotVector,
      lines: [{ ...snapshotVector.lines[0]!, inventoryItemId: "40000000-0000-4000-8000-000000000009" }]
    },
    {
      ...snapshotVector,
      lines: [{ ...snapshotVector.lines[0]!, itemName: "Changed tomatoes" }]
    },
    {
      ...snapshotVector,
      lines: [{ ...snapshotVector.lines[0]!, quantity: 5 }]
    },
    {
      ...snapshotVector,
      lines: [{ ...snapshotVector.lines[0]!, unit: "case" }]
    },
    {
      ...snapshotVector,
      lines: [{ ...snapshotVector.lines[0]!, supplierName: "Changed Produce Co." }]
    },
    { ...snapshotVector, lines: [] },
    {
      ...snapshotVector,
      lines: [
        ...snapshotVector.lines,
        {
          recommendationId: "30000000-0000-4000-8000-000000000002",
          inventoryItemId: "40000000-0000-4000-8000-000000000002",
          itemName: "Onions",
          quantity: 2,
          unit: "each",
          supplierName: "Local Produce Co."
        }
      ]
    }
  ];

  for (const variant of variants) {
    assert.notEqual(await fingerprintSupplierSendSnapshot(variant), baseline);
  }
});

test("demo approval binds exact content, survives no ABA revert, and completes only claimed lines", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
      clear: () => { values.clear(); },
      key: (index) => [...values.keys()][index] ?? null,
      get length() { return values.size; }
    }
  };

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);
  await repository.connectRestaurantGmail(DEMO_RESTAURANT_ID);
  const order = (await repository.fetchSupplierOrders(DEMO_RESTAURANT_ID))
    .find((entry) => entry.status === "draft")!;
  const action = await repository.fetchSupplierSendAction!(DEMO_RESTAURANT_ID, order.id);
  assert.ok(action);

  // An action carrying only the retired envelope attestation is not send
  // authority, even when its envelope strings happen to match.
  await repository.decideMiseAction(DEMO_RESTAURANT_ID, action.id, "approved");
  const storedKey = [...values.keys()].find((key) => key.includes("demo-store"));
  assert.ok(storedKey);
  const stored = JSON.parse(values.get(storedKey)!) as DemoState;
  const storedAction = stored.miseActions.find((entry) => entry.id === action.id)!;
  storedAction.expectedImpact = {
    ...(storedAction.expectedImpact ?? {}),
    approvedEnvelope: {
      from: "demo.sender@example.com",
      to: "produce@local.example",
      subject: `${stored.restaurants[0]!.name} order for ${order.supplier_name}`
    }
  };
  values.set(storedKey, JSON.stringify(stored));
  await assert.rejects(
    () => repository.sendSupplierOrderEmail(DEMO_RESTAURANT_ID, order.id),
    (error: unknown) =>
      error instanceof GmailIntegrationError && error.status === "send_content_unapproved"
  );

  const initial = await repository.previewSupplierSendContent(DEMO_RESTAURANT_ID, order.id);
  assert.equal(initial.ready, true);
  assert.match(initial.contentFingerprint ?? "", /^[a-f0-9]{64}$/);
  const firstApproval = await repository.approveSupplierSendContent(
    DEMO_RESTAURANT_ID,
    action.id,
    order.id,
    initial.contentFingerprint!
  );
  assert.equal(firstApproval.outcome, "applied");
  assert.equal(firstApproval.action?.expectedImpact?.approvedEnvelope, undefined);
  assert.equal(
    (firstApproval.action?.expectedImpact?.approvedSendContent as Record<string, unknown>)?.body,
    undefined
  );

  const originalNote = order.operator_note;
  await repository.updateSupplierOrder(DEMO_RESTAURANT_ID, order.id, {
    operator_note: "Call on arrival."
  });
  const changed = await repository.previewSupplierSendContent(DEMO_RESTAURANT_ID, order.id);
  await repository.updateSupplierOrder(DEMO_RESTAURANT_ID, order.id, {
    operator_note: originalNote
  });
  const reverted = await repository.previewSupplierSendContent(DEMO_RESTAURANT_ID, order.id);
  assert.ok(changed.contentRevision > initial.contentRevision);
  assert.ok(reverted.contentRevision > changed.contentRevision);
  assert.notEqual(reverted.contentFingerprint, initial.contentFingerprint);
  assert.equal(reverted.body, initial.body);
  await assert.rejects(
    () => repository.sendSupplierOrderEmail(DEMO_RESTAURANT_ID, order.id),
    (error: unknown) =>
      error instanceof GmailIntegrationError && error.status === "send_content_unapproved"
  );

  const reapproval = await repository.approveSupplierSendContent(
    DEMO_RESTAURANT_ID,
    action.id,
    order.id,
    reverted.contentFingerprint!
  );
  assert.equal(reapproval.outcome, "applied");

  // External identity rows participate in the same monotonic invalidation as
  // order/line content. Restoring the visible From/To/Subject strings must not
  // restore the approval that preceded the intermediate change.
  await repository.disconnectRestaurantGmail(DEMO_RESTAURANT_ID);
  await repository.connectRestaurantGmail(DEMO_RESTAURANT_ID);
  const senderReverted = await repository.previewSupplierSendContent(
    DEMO_RESTAURANT_ID,
    order.id
  );
  assert.equal(senderReverted.from, reverted.from);
  assert.ok(senderReverted.contentRevision > reverted.contentRevision);
  assert.notEqual(senderReverted.contentFingerprint, reverted.contentFingerprint);
  await assert.rejects(
    () => repository.sendSupplierOrderEmail(DEMO_RESTAURANT_ID, order.id),
    (error: unknown) =>
      error instanceof GmailIntegrationError && error.status === "send_content_unapproved"
  );
  assert.equal((await repository.approveSupplierSendContent(
    DEMO_RESTAURANT_ID,
    action.id,
    order.id,
    senderReverted.contentFingerprint!
  )).outcome, "applied");

  const recipient = (await repository.fetchSupplierRecipients(DEMO_RESTAURANT_ID))
    .find((entry) => entry.supplier_name === order.supplier_name)!;
  await repository.upsertSupplierRecipient({
    restaurant_id: DEMO_RESTAURANT_ID,
    supplier_name: order.supplier_name,
    email: "temporary-recipient@example.com"
  });
  await repository.upsertSupplierRecipient({
    restaurant_id: DEMO_RESTAURANT_ID,
    supplier_name: order.supplier_name,
    email: recipient.email
  });
  const recipientReverted = await repository.previewSupplierSendContent(
    DEMO_RESTAURANT_ID,
    order.id
  );
  assert.equal(recipientReverted.to, senderReverted.to);
  assert.ok(recipientReverted.contentRevision > senderReverted.contentRevision);
  assert.notEqual(recipientReverted.contentFingerprint, senderReverted.contentFingerprint);
  await assert.rejects(
    () => repository.sendSupplierOrderEmail(DEMO_RESTAURANT_ID, order.id),
    (error: unknown) =>
      error instanceof GmailIntegrationError && error.status === "send_content_unapproved"
  );
  assert.equal((await repository.approveSupplierSendContent(
    DEMO_RESTAURANT_ID,
    action.id,
    order.id,
    recipientReverted.contentFingerprint!
  )).outcome, "applied");

  const restaurant = await repository.fetchRestaurant(DEMO_RESTAURANT_ID);
  await repository.updateRestaurantProfile(DEMO_RESTAURANT_ID, {
    name: `${restaurant.name} Temporary`
  });
  await repository.updateRestaurantProfile(DEMO_RESTAURANT_ID, {
    name: restaurant.name
  });
  const subjectReverted = await repository.previewSupplierSendContent(
    DEMO_RESTAURANT_ID,
    order.id
  );
  assert.equal(subjectReverted.subject, recipientReverted.subject);
  assert.ok(subjectReverted.contentRevision > recipientReverted.contentRevision);
  assert.notEqual(subjectReverted.contentFingerprint, recipientReverted.contentFingerprint);
  await assert.rejects(
    () => repository.sendSupplierOrderEmail(DEMO_RESTAURANT_ID, order.id),
    (error: unknown) =>
      error instanceof GmailIntegrationError && error.status === "send_content_unapproved"
  );
  assert.equal((await repository.approveSupplierSendContent(
    DEMO_RESTAURANT_ID,
    action.id,
    order.id,
    subjectReverted.contentFingerprint!
  )).outcome, "applied");

  await assert.rejects(
    () => repository.markSupplierOrderSent(DEMO_RESTAURANT_ID, order.id),
    /Provider acceptance is required/
  );
  assert.equal(
    (await repository.fetchSupplierOrder(DEMO_RESTAURANT_ID, order.id)).status,
    "draft"
  );

  const sent = await repository.sendSupplierOrderEmail(DEMO_RESTAURANT_ID, order.id);
  const claimedIds = subjectReverted.lines.map((line) => line.recommendationId).sort();
  assert.deepEqual(sent.orderedRecommendations.map((line) => line.id).sort(), claimedIds);

  const observed = await repository.markSupplierOrderSent(DEMO_RESTAURANT_ID, order.id);
  assert.equal(observed.outcome, "already_applied");
  assert.deepEqual(
    observed.orderedRecommendations.map((line) => line.id).sort(),
    claimedIds
  );

  const executed = await repository.fetchSupplierSendAction!(DEMO_RESTAURANT_ID, order.id);
  assert.deepEqual(executed?.result?.recommendationIds, claimedIds);
  const exportBeforeReplay = await repository.exportRestaurantData(DEMO_RESTAURANT_ID);
  const sentAuditCount = exportBeforeReplay.datasets.audit_logs.filter(
    (entry) => entry.action === "supplier_email_sent"
  ).length;
  const replay = await repository.sendSupplierOrderEmail(DEMO_RESTAURANT_ID, order.id);
  assert.equal(replay.outcome, "already_sent");
  const exportAfterReplay = await repository.exportRestaurantData(DEMO_RESTAURANT_ID);
  assert.equal(
    exportAfterReplay.datasets.audit_logs.filter((entry) => entry.action === "supplier_email_sent").length,
    sentAuditCount
  );

  // The replaceable default restaurant—not only the fallback seed—must expose
  // a canonical reviewable draft after the simulated sender is connected.
  await repository.resetDemoData("Toast", { preset: "default" });
  await repository.connectRestaurantGmail(DEMO_RESTAURANT_ID);
  const defaultDraft = (await repository.fetchSupplierOrders(DEMO_RESTAURANT_ID))
    .find((entry) => entry.status === "draft")!;
  const defaultPreview = await repository.previewSupplierSendContent(
    DEMO_RESTAURANT_ID,
    defaultDraft.id
  );
  assert.equal(defaultPreview.ready, true);
  assert.equal(defaultPreview.body, defaultDraft.order_message);
});

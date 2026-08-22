import assert from "node:assert/strict";
import test from "node:test";

import {
  PurchaseAuthorityBlockedError,
  isPurchaseAuthorityBlockedError,
  normalizePurchaseAuthorityResult,
  purchaseAuthorityBlockerMessageKey
} from "../services/domain/purchaseAuthority";

test("purchase authority normalizes stable blockers and bounded audit evidence", () => {
  const authority = normalizePurchaseAuthorityResult({
    ready: false,
    evaluatedAt: "2026-08-21T12:00:00.000Z",
    planningRevision: "7",
    blockers: [{
      code: "inventory_count_stale",
      description: "The physical inventory count is older than 36 hours.",
      metadata: { countedAt: "2026-08-19T12:00:00.000Z", ignored: { secret: true } }
    }, {
      code: "not_a_real_code",
      description: "ignored"
    }],
    evidence: {
      recommendationId: "rec-1",
      inventoryItemId: "item-1",
      countEventId: "count-1",
      countedAt: "2026-08-19T12:00:00.000Z",
      projectedQuantity: "2.5",
      canonicalUnit: "each",
      providerWindowFrom: null,
      providerWindowTo: null,
      providerWindowCompletedAt: null,
      recipeRevisions: { "menu-1": 4 },
      demandBasis: "square_history_required",
      basis: "untrusted-client-value"
    }
  });

  assert.equal(authority.ready, false);
  assert.equal(authority.planningRevision, 7);
  assert.equal(authority.blockers.length, 1);
  assert.deepEqual(authority.blockers[0]?.metadata, {
    countedAt: "2026-08-19T12:00:00.000Z"
  });
  assert.equal(authority.evidence.projectedQuantity, 2.5);
  assert.equal(authority.evidence.basis, "physical_count_reorder_policy");
  assert.equal(authority.evidence.demandBasis, "square_history_required");
  assert.equal(purchaseAuthorityBlockerMessageKey("inventory_count_stale"), "orders.authority.inventory_count_stale");
});

test("blocked authority remains a typed application error", () => {
  const authority = normalizePurchaseAuthorityResult({
    ready: false,
    evaluatedAt: "2026-08-21T12:00:00.000Z",
    planningRevision: 1,
    blockers: [{ code: "ordering_disabled", description: "Drafting is disabled.", metadata: {} }],
    evidence: { recommendationId: "rec-1", inventoryItemId: "item-1", recipeRevisions: {} }
  });
  const error = new PurchaseAuthorityBlockedError(authority);
  assert.equal(isPurchaseAuthorityBlockedError(error), true);
  assert.equal(error.authority.blockers[0]?.code, "ordering_disabled");
});

test("a client ready flag cannot override server blockers", () => {
  const authority = normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-08-21T12:00:00.000Z",
    blockers: [{ code: "supplier_missing", description: "Supplier missing.", metadata: {} }],
    evidence: { recommendationId: "rec-1", inventoryItemId: "item-1", recipeRevisions: {} }
  });
  assert.equal(authority.ready, false);
});

test("legacy draft authority gaps remain a stable fail-closed blocker", () => {
  const authority = normalizePurchaseAuthorityResult({
    ready: false,
    evaluatedAt: "2026-08-21T12:00:00.000Z",
    blockers: [{
      code: "draft_authority_incomplete",
      description: "This supplier draft contains an approved line without purchase authority.",
      metadata: { unattestedLineCount: 1 }
    }],
    evidence: { recommendationId: "rec-1", inventoryItemId: "item-1", recipeRevisions: {} }
  });

  assert.equal(authority.blockers[0]?.code, "draft_authority_incomplete");
  assert.equal(
    purchaseAuthorityBlockerMessageKey("draft_authority_incomplete"),
    "orders.authority.draft_authority_incomplete"
  );
});

test("live draft and active sync blockers remain stable typed codes", () => {
  assert.equal(
    purchaseAuthorityBlockerMessageKey("draft_authority_stale"),
    "orders.authority.draft_authority_stale"
  );
  assert.equal(
    purchaseAuthorityBlockerMessageKey("pos_sync_in_progress"),
    "orders.authority.pos_sync_in_progress"
  );
});

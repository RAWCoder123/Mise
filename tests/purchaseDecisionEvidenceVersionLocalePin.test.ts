import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PURCHASE_DECISION_EVIDENCE_VERSION } from "../services/domain/purchaseDecisionMemory";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928210000_mise_005bv_purchase_decision_evidence_version_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original004a = readFileSync(
  new URL(
    "../supabase/migrations/20260824120000_mise_004a_purchase_decision_memory.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_decision_evidence_version_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const VERSION_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005BV pins purchase-decision evidence_version CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BV"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint purchase_decision_events_evidence_version_check check \(\s*evidence_version = 'mise\.purchase_decision\.v1'\s*and evidence_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`evidence_version collate "C" ~ '${VERSION_PATTERN}'`),
    "evidence_version CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("evidence_version = 'mise.purchase_decision.v1'"),
    "exact-token allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite contested sibling columns or writers.
  assert.doesNotMatch(sqlBody, /source_event_key/i);
  assert.doesNotMatch(sqlBody, /recommendation_unit/i);
  assert.doesNotMatch(sqlBody, /canonical_unit/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_lines/i);
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.record_purchase_decision_/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.approve_purchase_recommendation/i
  );
});

test("original purchase-decision evidence_version used bare equality without COLLATE C shape", () => {
  assert.match(
    original004a,
    /evidence_version text not null default 'mise\.purchase_decision\.v1'\s*check \(evidence_version = 'mise\.purchase_decision\.v1'\)/
  );
  assert.doesNotMatch(
    original004a,
    /evidence_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.equal(PURCHASE_DECISION_EVIDENCE_VERSION, "mise.purchase_decision.v1");
  assert.match(PURCHASE_DECISION_EVIDENCE_VERSION, /^[A-Za-z0-9._-]{1,80}$/);
});

test("pgTAP fixture pins purchase-decision evidence_version to COLLATE C", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /purchase_decision_events_evidence_version_check exists/);
  assert.match(pgTap, /evidence_version CHECK keeps exact-token allowlist/);
  assert.match(pgTap, /evidence_version CHECK uses COLLATE C/);
  assert.match(pgTap, /writer evidence_version matches under COLLATE C/);
  assert.match(pgTap, /spaced evidence_version is rejected under COLLATE C/);
  assert.match(pgTap, /empty evidence_version token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated evidence_version is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII evidence_version is rejected under COLLATE C/);
});

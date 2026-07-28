import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeOperationalFindingDecision,
  normalizeOperationalFindingDecisionInput,
  operationalFindingDecisionRpcArguments
} from "../services/domain/operationalFindingDecisions";
import type { OperationalFinding } from "../services/domain/operationalFindings";

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const finding: OperationalFinding = {
  id: "finding:recommendation:chicken",
  restaurantId,
  category: "ordering",
  severity: "urgent",
  priority: "now",
  title: "Review chicken coverage",
  explanation: "Projected inventory is below the configured operating level.",
  confidence: { score: 0.92, rationale: "Verified restaurant evidence." },
  evidence: [{
    type: "inventory_item",
    id: "item-chicken",
    observedAt: "2026-07-28T12:00:00.000Z",
    summary: "Chicken has less than one service day of coverage."
  }],
  affectedWorkflow: "inventory_and_ordering",
  recommendedAction: "Review 38 lb from Fresh Produce Co.",
  sourceWindow: {
    start: "2026-07-28T12:00:00.000Z",
    end: "2026-07-28T12:00:00.000Z"
  },
  generatedAt: "2026-07-28T12:05:00.000Z",
  freshness: {
    state: "fresh",
    asOf: "2026-07-28T12:00:00.000Z",
    staleAfter: "2026-07-30T12:00:00.000Z",
    missingData: []
  },
  policyVersion: "beta-findings-v1"
};

function input(overrides = {}) {
  return {
    restaurantId,
    finding,
    decisionType: "approved" as const,
    clientEventId: "device-a:finding-decision-1",
    idempotencyKey: "finding-decision:device-a:1",
    ...overrides
  };
}

test("finding decisions preserve the exact deterministic evidence and policy version", () => {
  const args = operationalFindingDecisionRpcArguments(input());

  assert.equal(args.p_restaurant_id, restaurantId);
  assert.equal(args.p_finding_id, finding.id);
  assert.equal(args.p_policy_version, finding.policyVersion);
  assert.equal(args.p_decision_type, "approved");
  assert.deepEqual(args.p_evidence, finding.evidence);
  assert.equal(args.p_original_recommended_action, finding.recommendedAction);
  assert.equal(args.p_edited_recommended_action, null);
});

test("finding decisions fail closed on cross-tenant, malformed, and ambiguous edits", () => {
  assert.throws(
    () => normalizeOperationalFindingDecisionInput(input({
      finding: { ...finding, restaurantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }
    })),
    /restaurant scope/
  );
  assert.throws(
    () => normalizeOperationalFindingDecisionInput(input({
      finding: { ...finding, evidence: [] }
    })),
    /evidence/
  );
  assert.throws(
    () => normalizeOperationalFindingDecisionInput(input({
      finding: {
        ...finding,
        evidence: [{ ...finding.evidence[0]!, type: "provider_secret" }]
      }
    })),
    /evidence type/
  );
  assert.throws(
    () => normalizeOperationalFindingDecisionInput(input({
      decisionType: "edited",
      editedRecommendedAction: finding.recommendedAction
    })),
    /edit/
  );
  assert.throws(
    () => normalizeOperationalFindingDecisionInput(input({
      decisionType: "approved",
      editedRecommendedAction: "Order less."
    })),
    /edit/
  );
});

test("hosted responses are tenant-scoped and strictly normalized", () => {
  const raw = {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    sequence: 7,
    restaurant_id: restaurantId,
    finding_id: finding.id,
    policy_version: finding.policyVersion,
    decision_type: "edited",
    finding_generated_at: finding.generatedAt,
    finding_category: finding.category,
    severity: finding.severity,
    confidence_score: finding.confidence.score,
    evidence: finding.evidence,
    original_recommended_action: finding.recommendedAction,
    edited_recommended_action: "Review 30 lb after recounting.",
    client_event_id: "device-a:finding-decision-2",
    idempotency_key: "finding-decision:device-a:2",
    actor_user_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    recorded_at: "2026-07-28T12:10:00.000Z"
  };
  const normalized = normalizeOperationalFindingDecision(raw, restaurantId);
  assert.equal(normalized.restaurantId, restaurantId);
  assert.equal(normalized.decisionType, "edited");
  assert.equal(normalized.editedRecommendedAction, "Review 30 lb after recounting.");
  assert.throws(
    () => normalizeOperationalFindingDecision(
      { ...raw, restaurant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      restaurantId
    ),
    /restaurant scope/
  );
});

test("finding feedback stays behind one stable facade in hosted and demo modes", () => {
  const facade = readFileSync("services/miseService.ts", "utf8");
  const application = readFileSync("services/application/findingDecisions.ts", "utf8");
  const hosted = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const demo = readFileSync("services/repositories/demoRepository.ts", "utf8");

  assert.match(facade, /export \* from "\.\/application\/findingDecisions"/);
  assert.match(application, /repository\.recordOperationalFindingDecision/);
  assert.match(hosted, /\.rpc\(\s*"record_operational_finding_decision"/);
  assert.match(demo, /state\.operationalFindingDecisions\.push/);
  assert.doesNotMatch(application, /supabase|functions\.invoke|openai/i);
});

test("finding decision schema is append-only, role-guarded, and operational-mode aware", () => {
  const migration = readFileSync(
    "supabase/migrations/20260728192830_append_operational_finding_decisions.sql",
    "utf8"
  );
  const evidenceHardening = readFileSync(
    "supabase/migrations/20260728194253_harden_operational_finding_evidence.sql",
    "utf8"
  );

  assert.match(migration, /alter table public\.operational_finding_decisions enable row level security/i);
  assert.match(migration, /private\.has_restaurant_role\([\s\S]*array\['owner', 'admin', 'manager'\]/i);
  assert.match(migration, /Operational finding decisions are append-only/i);
  assert.match(migration, /unique \(restaurant_id, client_event_id\)/i);
  assert.match(migration, /unique \(restaurant_id, idempotency_key\)/i);
  assert.match(migration, /create trigger enforce_authenticated_operational_mode/i);
  assert.match(evidenceHardening, /evidence_row - array\['type', 'id', 'observedAt', 'summary'\]/i);
  assert.match(evidenceHardening, /before insert on public\.operational_finding_decisions/i);
  assert.match(migration, /revoke all on table public\.operational_finding_decisions[\s\S]*authenticated/i);
  assert.match(migration, /grant select on table public\.operational_finding_decisions to authenticated/i);
});

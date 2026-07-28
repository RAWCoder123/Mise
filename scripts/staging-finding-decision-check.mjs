import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertStagingPreflight } from "./staging-preflight.mjs";

const url = process.env.SUPABASE_STAGING_URL;
const anonKey = process.env.SUPABASE_STAGING_ANON_KEY;
const password = process.env.MISE_STAGING_SEED_PASSWORD;
const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

if (
  !url ||
  !anonKey ||
  !password ||
  !process.env.SUPABASE_STAGING_PROJECT_REF ||
  !process.env.MISE_STAGING_MARKER
) {
  console.error(
    "Staging finding-decision verification requires the guarded staging URL, project ref, anon key, marker, and fixture password."
  );
  process.exit(1);
}

await assertStagingPreflight();

function anonymousClient() {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

async function signedClient(email) {
  const client = anonymousClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  assert.ok(data.user, `${email} did not return an authenticated user`);
  return client;
}

const managerA = await signedClient("manager-a@mise-staging.test");
const staffA = await signedClient("staff-a@mise-staging.test");
const ownerA = await signedClient("owner-a@mise-staging.test");
const ownerB = await signedClient("owner-b@mise-staging.test");
const runId = randomUUID();
const generatedAt = new Date().toISOString();
const observedAt = generatedAt;
const clientEventId = `hosted-finding-decision:${runId}`;
const idempotencyKey = `hosted-finding-decision:${runId}`;
const evidence = [{
  type: "inventory_item",
  id: `hosted-proof:${runId}`,
  observedAt,
  summary: "Hosted proof: chicken coverage requires manager review."
}];
const baseArguments = {
  p_restaurant_id: tenantA,
  p_finding_id: `finding:recommendation:hosted-${runId}`,
  p_policy_version: "beta-findings-v1",
  p_decision_type: "edited",
  p_finding_generated_at: generatedAt,
  p_finding_category: "ordering",
  p_severity: "urgent",
  p_confidence_score: 0.92,
  p_evidence: evidence,
  p_original_recommended_action: "Review 38 lb.",
  p_edited_recommended_action: "Review 30 lb after recounting.",
  p_client_event_id: clientEventId,
  p_idempotency_key: idempotencyKey
};

const directInsert = await managerA.from("operational_finding_decisions").insert({
  restaurant_id: tenantA,
  finding_id: baseArguments.p_finding_id,
  policy_version: baseArguments.p_policy_version,
  decision_type: "approved",
  finding_generated_at: generatedAt,
  finding_category: "ordering",
  severity: "urgent",
  confidence_score: 0.92,
  evidence,
  original_recommended_action: "Review 38 lb.",
  client_event_id: `${clientEventId}:direct`,
  idempotency_key: `${idempotencyKey}:direct`
});
assert.ok(directInsert.error, "authenticated clients cannot insert finding decisions directly");

const staffAttempt = await staffA.rpc("record_operational_finding_decision", baseArguments);
assert.ok(staffAttempt.error, "staff cannot record authoritative finding feedback");

const crossTenantAttempt = await managerA.rpc("record_operational_finding_decision", {
  ...baseArguments,
  p_restaurant_id: tenantB
});
assert.ok(crossTenantAttempt.error, "a manager cannot record feedback for another restaurant");

const poisonedEvidenceAttempt = await managerA.rpc("record_operational_finding_decision", {
  ...baseArguments,
  p_finding_id: `finding:recommendation:poisoned-${runId}`,
  p_evidence: [{ ...evidence[0], access_token: "must-not-persist" }],
  p_client_event_id: `${clientEventId}:poisoned`,
  p_idempotency_key: `${idempotencyKey}:poisoned`
});
assert.ok(
  poisonedEvidenceAttempt.error,
  "extra evidence fields cannot poison immutable history or restaurant exports"
);

const accepted = await managerA.rpc("record_operational_finding_decision", baseArguments);
if (accepted.error) throw accepted.error;
assert.equal(accepted.data.restaurant_id, tenantA, "accepted feedback remains tenant scoped");
assert.equal(accepted.data.finding_id, baseArguments.p_finding_id, "accepted feedback preserves finding identity");
assert.equal(accepted.data.policy_version, "beta-findings-v1", "accepted feedback preserves policy version");
assert.deepEqual(accepted.data.evidence, evidence, "accepted feedback preserves exact evidence");

const replay = await managerA.rpc("record_operational_finding_decision", baseArguments);
if (replay.error) throw replay.error;
assert.equal(replay.data.id, accepted.data.id, "an exact retry returns the authoritative decision");
assert.equal(replay.data.sequence, accepted.data.sequence, "an exact retry preserves authoritative sequence");

const conflict = await managerA.rpc("record_operational_finding_decision", {
  ...baseArguments,
  p_decision_type: "dismissed",
  p_edited_recommended_action: null
});
assert.ok(conflict.error, "a changed retry surfaces an idempotency conflict");

const ownRead = await managerA
  .from("operational_finding_decisions")
  .select("id,restaurant_id,finding_id,policy_version,decision_type,evidence")
  .eq("restaurant_id", tenantA)
  .eq("client_event_id", clientEventId);
if (ownRead.error) throw ownRead.error;
assert.equal(ownRead.data.length, 1, "manager reads one accepted tenant decision");
assert.equal(ownRead.data[0].id, accepted.data.id, "tenant read returns the authoritative row");

const foreignRead = await managerA
  .from("operational_finding_decisions")
  .select("id")
  .eq("restaurant_id", tenantB)
  .eq("client_event_id", clientEventId);
if (foreignRead.error) throw foreignRead.error;
assert.deepEqual(foreignRead.data, [], "manager cannot read another tenant decision set");

const unrelatedOwnerRead = await ownerB
  .from("operational_finding_decisions")
  .select("id")
  .eq("restaurant_id", tenantA)
  .eq("client_event_id", clientEventId);
if (unrelatedOwnerRead.error) throw unrelatedOwnerRead.error;
assert.deepEqual(unrelatedOwnerRead.data, [], "another tenant owner cannot read the accepted decision");

const auditRead = await ownerA
  .from("audit_logs")
  .select("id,restaurant_id,action,entity_table,entity_id,metadata")
  .eq("restaurant_id", tenantA)
  .eq("action", "operational_finding.decision_recorded")
  .eq("entity_id", accepted.data.id);
if (auditRead.error) throw auditRead.error;
assert.equal(auditRead.data.length, 1, "accepted feedback records one owner-visible audit entry");
assert.equal(auditRead.data[0].metadata.client_event_id, clientEventId, "audit preserves replay identity");

console.log("Hosted operational finding decision proof passed.");

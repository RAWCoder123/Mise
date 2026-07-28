import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateBetaReleaseReadiness,
  REQUIRED_BETA_RELEASE_CHECKS,
  type BetaReleaseEvidence
} from "../services/domain/betaReleaseReadiness";

const commit = "a".repeat(40);

function readyEvidence(): BetaReleaseEvidence {
  return {
    schemaVersion: 1,
    target: "invite_only_testflight_beta",
    candidateCommit: commit,
    candidateBuildId: "ios-preview-42",
    providerRestrictions: {
      squareEnabled: false,
      gmailDeliveryEnabled: false,
      aiEnabled: false,
      billingEnabled: false,
      autonomousOrderingEnabled: false,
      orderingPolicy: "draft_only",
      supplierDelivery: "outside_mise"
    },
    defects: {
      p0: [],
      p1: []
    },
    checks: REQUIRED_BETA_RELEASE_CHECKS.map((id) => ({
      id,
      status: "passed",
      verifiedAt: "2026-08-02T20:00:00.000Z",
      verifiedCommit: commit,
      evidence: `docs/launch/evidence/${id}.json`,
      owner: id.includes("iphone") ? "Cursor" : "Codex"
    })),
    raymondApproval: {
      approved: true,
      approvedAt: "2026-08-03T10:00:00.000Z",
      approvedCommit: commit
    }
  };
}

test("beta release authority passes only a complete exact-commit candidate", () => {
  const result = evaluateBetaReleaseReadiness(readyEvidence(), commit);
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.passedChecks.length, REQUIRED_BETA_RELEASE_CHECKS.length);
});

test("missing receipts, TestFlight build identity, and Raymond approval fail closed", () => {
  const evidence = readyEvidence();
  evidence.candidateBuildId = null;
  evidence.checks[0] = {
    ...evidence.checks[0]!,
    status: "pending",
    verifiedAt: null,
    verifiedCommit: null,
    evidence: null
  };
  evidence.raymondApproval = {
    approved: false,
    approvedAt: null,
    approvedCommit: null
  };

  const result = evaluateBetaReleaseReadiness(evidence, commit);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((blocker) => /build identity/i.test(blocker)));
  assert.ok(result.blockers.some((blocker) => /local_release_gate is pending/i.test(blocker)));
  assert.ok(result.blockers.some((blocker) => /Raymond has not approved/i.test(blocker)));
});

test("evidence and approval from another commit cannot approve the current candidate", () => {
  const evidence = readyEvidence();
  evidence.checks[1] = {
    ...evidence.checks[1]!,
    verifiedCommit: "b".repeat(40)
  };
  evidence.raymondApproval.approvedCommit = "b".repeat(40);

  const result = evaluateBetaReleaseReadiness(evidence, commit);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((blocker) => /hosted_security was not verified/i.test(blocker)));
  assert.ok(result.blockers.some((blocker) => /approval does not match/i.test(blocker)));

  const changedHead = evaluateBetaReleaseReadiness(evidence, "c".repeat(40));
  assert.ok(changedHead.blockers.some((blocker) => /not an ancestor/i.test(blocker)));
});

test("only release evidence files may follow the exact tested candidate", () => {
  const evidenceOnly = evaluateBetaReleaseReadiness(
    readyEvidence(),
    "b".repeat(40),
    [
      "docs/launch/BETA_RELEASE_EVIDENCE.json",
      "docs/launch/evidence/devices/recent-iphone.json"
    ]
  );
  assert.equal(evidenceOnly.ready, true);

  const codeChanged = evaluateBetaReleaseReadiness(
    readyEvidence(),
    "b".repeat(40),
    ["docs/launch/BETA_RELEASE_EVIDENCE.json", "services/miseService.ts"]
  );
  assert.equal(codeChanged.ready, false);
  assert.ok(
    codeChanged.blockers.some((blocker) => /services\/miseService\.ts/.test(blocker))
  );
});

test("uncommitted release workspace changes block an otherwise approved candidate", () => {
  const result = evaluateBetaReleaseReadiness(
    readyEvidence(),
    commit,
    [],
    ["app/(tabs)/today.tsx"]
  );
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((blocker) => /uncommitted files/i.test(blocker)));
});

test("any prohibited beta capability blocks release", () => {
  const capabilityKeys = [
    "squareEnabled",
    "gmailDeliveryEnabled",
    "aiEnabled",
    "billingEnabled",
    "autonomousOrderingEnabled"
  ] as const;
  for (const key of capabilityKeys) {
    const evidence = readyEvidence();
    evidence.providerRestrictions[key] = true;
    const result = evaluateBetaReleaseReadiness(evidence, commit);
    assert.equal(result.ready, false);
    assert.ok(result.blockers.some((blocker) => /prohibited beta provider/i.test(blocker)));
  }
});

test("P0/P1 defects and duplicated or missing checks block release", () => {
  const evidence = readyEvidence();
  evidence.defects.p0.push("Cross-tenant read under investigation");
  evidence.defects.p1.push("Receiving flow cannot recover offline");
  evidence.checks = [
    ...evidence.checks.slice(0, -1),
    evidence.checks[0]!
  ];

  const result = evaluateBetaReleaseReadiness(evidence, commit);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((blocker) => /P0 defects/i.test(blocker)));
  assert.ok(result.blockers.some((blocker) => /P1 defects/i.test(blocker)));
  assert.ok(result.blockers.some((blocker) => /duplicated/i.test(blocker)));
  assert.ok(result.blockers.some((blocker) => /provider_restrictions is missing/i.test(blocker)));
});

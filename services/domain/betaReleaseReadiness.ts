export const REQUIRED_BETA_RELEASE_CHECKS = [
  "local_release_gate",
  "hosted_security",
  "tenant_isolation",
  "managed_backup_restore",
  "sentry_receipt",
  "posthog_receipt",
  "recent_iphone",
  "older_iphone",
  "critical_workflow",
  "privacy_and_support",
  "testflight_install",
  "provider_restrictions"
] as const;

export type BetaReleaseCheckId = (typeof REQUIRED_BETA_RELEASE_CHECKS)[number];

export interface BetaReleaseEvidenceCheck {
  id: BetaReleaseCheckId;
  status: "pending" | "passed" | "failed";
  verifiedAt: string | null;
  verifiedCommit: string | null;
  evidence: string | null;
  owner: string;
}

export interface BetaReleaseEvidence {
  schemaVersion: 1;
  target: "invite_only_testflight_beta";
  candidateCommit: string | null;
  candidateBuildId: string | null;
  providerRestrictions: {
    squareEnabled: boolean;
    gmailDeliveryEnabled: boolean;
    aiEnabled: boolean;
    billingEnabled: boolean;
    autonomousOrderingEnabled: boolean;
    orderingPolicy: "off" | "draft_only";
    supplierDelivery: "outside_mise";
  };
  defects: {
    p0: string[];
    p1: string[];
  };
  checks: BetaReleaseEvidenceCheck[];
  raymondApproval: {
    approved: boolean;
    approvedAt: string | null;
    approvedCommit: string | null;
  };
}

export interface BetaReleaseReadiness {
  ready: boolean;
  candidateCommit: string | null;
  blockers: string[];
  passedChecks: BetaReleaseCheckId[];
}

export function evaluateBetaReleaseReadiness(
  evidence: BetaReleaseEvidence,
  currentCommit: string,
  changedPathsSinceCandidate: readonly string[] | null = null,
  workingTreePaths: readonly string[] = []
): BetaReleaseReadiness {
  const blockers: string[] = [];
  const passedChecks: BetaReleaseCheckId[] = [];
  const candidateCommit = normalizeCommit(evidence.candidateCommit);
  const normalizedCurrentCommit = normalizeCommit(currentCommit);

  if (evidence.schemaVersion !== 1) blockers.push("Unsupported release evidence schema.");
  if (evidence.target !== "invite_only_testflight_beta") {
    blockers.push("Release target is not the invite-only TestFlight beta.");
  }
  if (!candidateCommit) {
    blockers.push("Release candidate commit is not recorded.");
  } else if (candidateCommit !== normalizedCurrentCommit) {
    if (changedPathsSinceCandidate === null) {
      blockers.push("Release candidate is not an ancestor of the current commit.");
    } else {
      const disallowedChanges = changedPathsSinceCandidate.filter(
        (path) =>
          path !== "docs/launch/BETA_RELEASE_EVIDENCE.json" &&
          !path.startsWith("docs/launch/evidence/")
      );
      if (disallowedChanges.length > 0) {
        blockers.push(
          `Release-sensitive files changed after the candidate: ${disallowedChanges.join(", ")}.`
        );
      }
    }
  }
  if (!evidence.candidateBuildId?.trim()) {
    blockers.push("TestFlight candidate build identity is not recorded.");
  }
  if (workingTreePaths.length > 0) {
    blockers.push(
      `Release workspace has uncommitted files: ${workingTreePaths.join(", ")}.`
    );
  }

  const restrictions = evidence.providerRestrictions;
  if (
    restrictions.squareEnabled ||
    restrictions.gmailDeliveryEnabled ||
    restrictions.aiEnabled ||
    restrictions.billingEnabled ||
    restrictions.autonomousOrderingEnabled
  ) {
    blockers.push("A prohibited beta provider or autonomous capability is enabled.");
  }
  if (restrictions.orderingPolicy !== "off" && restrictions.orderingPolicy !== "draft_only") {
    blockers.push("Ordering policy exceeds the beta draft-only boundary.");
  }
  if (restrictions.supplierDelivery !== "outside_mise") {
    blockers.push("Supplier delivery must remain outside Mise.");
  }

  if (evidence.defects.p0.length > 0) blockers.push("One or more P0 defects remain open.");
  if (evidence.defects.p1.length > 0) blockers.push("One or more P1 defects remain open.");

  const checksById = new Map<BetaReleaseCheckId, BetaReleaseEvidenceCheck>();
  for (const check of evidence.checks) {
    if (checksById.has(check.id)) {
      blockers.push(`Release check ${check.id} is duplicated.`);
      continue;
    }
    checksById.set(check.id, check);
  }
  for (const id of REQUIRED_BETA_RELEASE_CHECKS) {
    const check = checksById.get(id);
    if (!check) {
      blockers.push(`Release check ${id} is missing.`);
      continue;
    }
    if (check.status !== "passed") {
      blockers.push(`Release check ${id} is ${check.status}.`);
      continue;
    }
    if (!check.owner.trim() || !check.evidence?.trim()) {
      blockers.push(`Release check ${id} has no owner or evidence reference.`);
      continue;
    }
    if (!isTimestamp(check.verifiedAt)) {
      blockers.push(`Release check ${id} has no valid verification time.`);
      continue;
    }
    if (!candidateCommit || normalizeCommit(check.verifiedCommit) !== candidateCommit) {
      blockers.push(`Release check ${id} was not verified against the candidate commit.`);
      continue;
    }
    passedChecks.push(id);
  }

  if (!evidence.raymondApproval.approved) {
    blockers.push("Raymond has not approved the release candidate.");
  } else {
    if (!isTimestamp(evidence.raymondApproval.approvedAt)) {
      blockers.push("Raymond approval has no valid timestamp.");
    }
    if (
      !candidateCommit ||
      normalizeCommit(evidence.raymondApproval.approvedCommit) !== candidateCommit
    ) {
      blockers.push("Raymond approval does not match the candidate commit.");
    }
  }

  return {
    ready: blockers.length === 0,
    candidateCommit,
    blockers,
    passedChecks
  };
}

function normalizeCommit(value: string | null) {
  if (!value || !/^[0-9a-f]{40}$/i.test(value.trim())) return null;
  return value.trim().toLowerCase();
}

function isTimestamp(value: string | null) {
  return value !== null && Number.isFinite(Date.parse(value));
}

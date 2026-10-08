import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  evaluateBetaReleaseReadiness,
  REQUIRED_BETA_RELEASE_CHECKS,
  type BetaReleaseEvidence
} from "../services/domain/betaReleaseReadiness";

const source = readFileSync(
  new URL("../services/domain/betaReleaseReadiness.ts", import.meta.url),
  "utf8"
);

const commit = "a".repeat(40);
const upperCommit = "A".repeat(40);

function readyEvidence(candidateCommit = commit): BetaReleaseEvidence {
  return {
    schemaVersion: 1,
    target: "invite_only_testflight_beta",
    candidateCommit,
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
      verifiedCommit: candidateCommit,
      evidence: `docs/launch/evidence/${id}.json`,
      owner: id.includes("iphone") ? "Cursor" : "Codex"
    })),
    raymondApproval: {
      approved: true,
      approvedAt: "2026-08-03T10:00:00.000Z",
      approvedCommit: candidateCommit
    }
  };
}

test("MISE-005KO pins betaReleaseReadiness commit identity to ASCII C", () => {
  assert.match(source, /MISE-005KO/);
  assert.match(
    source,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );
  assert.match(
    source,
    /function asciiTrim\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  const normalizeBody = source.slice(
    source.indexOf("function normalizeCommit(value: string | null)"),
    source.indexOf("function isTimestamp(value: string | null)")
  );

  assert.match(normalizeBody, /asciiTrim\(value\)/);
  assert.match(normalizeBody, /asciiCLower\(trimmed\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
});

test("ASCII C fold keeps ordinary hex commit case folding stable", () => {
  const mixed = `b${"c".repeat(38)}D`;
  const result = evaluateBetaReleaseReadiness(readyEvidence(mixed), mixed.toUpperCase());
  assert.equal(result.ready, true);
  assert.equal(result.candidateCommit, mixed.toLowerCase());

  const upperReady = evaluateBetaReleaseReadiness(readyEvidence(upperCommit), commit);
  assert.equal(upperReady.ready, true);
  assert.equal(upperReady.candidateCommit, commit);
});

test("non-hex Unicode folds stay fail-closed under ASCII C commit identity", () => {
  // Kelvin folds to ASCII k under Unicode lower, but k is outside [0-9a-f].
  // Pinning ASCII C + hex validation must still reject it.
  assert.equal("K".toLowerCase(), "k");
  assert.equal("K".toLocaleLowerCase(), "k");
  assert.equal(/^[0-9a-f]{40}$/.test(`${"a".repeat(39)}k`), false);

  const forged = `${"a".repeat(39)}K`;
  const result = evaluateBetaReleaseReadiness(readyEvidence(forged), `${"a".repeat(39)}k`);
  assert.equal(result.ready, false);
  assert.equal(result.candidateCommit, null);
  assert.ok(result.blockers.some((blocker) => /candidate commit is not recorded/i.test(blocker)));
});

test("ASCII commit trim ignores NBSP; Unicode trim would invent release identity", () => {
  const nbspPadded = `\u00a0${commit}\u00a0`;
  // Unicode trim invents an exact match against the unpadded candidate.
  assert.equal(nbspPadded.trim(), commit);
  assert.equal(nbspPadded.trim().toLowerCase(), commit);

  const result = evaluateBetaReleaseReadiness(readyEvidence(nbspPadded), commit);
  assert.equal(result.ready, false);
  assert.equal(result.candidateCommit, null);
  assert.ok(result.blockers.some((blocker) => /candidate commit is not recorded/i.test(blocker)));

  const emSpacePadded = `\u2003${commit}\u2003`;
  assert.equal(emSpacePadded.trim(), commit);
  const emResult = evaluateBetaReleaseReadiness(readyEvidence(emSpacePadded), commit);
  assert.equal(emResult.ready, false);
  assert.equal(emResult.candidateCommit, null);

  const asciiPadded = `  ${upperCommit}  `;
  const asciiReady = evaluateBetaReleaseReadiness(readyEvidence(asciiPadded), commit);
  assert.equal(asciiReady.ready, true);
  assert.equal(asciiReady.candidateCommit, commit);
});

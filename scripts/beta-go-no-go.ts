import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import {
  evaluateBetaReleaseReadiness,
  type BetaReleaseEvidence
} from "../services/domain/betaReleaseReadiness";

const root = process.cwd();
const evidencePath = resolve(root, "docs/launch/BETA_RELEASE_EVIDENCE.json");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as BetaReleaseEvidence;
const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8"
}).trim();
const candidateCommit =
  typeof evidence.candidateCommit === "string" &&
  /^[0-9a-f]{40}$/i.test(evidence.candidateCommit)
    ? evidence.candidateCommit
    : null;
let changedPathsSinceCandidate: string[] | null = null;
if (candidateCommit && candidateCommit !== currentCommit) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", candidateCommit, currentCommit], {
      cwd: root,
      stdio: "ignore"
    });
    changedPathsSinceCandidate = execFileSync(
      "git",
      ["diff", "--name-only", `${candidateCommit}..${currentCommit}`],
      { cwd: root, encoding: "utf8" }
    )
      .split("\n")
      .map((path) => path.trim())
      .filter(Boolean);
  } catch {
    changedPathsSinceCandidate = null;
  }
}
const trackedWorkingTreePaths = [
  ...execFileSync("git", ["diff", "--name-only"], { cwd: root, encoding: "utf8" }).split("\n"),
  ...execFileSync("git", ["diff", "--cached", "--name-only"], {
    cwd: root,
    encoding: "utf8"
  }).split("\n")
];
const untrackedWorkingTreePaths = execFileSync(
  "git",
  ["ls-files", "--others", "--exclude-standard"],
  { cwd: root, encoding: "utf8" }
)
  .split("\n")
  .filter(
    (path) =>
      path &&
      !path.startsWith(".cursor/") &&
      path !== "docs/launch/CURRENT_BATCH 2.yaml" &&
      path !== "docs/launch/CURRENT_BATCH 3.yaml"
  );
const workingTreePaths = [...new Set(
  [...trackedWorkingTreePaths, ...untrackedWorkingTreePaths]
    .map((path) => path.trim())
    .filter(Boolean)
)].sort();
const result = evaluateBetaReleaseReadiness(
  evidence,
  currentCommit,
  changedPathsSinceCandidate,
  workingTreePaths
);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else if (result.ready) {
  console.log(`Mise beta release gate passed for ${result.candidateCommit}.`);
  console.log(`${result.passedChecks.length} required evidence checks passed.`);
} else {
  console.error("Mise beta release gate is BLOCKED.");
  for (const blocker of result.blockers) console.error(`- ${blocker}`);
  console.error(
    `Passed evidence checks: ${result.passedChecks.length}/${evidence.checks.length}`
  );
}

process.exit(result.ready ? 0 : 1);

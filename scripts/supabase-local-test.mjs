import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { minimalChildEnv } from "./safe-env.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const dockerPaths = [
  join(homedir(), ".docker", "bin"),
  join(homedir(), "Applications", "Docker.app", "Contents", "Resources", "bin"),
  "/Applications/Docker.app/Contents/Resources/bin"
].filter(existsSync);
const childEnvironment = minimalChildEnv({
  PATH: [...dockerPaths, process.env.PATH ?? ""].filter(Boolean).join(delimiter)
});

function runSupabase(arguments_, options = {}) {
  const attempts = Math.max(1, (options.retries ?? 0) + 1);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(npx, ["supabase", ...arguments_], {
      cwd: projectRoot,
      env: childEnvironment,
      stdio: "inherit"
    });
    if (result.error) throw result.error;
    if (result.status === 0) return;
    if (attempt < attempts) {
      console.warn(
        `Supabase ${arguments_.join(" ")} was not ready (attempt ${attempt}/${attempts}); retrying.`
      );
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2_000);
      continue;
    }
    const error = new Error(`supabase ${arguments_.join(" ")} failed with exit code ${result.status ?? 1}`);
    error.exitStatus = result.status ?? 1;
    throw error;
  }
}

function runNode(scriptPath, nodeArguments = []) {
  const result = spawnSync(process.execPath, [...nodeArguments, scriptPath], {
    cwd: projectRoot,
    env: childEnvironment,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${scriptPath} failed with exit code ${result.status ?? 1}`);
    error.exitStatus = result.status ?? 1;
    throw error;
  }
}

try {
  // `db start` is idempotent and keeps this gate usable on a clean machine.
  runSupabase(["db", "start"]);
  runSupabase(["db", "reset"]);

  // Docker Desktop may not have macOS privacy access to a checkout under
  // ~/Documents. Stage only the non-secret pgTAP sources in the system temp
  // directory instead of requesting broad filesystem access.
  const stagedRoot = mkdtempSync(join(tmpdir(), "mise-supabase-tests-"));
  const stagedTests = join(stagedRoot, "tests");

  try {
    cpSync(join(projectRoot, "supabase", "tests"), stagedTests, { recursive: true });
    runNode("scripts/inventory-projection-concurrency.mjs");
    runNode("scripts/pos-mapping-review-concurrency.mjs");
    runNode("scripts/purchase-approval-concurrency.mjs");
    runNode("scripts/purchase-approval-square-sync-concurrency.mjs");
    runNode("scripts/purchase-decision-memory-concurrency.mjs");
    runNode("scripts/pilot-operational-controls-concurrency.mjs");
    runNode("scripts/supplier-send-concurrency.mjs");
    runNode("scripts/supplier-identity-concurrency.mjs");
    runNode("scripts/supplier-send-fingerprint-parity.mjs", ["--import", "tsx"]);
    // Container restarts can briefly complete before Postgres accepts a new
    // connection on macOS. Retry only the read-only test runner, never reset.
    runSupabase(["test", "db", stagedTests], { retries: 2 });
    runNode("scripts/local-workspace-concurrency.mjs");
    runSupabase(["db", "advisors", "--local", "--type", "security", "--fail-on", "error"]);
  } finally {
    rmSync(stagedRoot, { recursive: true, force: true });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = Number.isInteger(error?.exitStatus) ? error.exitStatus : 1;
}

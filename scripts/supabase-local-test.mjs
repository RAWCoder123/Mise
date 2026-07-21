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

function runSupabase(arguments_) {
  const result = spawnSync(npx, ["supabase", ...arguments_], {
    cwd: projectRoot,
    env: childEnvironment,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`supabase ${arguments_.join(" ")} failed with exit code ${result.status ?? 1}`);
    error.exitStatus = result.status ?? 1;
    throw error;
  }
}

function runNode(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
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
    runSupabase(["test", "db", stagedTests]);
    runNode("scripts/local-workspace-concurrency.mjs");
    runSupabase(["db", "advisors", "--local", "--type", "security", "--fail-on", "error"]);
  } finally {
    rmSync(stagedRoot, { recursive: true, force: true });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = Number.isInteger(error?.exitStatus) ? error.exitStatus : 1;
}

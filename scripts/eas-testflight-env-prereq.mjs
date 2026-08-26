import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  EAS_CLI_VERSION,
  TESTFLIGHT_EAS_ENVIRONMENT,
  evaluateTestflightEasParity,
  parseEasEnvironmentVariable,
  parseEasProjectInfo
} from "./lib/eas-testflight-env-parity.mjs";
import { publicQaEnv, testflightPublicQaEnv } from "./safe-env.mjs";

function readJson(name) {
  try {
    return JSON.parse(readFileSync(resolve(process.cwd(), name), "utf8"));
  } catch {
    return null;
  }
}

function runEas(args) {
  return spawnSync("npx", ["--yes", `eas-cli@${EAS_CLI_VERSION}`, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: publicQaEnv({ CI: "1", EXPO_NO_TELEMETRY: "1" }),
    maxBuffer: 1024 * 1024,
    timeout: 60000
  });
}

function readRemoteProjectId() {
  const result = runEas(["project:info"]);
  return result.status === 0 ? parseEasProjectInfo(result.stdout) : null;
}

function readRemoteVariable(name) {
  const result = runEas([
    "env:get",
    TESTFLIGHT_EAS_ENVIRONMENT,
    "--variable-name",
    name,
    "--format",
    "long",
    "--scope",
    "project",
    "--non-interactive"
  ]);
  return result.status === 0 ? parseEasEnvironmentVariable(result.stdout, name) : null;
}

const appConfig = readJson("app.json");
const easConfig = readJson("eas.json");
let localQaEnv = null;
try {
  localQaEnv = testflightPublicQaEnv();
} catch {
  // The bounded comparator reports the missing trusted local value without exposing it.
}

const result = evaluateTestflightEasParity({
  localProjectId: appConfig?.expo?.extra?.eas?.projectId ?? null,
  remoteProjectId: readRemoteProjectId(),
  testflightProfile: easConfig?.build?.testflight ?? null,
  remoteUrl: readRemoteVariable("EXPO_PUBLIC_SUPABASE_URL"),
  remoteAnonKey: readRemoteVariable("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
  expectedAnonKey: localQaEnv?.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? null
});

if (!result.ok) {
  console.error("Mise EAS TestFlight environment parity failed:");
  result.failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Mise EAS TestFlight environment parity passed.");
console.log(`- Remote EAS environment: ${result.summary.environment}`);
console.log(`- Remote EAS project: ${result.summary.project}`);
console.log(`- Remote Supabase URL: ${result.summary.supabaseUrl}`);
console.log(`- URL parity: ${result.summary.urlParity}`);
console.log(`- Anon key parity: ${result.summary.anonKeyParity}`);
console.log(`- Demo mode: ${result.summary.demoMode}`);
console.log(`- EAS environment parity: ${result.summary.environmentParity}`);

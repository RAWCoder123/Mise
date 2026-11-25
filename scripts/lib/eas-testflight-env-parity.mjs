import { timingSafeEqual } from "node:crypto";

export const EAS_CLI_VERSION = "21.4.0";
export const TESTFLIGHT_EAS_ENVIRONMENT = "preview";
export const TESTFLIGHT_EAS_PROJECT_ID = "bf74b605-68fb-4457-9eb8-e68b9c4aac0d";
export const TESTFLIGHT_SUPABASE_URL = "https://ycwozuyyxunnnvalydar.supabase.co";

const ansiPattern = /\u001b\[[0-?]*[ -/]*[@-~]/g;

function stripAnsi(value) {
  return String(value ?? "").replace(ansiPattern, "");
}

function fieldFromLongOutput(output, label, preserveWhitespace = false) {
  const line = stripAnsi(output)
    .split(/\r?\n/)
    .find((candidate) => new RegExp(`^${label}\\s{2,}`).test(candidate));
  if (!line) return null;
  const value = line.replace(new RegExp(`^${label}\\s{2,}`), "");
  return preserveWhitespace ? value : value.trim();
}

export function parseEasProjectInfo(output) {
  const ids = stripAnsi(output)
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^ID\s{2,}([0-9a-f-]{36})\s*$/i);
      return match ? [match[1].toLowerCase()] : [];
    });
  return ids.length === 1 ? ids[0] : null;
}

export function parseEasEnvironmentVariable(output, expectedName) {
  const name = fieldFromLongOutput(output, "Name");
  if (!name || name !== expectedName) return null;
  const value = fieldFromLongOutput(output, "Value", true);
  const visibility = fieldFromLongOutput(output, "Visibility")?.toUpperCase() ?? "UNKNOWN";
  const scope = fieldFromLongOutput(output, "Scope")?.toUpperCase() ?? "UNKNOWN";
  const environments = (fieldFromLongOutput(output, "Environments") ?? "")
    .split(/[\s,]+/)
    .map((environment) => environment.trim().toLowerCase())
    .filter(Boolean);
  const readable = Boolean(
    value &&
    visibility !== "SECRET" &&
    !/^\*{3,}$/.test(value) &&
    !/secret variables? (?:are|is) not available/i.test(value)
  );
  return { name, value, visibility, scope, environments, readable };
}

function exactPrivateMatch(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function inspectRemoteVariable(variable, name, expectedValue, comparison) {
  if (!variable) {
    return {
      parity: "MISSING",
      failure: `${name}: MISSING in the EAS Preview environment. Add or correct ${name} before building.`
    };
  }
  if (!variable.readable) {
    return {
      parity: "UNREADABLE",
      failure:
        `${name}: UNREADABLE. Set ${name} to Sensitive or Plain text visibility in the EAS Preview environment so exact parity can be verified.`
    };
  }
  if (variable.scope !== "PROJECT" || !variable.environments.includes(TESTFLIGHT_EAS_ENVIRONMENT)) {
    return {
      parity: "MISMATCH",
      failure: `${name}: MISMATCH. Configure ${name} at project scope for the EAS Preview environment.`
    };
  }
  const matches = comparison === "private"
    ? exactPrivateMatch(variable.value, expectedValue)
    : variable.value === expectedValue;
  return matches
    ? { parity: "MATCH", failure: null }
    : {
        parity: "MISMATCH",
        failure: `${name}: MISMATCH in the EAS Preview environment. Correct ${name} before building.`
      };
}

export function evaluateTestflightEasParity({
  localProjectId,
  remoteProjectId,
  testflightProfile,
  remoteUrl,
  remoteAnonKey,
  expectedAnonKey
}) {
  const failures = [];

  if (localProjectId !== TESTFLIGHT_EAS_PROJECT_ID) {
    failures.push(`EAS project identity: MISMATCH. Link this repository to ${TESTFLIGHT_EAS_PROJECT_ID}.`);
  }
  if (remoteProjectId !== TESTFLIGHT_EAS_PROJECT_ID) {
    failures.push(`Remote EAS project identity: MISMATCH or MISSING. Expected ${TESTFLIGHT_EAS_PROJECT_ID}.`);
  }
  if (testflightProfile?.environment !== TESTFLIGHT_EAS_ENVIRONMENT) {
    failures.push("TestFlight EAS environment: MISMATCH or MISSING. Set build.testflight.environment to preview.");
  }
  if (testflightProfile?.env?.EXPO_PUBLIC_APP_ENV !== "staging") {
    failures.push("EXPO_PUBLIC_APP_ENV: MISMATCH or MISSING in the TestFlight profile. Expected staging.");
  }
  if (testflightProfile?.env?.EXPO_PUBLIC_ENABLE_DEMO_MODE !== "false") {
    failures.push("EXPO_PUBLIC_ENABLE_DEMO_MODE: MISMATCH or MISSING in the TestFlight profile. Expected false.");
  }
  if (typeof expectedAnonKey !== "string" || expectedAnonKey.length === 0) {
    failures.push("Local intended EXPO_PUBLIC_SUPABASE_ANON_KEY: MISSING. Restore the trusted staging preflight value.");
  }

  const urlResult = inspectRemoteVariable(
    remoteUrl,
    "EXPO_PUBLIC_SUPABASE_URL",
    TESTFLIGHT_SUPABASE_URL,
    "public"
  );
  const anonResult = inspectRemoteVariable(
    remoteAnonKey,
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    expectedAnonKey,
    "private"
  );
  if (urlResult.failure) failures.push(urlResult.failure);
  if (anonResult.failure) failures.push(anonResult.failure);

  return {
    ok: failures.length === 0,
    failures,
    summary: {
      environment: TESTFLIGHT_EAS_ENVIRONMENT,
      project: TESTFLIGHT_EAS_PROJECT_ID,
      supabaseUrl: TESTFLIGHT_SUPABASE_URL,
      urlParity: urlResult.parity,
      anonKeyParity: anonResult.parity,
      demoMode: testflightProfile?.env?.EXPO_PUBLIC_ENABLE_DEMO_MODE ?? "MISSING",
      environmentParity: failures.length === 0 ? "MATCH" : "MISMATCH"
    }
  };
}

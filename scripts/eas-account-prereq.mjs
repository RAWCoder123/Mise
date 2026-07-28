import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { publicQaEnv } from "./safe-env.mjs";

const EAS_CLI_VERSION = "21.4.0";
const failures = [];
const notes = [];

function readAppConfig() {
  try {
    return JSON.parse(readFileSync(resolve(process.cwd(), "app.json"), "utf8"));
  } catch {
    failures.push("app.json could not be read.");
    return null;
  }
}

function checkProjectIdentity() {
  const config = readAppConfig();
  const projectId = config?.expo?.extra?.eas?.projectId;
  if (
    typeof projectId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)
  ) {
    failures.push(
      "app.json is missing expo.extra.eas.projectId. Raymond must run the authenticated EAS project-link flow before building."
    );
    return;
  }
  notes.push(`EAS project identity is configured: ${projectId}`);
}

function checkAuthenticatedAccount() {
  const result = spawnSync(
    "npx",
    ["--yes", `eas-cli@${EAS_CLI_VERSION}`, "whoami"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: publicQaEnv({ CI: "1", EXPO_NO_TELEMETRY: "1" })
    }
  );
  if (result.status !== 0) {
    failures.push(
      `EAS CLI ${EAS_CLI_VERSION} is not authenticated. Raymond must run: npx --yes eas-cli@${EAS_CLI_VERSION} login`
    );
    return;
  }
  const account = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  notes.push(`EAS CLI ${EAS_CLI_VERSION} authenticated account: ${account || "verified"}`);
}

checkProjectIdentity();
checkAuthenticatedAccount();

if (failures.length > 0) {
  console.error("Mise EAS account readiness failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Mise EAS account readiness passed.");
notes.forEach((note) => console.log(`- ${note}`));

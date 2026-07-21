import { spawnSync } from "node:child_process";
import { minimalChildEnv, trustedHostedChildEnv } from "./safe-env.mjs";

const requiredHostedEnvironment = [
  "SUPABASE_STAGING_URL",
  "SUPABASE_STAGING_ANON_KEY",
  "SUPABASE_STAGING_SECRET_KEY",
  "SUPABASE_STAGING_PROJECT_REF",
  "MISE_STAGING_MARKER",
  "MISE_STAGING_SEED_PASSWORD"
];
const missing = requiredHostedEnvironment.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Private-beta closure is fail-closed; hosted access is missing: ${missing.join(", ")}.`);
  console.error("Run verify:private-beta-security:local for local-only evidence, or load the trusted staging secrets for closure.");
  process.exit(1);
}

for (const script of ["verify:private-beta-security:local", "verify:private-beta-security:hosted"]) {
  const result = spawnSync("npm", ["run", script], {
    cwd: process.cwd(),
    env: script.endsWith(":local") ? minimalChildEnv({ CI: "1" }) : trustedHostedChildEnv(),
    stdio: "inherit"
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Mise private-beta security closure passed locally and against hosted staging.");

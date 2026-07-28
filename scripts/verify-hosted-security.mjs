import { spawnSync } from "node:child_process";
import { stagingChildEnv } from "./safe-env.mjs";
import { assertStagingPreflight } from "./staging-preflight.mjs";

const requiredEnvironment = [
  "SUPABASE_STAGING_URL",
  "SUPABASE_STAGING_ANON_KEY",
  "SUPABASE_STAGING_SECRET_KEY",
  "SUPABASE_STAGING_PROJECT_REF",
  "MISE_STAGING_MARKER",
  "MISE_STAGING_SEED_PASSWORD"
];
const missing = requiredEnvironment.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Hosted security verification requires local secret-backed environment values: ${missing.join(", ")}.`);
  console.error("Load them from the trusted staging secret store; do not paste them into chat or commit them.");
  process.exit(1);
}

await assertStagingPreflight();
if (process.env.SUPABASE_STAGING_SECRET_KEY === process.env.SUPABASE_STAGING_ANON_KEY) {
  console.error("Hosted verification requires a server-only staging secret distinct from the public anon key.");
  process.exit(1);
}

function run(script) {
  const common = [
    "SUPABASE_STAGING_URL",
    "SUPABASE_STAGING_ANON_KEY",
    "SUPABASE_STAGING_PROJECT_REF",
    "MISE_STAGING_MARKER"
  ];
  const variables = script === "staging:seed"
    ? [...common, "SUPABASE_STAGING_SECRET_KEY", "MISE_STAGING_SEED_PASSWORD"]
    : script === "staging:service-rpc"
      ? [...common, "SUPABASE_STAGING_SECRET_KEY"]
      : [
          ...common,
          "MISE_STAGING_SEED_PASSWORD",
          "MISE_STAGING_CLIENT_RACE_URL",
          "MISE_STAGING_CLIENT_RACE_PORT",
          "MISE_STAGING_CLIENT_RACE_DEBUG_PORT",
          "MISE_STAGING_CLIENT_RACE_TIMEOUT_MS"
        ];
  const result = spawnSync("npm", ["run", script], {
    cwd: process.cwd(),
    env: stagingChildEnv(variables),
    stdio: "inherit"
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// The rendered mutation-race suite and tenant workflow suite intentionally
// change fixture state. Reseed between them so every proof starts clean.
run("staging:seed");
run("staging:client-race");
run("staging:seed");
run("staging:tenant-check");
run("staging:service-rpc");
run("staging:edge-concurrency");
run("staging:finding-decision-check");
run("staging:restaurant-export-check");

console.log("Mise hosted private-beta security verification passed without skipped checks.");

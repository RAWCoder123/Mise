import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const root = process.cwd();

const sqlRoots = ["supabase/migrations", "supabase/schema.sql", "supabase/tests"];
const clientRoots = [
  "app",
  "components",
  "constants",
  "contexts",
  "lib",
  "services",
  "types",
  "utils",
  ".env.example",
  "app.json",
  "package.json",
  "package-lock.json",
  ".circleci/config.yml"
];

const allowedPublicEnv = new Set([
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_ENABLE_DEMO_MODE",
  "EXPO_PUBLIC_APP_ENV",
  "EXPO_PUBLIC_SENTRY_DSN",
  "EXPO_PUBLIC_POSTHOG_KEY",
  "EXPO_PUBLIC_POSTHOG_HOST",
  "EXPO_PUBLIC_PRIVACY_URL"
]);

const sqlChecks = [
  { pattern: /\busing\s*\(\s*true\s*\)/i, message: "Broad RLS USING (true) policy" },
  { pattern: /\bwith\s+check\s*\(\s*true\s*\)/i, message: "Broad RLS WITH CHECK (true) policy" },
  {
    pattern: /grant\s+select\s*,\s*update\s+on\s+public\.users\s+to\s+authenticated/i,
    message: "Legacy public.users broad update grant"
  }
];

const sensitiveClientReadableColumns = [
  "access_token",
  "refresh_token",
  "client_secret",
  "oauth_token",
  "smtp_password",
  "api_key",
  "service_role"
];

const restaurantOwnedTables = new Set([
  "pos_sales",
  "inventory_items",
  "menu_item_ingredients",
  "purchase_recommendations",
  "supplier_orders",
  "insights",
  "pos_integrations",
  "sales_imports",
  "supplier_items",
  "purchase_orders",
  "ai_insights",
  "audit_logs",
  "restaurant_email_connections",
  "supplier_recipients",
  "setup_attachments",
  "operational_issues",
  "mise_actions",
  "action_outcomes",
  "restaurant_memories",
  "restaurant_autonomy_rules",
  "restaurant_tasks",
  "restaurant_task_dependencies",
  "activity_events",
  "supplier_order_confirmations",
  "supplier_deliveries",
  "supplier_delivery_items"
]);

const serviceOnlyPublicTables = new Set([
  "outreach_agent_runs",
  "outreach_campaigns",
  "outreach_enrollments",
  "outreach_events",
  "outreach_leads",
  "outreach_messages",
  "outreach_suppressions"
]);

const nonTenantEdgeFunctions = new Set(["outreach-agent", "outreach-unsubscribe", "outreach-webhook"]);
const providerCallbackEdgeFunctions = new Set([
  "gmail-oauth-callback",
  "square-oauth-callback",
  "square-webhooks"
]);

const providerSecretIdentifiers = [
  "SQUARE_ACCESS_TOKEN",
  "TOAST_CLIENT_SECRET",
  "CLOVER_ACCESS_TOKEN",
  "LIGHTSPEED_ACCESS_TOKEN",
  "GOOGLE_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_ACCESS_TOKEN",
  "OPENAI_API_KEY"
];

const secretNameParts = [
  ["SUPABASE", "SERVICE", "ROLE"],
  ["SUPABASE", "SECRET", "KEY"],
  ["OPENAI", "API", "KEY"],
  ["STRIPE", "SECRET", "KEY"],
  ["TOAST", "CLIENT", "SECRET"],
  ["SQUARE", "ACCESS", "TOKEN"],
  ["CLOVER", "ACCESS", "TOKEN"],
  ["GOOGLE", "CLIENT", "SECRET"],
  ["GMAIL", "ACCESS", "TOKEN"],
  ["GMAIL", "REFRESH", "TOKEN"],
  ["SMTP", "PASSWORD"],
  ["JWT", "SECRET"],
  ["DB", "PASSWORD"]
];

const clientSecretChecks = secretNameParts.map((parts) => ({
  pattern: new RegExp(parts.join("[_\\s-]*"), "i"),
  message: `Forbidden client secret name: ${parts.join("_")}`
}));

function listFiles(path) {
  const absolute = join(root, path);
  let stats;
  try {
    stats = statSync(absolute);
  } catch {
    return [];
  }

  if (stats.isFile()) return [path];
  return readdirSync(absolute).flatMap((entry) => {
    const next = join(path, entry);
    if (next.includes("node_modules") || next.includes(".expo")) return [];
    const nextStats = statSync(join(root, next));
    return nextStats.isDirectory() ? listFiles(next) : [next];
  });
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const failures = [];
const sqlFiles = sqlRoots.flatMap(listFiles).filter((path) => path.endsWith(".sql"));
const combinedSql = sqlFiles.map(read).join("\n");

for (const file of sqlFiles) {
  const contents = read(file);
  for (const check of sqlChecks) {
    if (check.pattern.test(contents)) {
      failures.push(`${file}: ${check.message}`);
    }
  }

  for (const statement of contents.match(/[^;]*\bto\s+anon\b[^;]*;/gi) ?? []) {
    if (!/grant\s+execute\s+on\s+function\s+public\.verify_staging_identity\s*\(text\)\s+to\s+anon\s*,\s*authenticated/i.test(statement)) {
      failures.push(`${file}: Grant or policy exposed directly to anon`);
    }
  }

  const lines = contents.split(/\r?\n/);
  lines.forEach((line, index) => {
    const columnPattern = new RegExp(
      `^\\s*(${sensitiveClientReadableColumns.join("|")})\\s+(text|varchar|character varying|jsonb|json)\\b`,
      "i"
    );
    if (columnPattern.test(line)) {
      failures.push(`${file}:${index + 1}: Client-readable table defines OAuth/token/secret-like column`);
    }
  });
}

const publicTables = [...combinedSql.matchAll(/create\s+table\s+if\s+not\s+exists\s+public\.([a-z_]+)/gi)]
  .map((match) => match[1])
  .filter(Boolean);

for (const table of new Set(publicTables)) {
  if (serviceOnlyPublicTables.has(table)) {
    const revokePattern = new RegExp(
      `revoke\\s+all\\s+on\\s+public\\.${escapeRegExp(table)}\\s+from\\s+anon\\s*,\\s*authenticated`,
      "i"
    );
    if (!revokePattern.test(combinedSql)) {
      failures.push(`supabase: service-only public.${table} must explicitly revoke anon and authenticated access`);
    }
    continue;
  }
  const grantPattern = new RegExp(`grant\\s+[^;]+\\s+on\\s+public\\.${escapeRegExp(table)}\\s+to\\s+authenticated`, "i");
  if (!grantPattern.test(combinedSql)) {
    failures.push(`supabase: public.${table} is exposed through the Data API but has no authenticated grant`);
  }
}

for (const file of clientRoots.flatMap(listFiles).filter((path) => /\.(ts|tsx|js|json|env|yml|yaml)$/.test(path))) {
  const contents = read(file);
  for (const check of clientSecretChecks) {
    if (check.pattern.test(contents)) {
      failures.push(`${file}: ${check.message}`);
    }
  }
}

const repositorySources = [
  "services/repositories/miseRepository.ts",
  "services/repositories/supabaseRepository.ts",
  "services/repositories/demoRepository.ts"
];
const destructiveQueryPattern = /\.from\("([a-z_]+)"\)([\s\S]*?);/g;
for (const repositoryFile of repositorySources) {
  const repositorySource = read(repositoryFile);
  for (const match of repositorySource.matchAll(destructiveQueryPattern)) {
    const [, table, chain] = match;
    if (!restaurantOwnedTables.has(table)) continue;
    if (!/\.(delete|update)\s*\(/.test(chain)) continue;
    if (!/\.eq\(\s*"restaurant_id"\s*,/.test(chain)) {
      failures.push(`${repositoryFile}: destructive ${table} query is missing restaurant_id scope`);
    }
  }
}

const functionSources = listFiles("supabase/functions").filter((path) => path.endsWith(".ts"));
for (const file of functionSources) {
  const contents = read(file);
  if (/missingSecret/.test(contents)) {
    failures.push(`${file}: Edge Function response/metadata must not expose missing secret identifiers`);
  }
  if (file.endsWith("/index.ts")) {
    const functionName = basename(file.replace(/\/index\.ts$/, ""));
    if (functionName === "outreach-agent") {
      if (!/await\s+requireAgentSecret\(req\);[\s\S]*?await\s+readJsonObject\(req\);[\s\S]*?createServiceClient\(\)/.test(contents)) {
        failures.push(`${file}: service-only authentication must complete before body handling or service credentials are loaded`);
      }
    } else if (functionName === "outreach-webhook") {
      if (!/new\s+Webhook\(webhookSecret\)\.verify\([\s\S]*?createServiceClient\(\)/.test(contents)) {
        failures.push(`${file}: provider signature verification must complete before service credentials are loaded`);
      }
    } else if (functionName === "outreach-unsubscribe") {
      if (!/if\s*\(!isUuid\(token\)\)[\s\S]*?Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/.test(contents)) {
        failures.push(`${file}: the unsubscribe capability token must be validated before service credentials are loaded`);
      }
    } else if (functionName === "gmail-oauth-callback") {
      if (!/state\.length\s*<\s*32[\s\S]*?service_claim_gmail_oauth[\s\S]*?googleOAuthConfig\(\)/.test(contents)) {
        failures.push(`${file}: OAuth state must be bounded and atomically claimed before provider credentials are loaded`);
      }
      if (!/recordFunctionSecurityEvent\s*\(/.test(contents)) {
        failures.push(`${file}: OAuth callback must finalize its reserved firewall security event`);
      }
    } else if (functionName === "square-oauth-callback") {
      if (!/state\.length\s*<\s*32[\s\S]*?service_claim_square_oauth[\s\S]*?squareOAuthConfig\(\)/.test(contents)) {
        failures.push(`${file}: Square OAuth state must be bounded and atomically claimed before provider credentials are loaded`);
      }
      if (!/recordFunctionSecurityEvent\s*\(/.test(contents)) {
        failures.push(`${file}: Square OAuth callback must finalize its reserved firewall security event`);
      }
    } else if (functionName === "square-webhooks") {
      if (!/verifySquareSignature\([\s\S]*?if\s*\(!valid\)[\s\S]*?serviceClient\(\)/.test(contents)) {
        failures.push(`${file}: Square signature verification must complete before service credentials are loaded`);
      }
    } else if (!/reserveFunctionInvocation\s*\(/.test(contents)) {
      failures.push(`${file}: Edge Function must reserve a firewall/rate-limit invocation before sensitive work`);
    }
  }
  const lines = contents.split(/\r?\n/);
  let inProviderSecretMap = false;
  for (const secretName of providerSecretIdentifiers) {
    lines.forEach((line, index) => {
      if (/const\s+providerSecretNames\b/.test(line)) inProviderSecretMap = true;
      const providerMapAllowed = inProviderSecretMap;
      if (inProviderSecretMap && /^\s*};\s*$/.test(line)) inProviderSecretMap = false;
      if (!line.includes(secretName)) return;
      if (/Deno\.env\.get|providerSecretNames|providerSecretIdentifiers/.test(line) || providerMapAllowed) return;
      failures.push(`${file}:${index + 1}: Edge Function secret identifier ${secretName} appears outside server env lookup`);
    });
  }
}

if (!/create\s+table\s+if\s+not\s+exists\s+private\.edge_function_security_events/i.test(combinedSql)) {
  failures.push("supabase: missing private edge_function_security_events firewall table");
}

if (!/create\s+or\s+replace\s+function\s+public\.reserve_edge_function_invocation/i.test(combinedSql)) {
  failures.push("supabase: missing reserve_edge_function_invocation firewall RPC");
}

if (!/grant\s+execute\s+on\s+function\s+public\.reserve_edge_function_invocation\(uuid,\s*text,\s*text,\s*jsonb\)\s+to\s+authenticated/i.test(combinedSql)) {
  failures.push("supabase: reserve_edge_function_invocation must be executable by authenticated users only");
}

const publicEnvLines = read(".env.example")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

for (const line of publicEnvLines) {
  const key = line.split("=")[0];
  if (key?.startsWith("EXPO_PUBLIC_") && !allowedPublicEnv.has(key)) {
    failures.push(`.env.example: Unexpected public Expo env var ${key}`);
  }
}

const functionFiles = listFiles("supabase/functions").filter((path) => path.endsWith("index.ts"));
const functionConfig = read("supabase/config.toml");

for (const file of functionFiles) {
  const functionName = basename(file.replace(/\/index\.ts$/, ""));
  const blockPattern = new RegExp(`\\[functions\\.${escapeRegExp(functionName)}\\]([\\s\\S]*?)(?=\\n\\[|$)`, "i");
  const block = functionConfig.match(blockPattern)?.[1] ?? "";
  const expectedJwtSetting = nonTenantEdgeFunctions.has(functionName) || providerCallbackEdgeFunctions.has(functionName)
    ? "false"
    : "true";
  if (!new RegExp(`verify_jwt\\s*=\\s*${expectedJwtSetting}`, "i").test(block)) {
    failures.push(`supabase/config.toml: Edge Function ${functionName} must set verify_jwt = ${expectedJwtSetting}`);
  }
}

if (failures.length > 0) {
  console.error("Mise static security checks failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Mise static security checks passed.");

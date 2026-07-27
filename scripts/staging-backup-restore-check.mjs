import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { assertStagingPreflight } from "./staging-preflight.mjs";

const exec = promisify(execFile);
const required = [
  "SUPABASE_STAGING_URL",
  "SUPABASE_STAGING_PROJECT_REF",
  "SUPABASE_STAGING_ANON_KEY",
  "SUPABASE_STAGING_DB_PASSWORD",
  "MISE_STAGING_MARKER"
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required for the staging restore proof.`);
}
if (
  process.env.SUPABASE_PRODUCTION_PROJECT_REF &&
  process.env.SUPABASE_PRODUCTION_PROJECT_REF === process.env.SUPABASE_STAGING_PROJECT_REF
) {
  throw new Error("Staging and production project references must differ.");
}
await assertStagingPreflight();

const postgresBin = findPostgresBin();
const workspace = await mkdtemp(join(tmpdir(), "mise-recovery-proof-"));
const cluster = join(workspace, "cluster");
const dumpPath = join(workspace, "staging-operational.dump");
const postgresLog = join(workspace, "postgres.log");
const port = 56_000 + Math.floor(Math.random() * 2_000);
const sourceHost = `db.${process.env.SUPABASE_STAGING_PROJECT_REF}.supabase.co`;
const sourceEnv = {
  ...process.env,
  PGPASSWORD: process.env.SUPABASE_STAGING_DB_PASSWORD,
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "15",
  PGOPTIONS: "-c statement_timeout=120000 -c lock_timeout=15000",
  PGTZ: "UTC"
};
const recoveryEnv = { ...process.env, PGSSLMODE: "disable", PGTZ: "UTC" };
const startedAt = Date.now();
let clusterStarted = false;

try {
  await run("pg_dump", [
    "--host", sourceHost,
    "--port", "5432",
    "--username", "postgres",
    "--dbname", "postgres",
    "--format", "custom",
    "--no-owner",
    "--no-acl",
    "--schema", "public",
    "--schema", "private",
    "--file", dumpPath
  ], sourceEnv);

  const userIds = (
    await querySource("select id::text from auth.users order by id;")
  ).split("\n").filter(Boolean);
  if (!userIds.every((id) => /^[0-9a-f-]{36}$/.test(id))) {
    throw new Error("Source auth identity projection was not UUID-only.");
  }

  await run("initdb", [
    "--pgdata", cluster,
    "--username", "postgres",
    "--auth", "trust",
    "--encoding", "UTF8",
    "--no-locale"
  ], recoveryEnv);
  await run("pg_ctl", [
    "--pgdata", cluster,
    "--log", postgresLog,
    "--options", `-p ${port} -h 127.0.0.1`,
    "--wait",
    "start"
  ], recoveryEnv);
  clusterStarted = true;

  const identityValues = userIds.map((id) => `('${id}'::uuid)`).join(",");
  await queryRecovery(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role authenticator nologin;
    create role supabase_auth_admin nologin;
    create role supabase_storage_admin nologin;
    create schema extensions;
    create extension btree_gist with schema extensions;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid
      language sql stable
      as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    ${identityValues ? `insert into auth.users(id) values ${identityValues};` : ""}
    drop schema public cascade;
  `);

  await run("pg_restore", [
    "--host", "127.0.0.1",
    "--port", String(port),
    "--username", "postgres",
    "--dbname", "postgres",
    "--no-owner",
    "--no-acl",
    "--exit-on-error",
    dumpPath
  ], recoveryEnv);

  const tables = JSON.parse(
    await querySource(`
      select coalesce(json_agg(json_build_object('schema', table_schema, 'table', table_name)
        order by table_schema, table_name), '[]'::json)::text
      from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema in ('public', 'private');
    `)
  );
  if (!Array.isArray(tables) || tables.length === 0) {
    throw new Error("No operational tables were discovered in the staging backup.");
  }

  const digestQueries = tables.map((entry) => {
    const schema = requireIdentifier(entry.schema);
    const table = requireIdentifier(entry.table);
    return `
      select '${schema}.${table}' as table_name,
        count(*)::bigint as row_count,
        coalesce(md5(string_agg(row_json, '|' order by row_json)), md5('')) as content_digest
      from (
        select row_to_json(source_row)::text as row_json
        from "${schema}"."${table}" source_row
      ) rows
    `;
  });
  const digestSql = `
    select json_agg(check_row order by table_name)::text
    from (${digestQueries.join("\nunion all\n")}) check_row;
  `;
  const sourceChecks = JSON.parse(await querySource(digestSql));
  const recoveryChecks = JSON.parse(await queryRecovery(digestSql));
  let totalRows = 0;
  for (let index = 0; index < sourceChecks.length; index += 1) {
    const source = sourceChecks[index];
    const recovery = recoveryChecks[index];
    assertSame(source.table_name, source, recovery);
    totalRows += Number(source.row_count);
  }

  const dump = await readFile(dumpPath);
  const evidence = {
    status: "passed",
    source: "dedicated_staging",
    target: "ephemeral_isolated_postgresql",
    schemas: ["public", "private"],
    tables_verified: tables.length,
    rows_verified: totalRows,
    auth_identities_stubbed: userIds.length,
    dump_bytes: dump.byteLength,
    dump_sha256: createHash("sha256").update(dump).digest("hex"),
    duration_seconds: Math.round((Date.now() - startedAt) / 100) / 10,
    row_content_emitted: false,
    cleanup: "ephemeral_cluster_removed"
  };
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (clusterStarted) {
    await run("pg_ctl", ["--pgdata", cluster, "--mode", "fast", "--wait", "stop"], recoveryEnv)
      .catch(() => undefined);
  }
  await rm(workspace, { recursive: true, force: true });
}

async function querySource(sql) {
  return run("psql", [
    "--no-psqlrc",
    "--tuples-only",
    "--no-align",
    "--set", "ON_ERROR_STOP=1",
    "--host", sourceHost,
    "--port", "5432",
    "--username", "postgres",
    "--dbname", "postgres",
    "--command", sql
  ], sourceEnv);
}

async function queryRecovery(sql) {
  return run("psql", [
    "--no-psqlrc",
    "--tuples-only",
    "--no-align",
    "--set", "ON_ERROR_STOP=1",
    "--host", "127.0.0.1",
    "--port", String(port),
    "--username", "postgres",
    "--dbname", "postgres",
    "--command", sql
  ], recoveryEnv);
}

async function run(command, args, env) {
  const result = await exec(join(postgresBin, command), args, {
    env,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 180_000
  });
  return result.stdout.trim();
}

function findPostgresBin() {
  const candidates = [
    "/Applications/Postgres.app/Contents/Versions/latest/bin",
    "/Applications/Postgres.app/Contents/Versions/18/bin",
    "/opt/homebrew/opt/postgresql@17/bin",
    "/usr/local/opt/postgresql@17/bin"
  ];
  const match = candidates.find((candidate) =>
    ["pg_dump", "pg_restore", "psql", "initdb", "pg_ctl"].every((tool) =>
      existsSync(join(candidate, tool))
    )
  );
  if (!match) throw new Error("PostgreSQL 17 client and cluster tools are required.");
  return match;
}

function requireIdentifier(value) {
  if (typeof value !== "string" || !/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error("Unexpected database identifier in restore proof.");
  }
  return value;
}

function assertSame(table, source, recovery) {
  if (
    source.table_name !== recovery.table_name ||
    Number(source.row_count) !== Number(recovery.row_count) ||
    source.content_digest !== recovery.content_digest
  ) {
    throw new Error(
      `${table} did not match after isolated restore (source_count=${Number(source.row_count)}, recovery_count=${Number(recovery.row_count)}, source_digest=${source.content_digest}, recovery_digest=${recovery.content_digest}).`
    );
  }
}

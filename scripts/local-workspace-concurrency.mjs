import { spawn, spawnSync } from "node:child_process";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const psql = process.env.PSQL_PATH ?? "psql";
const actorUserId = "d0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0";

const status = spawnSync(npx, ["supabase", "status", "-o", "env"], {
  cwd: process.cwd(),
  env: process.env,
  encoding: "utf8"
});
if (status.status !== 0) throw new Error("Unable to read the local Supabase database URL.");
const databaseUrl = status.stdout.match(/^DB_URL="([^"]+)"$/m)?.[1];
if (!databaseUrl || !/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/.test(databaseUrl)) {
  throw new Error("Local workspace concurrency proof requires the loopback Supabase database.");
}

function runPsql(sql, allowFailure = false) {
  const result = spawnSync(psql, [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", sql], {
    env: process.env,
    encoding: "utf8"
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(result.stderr.trim() || "Local PostgreSQL security probe failed.");
  }
  return result;
}

function runConcurrentCreate(index) {
  const sql = `
    begin;
    set local role service_role;
    select (
      public.service_create_restaurant_with_owner(
        '${actorUserId}',
        'Concurrent quota ${index}',
        'Test'
      )
    ).id;
    commit;
  `;
  return new Promise((resolve) => {
    const child = spawn(psql, [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", sql], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => resolve({ status: -1, stderr: error.message }));
    child.on("close", (statusCode) => resolve({ status: statusCode ?? -1, stderr }));
  });
}

function cleanup() {
  runPsql(`
    delete from public.restaurants
    where id in (
      select restaurant_id
      from private.restaurant_workspace_allocations
      where creator_user_id = '${actorUserId}'
    );
    delete from auth.users where id = '${actorUserId}';
  `, true);
}

cleanup();
try {
  runPsql(`
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '${actorUserId}',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'local-concurrency@mise.test',
      crypt('local-only-password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );
  `);

  const results = await Promise.all(Array.from({ length: 20 }, (_, index) => runConcurrentCreate(index + 1)));
  const accepted = results.filter((result) => result.status === 0).length;
  const rejected = results.length - accepted;
  const counts = runPsql(`
    select
      (select count(*) from private.restaurant_workspace_allocations where creator_user_id = '${actorUserId}')::text
      || '|' ||
      (select count(*) from public.restaurant_memberships where user_id = '${actorUserId}' and role = 'owner')::text;
  `).stdout.trim();

  if (accepted !== 5 || rejected !== 15 || counts !== "5|5") {
    throw new Error(
      `Concurrent workspace quota proof failed: accepted=${accepted}, rejected=${rejected}, retained=${counts || "unknown"}.`
    );
  }
  console.log("Concurrent workspace quota proof passed: 5 accepted, 15 rejected, 5 immutable allocations.");
} finally {
  cleanup();
}

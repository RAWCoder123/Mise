import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929150000_mise_005cc_restaurant_memberships_role_status_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/202606210001_secure_multi_tenant_rls.sql",
    import.meta.url
  ),
  "utf8"
);
const originalWriters = readFileSync(
  new URL(
    "../supabase/migrations/20260716204112_reinforce_tenant_isolation.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/restaurant_memberships_role_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CC pins membership role/status CHECK and writers to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CC"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_memberships_role_check\s+check \(\s*role in \('owner', 'admin', 'manager', 'staff'\)\s*and role collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint restaurant_memberships_status_check\s+check \(\s*status in \('active', 'invited', 'disabled'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`role collate "C" ~ '${TOKEN_PATTERN}'`),
    "role CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'owner'") &&
      migration.includes("'admin'") &&
      migration.includes("'manager'") &&
      migration.includes("'staff'"),
    "exact role allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'active'") &&
      migration.includes("'invited'") &&
      migration.includes("'disabled'"),
    "exact status allowlist must be preserved"
  );

  assert.match(
    migration,
    /function public\.add_restaurant_member\(\s*p_restaurant_id uuid,\s*p_target_user_id uuid,\s*p_role text\s*\)/
  );
  assert.ok(
    migration.includes(`p_role collate "C" !~ '${TOKEN_PATTERN}'`),
    "add/update writer role gates must pin under COLLATE C"
  );
  assert.match(migration, /p_role not in \('admin', 'manager', 'staff'\)/);

  assert.match(
    migration,
    /function public\.update_restaurant_member\(\s*p_restaurant_id uuid,\s*p_target_user_id uuid,\s*p_role text default null,\s*p_status text default null\s*\)/
  );
  assert.match(
    migration,
    /p_role not in \('owner', 'admin', 'manager', 'staff'\)/
  );
  assert.ok(
    migration.includes(`p_status collate "C" !~ '${TOKEN_PATTERN}'`),
    "update writer status gate must pin under COLLATE C"
  );
  assert.match(migration, /p_status not in \('active', 'disabled'\)/);

  assert.match(
    migration,
    /revoke all on function public\.add_restaurant_member\(uuid, uuid, text\) from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /revoke all on function public\.update_restaurant_member\(uuid, uuid, text, text\) from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /grant execute on function public\.add_restaurant_member\(uuid, uuid, text\) to authenticated/i
  );
  assert.match(
    migration,
    /grant execute on function public\.update_restaurant_member\(uuid, uuid, text, text\) to authenticated/i
  );

  // Compose: do not rewrite remove, invite stacks, or contested paths.
  assert.doesNotMatch(sqlBody, /function public\.remove_restaurant_member/i);
  assert.doesNotMatch(sqlBody, /restaurant_member_invites/i);
  assert.doesNotMatch(sqlBody, /function public\.create_restaurant_with_owner/i);
  assert.doesNotMatch(sqlBody, /alter table public\.users/i);
  assert.doesNotMatch(sqlBody, /preferred_locale/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
});

test("original membership role/status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /restaurant_memberships_role_check[\s\S]*?check \(role in \('owner', 'admin', 'manager', 'staff'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /role collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.match(
    originalBound,
    /restaurant_memberships_status_check[\s\S]*?check \(status in \('active', 'invited', 'disabled'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );

  assert.match(
    originalWriters,
    /p_role is null or p_role not in \('admin', 'manager', 'staff'\)/
  );
  assert.doesNotMatch(
    originalWriters,
    /p_role collate "C" !~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.match(
    originalWriters,
    /p_role is not null and p_role not in \('owner', 'admin', 'manager', 'staff'\)/
  );
  assert.match(
    originalWriters,
    /p_status is not null and p_status not in \('active', 'disabled'\)/
  );
  assert.doesNotMatch(
    originalWriters,
    /p_status collate "C" !~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins membership role/status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(27\)/);
  assert.match(pgTap, /restaurant_memberships_role_check exists/);
  assert.match(pgTap, /role CHECK keeps exact allowlist/);
  assert.match(pgTap, /role CHECK uses COLLATE C/);
  assert.match(pgTap, /restaurant_memberships_status_check exists/);
  assert.match(pgTap, /status CHECK keeps exact allowlist/);
  assert.match(pgTap, /status CHECK uses COLLATE C/);
  assert.match(pgTap, /add_restaurant_member writer uses COLLATE C shape gate/);
  assert.match(pgTap, /add_restaurant_member writer keeps exact role allowlist/);
  assert.match(
    pgTap,
    /update_restaurant_member role writer uses COLLATE C shape gate/
  );
  assert.match(pgTap, /update_restaurant_member writer keeps exact role allowlist/);
  assert.match(
    pgTap,
    /update_restaurant_member status writer uses COLLATE C shape gate/
  );
  assert.match(
    pgTap,
    /update_restaurant_member writer keeps exact status allowlist/
  );
  assert.match(pgTap, /writer token owner matches under COLLATE C/);
  assert.match(pgTap, /writer token admin matches under COLLATE C/);
  assert.match(pgTap, /writer token manager matches under COLLATE C/);
  assert.match(pgTap, /writer token staff matches under COLLATE C/);
  assert.match(pgTap, /writer token active matches under COLLATE C/);
  assert.match(pgTap, /writer token invited matches under COLLATE C/);
  assert.match(pgTap, /writer token disabled matches under COLLATE C/);
  assert.match(
    pgTap,
    /spaced membership identity token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty membership identity token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated membership identity token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII membership identity token is rejected under COLLATE C/
  );
  assert.match(pgTap, /all allowlisted role tokens match under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
  assert.match(pgTap, /authenticated EXECUTE on add_restaurant_member is preserved/);
  assert.match(
    pgTap,
    /authenticated EXECUTE on update_restaurant_member is preserved/
  );
});

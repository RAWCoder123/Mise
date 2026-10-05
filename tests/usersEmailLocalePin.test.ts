import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261006140000_mise_005im_users_email_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/202606210001_secure_multi_tenant_rls.sql",
    import.meta.url
  ),
  "utf8"
);
const writer = readFileSync(
  new URL(
    "../supabase/migrations/20260716204112_reinforce_tenant_isolation.sql",
    import.meta.url
  ),
  "utf8"
);
const teamMembership = readFileSync(
  new URL("../services/domain/teamMembership.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/users_email_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IM pins users.email CHECK to COLLATE C mailbox shape", () => {
  assert.ok(migration.includes("MISE-005IM"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint users_email_check check \(\s*pg_catalog\.length\(email\) between 3 and 254\s*and email = pg_catalog\.btrim\(email\)\s*and email collate "C" !~ '\[\[:cntrl:\]\]'\s*and email collate "C" ~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'\s*\)/
  );
  assert.ok(
    migration.includes(`email collate "C" !~ '[[:cntrl:]]'`),
    "users.email CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(
      `email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'`
    ),
    "users.email CHECK must pin mailbox shape under COLLATE C"
  );
  assert.ok(
    migration.includes("pg_catalog.length(email) between 3 and 254"),
    "exact length bound must match team invite normalize (3..254)"
  );
  assert.doesNotMatch(
    sqlBody,
    /lower\(email/i,
    "must not require lower() — Auth may preserve mailbox casing"
  );

  // Compose: CHECK-only. Do not rewrite profile mutators or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(sqlBody, /update_my_profile/i);
  assert.doesNotMatch(sqlBody, /find_restaurant_member_candidate/i);
  assert.doesNotMatch(sqlBody, /restaurant_memberships/i);
  assert.doesNotMatch(
    sqlBody,
    /add constraint users_name_check/i,
    "must not reattach users.name CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint users_preferred_locale_allowlist_check/i,
    "must not reattach preferred_locale CHECK by name rewrite"
  );
  assert.ok(
    sqlBody.includes("users_name_check"),
    "drop loop must explicitly spare users.name sibling tip"
  );
  assert.ok(
    sqlBody.includes("users_preferred_locale_allowlist_check"),
    "drop loop must explicitly spare preferred_locale sibling tip"
  );
});

test("original users.email was unbound NOT NULL unique text; writer copies auth email", () => {
  assert.match(
    original,
    /create table if not exists public\.users \([\s\S]*?email text not null unique,/
  );
  assert.doesNotMatch(original, /users_email_check/);
  assert.doesNotMatch(
    original,
    /create table if not exists public\.users[\s\S]*?email text not null unique[^,\n]*check/
  );

  assert.match(
    writer,
    /insert into public\.users \(id, restaurant_id, name, email, role\)\s*values \(actor_user_id, null, normalized_name, actor_email, 'staff'\)/
  );
  assert.match(
    writer,
    /select auth_user\.email into actor_email/
  );
  assert.match(
    teamMembership,
    /export function normalizeTeamMemberEmail[\s\S]*normalized\.length < 3 \|\| normalized\.length > 254/
  );
  assert.match(
    teamMembership,
    /\/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\//
  );
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    )
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /users_email_check exists/);
  assert.match(pgTap, /users email CHECK keeps exact length bound/);
  assert.match(pgTap, /users email CHECK requires trimmed storage/);
  assert.match(pgTap, /users email CHECK uses COLLATE C cntrl rejection/);
  assert.match(pgTap, /users email CHECK uses COLLATE C mailbox shape/);
  assert.match(pgTap, /printable mailbox profile email is accepted under COLLATE C/);
  assert.match(pgTap, /tab in profile email local-part is rejected under COLLATE C/);
  assert.match(pgTap, /newline in profile email domain is rejected under COLLATE C/);
  assert.match(pgTap, /NUL in profile email domain is rejected under COLLATE C/);
  assert.match(pgTap, /space in profile email local-part is rejected under COLLATE C/);
  assert.match(pgTap, /profile email control and space detectors match ASCII C classes/);
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
  assert.match(pgTap, /users email CHECK keeps original length window/);
});

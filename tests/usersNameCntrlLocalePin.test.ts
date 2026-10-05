import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { requireProfileName } from "../services/miseValidation";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261006130000_mise_005il_users_name_cntrl_locale_pin.sql",
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
const validation = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const application = readFileSync(
  new URL("../services/application/restaurant.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/users_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IL pins users.name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005IL"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint users_name_check check \(\s*pg_catalog\.length\(pg_catalog\.btrim\(name\)\) between 1 and 120\s*and name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );

  assert.ok(
    migration.includes(`name collate "C" !~ '[[:cntrl:]]'`),
    "users.name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("between 1 and 120"),
    "exact users.name length bound must match update_my_profile"
  );

  // Compose: CHECK-only. Do not rewrite profile mutators or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /update_my_profile/i);
  assert.doesNotMatch(sqlBody, /restaurant_memberships/i);
  assert.doesNotMatch(
    sqlBody,
    /add constraint users_preferred_locale_allowlist_check/i
  );
  assert.ok(
    sqlBody.includes("users_preferred_locale_allowlist_check"),
    "drop loop must explicitly spare preferred_locale sibling tip"
  );
});

test("original users.name had no length or cntrl CHECK", () => {
  assert.match(
    original,
    /create table if not exists public\.users \([\s\S]*?name text not null,/
  );
  assert.doesNotMatch(original, /users_name_check|users_name_length_check/);
  assert.doesNotMatch(
    original,
    /create table if not exists public\.users[\s\S]*?name[\s\S]*?\[\[:cntrl:\]\]/
  );

  assert.match(
    writer,
    /pg_catalog\.length\(normalized_name\) not between 1 and 120/
  );
  assert.doesNotMatch(
    writer,
    /update_my_profile[\s\S]*?\[\[:cntrl:\]\]/
  );
});

test("requireProfileName rejects ASCII C control characters", () => {
  assert.equal(requireProfileName(" Alex Morgan "), "Alex Morgan");
  assert.equal(requireProfileName("A".repeat(120)).length, 120);
  assert.throws(() => requireProfileName("A".repeat(121)), /between 1 and 120/);
  assert.throws(
    () => requireProfileName("Alex\tMorgan"),
    /without control characters/
  );
  assert.throws(
    () => requireProfileName("Alex\nMorgan"),
    /without control characters/
  );
  assert.throws(
    () => requireProfileName("Alex\u007fMorgan"),
    /without control characters/
  );
  assert.match(
    validation,
    /export function requireProfileName[\s\S]*hasControlCharacters\(normalized\)/
  );
  assert.match(
    validation,
    /function hasControlCharacters\(value: string\) \{\s*return \/\[\\u0000-\\u001f\\u007f\]\/\.test\(value\);/
  );
  assert.match(
    application,
    /updateMyProfile[\s\S]*requireProfileName\(name\)/
  );
});

test("pgTAP fixture pins users.name to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(pgTap, /users_name_check exists/);
  assert.match(pgTap, /users name CHECK keeps exact length bound/);
  assert.match(pgTap, /users name CHECK uses COLLATE C cntrl rejection/);
  assert.match(pgTap, /printable operator name is accepted under COLLATE C/);
  assert.match(pgTap, /tab in operator name is rejected under COLLATE C/);
  assert.match(pgTap, /newline in operator name is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in operator name is rejected under COLLATE C/);
  assert.match(pgTap, /empty string has no control characters under COLLATE C/);
  assert.match(
    pgTap,
    /operator name control detector matches ASCII C \[\[:cntrl:\]\]/
  );
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
  assert.match(pgTap, /users name CHECK keeps original length window/);
});

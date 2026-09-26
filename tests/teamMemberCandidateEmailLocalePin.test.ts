import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeTeamMemberEmail } from "../services/domain/teamMembership";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926210000_mise_005aa_team_member_candidate_email_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalTeamDirectory = readFileSync(
  new URL("../supabase/migrations/20260726213000_restaurant_team_directory.sql", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/team_member_candidate_email_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

function candidateFunctionBody(source: string): string {
  const start = source.indexOf(
    "create or replace function public.find_restaurant_member_candidate("
  );
  assert.ok(start >= 0, "find_restaurant_member_candidate must exist");
  const end = source.indexOf("$$;", start);
  assert.ok(end > start, "function body terminator must exist");
  return source.slice(start, end);
}

test("MISE-005AA pins find_restaurant_member_candidate email to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AA"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function public\.find_restaurant_member_candidate\(\s*p_restaurant_id uuid,\s*p_email text/i
  );

  const body = candidateFunctionBody(migration);
  assert.match(
    body,
    /pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(p_email, ''\)\) collate "C"\s*\) collate "C"/
  );
  assert.match(body, /normalized_email collate "C" ~ '\[\[:cntrl:\]\]'/);
  assert.match(
    body,
    /normalized_email collate "C" !~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  assert.match(
    body,
    /pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(auth_user\.email::text, ''\)\) collate "C"\s*\) collate "C" = normalized_email/
  );

  assert.match(
    migration,
    /revoke all on function public\.find_restaurant_member_candidate\(\s*uuid, text\s*\)\s*from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /grant execute on function public\.find_restaurant_member_candidate\(\s*uuid, text\s*\)\s*to authenticated/i
  );

  // Compose: do not rewrite sibling team directory list RPC or membership mutators.
  assert.doesNotMatch(migration, /create or replace function public\.list_restaurant_members/i);
  assert.doesNotMatch(migration, /create or replace function public\.add_restaurant_member/i);
  assert.doesNotMatch(migration, /create or replace function public\.update_restaurant_member/i);
  assert.doesNotMatch(migration, /create or replace function public\.remove_restaurant_member/i);
});

test("team directory originally left candidate email normalize/compare bare", () => {
  const body = candidateFunctionBody(originalTeamDirectory);
  assert.match(
    body,
    /normalized_email text := pg_catalog\.lower\(pg_catalog\.btrim\(p_email\)\);/
  );
  assert.match(body, /pg_catalog\.strpos\(normalized_email, '@'\) = 0/);
  assert.match(body, /where pg_catalog\.lower\(auth_user\.email\) = normalized_email/);
  assert.doesNotMatch(body, /collate "C"/);
});

test("pgTAP fixture pins candidate email normalize/compare to COLLATE C", () => {
  assert.match(pgTap, /select plan\(6\)/);
  assert.match(pgTap, /candidate email normalize uses COLLATE C lower\/btrim/);
  assert.match(pgTap, /candidate email shape check uses COLLATE C/);
  assert.match(pgTap, /candidate Auth email compare uses COLLATE C/);
  assert.match(pgTap, /authenticated retains EXECUTE on find_restaurant_member_candidate/);
  assert.match(pgTap, /anon lacks EXECUTE on find_restaurant_member_candidate/);
});

test("client normalizeTeamMemberEmail already matches the pinned mailbox shape", () => {
  assert.equal(normalizeTeamMemberEmail("  Ops@Example.COM "), "ops@example.com");
  assert.equal(normalizeTeamMemberEmail("not-an-email"), null);
  assert.equal(normalizeTeamMemberEmail("a@b"), null);
  assert.equal(normalizeTeamMemberEmail("ops@exam\nple.com"), null);
});

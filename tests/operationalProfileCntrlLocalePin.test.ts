import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004230000_mise_005hk_operational_profile_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalFoundation = readFileSync(
  new URL(
    "../supabase/migrations/20260715164843_harden_profile_ai_and_order_boundaries.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/operational_profile_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HK pins restaurant_operational_profile_is_valid cntrl and allowlists to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005HK"), "additive pin must stay labeled");

  assert.match(
    migration,
    /create or replace function private\.restaurant_operational_profile_is_valid\(p_profile jsonb\)/i
  );
  assert.ok(
    migration.includes(`array_text collate "C" ~ '[[:cntrl:]]'`),
    "array entries must reject controls under COLLATE C"
  );
  assert.match(
    migration,
    /style_text collate "C" not in \(\s*'quick_service', 'fast_casual', 'full_service', 'bar', 'cafe', 'ghost_kitchen'\s*\)/
  );
  assert.ok(
    migration.includes(
      `notes_text collate "C" ~ E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]'`
    ),
    "notes must use multiline-aware control rejection under COLLATE C"
  );
  assert.match(
    migration,
    /grant execute on function private\.restaurant_operational_profile_is_valid\(jsonb\)\s*to service_role/i
  );
  assert.match(
    migration,
    /revoke all on function private\.restaurant_operational_profile_is_valid\(jsonb\)\s*from public, anon, authenticated, service_role/i
  );

  // Compose: validator-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.update_restaurant_profile/i
  );
  assert.doesNotMatch(sqlBody, /alter table public\.restaurants/i);
  assert.doesNotMatch(sqlBody, /restaurants_name/);
  assert.doesNotMatch(sqlBody, /restaurants_address/);
  assert.doesNotMatch(sqlBody, /restaurants_cuisine/);
  assert.doesNotMatch(sqlBody, /restaurants_logo_url/);
  assert.doesNotMatch(sqlBody, /structured_ai_insight_output_is_valid/);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
});

test("original operational profile validator used length-only text and bare allowlists", () => {
  const start = originalFoundation.indexOf(
    "create or replace function private.restaurant_operational_profile_is_valid(p_profile jsonb)"
  );
  assert.ok(start >= 0, "foundation validator must exist");
  const end = originalFoundation.indexOf(
    "revoke all on function private.restaurant_operational_profile_is_valid",
    start
  );
  assert.ok(end > start, "foundation revoke must follow validator");
  const body = originalFoundation.slice(start, end);

  assert.match(
    body,
    /pg_catalog\.length\(array_entry #>> '\{\}'\) not between 1 and 160/
  );
  assert.match(
    body,
    /p_profile ->> 'serviceStyle' not in \(\s*'quick_service', 'fast_casual', 'full_service', 'bar', 'cafe', 'ghost_kitchen'\s*\)/
  );
  assert.match(body, /pg_catalog\.length\(p_profile ->> 'notes'\) > 2000/);
  assert.doesNotMatch(body, /collate "C"/);
  assert.doesNotMatch(body, /\[\[:cntrl:\]\]/);
});

test("length+cntrl class matches the pinned operational profile text contract", () => {
  const isAllowedSingleLine = (value: string, max: number) => {
    return (
      value.length >= 1 &&
      value.length <= max &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };
  // Same byte class as MISE-005EM operator_note / supplier-send multiline.
  const isAllowedNotes = (value: string, max: number) => {
    return (
      value.length <= max &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    );
  };
  const isAllowedServiceStyle = (value: string) =>
    [
      "quick_service",
      "fast_casual",
      "full_service",
      "bar",
      "cafe",
      "ghost_kitchen",
    ].includes(value);

  assert.equal(isAllowedSingleLine("Mon/Wed delivery", 160), true);
  assert.equal(isAllowedSingleLine("a".repeat(160), 160), true);
  assert.equal(isAllowedSingleLine("a".repeat(161), 160), false);
  assert.equal(isAllowedSingleLine("", 160), false);
  assert.equal(isAllowedSingleLine("Mon\tWed", 160), false);
  assert.equal(isAllowedSingleLine("Mon\nWed", 160), false);
  assert.equal(isAllowedSingleLine("Mon\u007fWed", 160), false);

  assert.equal(isAllowedNotes("Count proteins\nbefore dinner.", 2000), true);
  assert.equal(isAllowedNotes("Count\tproteins", 2000), true);
  assert.equal(isAllowedNotes("Count\rproteins", 2000), true);
  assert.equal(isAllowedNotes("Count\u0000proteins", 2000), false);
  assert.equal(isAllowedNotes("Count\u007fproteins", 2000), false);
  assert.equal(isAllowedNotes("a".repeat(2001), 2000), false);

  assert.equal(isAllowedServiceStyle("full_service"), true);
  assert.equal(isAllowedServiceStyle("FULL_SERVICE"), false);
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    ),
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /array_text collate "C" ~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /style_text collate "C" not in/);
  assert.match(pgTap, /notes_text collate "C" ~/);
  assert.match(pgTap, /tab in profile array entry is rejected under COLLATE C/);
  assert.match(pgTap, /NUL in profile notes is rejected under COLLATE C/);
  assert.match(pgTap, /multiline profile notes allow LF under COLLATE C/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929140000_mise_005cb_preferred_locale_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260719062921_add_operator_locale_preference.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/preferred_locale_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CB pins preferred_locale CHECK and writer to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CB"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint users_preferred_locale_allowlist_check\s+check \(\s*preferred_locale is null\s*or \(\s*preferred_locale in \('en', 'es', 'zh-Hans'\)\s*and preferred_locale collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)\s*\)/
  );

  assert.ok(
    migration.includes(`preferred_locale collate "C" ~ '${TOKEN_PATTERN}'`),
    "preferred_locale CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'en'") &&
      migration.includes("'es'") &&
      migration.includes("'zh-Hans'"),
    "exact preferred_locale allowlist must be preserved"
  );

  assert.match(
    migration,
    /function public\.update_my_preferred_locale\(p_locale text\)/
  );
  assert.ok(
    migration.includes(`p_locale collate "C" !~ '${TOKEN_PATTERN}'`),
    "writer gate must pin under COLLATE C"
  );
  assert.match(migration, /p_locale not in \('en', 'es', 'zh-Hans'\)/);
  assert.match(
    migration,
    /revoke all on function public\.update_my_preferred_locale\(text\) from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /grant execute on function public\.update_my_preferred_locale\(text\) to authenticated/i
  );

  // Compose: do not rewrite the read RPC, users RLS, or contested stacks.
  assert.doesNotMatch(sqlBody, /function public\.get_my_preferred_locale/i);
  assert.doesNotMatch(sqlBody, /alter table public\.insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table private\.edge_function_security_events/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
});

test("original preferred_locale used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /users_preferred_locale_allowlist_check[\s\S]*?check \(preferred_locale is null or preferred_locale in \('en', 'es', 'zh-Hans'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /preferred_locale collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.match(originalBound, /p_locale not in \('en', 'es', 'zh-Hans'\)/);
  assert.doesNotMatch(
    originalBound,
    /p_locale collate "C" !~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins preferred_locale to COLLATE C", () => {
  assert.match(pgTap, /select plan\(14\)/);
  assert.match(pgTap, /users_preferred_locale_allowlist_check exists/);
  assert.match(pgTap, /preferred_locale CHECK keeps exact allowlist/);
  assert.match(pgTap, /preferred_locale CHECK uses COLLATE C/);
  assert.match(pgTap, /update_my_preferred_locale writer uses COLLATE C shape gate/);
  assert.match(pgTap, /update_my_preferred_locale writer keeps exact allowlist/);
  assert.match(pgTap, /writer token en matches under COLLATE C/);
  assert.match(pgTap, /writer token es matches under COLLATE C/);
  assert.match(pgTap, /writer token zh-Hans matches under COLLATE C/);
  assert.match(pgTap, /spaced preferred_locale token is rejected under COLLATE C/);
  assert.match(pgTap, /empty preferred_locale token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated preferred_locale token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII preferred_locale token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted preferred_locale tokens match under COLLATE C/);
  assert.match(pgTap, /authenticated EXECUTE on update_my_preferred_locale is preserved/);
});

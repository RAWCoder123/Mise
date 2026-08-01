import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260719062921_add_operator_locale_preference.sql",
  "utf8"
);
const edgeMigration = readFileSync(
  "supabase/migrations/20260801072000_edge_profile_and_locale_mutations.sql",
  "utf8"
);
const adapter = readFileSync("services/localePreferences.ts", "utf8");
const localeContext = readFileSync("contexts/LocaleContext.tsx", "utf8");
const rootLayout = readFileSync("app/_layout.tsx", "utf8");
const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");

test("operator locale schema is allowlisted metadata with no direct mutation grant", () => {
  assert.match(migration, /add column if not exists preferred_locale text/i);
  assert.match(
    migration,
    /check \(preferred_locale is null or preferred_locale in \('en', 'es', 'zh-Hans'\)\)/i
  );
  assert.match(migration, /never use for restaurant authorization/i);
  assert.match(migration, /revoke update \(preferred_locale\) on table public\.users from authenticated/i);
  assert.doesNotMatch(migration, /grant update[^;]*preferred_locale[^;]*authenticated/i);
});

test("locale reads stay identity-free while writes are service-owned Edge mutations", () => {
  assert.match(migration, /function public\.get_my_preferred_locale\(\)/i);
  assert.match(migration, /function public\.update_my_preferred_locale\(p_locale text\)/i);
  assert.doesNotMatch(migration, /preferred_locale\([^)]*(user|restaurant).*uuid/i);

  assert.match(edgeMigration, /private\.service_update_my_preferred_locale/i);
  assert.match(edgeMigration, /grant execute on function public\.service_update_my_preferred_locale[\s\S]*service_role/i);
  assert.match(edgeMigration, /revoke all on function public\.update_my_preferred_locale\(text\)/i);
  assert.match(
    edgeMigration,
    /Preference row identity always[\s\S]*comes from the Edge-authenticated actor/i
  );
});

test("Expo locale persistence loads identity-free and saves through Edge with session restaurant scope", () => {
  assert.match(adapter, /export function createHostedLocalePreferenceAdapter/);
  assert.doesNotMatch(adapter, /p_user_id/);
  assert.doesNotMatch(adapter, /hostedLocalePreferenceAdapter/);
  assert.match(localeContext, /createHostedLocalePreferenceAdapter/);
  assert.match(localeContext, /fetchMyPreferredLocale/);
  assert.match(localeContext, /updateMyPreferredLocale\(restaurantId, nextLocale\)/);
  assert.match(rootLayout, /<LocaleProvider>/);
  assert.doesNotMatch(rootLayout, /hostedLocalePreferenceAdapter/);

  const hostedRepository = repository.match(/function createSupabaseRepository\([\s\S]*$/)?.[0] ?? "";
  const hostedSave =
    hostedRepository.match(/async updateMyPreferredLocale\([\s\S]*?\n    \},/)?.[0] ?? "";
  const hostedLoad =
    hostedRepository.match(/async fetchMyPreferredLocale\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(hostedLoad, /\.rpc\(\s*["']get_my_preferred_locale["']/);
  assert.match(hostedSave, /action:\s*"update_my_preferred_locale"/);
  assert.doesNotMatch(hostedSave, /\.rpc\(\s*["']update_my_preferred_locale["']/);
  assert.match(edge, /"update_my_preferred_locale"/);
  assert.match(edge, /service_update_my_preferred_locale/);
});

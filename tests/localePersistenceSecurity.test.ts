import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260719062921_add_operator_locale_preference.sql",
  "utf8"
);
const adapter = readFileSync("services/localePreferences.ts", "utf8");
const rootLayout = readFileSync("app/_layout.tsx", "utf8");

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

test("locale RPCs are identity-free, authenticated, and pinned to an empty search path", () => {
  assert.match(migration, /function public\.get_my_preferred_locale\(\)/i);
  assert.match(migration, /function public\.update_my_preferred_locale\(p_locale text\)/i);
  assert.doesNotMatch(migration, /preferred_locale\([^)]*(user|restaurant).*uuid/i);

  assert.equal((migration.match(/security definer/gi) ?? []).length, 2);
  assert.equal((migration.match(/set search_path = ''/gi) ?? []).length, 2);
  assert.equal((migration.match(/actor_user_id uuid := auth\.uid\(\)/gi) ?? []).length, 2);
  assert.match(migration, /where profile\.id = actor_user_id/i);
  assert.match(migration, /p_locale not in \('en', 'es', 'zh-Hans'\)/i);

  assert.match(migration, /revoke all on function public\.get_my_preferred_locale\(\) from public, anon, authenticated, service_role/i);
  assert.match(migration, /revoke all on function public\.update_my_preferred_locale\(text\) from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function public\.get_my_preferred_locale\(\) to authenticated/i);
  assert.match(migration, /grant execute on function public\.update_my_preferred_locale\(text\) to authenticated/i);
  const executeGrants = migration.match(/grant execute on function [^;]+;/gi) ?? [];
  assert.ok(executeGrants.every((statement) => / to authenticated;$/i.test(statement.trim())));
});

test("Expo uses only current-session locale RPCs through one stable hosted adapter", () => {
  assert.match(adapter, /export const hostedLocalePreferenceAdapter/);
  assert.match(adapter, /configuredSupabase\.rpc\("get_my_preferred_locale"\)/);
  assert.match(adapter, /configuredSupabase\.rpc\("update_my_preferred_locale", \{\s*p_locale: locale\s*\}\)/);
  assert.doesNotMatch(adapter, /p_(user|restaurant)_id/);
  assert.match(adapter, /isAppLocale\(value\)/);
  assert.match(rootLayout, /<LocaleProvider hostedPreferenceAdapter=\{hostedLocalePreferenceAdapter\}>/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260905120000_mise_purchase_line_item_key_aliases.sql",
  "utf8"
);
const securityGate = readFileSync("scripts/security-backend.mjs", "utf8");
const tenantIsolation = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
const hostedRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
const application = readFileSync("services/application/purchaseLineItemKeyAliases.ts", "utf8");
const screen = readFileSync("app/more/purchase-line-aliases.tsx", "utf8");
const exportFunction = readFileSync("supabase/functions/export-restaurant-data/index.ts", "utf8");
const contracts = readFileSync("services/repositories/repositoryContracts.ts", "utf8");

test("purchase_line_item_key_aliases is select-only for authenticated clients", () => {
  assert.match(migration, /create table if not exists public\.purchase_line_item_key_aliases/);
  assert.match(
    migration,
    /alter table public\.purchase_line_item_key_aliases enable row level security/
  );
  assert.match(
    migration,
    /revoke all on table public\.purchase_line_item_key_aliases\s+from public, anon, authenticated, service_role/
  );
  assert.match(
    migration,
    /grant select on public\.purchase_line_item_key_aliases to authenticated;/
  );
  assert.doesNotMatch(
    migration,
    /grant[^;]*\b(insert|update|delete)\b[^;]*on\s+(?:table\s+)?public\.purchase_line_item_key_aliases[^;]*to authenticated/i
  );
});

test("alias mutations are manager-gated SECURITY DEFINER RPCs with empty search_path", () => {
  for (const fn of ["alias_purchase_line_item_key", "revoke_purchase_line_item_key_alias"]) {
    assert.match(
      migration,
      new RegExp(
        `create or replace function public\\.${fn}[\\s\\S]*security definer[\\s\\S]*set search_path = ''`,
        "i"
      )
    );
    assert.match(
      migration,
      new RegExp(
        `private\\.has_restaurant_role\\(\\s*p_restaurant_id,\\s*array\\['owner',\\s*'admin',\\s*'manager'\\]`
      )
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*to authenticated`, "i")
    );
  }
  assert.match(migration, /Never fuzzy|never inferred|Never inferred/i);
  assert.match(migration, /purchase_line_item_key_aliased/);
  assert.match(migration, /Canonical purchase item key is already an alias source/);
  assert.match(migration, /Alias purchase item key is already a canonical target/);
});

test("active aliases are unique per restaurant, supplier scope, and alias key", () => {
  assert.match(
    migration,
    /create unique index if not exists purchase_line_item_key_aliases_active_key_idx[\s\S]*where status = 'verified'/
  );
  assert.match(
    migration,
    /constraint purchase_line_item_key_aliases_supplier_fkey foreign key \(restaurant_id, supplier_id\)/
  );
  assert.match(migration, /constraint purchase_line_item_key_aliases_keys_distinct_check/);
});

test("netting applies one-hop aliases and keeps unmatched credits visible", () => {
  assert.match(migration, /private\.resolve_purchase_line_item_key/);
  assert.match(
    migration,
    /create or replace function public\.list_purchase_line_net_by_item[\s\S]*resolve_purchase_line_item_key/
  );
  assert.doesNotMatch(migration, /fuzzy|similarity|levenshtein|soundex/i);
});

test("hosted/demo/application expose RPC-only mutations without client DML", () => {
  assert.match(hostedRepository, /client\.rpc\(\s*"alias_purchase_line_item_key"/);
  assert.match(hostedRepository, /client\.rpc\(\s*"revoke_purchase_line_item_key_alias"/);
  assert.match(demoRepository, /async\s+aliasPurchaseLineItemKey\(/);
  assert.match(demoRepository, /netPurchaseLinesWithAliases\(/);
  assert.match(application, /repository\.aliasPurchaseLineItemKey\(/);
  assert.doesNotMatch(
    hostedRepository,
    /\.from\(\s*"purchase_line_item_key_aliases"\s*\)[\s\S]{0,160}\.(insert|update|upsert|delete)\(/
  );
});

test("UI gates mutations to managers and only offers exact purchase-key targets", () => {
  assert.match(screen, /canManageRestaurantData\(memberships,\s*restaurant\?\.id\)/);
  assert.match(screen, /aliasPurchaseLineItemKey/);
  assert.match(screen, /canonicalTargets/);
  assert.doesNotMatch(screen, /fuzzy|levenshtein/);
});

test("aliases are registered for export and security inventories", () => {
  assert.match(securityGate, /"purchase_line_item_key_aliases"/);
  const restaurantOwned =
    securityGate.match(/const restaurantOwnedTables = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
  assert.match(restaurantOwned, /"purchase_line_item_key_aliases"/);
  const selectOnly =
    securityGate.match(/const selectOnlyAuthenticatedTables = new Set\(\[([\s\S]*?)\]\)/)?.[1] ??
    "";
  assert.match(selectOnly, /"purchase_line_item_key_aliases"/);
  assert.match(tenantIsolation, /'purchase_line_item_key_aliases',/);
  assert.match(exportFunction, /purchase_line_item_key_aliases/);
  assert.match(contracts, /"purchase_line_item_key_aliases"/);
});

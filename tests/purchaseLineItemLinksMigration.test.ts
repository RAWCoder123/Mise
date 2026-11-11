import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260904120000_mise_purchase_line_item_links.sql",
  "utf8"
);
const securityGate = readFileSync("scripts/security-backend.mjs", "utf8");
const tenantIsolation = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
const hostedRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
const application = readFileSync("services/application/purchaseLineItemLinks.ts", "utf8");
const screen = readFileSync("app/more/purchase-line-links.tsx", "utf8");
const exportFunction = readFileSync("supabase/functions/export-restaurant-data/index.ts", "utf8");
const contracts = readFileSync("services/repositories/repositoryContracts.ts", "utf8");

test("purchase_line_item_links is select-only for authenticated clients", () => {
  assert.match(migration, /create table if not exists public\.purchase_line_item_links/);
  assert.match(migration, /alter table public\.purchase_line_item_links enable row level security/);
  assert.match(
    migration,
    /revoke all on table public\.purchase_line_item_links from public, anon, authenticated, service_role/
  );
  assert.match(migration, /grant select on public\.purchase_line_item_links to authenticated;/);
  assert.doesNotMatch(
    migration,
    /grant[^;]*\b(insert|update|delete)\b[^;]*on\s+(?:table\s+)?public\.purchase_line_item_links[^;]*to authenticated/i
  );
});

test("link mutations are manager-gated SECURITY DEFINER RPCs with empty search_path", () => {
  for (const fn of [
    "link_purchase_line_item",
    "revoke_purchase_line_item_link",
    "apply_purchase_line_linked_unit_cost"
  ]) {
    assert.match(
      migration,
      new RegExp(`create or replace function public\\.${fn}[\\s\\S]*security definer[\\s\\S]*set search_path = ''`, "i")
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
  assert.match(migration, /Never auto-binds|never invent|Never inferred/i);
  assert.match(migration, /purchase_line_item_linked/);
  assert.match(migration, /purchase_line_linked_unit_cost_applied/);
});

test("active links are unique per restaurant, supplier scope, and normalized key", () => {
  assert.match(
    migration,
    /create unique index if not exists purchase_line_item_links_active_key_idx[\s\S]*where status = 'verified'/
  );
  assert.match(
    migration,
    /constraint purchase_line_item_links_inventory_fkey foreign key \(restaurant_id, inventory_item_id\)/
  );
  assert.match(
    migration,
    /constraint purchase_line_item_links_supplier_fkey foreign key \(restaurant_id, supplier_id\)/
  );
});

test("unit-cost apply requires a verified link and confirmed purchase-line price", () => {
  assert.match(migration, /Verified purchase line item link is required/);
  assert.match(migration, /No confirmed purchase-line unit price is available for this link/);
  assert.match(migration, /parse_confidence = 'confirmed'/);
  assert.match(migration, /estimated_unit_cost = source_line\.unit_price/);
  assert.doesNotMatch(migration, /fuzzy|similarity|levenshtein/i);
});

test("hosted/demo/application expose RPC-only mutations without client DML", () => {
  assert.match(hostedRepository, /client\.rpc\(\s*"link_purchase_line_item"/);
  assert.match(hostedRepository, /client\.rpc\(\s*"revoke_purchase_line_item_link"/);
  assert.match(hostedRepository, /client\.rpc\(\s*"apply_purchase_line_linked_unit_cost"/);
  assert.match(demoRepository, /async\s+linkPurchaseLineItem\(/);
  assert.match(demoRepository, /async\s+applyPurchaseLineLinkedUnitCost\(/);
  assert.match(application, /repository\.linkPurchaseLineItem\(/);
  assert.doesNotMatch(
    hostedRepository,
    /\.from\(\s*"purchase_line_item_links"\s*\)[\s\S]{0,160}\.(insert|update|upsert|delete)\(/
  );
});

test("UI gates mutations to managers and only offers exact-match linking", () => {
  assert.match(screen, /canManageRestaurantData\(memberships,\s*restaurant\?\.id\)/);
  assert.match(screen, /suggestInventoryMatchesForPurchaseLineKey/);
  assert.match(screen, /linkPurchaseLineItem/);
  assert.match(screen, /applyPurchaseLineLinkedUnitCost/);
  assert.doesNotMatch(screen, /fuzzy|levenshtein|includes\(/);
});

test("links are registered for export and security inventories", () => {
  assert.match(securityGate, /"purchase_line_item_links"/);
  const restaurantOwned =
    securityGate.match(/const restaurantOwnedTables = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
  assert.match(restaurantOwned, /"purchase_line_item_links"/);
  const selectOnly =
    securityGate.match(/const selectOnlyAuthenticatedTables = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
  assert.match(selectOnly, /"purchase_line_item_links"/);
  assert.match(tenantIsolation, /'purchase_line_item_links',/);
  assert.match(exportFunction, /purchase_line_item_links/);
  assert.match(contracts, /"purchase_line_item_links"/);
});

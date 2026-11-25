import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260906120000_mise_purchase_line_credit_attachments.sql",
  "utf8"
);
const securityGate = readFileSync("scripts/security-backend.mjs", "utf8");
const tenantIsolation = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
const hostedRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
const application = readFileSync("services/application/purchaseLineCreditAttachments.ts", "utf8");
const screen = readFileSync("app/more/purchase-line-credit-attachments.tsx", "utf8");
const exportFunction = readFileSync("supabase/functions/export-restaurant-data/index.ts", "utf8");
const contracts = readFileSync("services/repositories/repositoryContracts.ts", "utf8");
const activityEvents = readFileSync("services/domain/activityEvents.ts", "utf8");

test("purchase_line_credit_attachments is select-only for authenticated clients", () => {
  assert.match(migration, /create table if not exists public\.purchase_line_credit_attachments/);
  assert.match(
    migration,
    /alter table public\.purchase_line_credit_attachments enable row level security/
  );
  assert.match(
    migration,
    /revoke all on table public\.purchase_line_credit_attachments\s+from public, anon, authenticated, service_role/
  );
  assert.match(
    migration,
    /grant select on public\.purchase_line_credit_attachments to authenticated;/
  );
  assert.doesNotMatch(
    migration,
    /grant[^;]*\b(insert|update|delete)\b[^;]*on\s+(?:table\s+)?public\.purchase_line_credit_attachments[^;]*to authenticated/i
  );
});

test("attach mutations are manager-gated SECURITY DEFINER RPCs with empty search_path", () => {
  for (const fn of ["attach_purchase_line_credit", "revoke_purchase_line_credit_attachment"]) {
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
  assert.match(migration, /Never inferred|never rewrites ledger credits_line_id/i);
  assert.match(migration, /purchase_line_credit_attached/);
  assert.match(migration, /purchase_line_credit_attachment_revoked/);
  assert.match(migration, /Credit already names its offset on the source document/);
  assert.match(migration, /Credited purchase line is not available for this supplier/);
});

test("active attachments are unique per restaurant and credit line", () => {
  assert.match(
    migration,
    /create unique index if not exists purchase_line_credit_attachments_active_credit_idx[\s\S]*where status = 'verified'/
  );
  assert.match(
    migration,
    /constraint purchase_line_credit_attachments_credit_fkey[\s\S]*foreign key \(restaurant_id, credit_line_id\)/
  );
  assert.match(
    migration,
    /constraint purchase_line_credit_attachments_purchase_fkey[\s\S]*foreign key \(restaurant_id, purchase_line_id\)/
  );
  assert.doesNotMatch(migration, /fuzzy|similarity|levenshtein/i);
});

test("activity vocabulary includes sibling purchase-line events for merge safety", () => {
  for (const eventType of [
    "purchase_line_item_linked",
    "purchase_line_item_link_revoked",
    "purchase_line_linked_unit_cost_applied",
    "purchase_line_item_key_aliased",
    "purchase_line_item_key_alias_revoked",
    "purchase_line_credit_attached",
    "purchase_line_credit_attachment_revoked"
  ]) {
    assert.match(migration, new RegExp(`'${eventType}'`));
    assert.match(activityEvents, new RegExp(`"${eventType}"`));
  }
});

test("hosted/demo/application expose RPC-only mutations without client DML", () => {
  assert.match(hostedRepository, /client\.rpc\(\s*"attach_purchase_line_credit"/);
  assert.match(hostedRepository, /client\.rpc\(\s*"revoke_purchase_line_credit_attachment"/);
  assert.match(demoRepository, /async\s+attachPurchaseLineCredit\(/);
  assert.match(demoRepository, /async\s+revokePurchaseLineCreditAttachment\(/);
  assert.match(application, /repository\.attachPurchaseLineCredit\(/);
  assert.doesNotMatch(
    hostedRepository,
    /\.from\(\s*"purchase_line_credit_attachments"\s*\)[\s\S]{0,160}\.(insert|update|upsert|delete)\(/
  );
});

test("UI gates mutations to managers and only offers same-supplier suggestions", () => {
  assert.match(screen, /canManageRestaurantData\(memberships,\s*restaurant\?\.id\)/);
  assert.match(screen, /suggestPurchaseMatchesForCredit/);
  assert.match(screen, /attachPurchaseLineCredit/);
  assert.match(screen, /revokePurchaseLineCreditAttachment/);
  assert.doesNotMatch(screen, /fuzzy|levenshtein/);
});

test("attachments are registered for export and security inventories", () => {
  assert.match(securityGate, /"purchase_line_credit_attachments"/);
  const restaurantOwned =
    securityGate.match(/const restaurantOwnedTables = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
  assert.match(restaurantOwned, /"purchase_line_credit_attachments"/);
  const selectOnly =
    securityGate.match(/const selectOnlyAuthenticatedTables = new Set\(\[([\s\S]*?)\]\)/)?.[1] ??
    "";
  assert.match(selectOnly, /"purchase_line_credit_attachments"/);
  assert.match(tenantIsolation, /'purchase_line_credit_attachments',/);
  assert.match(exportFunction, /purchase_line_credit_attachments/);
  assert.match(contracts, /"purchase_line_credit_attachments"/);
});

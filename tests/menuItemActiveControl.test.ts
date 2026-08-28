import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260828200000_set_menu_item_active.sql",
  "utf8"
);
const screen = readFileSync("app/settings/recipes.tsx", "utf8");
const inventoryApplication = readFileSync("services/application/inventory.ts", "utf8");
const repository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
const contracts = readFileSync("services/repositories/repositoryContracts.ts", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");
const types = readFileSync("types/mise.ts", "utf8");
const pgTap = readFileSync("supabase/tests/database/set_menu_item_active.test.sql", "utf8");

test("set_menu_item_active is manager+ SECURITY DEFINER with empty search_path", () => {
  assert.match(migration, /create or replace function public\.set_menu_item_active/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /array\['owner', 'admin', 'manager'\]/i);
  assert.match(migration, /menu_item_activated/i);
  assert.match(migration, /menu_item_deactivated/i);
  assert.match(migration, /revoke all on function public\.set_menu_item_active/i);
  assert.match(migration, /grant execute on function public\.set_menu_item_active[\s\S]*to authenticated/i);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to anon/i);
  assert.doesNotMatch(migration, /grant (insert|update|delete) on public\.menu_items/i);
});

test("recipe settings toggles active state through the service-owned RPC only", () => {
  assert.match(types, /active\?:\s*boolean/);
  assert.match(inventoryApplication, /active: authority\?\.active \?\? true/);
  assert.match(inventoryApplication, /export async function setRecipeMenuItemActive/);
  assert.match(inventoryApplication, /repository\.setMenuItemActive\(/);
  assert.match(contracts, /setMenuItemActive\(/);
  assert.match(repository, /client\.rpc\("set_menu_item_active"/);
  assert.match(demoRepository, /async setMenuItemActive\(/);
  assert.match(demoRepository, /demoInactiveMenuItemIds/);
  assert.match(screen, /setRecipeMenuItemActive\(restaurantId, item\.menuItemId, nextActive\)/);
  assert.match(screen, /recipes\.authority\.inactive/);
  assert.match(screen, /recipes\.action\.deactivate/);
  assert.match(screen, /recipes\.action\.activate/);
  assert.doesNotMatch(screen, /\.from\("menu_items"\)/);
  assert.doesNotMatch(screen, /\.update\(\{[\s\S]*active/);
});

test("menu item active control is localized for EN, ES, and zh-Hans", () => {
  for (const key of [
    "recipes.authority.inactive",
    "recipes.action.activate",
    "recipes.action.deactivate",
    "recipes.notice.activated",
    "recipes.notice.deactivated",
    "recipes.error.active",
    "recipes.error.inactiveConfirm"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}":`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} must appear once per locale`);
  }
  assert.match(catalog, /"recipes\.authority\.inactive":\s*"Inactive"/);
  assert.match(catalog, /"recipes\.authority\.inactive":\s*"Inactivo"/);
  assert.match(catalog, /"recipes\.authority\.inactive":\s*"已停用"/);
});

test("pgTAP pins execute grants and rejects direct menu_items updates", () => {
  assert.match(pgTap, /set_menu_item_active exists/i);
  assert.match(pgTap, /authenticated may execute set_menu_item_active/i);
  assert.match(pgTap, /authenticated cannot update menu_items directly/i);
  assert.match(pgTap, /anon cannot execute set_menu_item_active/i);
});

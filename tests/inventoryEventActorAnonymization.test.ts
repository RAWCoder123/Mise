import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260726220000_inventory_event_actor_anonymization.sql",
  "utf8"
);

test("inventory actor deletion preserves history through a narrow FK-only path", () => {
  assert.match(migration, /alter column actor_user_id drop not null/i);
  assert.match(
    migration,
    /foreign key \(actor_user_id\)[\s\S]*references auth\.users\(id\)[\s\S]*on delete set null/i
  );
  assert.match(migration, /old\.actor_user_id is not null/i);
  assert.match(migration, /new\.actor_user_id is null/i);
  assert.match(
    migration,
    /not exists \([\s\S]*from auth\.users auth_user[\s\S]*auth_user\.id = old\.actor_user_id/i
  );
  assert.match(
    migration,
    /pg_catalog\.to_jsonb\(new\) - 'actor_user_id'[\s\S]*is not distinct from[\s\S]*pg_catalog\.to_jsonb\(old\) - 'actor_user_id'/i
  );
  assert.match(migration, /Inventory events are append-only/i);
});

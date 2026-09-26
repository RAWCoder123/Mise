import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926180000_mise_005x_approve_send_fingerprint_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original003c = readFileSync(
  new URL(
    "../supabase/migrations/20260824034152_mise_003c_durable_supplier_identity.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/approve_send_fingerprint_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

function approveFingerprintGate(source: string): string {
  const fnStart = source.indexOf(
    "create or replace function public.approve_supplier_send_content("
  );
  assert.ok(fnStart >= 0, "approve_supplier_send_content must exist");
  const begin = source.indexOf("begin", fnStart);
  assert.ok(begin > fnStart, "function body begin must follow declare");
  return source.slice(fnStart, begin);
}

test("MISE-005X pins approve reviewed fingerprint lower to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005X"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function public\.approve_supplier_send_content\(\s*p_restaurant_id uuid,\s*p_action_id uuid,\s*p_order_id uuid,\s*p_reviewed_content_fingerprint text/i
  );

  const gate = approveFingerprintGate(migration);
  assert.match(
    gate,
    /reviewed_fingerprint text := pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(p_reviewed_content_fingerprint, ''\)\) collate "C"\s*\) collate "C"/
  );
  assert.doesNotMatch(
    gate,
    /reviewed_fingerprint text := pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(p_reviewed_content_fingerprint, ''\)\)\s*\);/
  );

  assert.match(
    migration,
    /revoke all on function public\.approve_supplier_send_content\(\s*uuid, uuid, uuid, text\s*\)\s*from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /grant execute on function public\.approve_supplier_send_content\(\s*uuid, uuid, uuid, text\s*\)\s*to authenticated/i
  );

  // Compose with MISE-005Q/005R/005T: do not rewrite builder, claim, or complete.
  assert.doesNotMatch(
    migration,
    /create or replace function private\.build_supplier_send_content/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_claim_supplier_email_send/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_complete_supplier_email_send/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.approve_supplier_send_envelope/i
  );
  assert.doesNotMatch(migration, /gmail_credentials_sender_email_check/);
  assert.doesNotMatch(
    migration,
    /supplier_email_deliveries_mise_003c_metadata_check/
  );
});

test("MISE-003C originally left approve fingerprint on bare lower/btrim", () => {
  const gate = approveFingerprintGate(original003c);
  assert.match(
    gate,
    /reviewed_fingerprint text := pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(p_reviewed_content_fingerprint, ''\)\)\s*\);/
  );
  assert.doesNotMatch(
    gate,
    /btrim\(coalesce\(p_reviewed_content_fingerprint, ''\)\) collate "C"/
  );
});

test("pgTAP fixture pins approve fingerprint lower to COLLATE C", () => {
  assert.match(pgTap, /select plan\(4\)/);
  assert.match(pgTap, /approve reviewed fingerprint lower\/btrim uses COLLATE C/);
  assert.match(
    pgTap,
    /authenticated retains EXECUTE on approve_supplier_send_content/
  );
  assert.match(
    pgTap,
    /service_role lacks EXECUTE on approve_supplier_send_content/
  );
});

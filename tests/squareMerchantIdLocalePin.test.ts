import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isSquareMerchantId,
  SQUARE_MERCHANT_ID_PATTERN,
} from "../supabase/functions/_shared/square.ts";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927230000_mise_005az_square_merchant_id_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalSquare = readFileSync(
  new URL(
    "../supabase/migrations/20260730210000_square_backend_oauth_sync.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/square_merchant_id_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const squareShared = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);
const webhooks = readFileSync(
  new URL("../supabase/functions/square-webhooks/index.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const MERCHANT_PATTERN = "^[A-Za-z0-9_-]{1,128}$";

test("MISE-005AZ pins square_credentials.merchant_id CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AZ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint square_credentials_merchant_id_check check \(\s*merchant_id collate "C" ~ '\^\[A-Za-z0-9_-\]\{1,128\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`merchant_id collate "C" ~ '${MERCHANT_PATTERN}'`),
    "merchant_id CHECK must pin under COLLATE C"
  );

  assert.match(
    migration,
    /p_merchant_id collate "C" !~ '\^\[A-Za-z0-9_-\]\{1,128\}\$'/
  );

  assert.match(
    migration,
    /create or replace function private\.service_complete_square_oauth/
  );
  assert.match(
    migration,
    /create or replace function private\.service_resolve_square_webhook_merchant/
  );

  // Compose: do not rewrite contested sibling pins or public wrappers.
  assert.doesNotMatch(sqlBody, /create or replace function public\./i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table private\.gmail_oauth_flows/i);
  assert.doesNotMatch(sqlBody, /alter table private\.square_oauth_flows/i);
  assert.doesNotMatch(sqlBody, /gmail_safe_error_code/i);

  assert.match(
    migration,
    /grant execute on function private\.service_complete_square_oauth/
  );
  assert.match(
    migration,
    /grant execute on function private\.service_resolve_square_webhook_merchant/
  );
});

test("original square_credentials.merchant_id CHECK was length-only", () => {
  assert.match(
    originalSquare,
    /merchant_id text not null check \(length\(merchant_id\) between 1 and 128\)/
  );
  assert.match(
    originalSquare,
    /if p_merchant_id is null or length\(p_merchant_id\) not between 1 and 128/
  );
  assert.doesNotMatch(originalSquare, /square_credentials_merchant_id_check/);
  assert.doesNotMatch(
    originalSquare,
    /p_merchant_id collate "C" !~ '\^\[A-Za-z0-9_-\]\{1,128\}\$'/
  );
});

test("Edge writer allowlist matches the pinned ASCII merchant_id class", () => {
  assert.equal(SQUARE_MERCHANT_ID_PATTERN.source, MERCHANT_PATTERN);
  assert.equal(isSquareMerchantId("MLG2Y3WQ3C3SN"), true);
  assert.equal(isSquareMerchantId("sandbox_merchant-1"), true);
  assert.equal(isSquareMerchantId("merchant id spaced"), false);
  assert.equal(isSquareMerchantId("merchant_café"), false);
  assert.equal(isSquareMerchantId(""), false);
  assert.equal(isSquareMerchantId("a".repeat(129)), false);

  assert.match(squareShared, /export function isSquareMerchantId/);
  assert.match(
    squareShared,
    /!merchantId \|\| !isSquareMerchantId\(merchantId\)/
  );
  assert.match(webhooks, /isSquareMerchantId/);
  assert.match(webhooks, /merchant_invalid/);
});

test("pgTAP fixture pins square merchant_id shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /square_credentials_merchant_id_check exists/);
  assert.match(pgTap, /square_credentials merchant_id CHECK uses COLLATE C/);
  assert.match(pgTap, /square_credentials merchant_id CHECK is not length-only/);
  assert.match(pgTap, /complete_square_oauth merchant_id gate uses COLLATE C/);
  assert.match(pgTap, /complete_square_oauth merchant_id gate is not length-only/);
  assert.match(pgTap, /resolve_square_webhook_merchant gate uses COLLATE C/);
  assert.match(
    pgTap,
    /resolve_square_webhook_merchant gate is not length-only/
  );
  assert.match(pgTap, /Square-shaped merchant_id matches under COLLATE C/);
  assert.match(pgTap, /underscore\/hyphen merchant_id matches under COLLATE C/);
  assert.match(pgTap, /spaced merchant_id is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII merchant_id is rejected under COLLATE C/);
  assert.match(pgTap, /empty merchant_id is rejected under COLLATE C/);
});

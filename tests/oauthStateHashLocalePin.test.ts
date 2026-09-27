import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927000100_mise_005ad_oauth_state_hash_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalGmail = readFileSync(
  new URL(
    "../supabase/migrations/20260719062148_gmail_backend_oauth_delivery.sql",
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
    "../supabase/tests/database/oauth_state_hash_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const gmailShared = readFileSync(
  new URL("../supabase/functions/_shared/gmail.ts", import.meta.url),
  "utf8"
);

const STATE_HASH_PATTERN = "^[0-9a-f]{64}$";
const PKCE_PATTERN = "^[A-Za-z0-9._~-]+$";

function functionBody(source: string, signature: string): string {
  const start = source.indexOf(`create or replace function ${signature}`);
  assert.ok(start >= 0, `${signature} must exist`);
  const end = source.indexOf("$$;", start);
  assert.ok(end > start, "function body terminator must exist");
  return source.slice(start, end);
}

test("MISE-005AD pins Gmail/Square OAuth state_hash CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AD"), "additive pin must stay labeled");

  assert.ok(
    migration.includes(`state_hash collate "C" ~ '${STATE_HASH_PATTERN}'`),
    "both CHECKs must pin state_hash under COLLATE C"
  );
  assert.match(
    migration,
    /add constraint gmail_oauth_flows_state_hash_check[\s\S]*state_hash collate "C"/
  );
  assert.match(
    migration,
    /add constraint square_oauth_flows_state_hash_check[\s\S]*state_hash collate "C"/
  );
});

test("MISE-005AD pins begin/claim OAuth hex + PKCE gates to COLLATE C", () => {
  for (const signature of [
    "private.service_begin_gmail_oauth(",
    "private.service_begin_square_oauth(",
  ]) {
    const body = functionBody(migration, signature);
    assert.ok(
      body.includes(`p_state_hash collate "C" !~ '${STATE_HASH_PATTERN}'`),
      `${signature} must pin state_hash under COLLATE C`
    );
    assert.ok(
      body.includes(`p_code_verifier collate "C" !~ '${PKCE_PATTERN}'`),
      `${signature} must pin PKCE verifier under COLLATE C`
    );
  }

  for (const signature of [
    "private.service_claim_gmail_oauth(",
    "private.service_claim_square_oauth(",
  ]) {
    const body = functionBody(migration, signature);
    assert.ok(
      body.includes(`p_state_hash collate "C" !~ '${STATE_HASH_PATTERN}'`),
      `${signature} must pin state_hash under COLLATE C`
    );
  }

  assert.match(
    migration,
    /grant execute on function private\.service_begin_gmail_oauth\(\s*uuid, uuid, uuid, text, text\s*\)\s*to service_role/i
  );
  assert.match(
    migration,
    /grant execute on function private\.service_begin_square_oauth\(\s*uuid, uuid, uuid, text, text\s*\)\s*to service_role/i
  );
  assert.match(
    migration,
    /revoke all on function private\.service_claim_gmail_oauth\(\s*text\s*\)\s*from public, anon, authenticated, service_role/i
  );

  // Compose: do not rewrite public wrappers, complete-oauth, or error-code helper.
  assert.doesNotMatch(
    migration,
    /create or replace function public\.service_begin_gmail_oauth/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.service_begin_square_oauth/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_complete_gmail_oauth/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_complete_square_oauth/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.gmail_safe_error_code/i
  );
  assert.doesNotMatch(migration, /gmail_credentials_sender_email_check/);
});

test("original OAuth migrations left state_hash and PKCE on bare classes", () => {
  assert.ok(
    originalGmail.includes(`state_hash text not null unique check (state_hash ~ '${STATE_HASH_PATTERN}')`),
    "original Gmail CHECK used bare state_hash ~"
  );
  assert.ok(
    !originalGmail.includes(`state_hash collate "C"`),
    "original Gmail must not already pin COLLATE C on state_hash"
  );
  assert.ok(
    functionBody(originalGmail, "private.service_begin_gmail_oauth(").includes(
      `p_state_hash !~ '${STATE_HASH_PATTERN}'`
    ),
    "original begin gmail used bare state_hash !~"
  );
  assert.ok(
    functionBody(originalGmail, "private.service_begin_gmail_oauth(").includes(
      `p_code_verifier !~ '${PKCE_PATTERN}'`
    ),
    "original begin gmail used bare PKCE !~"
  );

  assert.ok(
    originalSquare.includes(`state_hash text not null unique check (state_hash ~ '${STATE_HASH_PATTERN}')`),
    "original Square CHECK used bare state_hash ~"
  );
  assert.ok(
    !originalSquare.includes(`state_hash collate "C"`),
    "original Square must not already pin COLLATE C on state_hash"
  );
  assert.ok(
    functionBody(originalSquare, "private.service_begin_square_oauth(").includes(
      `p_state_hash !~ '${STATE_HASH_PATTERN}'`
    ),
    "original begin square used bare state_hash !~"
  );
});

test("pgTAP fixture pins OAuth state_hash and begin/claim gates", () => {
  assert.match(pgTap, /select plan\(13\)/);
  assert.match(pgTap, /gmail state_hash CHECK uses COLLATE C hex class/);
  assert.match(pgTap, /square state_hash CHECK uses COLLATE C hex class/);
  assert.match(pgTap, /begin gmail state_hash gate uses COLLATE C/);
  assert.match(pgTap, /begin gmail PKCE gate uses COLLATE C/);
  assert.match(pgTap, /claim gmail state_hash gate uses COLLATE C/);
  assert.match(pgTap, /begin square state_hash gate uses COLLATE C/);
  assert.match(pgTap, /begin square PKCE gate uses COLLATE C/);
  assert.match(pgTap, /claim square state_hash gate uses COLLATE C/);
  assert.match(pgTap, /service_role retains EXECUTE on private\.service_begin_gmail_oauth/);
  assert.match(pgTap, /authenticated lacks EXECUTE on private\.service_begin_gmail_oauth/);
  assert.match(pgTap, /authenticated lacks EXECUTE on private\.service_begin_square_oauth/);
});

test("Edge sha256Hex + base64url PKCE already match the ASCII allowlists", () => {
  assert.match(
    gmailShared,
    /byte\.toString\(16\)\.padStart\(2, "0"\)/
  );

  const stateHash = /^[0-9a-f]{64}$/;
  const pkce = /^[A-Za-z0-9._~-]+$/;
  assert.match("a".repeat(64), stateHash);
  assert.match("0123456789abcdef".repeat(4), stateHash);
  assert.doesNotMatch("A".repeat(64), stateHash);
  assert.doesNotMatch("g".repeat(64), stateHash);
  assert.match("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~", pkce);
  assert.doesNotMatch("has space", pkce);
  assert.doesNotMatch("plus+sign", pkce);
});

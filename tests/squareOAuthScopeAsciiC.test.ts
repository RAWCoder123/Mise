import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareOAuthScopeField,
  asciiTrimSquareOAuthScopeToken,
  canonicalizeSquareOAuthScopeToken,
  normalizeSquareOAuthGrantedScopes
} from "../services/domain/squareOAuthScopeIdentity";
import {
  exchangeSquareAuthorizationCode,
  refreshSquareAccessToken,
  SquareProviderError
} from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareOAuthScopeIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const requiredScopes = "MERCHANT_PROFILE_READ ITEMS_READ ORDERS_READ";
const requiredScopeList = [
  "MERCHANT_PROFILE_READ",
  "ITEMS_READ",
  "ORDERS_READ"
];
const accentedScope = "Café-SCOPE_READ";
const em = "\u2003";
const nbsp = "\u00a0";

const oauthConfig = {
  applicationId: "sq0idp-test-application",
  applicationSecret: "server-only-square-secret",
  redirectUri: "https://project.supabase.co/functions/v1/square-oauth-callback",
  environment: "sandbox" as const
};

function tokenFetch(payload: unknown): typeof fetch {
  return async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
}

test("MISE-005TP pins Square OAuth scope to ASCII C", () => {
  assert.match(identitySource, /MISE-005TP/);
  assert.match(squareSource, /MISE-005TP/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareOAuthScopeField\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareOAuthScopeIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareOAuthGrantedScopes\(/);

  const parseStart = squareSource.indexOf("function parseTokenSet(");
  const parseEnd = squareSource.indexOf("function moneyAmount(");
  assert.ok(parseStart > 0 && parseEnd > parseStart);
  const parseBody = squareSource.slice(parseStart, parseEnd);
  assert.match(parseBody, /normalizeSquareOAuthGrantedScopes\(/);
  assert.doesNotMatch(parseBody, /stringField\(payload,\s*"scope"/);
  assert.doesNotMatch(parseBody, /\.map\(\(scope\) => scope\.trim\(\)\)/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (tokens, merchant_id, expires_at).
  assert.match(parseBody, /stringField\(payload,\s*"access_token"/);
  assert.match(parseBody, /stringField\(payload,\s*"refresh_token"/);
  assert.match(parseBody, /stringField\(payload,\s*"merchant_id"/);
  assert.match(parseBody, /stringField\(payload,\s*"expires_at"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareOAuthExpiresAtIdentity/);
  assert.doesNotMatch(identityCode, /squareMerchantIdIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogCategoryIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleClosedAtIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleVariationNameIdentity/);
  assert.doesNotMatch(identityCode, /squareLocationDisplayNameIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogVariationNameIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogItemExternalNameIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogItemExternalIdIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogVariationExternalIdIdentity/);
  assert.doesNotMatch(identityCode, /squareLocationExternalIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleLineUidIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleSourceRecordOrderIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderVariationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square OAuth scopes stable", async () => {
  assert.equal(asciiTrimSquareOAuthScopeField(`  ${requiredScopes}  `), requiredScopes);
  assert.equal(asciiTrimSquareOAuthScopeField(`\t${requiredScopes}\n`), requiredScopes);
  assert.deepEqual(
    normalizeSquareOAuthGrantedScopes(`  ${requiredScopes}  `),
    requiredScopeList
  );
  assert.deepEqual(
    normalizeSquareOAuthGrantedScopes(requiredScopes.replace(/ /g, ",")),
    requiredScopeList
  );

  assert.equal(canonicalizeSquareOAuthScopeToken(accentedScope), accentedScope);
  assert.equal(asciiTrimSquareOAuthScopeToken(`  ${accentedScope}  `), accentedScope);

  const tokens = await exchangeSquareAuthorizationCode(
    oauthConfig,
    "authorization-code-with-enough-bytes",
    tokenFetch({
      access_token: "square-access-token-with-enough-bytes",
      refresh_token: "square-refresh-token-with-enough-bytes",
      merchant_id: "ML_ABC123",
      scope: `  ${requiredScopes}  `,
      expires_at: "2026-10-29T12:00:00.000Z"
    })
  );
  assert.deepEqual(tokens.grantedScopes, requiredScopeList);
});

test("Unicode em-space / NBSP padding cannot invent clean Square OAuth scopes", async () => {
  const padded = `${em}${requiredScopes}${em}`;
  const nbspScopes = `${nbsp}${requiredScopes}${nbsp}`;

  // Inventing proof: Unicode trim would invent the clean scope grant string.
  assert.equal(padded.trim(), requiredScopes);
  assert.equal(nbspScopes.trim(), requiredScopes);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareOAuthScopeField(padded), padded);
  assert.deepEqual(normalizeSquareOAuthGrantedScopes(padded), []);
  assert.deepEqual(normalizeSquareOAuthGrantedScopes(nbspScopes), []);

  // Soft empty still fails closed without inventing scopes from padding alone.
  assert.deepEqual(normalizeSquareOAuthGrantedScopes(`${em}${em}`), []);
  assert.deepEqual(normalizeSquareOAuthGrantedScopes(`${nbsp}`), []);
  assert.deepEqual(normalizeSquareOAuthGrantedScopes("   "), []);

  // Live exchange must not invent clean grantedScopes from padded scope;
  // soft-empty grants fail closed via square_scope_missing.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        tokenFetch({
          access_token: "square-access-token-with-enough-bytes",
          refresh_token: "square-refresh-token-with-enough-bytes",
          merchant_id: "ML_ABC123",
          scope: padded,
          expires_at: "2026-10-29T12:00:00.000Z"
        })
      ),
    (error: unknown) =>
      error instanceof SquareProviderError &&
      error.safeCode === "square_scope_missing" &&
      error.disposition === "rejected"
  );

  await assert.rejects(
    () =>
      refreshSquareAccessToken(
        oauthConfig,
        "square-refresh-token-with-enough-bytes",
        tokenFetch({
          access_token: "square-access-token-with-enough-bytes",
          merchant_id: "ML_ABC123",
          scope: em,
          expires_at: "2026-10-29T12:00:00.000Z"
        })
      ),
    (error: unknown) =>
      error instanceof SquareProviderError &&
      error.safeCode === "square_scope_missing"
  );

  // Per-token Unicode end padding that survives delimiter split also fails closed.
  const paddedToken = `${em}ORDERS_READ${em}`;
  assert.equal(paddedToken.trim(), "ORDERS_READ");
  assert.equal(asciiTrimSquareOAuthScopeToken(paddedToken), paddedToken);
  assert.equal(canonicalizeSquareOAuthScopeToken(paddedToken), null);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square OAuth scopes", async () => {
  assert.deepEqual(normalizeSquareOAuthGrantedScopes(undefined), []);
  assert.deepEqual(normalizeSquareOAuthGrantedScopes(null), []);
  assert.deepEqual(normalizeSquareOAuthGrantedScopes(""), []);
  assert.deepEqual(normalizeSquareOAuthGrantedScopes("   "), []);
  assert.deepEqual(normalizeSquareOAuthGrantedScopes(123 as unknown as string), []);
  assert.deepEqual(normalizeSquareOAuthGrantedScopes(`\u0001${requiredScopes}`), []);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.deepEqual(
    normalizeSquareOAuthGrantedScopes(`${requiredScopes}\t`),
    requiredScopeList
  );
  assert.deepEqual(normalizeSquareOAuthGrantedScopes(`${requiredScopes}\u0007`), []);
  // Overly padded Unicode-only space soft-empties without inventing grants.
  assert.deepEqual(normalizeSquareOAuthGrantedScopes(em), []);
  // Overlong fields fail closed (prior stringField max 2000).
  assert.deepEqual(normalizeSquareOAuthGrantedScopes("x".repeat(2001)), []);
  // A single 2000-char token is within the field max but exceeds per-token max
  // 128 → filtered out rather than inventing a truncated durable scope.
  assert.deepEqual(normalizeSquareOAuthGrantedScopes("x".repeat(2000)), []);
  assert.equal(canonicalizeSquareOAuthScopeToken("x".repeat(128)), "x".repeat(128));
  assert.equal(canonicalizeSquareOAuthScopeToken("x".repeat(129)), null);

  // Missing scope still fails closed via square_scope_missing.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        tokenFetch({
          access_token: "square-access-token-with-enough-bytes",
          refresh_token: "square-refresh-token-with-enough-bytes",
          merchant_id: "ML_ABC123",
          expires_at: "2026-10-29T12:00:00.000Z"
        })
      ),
    (error: unknown) =>
      error instanceof SquareProviderError &&
      error.safeCode === "square_scope_missing"
  );
});

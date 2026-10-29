import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareOAuthAccessOrRefreshToken,
  canonicalizeSquareOAuthAccessOrRefreshToken,
  normalizeSquareOAuthAccessOrRefreshToken
} from "../services/domain/squareOAuthAccessRefreshTokenIdentity";
import {
  exchangeSquareAuthorizationCode,
  refreshSquareAccessToken,
  SquareProviderError
} from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareOAuthAccessRefreshTokenIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const accessToken = "square-access-token-with-enough-bytes";
const refreshToken = "square-refresh-token-with-enough-bytes";
const accentedToken = "sq0at-Café-Token-1-with-enough-bytes";
const em = "\u2003";
const nbsp = "\u00a0";

const oauthConfig = {
  applicationId: "sq0idp-test-application",
  applicationSecret: "server-only-square-secret",
  redirectUri: "https://project.supabase.co/functions/v1/square-oauth-callback",
  environment: "sandbox" as const
};

const requiredScopes = "MERCHANT_PROFILE_READ ITEMS_READ ORDERS_READ";

function tokenFetch(payload: unknown): typeof fetch {
  return async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
}

test("MISE-005TR pins Square OAuth access_token / refresh_token to ASCII C", () => {
  assert.match(identitySource, /MISE-005TR/);
  assert.match(squareSource, /MISE-005TR/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareOAuthAccessOrRefreshToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareOAuthAccessRefreshTokenIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareOAuthAccessOrRefreshToken\(/);

  const parseStart = squareSource.indexOf("function parseTokenSet(");
  const parseEnd = squareSource.indexOf("function moneyAmount(");
  assert.ok(parseStart > 0 && parseEnd > parseStart);
  const parseBody = squareSource.slice(parseStart, parseEnd);
  assert.match(parseBody, /normalizeSquareOAuthAccessOrRefreshToken\(/);
  assert.doesNotMatch(parseBody, /stringField\(payload,\s*"access_token"/);
  assert.doesNotMatch(parseBody, /stringField\(payload,\s*"refresh_token"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (merchant_id, scopes, expires_at).
  assert.match(parseBody, /stringField\(payload,\s*"merchant_id"/);
  assert.match(parseBody, /stringField\(payload,\s*"scope"/);
  assert.match(parseBody, /stringField\(payload,\s*"expires_at"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareMerchantIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOAuthScopeIdentity/);
  assert.doesNotMatch(identityCode, /squareOAuthExpiresAtIdentity/);
  assert.doesNotMatch(identityCode, /squareOAuthTokenEndpointErrorCodeIdentity/);
  assert.doesNotMatch(identityCode, /squareLocationExternalIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square OAuth access / refresh tokens stable", async () => {
  assert.equal(asciiTrimSquareOAuthAccessOrRefreshToken(`  ${accessToken}  `), accessToken);
  assert.equal(asciiTrimSquareOAuthAccessOrRefreshToken(`\t${refreshToken}\n`), refreshToken);
  assert.equal(canonicalizeSquareOAuthAccessOrRefreshToken(`  ${accessToken}  `), accessToken);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(`  ${refreshToken}  `), refreshToken);

  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(accentedToken), accentedToken);
  assert.equal(canonicalizeSquareOAuthAccessOrRefreshToken(accentedToken), accentedToken);

  const tokens = await exchangeSquareAuthorizationCode(
    oauthConfig,
    "authorization-code-with-enough-bytes",
    tokenFetch({
      access_token: `  ${accessToken}  `,
      refresh_token: `  ${refreshToken}  `,
      merchant_id: "ML_ABC123",
      scope: requiredScopes,
      expires_at: "2026-10-29T12:00:00.000Z"
    })
  );
  assert.equal(tokens.accessToken, accessToken);
  assert.equal(tokens.refreshToken, refreshToken);
});

test("Unicode em-space / NBSP padding cannot invent clean Square OAuth access / refresh tokens", async () => {
  const paddedAccess = `${em}${accessToken}${em}`;
  const nbspAccess = `${nbsp}${accessToken}${nbsp}`;
  const paddedRefresh = `${em}${refreshToken}${em}`;
  const nbspRefresh = `${nbsp}${refreshToken}${nbsp}`;
  const internalEm = `sq0at-${em}internal-with-enough-bytes`;
  const internalNbsp = `sq0at-${nbsp}internal-with-enough-bytes`;

  // Inventing proof: Unicode trim would invent the clean opaque credential.
  assert.equal(paddedAccess.trim(), accessToken);
  assert.equal(nbspAccess.trim(), accessToken);
  assert.equal(paddedRefresh.trim(), refreshToken);
  assert.equal(nbspRefresh.trim(), refreshToken);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareOAuthAccessOrRefreshToken(paddedAccess), paddedAccess);
  assert.equal(canonicalizeSquareOAuthAccessOrRefreshToken(paddedAccess), null);
  assert.equal(canonicalizeSquareOAuthAccessOrRefreshToken(nbspAccess), null);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(paddedAccess), null);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(nbspAccess), null);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(paddedRefresh), null);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(nbspRefresh), null);

  // Soft empty still fails closed without inventing a credential from padding alone.
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(`${em}${em}`), null);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(`${nbsp}`), null);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken("   "), null);

  // Live exchange must not invent a clean accessToken from padded access_token;
  // soft-null fails closed through the existing token_response_invalid path.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        tokenFetch({
          access_token: paddedAccess,
          refresh_token: refreshToken,
          merchant_id: "ML_ABC123",
          scope: requiredScopes,
          expires_at: "2026-10-29T12:00:00.000Z"
        })
      ),
    (error: unknown) =>
      error instanceof SquareProviderError &&
      error.safeCode === "token_response_invalid"
  );

  // Live exchange must not invent a clean refreshToken from padded refresh_token;
  // soft-null fails closed through the existing refresh_token_missing path.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        tokenFetch({
          access_token: accessToken,
          refresh_token: paddedRefresh,
          merchant_id: "ML_ABC123",
          scope: requiredScopes,
          expires_at: "2026-10-29T12:00:00.000Z"
        })
      ),
    (error: unknown) =>
      error instanceof SquareProviderError &&
      error.safeCode === "refresh_token_missing"
  );

  // Refresh path: padded access_token fails closed without inventing credentials.
  await assert.rejects(
    () =>
      refreshSquareAccessToken(
        oauthConfig,
        refreshToken,
        tokenFetch({
          access_token: em,
          merchant_id: "ML_ABC123",
          scope: requiredScopes,
          expires_at: "2026-10-29T12:00:00.000Z"
        })
      ),
    (error: unknown) =>
      error instanceof SquareProviderError &&
      error.safeCode === "token_response_invalid"
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareOAuthAccessOrRefreshToken(internalEm), internalEm);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(internalEm), internalEm);

  const internalTokens = await exchangeSquareAuthorizationCode(
    oauthConfig,
    "authorization-code-with-enough-bytes",
    tokenFetch({
      access_token: internalEm,
      refresh_token: internalNbsp,
      merchant_id: "ML_ABC123",
      scope: requiredScopes,
      expires_at: "2026-10-29T12:00:00.000Z"
    })
  );
  assert.equal(internalTokens.accessToken, internalEm);
  assert.equal(internalTokens.refreshToken, internalNbsp);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square OAuth access / refresh tokens", async () => {
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(undefined), null);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(null), null);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(""), null);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken("   "), null);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(123 as unknown as string), null);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(`\u0001${accessToken}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(`${accessToken}\t`), accessToken);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(`${accessToken}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken(em), null);
  // Overlong tokens fail closed (prior stringField max 4096).
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken("x".repeat(4097)), null);
  assert.equal(normalizeSquareOAuthAccessOrRefreshToken("x".repeat(4096)), "x".repeat(4096));

  // Missing access_token still fails closed through token_response_invalid.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        tokenFetch({
          refresh_token: refreshToken,
          merchant_id: "ML_ABC123",
          scope: requiredScopes,
          expires_at: "2026-10-29T12:00:00.000Z"
        })
      ),
    (error: unknown) =>
      error instanceof SquareProviderError &&
      error.safeCode === "token_response_invalid"
  );

  // Missing refresh_token on exchange still fails closed through refresh_token_missing.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        tokenFetch({
          access_token: accessToken,
          merchant_id: "ML_ABC123",
          scope: requiredScopes,
          expires_at: "2026-10-29T12:00:00.000Z"
        })
      ),
    (error: unknown) =>
      error instanceof SquareProviderError &&
      error.safeCode === "refresh_token_missing"
  );
});

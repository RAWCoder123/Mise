import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareOAuthExpiresAt,
  canonicalizeSquareOAuthExpiresAt,
  normalizeSquareOAuthExpiresAt
} from "../services/domain/squareOAuthExpiresAtIdentity";
import {
  exchangeSquareAuthorizationCode,
  refreshSquareAccessToken
} from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareOAuthExpiresAtIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const expiresAt = "2026-10-29T12:00:00.000Z";
const accentedStamp = "2026-Café-29T12:00:00.000Z";
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

test("MISE-005TO pins Square OAuth expires_at to ASCII C", () => {
  assert.match(identitySource, /MISE-005TO/);
  assert.match(squareSource, /MISE-005TO/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareOAuthExpiresAt\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareOAuthExpiresAtIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareOAuthExpiresAt\(/);

  const parseStart = squareSource.indexOf("function parseTokenSet(");
  const parseEnd = squareSource.indexOf("function moneyAmount(");
  assert.ok(parseStart > 0 && parseEnd > parseStart);
  const parseBody = squareSource.slice(parseStart, parseEnd);
  assert.match(parseBody, /normalizeSquareOAuthExpiresAt\(/);
  assert.doesNotMatch(parseBody, /stringField\(payload,\s*"expires_at"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (tokens, scopes, merchant_id).
  assert.match(parseBody, /stringField\(payload,\s*"access_token"/);
  assert.match(parseBody, /stringField\(payload,\s*"refresh_token"/);
  assert.match(parseBody, /stringField\(payload,\s*"scope"/);
  assert.match(parseBody, /stringField\(payload,\s*"merchant_id"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareMerchantIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleClosedAtIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogCategoryIdentity/);
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

test("ASCII C prep keeps ordinary Square OAuth expires_at stamps stable", async () => {
  assert.equal(asciiTrimSquareOAuthExpiresAt(`  ${expiresAt}  `), expiresAt);
  assert.equal(asciiTrimSquareOAuthExpiresAt(`\t${expiresAt}\n`), expiresAt);
  assert.equal(canonicalizeSquareOAuthExpiresAt(`  ${expiresAt}  `), expiresAt);
  assert.equal(normalizeSquareOAuthExpiresAt(`  ${expiresAt}  `), expiresAt);

  assert.equal(normalizeSquareOAuthExpiresAt(accentedStamp), accentedStamp);
  assert.equal(canonicalizeSquareOAuthExpiresAt(accentedStamp), accentedStamp);

  const tokens = await exchangeSquareAuthorizationCode(
    oauthConfig,
    "authorization-code-with-enough-bytes",
    tokenFetch({
      access_token: "square-access-token-with-enough-bytes",
      refresh_token: "square-refresh-token-with-enough-bytes",
      merchant_id: "ML_ABC123",
      scope: requiredScopes,
      expires_at: `  ${expiresAt}  `
    })
  );
  assert.equal(tokens.expiresAt, expiresAt);
});

test("Unicode em-space / NBSP padding cannot invent clean Square OAuth expires_at", async () => {
  const padded = `${em}${expiresAt}${em}`;
  const nbspStamp = `${nbsp}${expiresAt}${nbsp}`;
  const internalEm = `2026${em}10-29T12:00:00.000Z`;
  const internalNbsp = `2026${nbsp}10-29T12:00:00.000Z`;

  // Inventing proof: Unicode trim would invent the clean expiry stamp.
  assert.equal(padded.trim(), expiresAt);
  assert.equal(nbspStamp.trim(), expiresAt);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareOAuthExpiresAt(padded), padded);
  assert.equal(canonicalizeSquareOAuthExpiresAt(padded), null);
  assert.equal(canonicalizeSquareOAuthExpiresAt(nbspStamp), null);
  assert.equal(normalizeSquareOAuthExpiresAt(padded), null);
  assert.equal(normalizeSquareOAuthExpiresAt(nbspStamp), null);

  // Soft empty still fails closed without inventing an expiry from padding alone.
  assert.equal(normalizeSquareOAuthExpiresAt(`${em}${em}`), null);
  assert.equal(normalizeSquareOAuthExpiresAt(`${nbsp}`), null);
  assert.equal(normalizeSquareOAuthExpiresAt("   "), null);

  // Live exchange must not invent a clean expiresAt from padded expires_at;
  // soft-null leaves expiresAt null without failing the whole token set.
  const paddedTokens = await exchangeSquareAuthorizationCode(
    oauthConfig,
    "authorization-code-with-enough-bytes",
    tokenFetch({
      access_token: "square-access-token-with-enough-bytes",
      refresh_token: "square-refresh-token-with-enough-bytes",
      merchant_id: "ML_ABC123",
      scope: requiredScopes,
      expires_at: padded
    })
  );
  assert.equal(paddedTokens.expiresAt, null);
  assert.equal(paddedTokens.merchantId, "ML_ABC123");

  const softEmptyRefresh = await refreshSquareAccessToken(
    oauthConfig,
    "square-refresh-token-with-enough-bytes",
    tokenFetch({
      access_token: "square-access-token-with-enough-bytes",
      merchant_id: "ML_ABC123",
      scope: requiredScopes,
      expires_at: em
    })
  );
  assert.equal(softEmptyRefresh.expiresAt, null);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareOAuthExpiresAt(internalEm), internalEm);
  assert.equal(normalizeSquareOAuthExpiresAt(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareOAuthExpiresAt(internalEm), internalEm);

  const internalTokens = await exchangeSquareAuthorizationCode(
    oauthConfig,
    "authorization-code-with-enough-bytes",
    tokenFetch({
      access_token: "square-access-token-with-enough-bytes",
      refresh_token: "square-refresh-token-with-enough-bytes",
      merchant_id: "ML_ABC123",
      scope: requiredScopes,
      expires_at: internalEm
    })
  );
  assert.equal(internalTokens.expiresAt, internalEm);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square OAuth expires_at", async () => {
  assert.equal(normalizeSquareOAuthExpiresAt(undefined), null);
  assert.equal(normalizeSquareOAuthExpiresAt(null), null);
  assert.equal(normalizeSquareOAuthExpiresAt(""), null);
  assert.equal(normalizeSquareOAuthExpiresAt("   "), null);
  assert.equal(normalizeSquareOAuthExpiresAt(123 as unknown as string), null);
  assert.equal(normalizeSquareOAuthExpiresAt(`\u0001${expiresAt}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareOAuthExpiresAt(`${expiresAt}\t`), expiresAt);
  assert.equal(normalizeSquareOAuthExpiresAt(`${expiresAt}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a stamp.
  assert.equal(normalizeSquareOAuthExpiresAt(em), null);
  // Overlong tokens fail closed (prior stringField max 64).
  assert.equal(normalizeSquareOAuthExpiresAt("x".repeat(65)), null);
  assert.equal(normalizeSquareOAuthExpiresAt("x".repeat(64)), "x".repeat(64));

  // Missing expires_at still soft-nulls without failing the token exchange.
  const missing = await exchangeSquareAuthorizationCode(
    oauthConfig,
    "authorization-code-with-enough-bytes",
    tokenFetch({
      access_token: "square-access-token-with-enough-bytes",
      refresh_token: "square-refresh-token-with-enough-bytes",
      merchant_id: "ML_ABC123",
      scope: requiredScopes
    })
  );
  assert.equal(missing.expiresAt, null);
  assert.equal(missing.merchantId, "ML_ABC123");
});

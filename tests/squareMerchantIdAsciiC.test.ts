import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareMerchantId,
  canonicalizeSquareMerchantId,
  normalizeSquareMerchantId
} from "../services/domain/squareMerchantIdIdentity";
import {
  exchangeSquareAuthorizationCode,
  refreshSquareAccessToken,
  SquareProviderError
} from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareMerchantIdIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const merchantId = "ML_ABC123";
const accentedId = "Café-Merchant-1";
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

test("MISE-005TF pins Square OAuth merchant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005TF/);
  assert.match(squareSource, /MISE-005TF/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareMerchantId\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareMerchantIdIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareMerchantId\(/);

  const parseStart = squareSource.indexOf("function parseTokenSet(");
  const parseEnd = squareSource.indexOf("function moneyAmount(");
  assert.ok(parseStart > 0 && parseEnd > parseStart);
  const parseBody = squareSource.slice(parseStart, parseEnd);
  assert.match(parseBody, /normalizeSquareMerchantId\(/);
  assert.doesNotMatch(parseBody, /stringField\(payload,\s*"merchant_id"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (tokens, scopes, expires_at).
  assert.match(parseBody, /stringField\(payload,\s*"access_token"/);
  assert.match(parseBody, /stringField\(payload,\s*"refresh_token"/);
  assert.match(parseBody, /stringField\(payload,\s*"scope"/);
  assert.match(parseBody, /stringField\(payload,\s*"expires_at"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareLocationExternalIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /verifiedProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderVariationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleSourceRecordOrderIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleLineUidIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /askMiseTopSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square OAuth merchant ids stable", async () => {
  assert.equal(asciiTrimSquareMerchantId(`  ${merchantId}  `), merchantId);
  assert.equal(asciiTrimSquareMerchantId(`\t${merchantId}\n`), merchantId);
  assert.equal(canonicalizeSquareMerchantId(`  ${merchantId}  `), merchantId);
  assert.equal(normalizeSquareMerchantId(`  ${merchantId}  `), merchantId);

  assert.equal(normalizeSquareMerchantId(accentedId), accentedId);
  assert.equal(canonicalizeSquareMerchantId(accentedId), accentedId);

  const tokens = await exchangeSquareAuthorizationCode(
    oauthConfig,
    "authorization-code-with-enough-bytes",
    tokenFetch({
      access_token: "square-access-token-with-enough-bytes",
      refresh_token: "square-refresh-token-with-enough-bytes",
      merchant_id: `  ${merchantId}  `,
      scope: requiredScopes,
      expires_at: "2026-10-29T12:00:00.000Z"
    })
  );
  assert.equal(tokens.merchantId, merchantId);
});

test("Unicode em-space / NBSP padding cannot invent clean Square OAuth merchant ids", async () => {
  const padded = `${em}${merchantId}${em}`;
  const nbspId = `${nbsp}${merchantId}${nbsp}`;
  const internalEm = `ML${em}ABC`;
  const internalNbsp = `ML${nbsp}ABC`;

  // Inventing proof: Unicode trim would invent the clean merchant id.
  assert.equal(padded.trim(), merchantId);
  assert.equal(nbspId.trim(), merchantId);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareMerchantId(padded), padded);
  assert.equal(canonicalizeSquareMerchantId(padded), null);
  assert.equal(canonicalizeSquareMerchantId(nbspId), null);
  assert.equal(normalizeSquareMerchantId(padded), null);
  assert.equal(normalizeSquareMerchantId(nbspId), null);

  // Soft empty still fails closed without inventing a merchant id from padding alone.
  assert.equal(normalizeSquareMerchantId(`${em}${em}`), null);
  assert.equal(normalizeSquareMerchantId(`${nbsp}`), null);
  assert.equal(normalizeSquareMerchantId("   "), null);

  // Live exchange must not invent a clean merchantId from padded merchant_id;
  // soft-null fails closed through the existing token_response_invalid path.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        tokenFetch({
          access_token: "square-access-token-with-enough-bytes",
          refresh_token: "square-refresh-token-with-enough-bytes",
          merchant_id: padded,
          scope: requiredScopes,
          expires_at: "2026-10-29T12:00:00.000Z"
        })
      ),
    (error: unknown) =>
      error instanceof SquareProviderError &&
      error.safeCode === "token_response_invalid"
  );

  await assert.rejects(
    () =>
      refreshSquareAccessToken(
        oauthConfig,
        "square-refresh-token-with-enough-bytes",
        tokenFetch({
          access_token: "square-access-token-with-enough-bytes",
          merchant_id: em,
          scope: requiredScopes,
          expires_at: "2026-10-29T12:00:00.000Z"
        })
      ),
    (error: unknown) =>
      error instanceof SquareProviderError &&
      error.safeCode === "token_response_invalid"
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareMerchantId(internalEm), internalEm);
  assert.equal(normalizeSquareMerchantId(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareMerchantId(internalEm), internalEm);

  const internalTokens = await exchangeSquareAuthorizationCode(
    oauthConfig,
    "authorization-code-with-enough-bytes",
    tokenFetch({
      access_token: "square-access-token-with-enough-bytes",
      refresh_token: "square-refresh-token-with-enough-bytes",
      merchant_id: internalEm,
      scope: requiredScopes,
      expires_at: "2026-10-29T12:00:00.000Z"
    })
  );
  assert.equal(internalTokens.merchantId, internalEm);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square OAuth merchant ids", async () => {
  assert.equal(normalizeSquareMerchantId(undefined), null);
  assert.equal(normalizeSquareMerchantId(null), null);
  assert.equal(normalizeSquareMerchantId(""), null);
  assert.equal(normalizeSquareMerchantId("   "), null);
  assert.equal(normalizeSquareMerchantId(123 as unknown as string), null);
  assert.equal(normalizeSquareMerchantId(`\u0001${merchantId}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareMerchantId(`${merchantId}\t`), merchantId);
  assert.equal(normalizeSquareMerchantId(`${merchantId}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareMerchantId(em), null);
  // Overlong tokens fail closed (prior stringField max 128).
  assert.equal(normalizeSquareMerchantId("x".repeat(129)), null);
  assert.equal(normalizeSquareMerchantId("x".repeat(128)), "x".repeat(128));

  // Missing merchant_id still fails closed through token_response_invalid.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        tokenFetch({
          access_token: "square-access-token-with-enough-bytes",
          refresh_token: "square-refresh-token-with-enough-bytes",
          scope: requiredScopes,
          expires_at: "2026-10-29T12:00:00.000Z"
        })
      ),
    (error: unknown) =>
      error instanceof SquareProviderError &&
      error.safeCode === "token_response_invalid"
  );
});

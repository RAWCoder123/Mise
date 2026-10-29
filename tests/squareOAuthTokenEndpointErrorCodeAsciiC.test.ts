import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareOAuthTokenEndpointErrorCode,
  canonicalizeSquareOAuthTokenEndpointErrorCode,
  normalizeSquareOAuthTokenEndpointErrorCode
} from "../services/domain/squareOAuthTokenEndpointErrorCodeIdentity";
import {
  exchangeSquareAuthorizationCode,
  refreshSquareAccessToken,
  SquareProviderError
} from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareOAuthTokenEndpointErrorCodeIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const unauthorizedClient = "unauthorized_client";
const accentedCode = "Café-unauthorized";
const em = "\u2003";
const nbsp = "\u00a0";

const oauthConfig = {
  applicationId: "sq0idp-test-application",
  applicationSecret: "server-only-square-secret",
  redirectUri: "https://project.supabase.co/functions/v1/square-oauth-callback",
  environment: "sandbox" as const
};

function errorFetch(status: number, payload: unknown): typeof fetch {
  return async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" }
    });
}

test("MISE-005TQ pins Square OAuth token-endpoint error codes to ASCII C", () => {
  assert.match(identitySource, /MISE-005TQ/);
  assert.match(squareSource, /MISE-005TQ/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareOAuthTokenEndpointErrorCode\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareOAuthTokenEndpointErrorCodeIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareOAuthTokenEndpointErrorCode\(/);

  const fnStart = squareSource.indexOf("function tokenEndpointError(");
  const fnEnd = squareSource.indexOf("function providerHttpError(");
  assert.ok(fnStart > 0 && fnEnd > fnStart);
  const fnBody = squareSource.slice(fnStart, fnEnd);
  assert.match(fnBody, /normalizeSquareOAuthTokenEndpointErrorCode\(/);
  assert.doesNotMatch(fnBody, /stringField\(payload,\s*"code"/);
  assert.doesNotMatch(fnBody, /stringField\(payload,\s*"error"/);

  // Leave parseTokenSet sibling stringField call sites on their existing
  // Unicode trim contract for separate tips (tokens, scopes, merchant, expiry).
  const parseStart = squareSource.indexOf("function parseTokenSet(");
  const parseEnd = squareSource.indexOf("function moneyAmount(");
  assert.ok(parseStart > 0 && parseEnd > parseStart);
  const parseBody = squareSource.slice(parseStart, parseEnd);
  assert.match(parseBody, /stringField\(payload,\s*"access_token"/);
  assert.match(parseBody, /stringField\(payload,\s*"refresh_token"/);
  assert.match(parseBody, /stringField\(payload,\s*"merchant_id"/);
  assert.match(parseBody, /stringField\(payload,\s*"scope"/);
  assert.match(parseBody, /stringField\(payload,\s*"expires_at"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareOAuthScopeIdentity/);
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

test("ASCII C prep keeps ordinary Square OAuth token-endpoint error codes stable", async () => {
  assert.equal(
    asciiTrimSquareOAuthTokenEndpointErrorCode(`  ${unauthorizedClient}  `),
    unauthorizedClient
  );
  assert.equal(
    asciiTrimSquareOAuthTokenEndpointErrorCode(`\t${unauthorizedClient}\n`),
    unauthorizedClient
  );
  assert.equal(
    canonicalizeSquareOAuthTokenEndpointErrorCode(`  ${unauthorizedClient}  `),
    unauthorizedClient
  );
  assert.equal(
    normalizeSquareOAuthTokenEndpointErrorCode(`  ${unauthorizedClient}  `),
    unauthorizedClient
  );

  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode(accentedCode), accentedCode);
  assert.equal(canonicalizeSquareOAuthTokenEndpointErrorCode(accentedCode), accentedCode);

  // Clean unauthorized_client on a non-401 still selects reauthorize.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        errorFetch(400, { code: `  ${unauthorizedClient}  ` })
      ),
    (error: unknown) => {
      assert.ok(error instanceof SquareProviderError);
      assert.equal(error.safeCode, "square_unauthorized");
      assert.equal(error.disposition, "reauthorize");
      assert.equal(error.status, 400);
      return true;
    }
  );

  // `error` fallback still works when `code` is absent.
  await assert.rejects(
    () =>
      refreshSquareAccessToken(
        oauthConfig,
        "square-refresh-token-with-enough-bytes",
        errorFetch(400, { error: unauthorizedClient })
      ),
    (error: unknown) => {
      assert.ok(error instanceof SquareProviderError);
      assert.equal(error.safeCode, "square_unauthorized");
      assert.equal(error.disposition, "reauthorize");
      return true;
    }
  );

  // Status 401 still reauthorizes without needing a provider code.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        errorFetch(401, {})
      ),
    (error: unknown) => {
      assert.ok(error instanceof SquareProviderError);
      assert.equal(error.safeCode, "square_unauthorized");
      assert.equal(error.disposition, "reauthorize");
      assert.equal(error.status, 401);
      return true;
    }
  );
});

test("Unicode em-space / NBSP padding cannot invent unauthorized_client reauthorize", async () => {
  const padded = `${em}${unauthorizedClient}${em}`;
  const nbspCode = `${nbsp}${unauthorizedClient}${nbsp}`;
  const internalEm = `unauth${em}orized_client`;
  const internalNbsp = `unauth${nbsp}orized_client`;

  // Inventing proof: Unicode trim would invent the clean provider error code.
  assert.equal(padded.trim(), unauthorizedClient);
  assert.equal(nbspCode.trim(), unauthorizedClient);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareOAuthTokenEndpointErrorCode(padded), padded);
  assert.equal(canonicalizeSquareOAuthTokenEndpointErrorCode(padded), null);
  assert.equal(canonicalizeSquareOAuthTokenEndpointErrorCode(nbspCode), null);
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode(padded), null);
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode(nbspCode), null);

  // Soft empty still fails closed without inventing a code from padding alone.
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode(`${em}${em}`), null);
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode(`${nbsp}`), null);
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode("   "), null);

  // Live exchange must not invent reauthorize from padded unauthorized_client;
  // soft-empty code falls through to square_token_exchange_failed / ambiguous.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        errorFetch(400, { code: padded })
      ),
    (error: unknown) => {
      assert.ok(error instanceof SquareProviderError);
      assert.equal(error.safeCode, "square_token_exchange_failed");
      assert.equal(error.disposition, "ambiguous");
      assert.equal(error.status, 400);
      return true;
    }
  );

  await assert.rejects(
    () =>
      refreshSquareAccessToken(
        oauthConfig,
        "square-refresh-token-with-enough-bytes",
        errorFetch(400, { error: nbspCode })
      ),
    (error: unknown) => {
      assert.ok(error instanceof SquareProviderError);
      assert.equal(error.safeCode, "square_token_exchange_failed");
      assert.equal(error.disposition, "ambiguous");
      return true;
    }
  );

  // Soft-empty Unicode-only padding also stays off the reauthorize gate.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        errorFetch(400, { code: em })
      ),
    (error: unknown) => {
      assert.ok(error instanceof SquareProviderError);
      assert.equal(error.safeCode, "square_token_exchange_failed");
      assert.equal(error.disposition, "ambiguous");
      return true;
    }
  );

  // Internal Unicode spaces are not stripped; they remain content and do not
  // match unauthorized_client.
  assert.equal(canonicalizeSquareOAuthTokenEndpointErrorCode(internalEm), internalEm);
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode(internalNbsp), internalNbsp);
  assert.notEqual(normalizeSquareOAuthTokenEndpointErrorCode(internalEm), unauthorizedClient);

  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        errorFetch(400, { code: internalEm })
      ),
    (error: unknown) => {
      assert.ok(error instanceof SquareProviderError);
      assert.equal(error.safeCode, "square_token_exchange_failed");
      assert.equal(error.disposition, "ambiguous");
      return true;
    }
  );
});

test("soft empty, controls, overlong, and non-strings fail closed for token-endpoint codes", async () => {
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode(undefined), null);
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode(null), null);
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode(""), null);
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode("   "), null);
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode(123 as unknown as string), null);
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode(`\u0001${unauthorizedClient}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(
    normalizeSquareOAuthTokenEndpointErrorCode(`${unauthorizedClient}\t`),
    unauthorizedClient
  );
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode(`${unauthorizedClient}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a code.
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode(em), null);
  // Overlong tokens fail closed (prior stringField max 80).
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode("x".repeat(81)), null);
  assert.equal(normalizeSquareOAuthTokenEndpointErrorCode("x".repeat(80)), "x".repeat(80));

  // Prefer `code` over `error` when both are present.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        errorFetch(400, {
          code: unauthorizedClient,
          error: "some_other_error"
        })
      ),
    (error: unknown) => {
      assert.ok(error instanceof SquareProviderError);
      assert.equal(error.safeCode, "square_unauthorized");
      assert.equal(error.disposition, "reauthorize");
      return true;
    }
  );

  // Padded `code` must not fall through into a clean `error` inventing path
  // either when error is also padded unauthorized_client.
  await assert.rejects(
    () =>
      exchangeSquareAuthorizationCode(
        oauthConfig,
        "authorization-code-with-enough-bytes",
        errorFetch(400, {
          code: `${em}${unauthorizedClient}${em}`,
          error: `${nbsp}${unauthorizedClient}${nbsp}`
        })
      ),
    (error: unknown) => {
      assert.ok(error instanceof SquareProviderError);
      assert.equal(error.safeCode, "square_token_exchange_failed");
      assert.equal(error.disposition, "ambiguous");
      return true;
    }
  );

  // Status 403 still maps to forbidden independently of provider code.
  await assert.rejects(
    () =>
      refreshSquareAccessToken(
        oauthConfig,
        "square-refresh-token-with-enough-bytes",
        errorFetch(403, { code: "anything" })
      ),
    (error: unknown) => {
      assert.ok(error instanceof SquareProviderError);
      assert.equal(error.safeCode, "square_forbidden");
      assert.equal(error.disposition, "rejected");
      return true;
    }
  );
});

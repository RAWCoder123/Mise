import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildGmailRawMessage,
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  GMAIL_SEND_SCOPE,
  gmailMessageId,
  GoogleProviderError,
  refreshGoogleAccessToken,
  sendGmailMessage,
  sha256Base64Url,
  sha256Hex,
} from "../supabase/functions/_shared/gmail.ts";

const oauthConfig = {
  clientId: "google-client-id.apps.googleusercontent.com",
  clientSecret: "server-only-client-secret",
  redirectUri: "https://project.supabase.co/functions/v1/gmail-oauth-callback",
};

test("Gmail OAuth uses S256 PKCE, opaque state, offline access, and only identity plus gmail.send scopes", async () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = await sha256Base64Url(verifier);
  assert.equal(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  assert.equal(
    await sha256Hex("state"),
    "4ba69735ca53765ed6a709edb56c6ea236b7193a3b29a6b390c346f0f4340e4e",
  );

  const state = "state-token-with-at-least-thirty-two-bytes";
  const authorization = new URL(
    buildGoogleAuthorizationUrl(oauthConfig, state, challenge),
  );
  assert.equal(authorization.origin, "https://accounts.google.com");
  assert.equal(authorization.searchParams.get("state"), state);
  assert.equal(authorization.searchParams.get("code_challenge"), challenge);
  assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorization.searchParams.get("access_type"), "offline");
  assert.equal(
    authorization.searchParams.get("include_granted_scopes"),
    "false",
  );
  assert.deepEqual(authorization.searchParams.get("scope")?.split(" "), [
    "openid",
    "email",
    GMAIL_SEND_SCOPE,
  ]);
  assert.doesNotMatch(
    authorization.toString(),
    /client_secret|server-only-client-secret/i,
  );
});

test("authorization exchange passes the PKCE verifier and rejects partial scope grants", async () => {
  let requestBody = "";
  const fetchSuccess: typeof fetch = async (_input, init) => {
    requestBody = String(init?.body ?? "");
    return Response.json({
      access_token: "access-token-value",
      refresh_token: "refresh-token-value",
      expires_in: 3600,
      scope: `openid email ${GMAIL_SEND_SCOPE}`,
      token_type: "Bearer",
    });
  };
  const tokenSet = await exchangeGoogleAuthorizationCode(
    oauthConfig,
    "authorization-code-value",
    "v".repeat(64),
    fetchSuccess,
  );
  const form = new URLSearchParams(requestBody);
  assert.equal(form.get("code_verifier"), "v".repeat(64));
  assert.equal(form.get("client_secret"), oauthConfig.clientSecret);
  assert.equal(tokenSet.refreshToken, "refresh-token-value");
  assert.ok(tokenSet.grantedScopes.includes(GMAIL_SEND_SCOPE));

  const fetchPartial: typeof fetch = async () =>
    Response.json({
      access_token: "access-token-value",
      refresh_token: "refresh-token-value",
      expires_in: 3600,
      scope: "openid email",
    });
  await assert.rejects(
    exchangeGoogleAuthorizationCode(
      oauthConfig,
      "authorization-code-value",
      "v".repeat(64),
      fetchPartial,
    ),
    (error: unknown) =>
      error instanceof GoogleProviderError &&
      error.safeCode === "gmail_send_scope_missing",
  );
});

test("Gmail refresh and send helpers keep access tokens ephemeral and build bounded RFC messages", async () => {
  let refreshAuthorization = "";
  const refreshFetch: typeof fetch = async (_input, init) => {
    refreshAuthorization = String(init?.body ?? "");
    return Response.json({
      access_token: "new-access-token",
      expires_in: 3600,
      scope: GMAIL_SEND_SCOPE,
      token_type: "Bearer",
    });
  };
  const refreshed = await refreshGoogleAccessToken(
    oauthConfig,
    "stored-refresh-token",
    refreshFetch,
  );
  assert.equal(
    new URLSearchParams(refreshAuthorization).get("grant_type"),
    "refresh_token",
  );
  assert.equal(refreshed.accessToken, "new-access-token");
  assert.equal(refreshed.refreshToken, null);

  const raw = buildGmailRawMessage({
    from: "orders@restaurant.example",
    to: "supplier@example.com",
    subject: "Produce order\r\nBcc: attacker@example.com",
    textBody: "Tomatoes - 10 lb\nThank you",
    messageId: gmailMessageId("11111111-1111-4111-8111-111111111111"),
  });
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(
    decoded,
    /^From: orders@restaurant\.example\r\nTo: supplier@example\.com/m,
  );
  assert.match(
    decoded,
    /Message-ID: <mise-11111111-1111-4111-8111-111111111111@mail\.mise\.app>/,
  );
  assert.doesNotMatch(decoded, /\r\nBcc:/);
  assert.match(decoded, /Tomatoes - 10 lb\r\nThank you/);

  let providerAuthorization = "";
  let providerRaw = "";
  const sendFetch: typeof fetch = async (_input, init) => {
    providerAuthorization =
      new Headers(init?.headers).get("authorization") ?? "";
    providerRaw = JSON.parse(String(init?.body)).raw;
    return Response.json({
      id: "gmail-message-id",
      threadId: "gmail-thread-id",
    });
  };
  const sent = await sendGmailMessage(refreshed.accessToken, raw, sendFetch);
  assert.equal(providerAuthorization, "Bearer new-access-token");
  assert.equal(providerRaw, raw);
  assert.deepEqual(sent, {
    id: "gmail-message-id",
    threadId: "gmail-thread-id",
  });
});

test("Gmail send failures distinguish rejection, reauthorization, and ambiguous provider outcomes", async () => {
  const raw = buildGmailRawMessage({
    from: "orders@restaurant.example",
    to: "supplier@example.com",
    subject: "Order",
    textBody: "One case",
    messageId: gmailMessageId("22222222-2222-4222-8222-222222222222"),
  });
  const assertDisposition = async (status: number, disposition: string) => {
    await assert.rejects(
      sendGmailMessage("ephemeral-access-token", raw, async () =>
        Response.json({ error: {} }, { status }),
      ),
      (error: unknown) =>
        error instanceof GoogleProviderError &&
        error.disposition === disposition,
    );
  };
  await assertDisposition(400, "rejected");
  await assertDisposition(401, "reauthorize");
  await assertDisposition(429, "ambiguous");
  await assertDisposition(503, "ambiguous");
});

test("Gmail migration stores secrets only in Vault and makes sends tenant-safe and idempotent", () => {
  const migration = readFileSync(
    "supabase/migrations/20260719062148_gmail_backend_oauth_delivery.sql",
    "utf8",
  );
  assert.match(
    migration,
    /create extension if not exists supabase_vault with schema vault/i,
  );
  assert.match(
    migration,
    /create table if not exists private\.gmail_oauth_flows/i,
  );
  assert.match(
    migration,
    /create table if not exists private\.gmail_credentials/i,
  );
  assert.match(
    migration,
    /create table if not exists private\.supplier_email_deliveries/i,
  );
  assert.match(
    migration,
    /vault\.create_secret[\s\S]*Mise Gmail refresh credential/i,
  );
  assert.match(migration, /vault\.decrypted_secrets/i);
  assert.match(
    migration,
    /revoke all on table private\.gmail_credentials from public, anon, authenticated, service_role/i,
  );
  assert.match(
    migration,
    /revoke insert, update, delete on public\.restaurant_email_connections from authenticated/i,
  );
  assert.doesNotMatch(
    migration,
    /create table[^;]+(?:access_token|refresh_token)\s+text/is,
  );

  assert.match(
    migration,
    /state_hash text not null unique[\s\S]*expires_at timestamptz not null/i,
  );
  assert.match(migration, /pkce_verifier_secret_id uuid not null/i);
  assert.match(
    migration,
    /gmail-oauth-callback[\s\S]*array\['owner', 'admin'\]/i,
  );
  assert.match(
    migration,
    /private\.gmail_service_actor_has_role[\s\S]*membership\.status = 'active'/i,
  );
  assert.match(migration, /p_idempotency_key <> p_order_id/i);
  assert.match(migration, /unique \(restaurant_id, supplier_order_id\)/i);
  assert.match(migration, /status = 'unknown'[\s\S]*requires_review/i);
  assert.match(
    migration,
    /provider_accepted_at = now\(\)[\s\S]*set status = 'sent'/i,
  );
  assert.match(
    migration,
    /provider acceptance is required before marking this order sent/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.service_complete_supplier_email_send[\s\S]*to service_role/i,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.service_complete_supplier_email_send[^;]+to authenticated/i,
  );
});

test("Gmail Edge Functions preserve authenticated firewall entry and single-use callback authority", () => {
  const link = readFileSync("supabase/functions/link-gmail/index.ts", "utf8");
  const callback = readFileSync(
    "supabase/functions/gmail-oauth-callback/index.ts",
    "utf8",
  );
  const send = readFileSync(
    "supabase/functions/send-supplier-email/index.ts",
    "utf8",
  );
  const config = readFileSync("supabase/config.toml", "utf8");

  assert.match(
    link,
    /requireAuthenticatedContext\(req\)[\s\S]*requireRestaurantRole[\s\S]*"owner"[\s\S]*"admin"/i,
  );
  assert.match(
    link,
    /reserveFunctionInvocation\([\s\S]*"gmail-oauth-callback"/i,
  );
  assert.match(
    link,
    /sha256Hex\(state\)[\s\S]*sha256Base64Url\(codeVerifier\)/i,
  );
  assert.match(link, /service_begin_gmail_oauth/i);
  assert.match(
    callback,
    /state\.length < 32[\s\S]*service_claim_gmail_oauth[\s\S]*exchangeGoogleAuthorizationCode/i,
  );
  assert.match(
    callback,
    /service_complete_gmail_oauth[\s\S]*recordFunctionSecurityEvent/i,
  );
  assert.match(
    config,
    /\[functions\.gmail-oauth-callback\]\s*verify_jwt = false/i,
  );

  assert.match(send, /GMAIL_SEND_ENABLED"\) !== "true"/i);
  assert.match(send, /service_claim_supplier_email_send/i);
  assert.match(send, /refreshGoogleAccessToken/i);
  assert.match(
    send,
    /sendGmailMessage[\s\S]*service_complete_supplier_email_send/i,
  );
  assert.match(
    send,
    /delivery_requires_review[\s\S]*will not retry automatically/i,
  );
  assert.doesNotMatch(send, /\.from\("supplier_orders"\)[\s\S]*\.update\(/i);
});

test("supplier email Edge delivery uses only a strict, durable database claim", () => {
  const send = readFileSync(
    "supabase/functions/send-supplier-email/index.ts",
    "utf8",
  );

  const observeIndex = send.indexOf(
    'rpc("service_observe_supplier_email_send"',
  );
  const environmentGateIndex = send.indexOf(
    'Deno.env.get("GMAIL_SEND_ENABLED")',
  );
  const claimIndex = send.indexOf('"service_claim_supplier_email_send"');
  assert.ok(observeIndex > 0);
  assert.ok(observeIndex < environmentGateIndex);
  assert.ok(environmentGateIndex < claimIndex);
  assert.match(
    send,
    /supplierSendOutcome\(observationData\) !== "claim_required"/,
  );

  assert.match(send, /credentialGeneration: number/);
  assert.match(send, /Number\.isSafeInteger\(claim\.credentialGeneration\)/);
  assert.match(send, /claim\.credentialGeneration > 0/);
  assert.match(send, /claim\.contentVersion === "mise\.supplier_send\.v1"/);
  assert.match(
    send,
    /claim\.authorityVersion === "mise\.purchase_authority\.v1"/,
  );
  assert.match(send, /SHA256_HEX_PATTERN = \/\^\[0-9a-f\]\{64\}\$\//);
  assert.match(send, /isCanonicalEmail\(claim\.from\)/);
  assert.match(send, /isCanonicalEmail\(claim\.to\)/);
  assert.match(send, /value\.length <= 500/);
  assert.match(send, /TextEncoder\(\)\.encode\(value\)\.byteLength/);
  assert.match(send, /claim\.rfcMessageId === expectedMessageId/);

  assert.match(
    send,
    /"service_rotate_gmail_refresh_token"[\s\S]*p_expected_credential_generation:\s*claim\.credentialGeneration/,
  );

  const rawStart = send.indexOf("rawMessage = buildGmailRawMessage({");
  const rawEnd = send.indexOf("});", rawStart);
  const rawBuilder = send.slice(rawStart, rawEnd);
  assert.match(rawBuilder, /from:\s*claim\.from/);
  assert.match(rawBuilder, /to:\s*claim\.to/);
  assert.match(rawBuilder, /subject:\s*claim\.subject/);
  assert.match(rawBuilder, /textBody:\s*claim\.body/);
  assert.match(rawBuilder, /messageId:\s*claim\.rfcMessageId/);
  assert.doesNotMatch(
    rawBuilder,
    /supplier_orders|order_message|supplier_recipients|restaurant_email_connections/i,
  );

  const claimedFlowStart = send.indexOf(
    "actionFailureContext = null;",
    send.indexOf("database owns an active claim"),
  );
  const outerCatch = send.indexOf(
    "  } catch (error) {\n    if (actionFailureContext)",
    claimedFlowStart,
  );
  assert.ok(claimedFlowStart > 0 && outerCatch > claimedFlowStart);
  const claimedFlow = send.slice(claimedFlowStart, outerCatch);
  assert.doesNotMatch(claimedFlow, /recordMiseActionFailure\(/);
  assert.match(
    claimedFlow,
    /buildGmailRawMessage[\s\S]*failDelivery\([\s\S]*"rejected",[\s\S]*"claimed_snapshot_invalid"[\s\S]*sendGmailMessage/,
  );
  assert.match(
    claimedFlow,
    /ambiguous \? "unknown" : "rejected"/,
  );
  assert.match(
    claimedFlow,
    /"unknown",\s*"database_finalize_failed"/,
  );
});

test("supplier email Edge returns bounded content and authority blockers without failing approval generically", () => {
  const send = readFileSync(
    "supabase/functions/send-supplier-email/index.ts",
    "utf8",
  );
  for (const outcome of [
    "send_content_changed",
    "send_content_unapproved",
    "purchase_authority_stale",
    "draft_authority_incomplete",
  ]) {
    assert.match(send, new RegExp(`outcome === "${outcome}"`));
  }
  assert.match(send, /SAFE_CODE_PATTERN = \/\^\[a-z0-9_\]\{1,80\}\$\//);
  assert.match(send, /MAX_BLOCKER_CODES = 20/);
  assert.match(send, /bounded\.length === MAX_BLOCKER_CODES/);
  assert.match(send, /status: "request_blocked"/);
  assert.doesNotMatch(send, /status: "send_claim_failed"/);

  const genericFailureGuard = send.slice(
    send.indexOf("function shouldRecordPreClaimFailure"),
    send.indexOf("function boundedBlockerCodes"),
  );
  assert.match(genericFailureGuard, /"send_content_changed"/);
  assert.match(genericFailureGuard, /"send_content_unapproved"/);
  assert.match(genericFailureGuard, /"purchase_authority_stale"/);
  assert.match(genericFailureGuard, /"draft_authority_incomplete"/);
});

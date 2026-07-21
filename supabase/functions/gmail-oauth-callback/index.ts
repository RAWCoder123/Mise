import { createClient } from "npm:@supabase/supabase-js@2";
import {
  exchangeGoogleAuthorizationCode,
  fetchGoogleIdentity,
  GoogleProviderError,
  sha256Hex,
  type GoogleOAuthConfig,
} from "../_shared/gmail.ts";
import {
  captureFunctionError,
  HttpError,
  recordFunctionSecurityEvent,
  recordFunctionTerminalError,
  type InvocationTerminalContext,
} from "../_shared/mise.ts";

interface ClaimedOAuthFlow {
  flowId: string;
  restaurantId: string;
  actorUserId: string;
  callbackReservationId: string;
  codeVerifier: string;
}

Deno.serve(async (req) => {
  if (req.method !== "GET")
    return callbackPage(false, "Method not allowed.", 405);

  let terminalContext: InvocationTerminalContext | null = null;
  let claimedFlow: ClaimedOAuthFlow | null = null;
  try {
    const url = new URL(req.url);
    const state = url.searchParams.get("state");
    if (
      !state ||
      state.length < 32 ||
      state.length > 512 ||
      /[\u0000-\u001f\u007f]/u.test(state)
    ) {
      throw new HttpError(
        400,
        "The Gmail authorization response is invalid or expired.",
      );
    }

    const securitySupabase = serviceClient();
    const stateHash = await sha256Hex(state);
    const { data: flowData, error: flowError } = await securitySupabase.rpc(
      "service_claim_gmail_oauth",
      {
        p_state_hash: stateHash,
      },
    );
    if (flowError || !isClaimedFlow(flowData)) {
      throw new HttpError(
        400,
        "The Gmail authorization response is invalid or expired.",
      );
    }
    claimedFlow = flowData;
    terminalContext = {
      securitySupabase,
      actorUserId: claimedFlow.actorUserId,
      reservationId: claimedFlow.callbackReservationId,
      restaurantId: claimedFlow.restaurantId,
      functionName: "gmail-oauth-callback",
    };
    const oauthConfig = googleOAuthConfig();

    const providerError = url.searchParams.get("error");
    if (providerError) {
      const safeFailure = oauthDenial(providerError);
      await failOAuthFlow(
        securitySupabase,
        claimedFlow.flowId,
        safeFailure.code,
        safeFailure.status,
      );
      await recordFunctionSecurityEvent(
        securitySupabase,
        claimedFlow.actorUserId,
        claimedFlow.callbackReservationId,
        claimedFlow.restaurantId,
        "gmail-oauth-callback",
        "blocked",
        "gmail_oauth_denied",
        { provider: "gmail", reason: safeFailure.code },
      );
      terminalContext = null;
      return callbackPage(
        false,
        "Gmail was not connected. You can safely return to Mise and try again.",
        400,
      );
    }

    const code = url.searchParams.get("code");
    if (!code) {
      await failOAuthFlow(
        securitySupabase,
        claimedFlow.flowId,
        "authorization_code_missing",
        "needs_reauth",
      );
      throw new HttpError(
        400,
        "The Gmail authorization response is incomplete.",
      );
    }

    let tokens;
    let identity;
    try {
      tokens = await exchangeGoogleAuthorizationCode(
        oauthConfig,
        code,
        claimedFlow.codeVerifier,
      );
      identity = await fetchGoogleIdentity(tokens.accessToken);
    } catch (error) {
      const failure = oauthProviderFailure(error);
      await failOAuthFlow(
        securitySupabase,
        claimedFlow.flowId,
        failure.code,
        failure.status,
      );
      await recordFunctionSecurityEvent(
        securitySupabase,
        claimedFlow.actorUserId,
        claimedFlow.callbackReservationId,
        claimedFlow.restaurantId,
        "gmail-oauth-callback",
        failure.eventType,
        "gmail_oauth_exchange_failed",
        { provider: "gmail", reason: failure.code },
      );
      terminalContext = null;
      return callbackPage(
        false,
        "Gmail could not be connected. Return to Mise to reconnect.",
        failure.httpStatus,
      );
    }

    const { error: completionError } = await securitySupabase.rpc(
      "service_complete_gmail_oauth",
      {
        p_flow_id: claimedFlow.flowId,
        p_provider_subject: identity.subject,
        p_sender_email: identity.email,
        p_credential_material: tokens.refreshToken,
        p_granted_scopes: tokens.grantedScopes,
      },
    );
    if (completionError) throw completionError;

    try {
      await recordFunctionSecurityEvent(
        securitySupabase,
        claimedFlow.actorUserId,
        claimedFlow.callbackReservationId,
        claimedFlow.restaurantId,
        "gmail-oauth-callback",
        "completed",
        "gmail_connected",
        { provider: "gmail" },
      );
    } catch (error) {
      captureFunctionError(error, {
        functionName: "gmail-oauth-callback",
        stage: "terminal_security_event",
      });
    }
    terminalContext = null;
    return callbackPage(
      true,
      "Gmail is connected. You can return to Mise.",
      200,
    );
  } catch (error) {
    captureFunctionError(error, { functionName: "gmail-oauth-callback" });
    await recordFunctionTerminalError(terminalContext);
    if (claimedFlow) {
      try {
        const securitySupabase = serviceClient();
        await failOAuthFlow(
          securitySupabase,
          claimedFlow.flowId,
          "oauth_callback_failed",
          "needs_reauth",
        );
      } catch {
        // The response stays generic; server telemetry records the primary failure.
      }
    }
    return callbackPage(
      false,
      "Gmail could not be connected. Return to Mise to try again.",
      400,
    );
  }
});

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    throw new HttpError(500, "Server configuration is unavailable.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function googleOAuthConfig(): GoogleOAuthConfig {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirectUri) {
    throw new HttpError(500, "Server configuration is unavailable.");
  }
  return { clientId, clientSecret, redirectUri };
}

async function failOAuthFlow(
  securitySupabase: ReturnType<typeof serviceClient>,
  flowId: string,
  code: string,
  status: "not_connected" | "needs_reauth" | "restricted",
) {
  const { error } = await securitySupabase.rpc("service_fail_gmail_oauth", {
    p_flow_id: flowId,
    p_error_code: code,
    p_connection_status: status,
  });
  if (error) throw error;
}

function oauthDenial(value: string) {
  if (value === "access_denied")
    return { code: "access_denied", status: "not_connected" as const };
  if (value === "admin_policy_enforced" || value === "org_internal") {
    return {
      code: "workspace_admin_restriction",
      status: "restricted" as const,
    };
  }
  return { code: "oauth_provider_rejected", status: "needs_reauth" as const };
}

function oauthProviderFailure(error: unknown) {
  if (error instanceof GoogleProviderError) {
    const restricted =
      error.safeCode === "gmail_send_scope_missing" || error.status === 403;
    return {
      code: restricted ? "workspace_admin_restriction" : error.safeCode,
      status: restricted ? ("restricted" as const) : ("needs_reauth" as const),
      eventType:
        error.disposition === "ambiguous"
          ? ("error" as const)
          : ("blocked" as const),
      httpStatus: error.disposition === "ambiguous" ? 502 : 400,
    };
  }
  return {
    code: "oauth_provider_unavailable",
    status: "needs_reauth" as const,
    eventType: "error" as const,
    httpStatus: 502,
  };
}

function isClaimedFlow(value: unknown): value is ClaimedOAuthFlow {
  if (!value || typeof value !== "object") return false;
  const flow = value as Record<string, unknown>;
  return [
    "flowId",
    "restaurantId",
    "actorUserId",
    "callbackReservationId",
    "codeVerifier",
  ].every(
    (key) => typeof flow[key] === "string" && (flow[key] as string).length > 0,
  );
}

function callbackPage(success: boolean, message: string, status: number) {
  const destination = fixedAppRedirect(success);
  if (destination) {
    return new Response(null, {
      status: 303,
      headers: {
        location: destination,
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
      },
    });
  }
  const title = success ? "Gmail connected" : "Gmail connection incomplete";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "content-security-policy":
        "default-src 'none'; style-src 'none'; img-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      "x-content-type-options": "nosniff",
    },
  });
}

function fixedAppRedirect(success: boolean) {
  const configured = Deno.env.get("MISE_APP_GMAIL_REDIRECT_URI");
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "mise:") return null;
    if (url.username || url.password) return null;
    url.searchParams.set("gmail", success ? "connected" : "connection_failed");
    return url.toString();
  } catch {
    return null;
  }
}

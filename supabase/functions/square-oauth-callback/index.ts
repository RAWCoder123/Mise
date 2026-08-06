import { createClient } from "npm:@supabase/supabase-js@2";
import {
  exchangeSquareAuthorizationCode,
  listSquareLocations,
  sha256Hex,
  SquareProviderError,
  type SquareOAuthConfig,
} from "../_shared/square.ts";
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
  if (req.method !== "GET") return callbackPage(false, "Method not allowed.", 405);

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
      throw new HttpError(400, "The Square authorization response is invalid or expired.");
    }

    const securitySupabase = serviceClient();
    const stateHash = await sha256Hex(state);
    const { data: flowData, error: flowError } = await securitySupabase.rpc(
      "service_claim_square_oauth",
      { p_state_hash: stateHash },
    );
    if (flowError || !isClaimedFlow(flowData)) {
      throw new HttpError(400, "The Square authorization response is invalid or expired.");
    }
    claimedFlow = flowData;
    terminalContext = {
      securitySupabase,
      actorUserId: claimedFlow.actorUserId,
      reservationId: claimedFlow.callbackReservationId,
      restaurantId: claimedFlow.restaurantId,
      functionName: "square-oauth-callback",
    };
    const oauthConfig = squareOAuthConfig();

    const providerError = url.searchParams.get("error");
    if (providerError) {
      await failOAuthFlow(securitySupabase, claimedFlow.flowId, "access_denied", "not_connected");
      await recordFunctionSecurityEvent(
        securitySupabase,
        claimedFlow.actorUserId,
        claimedFlow.callbackReservationId,
        claimedFlow.restaurantId,
        "square-oauth-callback",
        "blocked",
        "square_oauth_denied",
        { provider: "square", reason: "access_denied" },
      );
      terminalContext = null;
      return callbackPage(
        false,
        "Square was not connected. You can safely return to Mise and try again.",
        400,
      );
    }

    const code = url.searchParams.get("code");
    if (!code) {
      await failOAuthFlow(
        securitySupabase,
        claimedFlow.flowId,
        "authorization_code_missing",
        "error",
      );
      throw new HttpError(400, "The Square authorization response is incomplete.");
    }

    let tokens;
    let locations;
    try {
      tokens = await exchangeSquareAuthorizationCode(oauthConfig, code);
      locations = await listSquareLocations(oauthConfig, tokens.accessToken);
    } catch (error) {
      const failure = oauthProviderFailure(error);
      await failOAuthFlow(securitySupabase, claimedFlow.flowId, failure.code, failure.status);
      await recordFunctionSecurityEvent(
        securitySupabase,
        claimedFlow.actorUserId,
        claimedFlow.callbackReservationId,
        claimedFlow.restaurantId,
        "square-oauth-callback",
        failure.eventType,
        "square_oauth_exchange_failed",
        { provider: "square", reason: failure.code },
      );
      terminalContext = null;
      return callbackPage(
        false,
        "Square could not be connected. Return to Mise to reconnect.",
        failure.httpStatus,
      );
    }

    if (!tokens.refreshToken) {
      await failOAuthFlow(securitySupabase, claimedFlow.flowId, "refresh_token_missing", "error");
      throw new HttpError(400, "Square did not return a refresh credential.");
    }

    const primaryLocation = locations[0]?.externalLocationId ?? null;
    const { error: completionError } = await securitySupabase.rpc(
      "service_complete_square_oauth",
      {
        p_flow_id: claimedFlow.flowId,
        p_merchant_id: tokens.merchantId,
        p_external_location_id: primaryLocation,
        p_credential_material: tokens.refreshToken,
        p_granted_scopes: tokens.grantedScopes,
        p_locations: locations.map((location) => ({
          external_location_id: location.externalLocationId,
          display_name: location.displayName,
          timezone: location.timezone,
        })),
      },
    );
    if (completionError) throw completionError;

    try {
      await recordFunctionSecurityEvent(
        securitySupabase,
        claimedFlow.actorUserId,
        claimedFlow.callbackReservationId,
        claimedFlow.restaurantId,
        "square-oauth-callback",
        "completed",
        "square_connected",
        { provider: "square" },
      );
    } catch (error) {
      captureFunctionError(error, {
        functionName: "square-oauth-callback",
        stage: "terminal_security_event",
      });
    }
    terminalContext = null;
    return callbackPage(true, "Square is connected. You can return to Mise.", 200);
  } catch (error) {
    captureFunctionError(error, { functionName: "square-oauth-callback" });
    await recordFunctionTerminalError(terminalContext);
    if (claimedFlow) {
      try {
        await failOAuthFlow(
          serviceClient(),
          claimedFlow.flowId,
          "oauth_callback_failed",
          "error",
        );
      } catch {
        // Keep the generic page; telemetry captured the primary failure.
      }
    }
    return callbackPage(
      false,
      "Square could not be connected. Return to Mise to try again.",
      400,
    );
  }
});

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new HttpError(500, "Server configuration is unavailable.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function squareOAuthConfig(): SquareOAuthConfig {
  const applicationId = Deno.env.get("SQUARE_APPLICATION_ID");
  const applicationSecret = Deno.env.get("SQUARE_APPLICATION_SECRET");
  const redirectUri = Deno.env.get("SQUARE_REDIRECT_URI");
  const environment =
    Deno.env.get("SQUARE_ENVIRONMENT") === "production" ? "production" : "sandbox";
  if (!applicationId || !applicationSecret || !redirectUri) {
    throw new HttpError(500, "Server configuration is unavailable.");
  }
  return { applicationId, applicationSecret, redirectUri, environment };
}

async function failOAuthFlow(
  securitySupabase: ReturnType<typeof serviceClient>,
  flowId: string,
  code: string,
  status: "not_connected" | "error" | "paused",
) {
  const { error } = await securitySupabase.rpc("service_fail_square_oauth", {
    p_flow_id: flowId,
    p_error_code: code,
    p_connection_status: status,
  });
  if (error) throw error;
}

function oauthProviderFailure(error: unknown) {
  if (error instanceof SquareProviderError) {
    return {
      code: error.safeCode,
      status: "error" as const,
      eventType:
        error.disposition === "ambiguous" ? ("error" as const) : ("blocked" as const),
      httpStatus: error.disposition === "ambiguous" ? 502 : 400,
    };
  }
  return {
    code: "oauth_provider_unavailable",
    status: "error" as const,
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
  ].every((key) => typeof flow[key] === "string" && (flow[key] as string).length > 0);
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
  const title = success ? "Square connected" : "Square connection incomplete";
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
  const configured = Deno.env.get("MISE_APP_SQUARE_REDIRECT_URI");
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "mise:") return null;
    if (url.username || url.password) return null;
    url.searchParams.set("square", success ? "connected" : "connection_failed");
    return url.toString();
  } catch {
    return null;
  }
}

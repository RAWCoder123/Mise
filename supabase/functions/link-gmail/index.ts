import {
  buildGoogleAuthorizationUrl,
  GoogleProviderError,
  randomBase64Url,
  revokeGoogleCredential,
  sha256Base64Url,
  sha256Hex,
  type GoogleOAuthConfig,
} from "../_shared/gmail.ts";
import {
  firewallBlockedResponse,
  handleError,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJsonObject,
  recordFunctionAuditLog,
  recordFunctionSecurityEvent,
  recordFunctionTerminalError,
  reserveFunctionInvocation,
  requireAuthenticatedContext,
  requireEnum,
  requireRestaurantRole,
  requireUuid,
  type InvocationTerminalContext,
} from "../_shared/mise.ts";

const GMAIL_ACTIONS = ["connect", "disconnect"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed." }, 405);

  let terminalContext: InvocationTerminalContext | null = null;
  try {
    const { supabase, securitySupabase, user } =
      await requireAuthenticatedContext(req);
    const body = await readJsonObject(req);
    const restaurantId = requireUuid(body.restaurantId, "restaurantId");
    const action =
      body.action === undefined
        ? "connect"
        : requireEnum(body.action, "action", GMAIL_ACTIONS);
    const reservation = await reserveFunctionInvocation(
      securitySupabase,
      user.id,
      restaurantId,
      "link-gmail",
      action === "connect"
        ? "gmail_link_started"
        : "gmail_disconnect_requested",
      { provider: "gmail", action },
    );
    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      restaurantId,
      functionName: "link-gmail",
    };

    await requireRestaurantRole(supabase, user.id, restaurantId, [
      "owner",
      "admin",
    ]);

    if (action === "disconnect") {
      await recordFunctionAuditLog(
        securitySupabase,
        user.id,
        restaurantId,
        "gmail_disconnect_requested",
        "restaurant_email_connections",
        null,
        { provider: "gmail" },
      );
      const { data: credential, error: credentialError } =
        await securitySupabase.rpc(
          "service_fetch_gmail_disconnect_credential",
          { p_actor_user_id: user.id, p_restaurant_id: restaurantId },
        );
      if (credentialError) throw credentialError;
      if (credential?.outcome === "already_disconnected") {
        const { error: normalizeError } = await securitySupabase.rpc(
          "service_disconnect_gmail",
          {
            p_actor_user_id: user.id,
            p_restaurant_id: restaurantId,
            p_credential_id: null,
            p_credential_generation: null,
          },
        );
        if (normalizeError) throw normalizeError;
        await recordFunctionSecurityEvent(
          securitySupabase,
          user.id,
          reservation.reservation_id!,
          restaurantId,
          "link-gmail",
          "completed",
          "gmail_already_disconnected",
          { provider: "gmail" },
        );
        terminalContext = null;
        return jsonResponse({
          status: "not_connected",
          outcome: "already_disconnected",
        });
      }

      try {
        await revokeGoogleCredential(String(credential?.refreshToken ?? ""));
      } catch (error) {
        if (error instanceof GoogleProviderError) {
          throw new HttpError(
            502,
            "Google could not confirm credential revocation. Try again.",
          );
        }
        throw error;
      }
      const { data: disconnected, error: disconnectError } =
        await securitySupabase.rpc("service_disconnect_gmail", {
          p_actor_user_id: user.id,
          p_restaurant_id: restaurantId,
          p_credential_id: credential.credentialId,
          p_credential_generation: credential.credentialGeneration,
        });
      if (disconnectError) throw disconnectError;
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "link-gmail",
        "completed",
        "gmail_disconnected",
        { provider: "gmail" },
      );
      terminalContext = null;
      return jsonResponse({
        status: "not_connected",
        outcome: disconnected?.outcome ?? "disconnected",
      });
    }

    const oauthConfig = googleOAuthConfig();
    if (!oauthConfig) {
      await recordFunctionAuditLog(
        securitySupabase,
        user.id,
        restaurantId,
        "gmail_link_started",
        "restaurant_email_connections",
        null,
        { provider: "gmail", configured: false },
      );
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "link-gmail",
        "blocked",
        "gmail_link_blocked",
        { provider: "gmail", reason: "server_configuration_missing" },
      );
      terminalContext = null;
      return jsonResponse(
        {
          status: "server_configuration_missing",
          message: "Gmail connection is not configured for this environment.",
        },
        503,
      );
    }

    const callbackReservation = await reserveFunctionInvocation(
      securitySupabase,
      user.id,
      restaurantId,
      "gmail-oauth-callback",
      "gmail_oauth_callback_reserved",
      { provider: "gmail" },
    );
    if (!callbackReservation.allowed) {
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "link-gmail",
        "blocked",
        "gmail_link_blocked",
        {
          provider: "gmail",
          reason: callbackReservation.reason ?? "callback_reservation_denied",
        },
      );
      terminalContext = null;
      return firewallBlockedResponse(callbackReservation);
    }

    const state = randomBase64Url(32);
    const codeVerifier = randomBase64Url(64);
    const [stateHash, codeChallenge] = await Promise.all([
      sha256Hex(state),
      sha256Base64Url(codeVerifier),
    ]);
    const { data: flow, error: flowError } = await securitySupabase.rpc(
      "service_begin_gmail_oauth",
      {
        p_actor_user_id: user.id,
        p_restaurant_id: restaurantId,
        p_callback_reservation_id: callbackReservation.reservation_id!,
        p_state_hash: stateHash,
        p_code_verifier: codeVerifier,
      },
    );
    if (flowError) throw flowError;

    const authorizationUrl = buildGoogleAuthorizationUrl(
      oauthConfig,
      state,
      codeChallenge,
    );
    await recordFunctionAuditLog(
      securitySupabase,
      user.id,
      restaurantId,
      "gmail_link_started",
      "restaurant_email_connections",
      null,
      { provider: "gmail", flowId: flow?.flowId },
    );
    await recordFunctionSecurityEvent(
      securitySupabase,
      user.id,
      reservation.reservation_id!,
      restaurantId,
      "link-gmail",
      "completed",
      "gmail_authorization_created",
      { provider: "gmail" },
    );
    terminalContext = null;
    return jsonResponse({
      status: "authorization_required",
      authorizationUrl,
      expiresAt: flow?.expiresAt ?? null,
    });
  } catch (error) {
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

function googleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

import {
  listSquareCatalogItems,
  refreshSquareAccessToken,
  searchSquareOrders,
  SquareProviderError,
  type SquareOAuthConfig,
} from "../_shared/square.ts";
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
  requireIsoDateString,
  requireRestaurantRole,
  requireUuid,
  type InvocationTerminalContext,
  type PosProvider,
} from "../_shared/mise.ts";

const validProviderList = [
  "square",
  "toast",
  "clover",
  "lightspeed",
  "manual_csv",
] as const satisfies readonly PosProvider[];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let terminalContext: InvocationTerminalContext | null = null;
  try {
    const { supabase, securitySupabase, user } = await requireAuthenticatedContext(req);
    const body = await readJsonObject(req);
    const restaurantId = requireUuid(body.restaurantId, "restaurantId");
    const provider = requireEnum(body.provider, "provider", validProviderList);
    const from = requireIsoDateString(body.from, "from");
    const to = requireIsoDateString(body.to, "to");
    if (to < from) throw new HttpError(400, "The sync window is invalid.");

    const reservation = await reserveFunctionInvocation(
      securitySupabase,
      user.id,
      restaurantId,
      "sync-pos-sales",
      "pos_sync_requested",
      { provider, from, to },
    );
    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      restaurantId,
      functionName: "sync-pos-sales",
    };

    await requireRestaurantRole(supabase, user.id, restaurantId, [
      "owner",
      "admin",
      "manager",
    ]);
    await recordFunctionAuditLog(
      securitySupabase,
      user.id,
      restaurantId,
      "pos_sync_requested",
      "sales_imports",
      null,
      { provider, from, to },
    );

    if (provider !== "square") {
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "sync-pos-sales",
        "blocked",
        "pos_sync_blocked",
        { provider, reason: "provider_not_enabled" },
      );
      terminalContext = null;
      return jsonResponse(
        {
          status: "provider_not_enabled",
          message: "Live POS synchronization is not enabled for this provider.",
          retryable: false,
        },
        501,
      );
    }

    const oauthConfig = squareOAuthConfig();
    if (!oauthConfig) {
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "sync-pos-sales",
        "blocked",
        "pos_sync_blocked",
        { provider, reason: "server_configuration_required" },
      );
      terminalContext = null;
      return jsonResponse(
        {
          status: "server_configuration_required",
          message: "The selected POS connection is not configured on the server.",
          retryable: false,
        },
        503,
      );
    }

    const { data: credential, error: credentialError } = await securitySupabase.rpc(
      "service_fetch_square_sync_credential",
      { p_actor_user_id: user.id, p_restaurant_id: restaurantId },
    );
    if (credentialError) throw credentialError;

    if (credential?.outcome === "provider_not_enabled") {
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "sync-pos-sales",
        "blocked",
        "pos_sync_blocked",
        { provider, reason: "provider_not_enabled" },
      );
      terminalContext = null;
      return jsonResponse(
        {
          status: "provider_not_enabled",
          message: "Live POS synchronization is not enabled.",
          retryable: false,
        },
        501,
      );
    }

    if (credential?.outcome !== "ready") {
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "sync-pos-sales",
        "blocked",
        "pos_sync_blocked",
        { provider, reason: "not_connected" },
      );
      terminalContext = null;
      return jsonResponse(
        {
          status: "not_connected",
          message: "Connect Square before syncing sales.",
          retryable: false,
        },
        409,
      );
    }

    const locationIds = Array.isArray(credential.locationIds)
      ? credential.locationIds.filter((value: unknown): value is string => typeof value === "string")
      : [];

    try {
      const tokens = await refreshSquareAccessToken(
        oauthConfig,
        String(credential.refreshToken),
      );
      if (tokens.refreshToken) {
        await securitySupabase.rpc("service_rotate_square_refresh_token", {
          p_actor_user_id: user.id,
          p_restaurant_id: restaurantId,
          p_credential_id: credential.credentialId,
          p_credential_material: tokens.refreshToken,
        });
      }

      const [sales, catalogItems] = await Promise.all([
        searchSquareOrders(oauthConfig, tokens.accessToken, locationIds, from, to),
        listSquareCatalogItems(oauthConfig, tokens.accessToken),
      ]);

      const { data: applied, error: applyError } = await securitySupabase.rpc(
        "service_apply_square_sync_result",
        {
          p_actor_user_id: user.id,
          p_restaurant_id: restaurantId,
          p_integration_id: credential.integrationId,
          p_sales: sales,
          p_catalog_items: catalogItems,
          p_sync_cursor: null,
          p_from: from,
          p_to: to,
        },
      );
      if (applyError) throw applyError;

      let planningSyncStatus: "fresh" | "stale" = "stale";
      let planningSyncErrorCode: string | null = null;
      await securitySupabase.rpc("service_record_pos_planning_sync_state", {
        p_actor_user_id: user.id,
        p_restaurant_id: restaurantId,
        p_integration_id: credential.integrationId,
        p_status: "stale",
        p_error_code: null,
      });

      try {
        const refreshResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/operational-workflows`,
          {
            method: "POST",
            headers: {
              authorization: req.headers.get("authorization") ?? "",
              apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
              "content-type": "application/json",
            },
            body: JSON.stringify({ action: "refresh_signals", restaurantId }),
          },
        );
        if (refreshResponse.ok) {
          await securitySupabase.rpc("service_record_pos_planning_sync_state", {
            p_actor_user_id: user.id,
            p_restaurant_id: restaurantId,
            p_integration_id: credential.integrationId,
            p_status: "fresh",
            p_error_code: null,
          });
          planningSyncStatus = "fresh";
          planningSyncErrorCode = null;
        } else {
          planningSyncErrorCode = "signal_refresh_failed";
          await securitySupabase.rpc("service_record_pos_planning_sync_state", {
            p_actor_user_id: user.id,
            p_restaurant_id: restaurantId,
            p_integration_id: credential.integrationId,
            p_status: "stale",
            p_error_code: planningSyncErrorCode,
          });
        }
      } catch {
        planningSyncErrorCode = "signal_refresh_failed";
        await securitySupabase.rpc("service_record_pos_planning_sync_state", {
          p_actor_user_id: user.id,
          p_restaurant_id: restaurantId,
          p_integration_id: credential.integrationId,
          p_status: "stale",
          p_error_code: planningSyncErrorCode,
        });
      }

      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "sync-pos-sales",
        "completed",
        "pos_sync_completed",
        {
          provider,
          recordsProcessed: applied?.recordsProcessed ?? sales.length,
          catalogProcessed: applied?.catalogProcessed ?? catalogItems.length,
          planningSyncStatus,
          planningSyncErrorCode,
        },
      );
      terminalContext = null;
      return jsonResponse({
        status: "completed",
        importId: applied?.importId ?? null,
        recordsProcessed: applied?.recordsProcessed ?? sales.length,
        catalogProcessed: applied?.catalogProcessed ?? catalogItems.length,
        planningSyncStatus,
        planningSyncErrorCode,
      });
    } catch (error) {
      const safeCode =
        error instanceof SquareProviderError ? error.safeCode : "square_sync_failed";
      if (error instanceof SquareProviderError && error.disposition === "reauthorize") {
        await securitySupabase.rpc("service_mark_square_connection_state", {
          p_actor_user_id: user.id,
          p_restaurant_id: restaurantId,
          p_status: "error",
          p_error_code: safeCode,
        });
      }
      await securitySupabase.rpc("service_record_square_sync_failure", {
        p_actor_user_id: user.id,
        p_restaurant_id: restaurantId,
        p_integration_id: credential.integrationId,
        p_error_code: safeCode,
        p_from: from,
        p_to: to,
      });
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "sync-pos-sales",
        "error",
        "pos_sync_failed",
        { provider, reason: safeCode },
      );
      terminalContext = null;
      if (error instanceof SquareProviderError && error.disposition === "reauthorize") {
        return jsonResponse(
          {
            status: "needs_reauth",
            message: "Reconnect Square before syncing sales.",
            retryable: false,
          },
          409,
        );
      }
      throw error instanceof HttpError
        ? error
        : new HttpError(502, "Square sync failed. Try again later.");
    }
  } catch (error) {
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

function squareOAuthConfig(): SquareOAuthConfig | null {
  const applicationId = Deno.env.get("SQUARE_APPLICATION_ID");
  const applicationSecret = Deno.env.get("SQUARE_APPLICATION_SECRET");
  const redirectUri = Deno.env.get("SQUARE_REDIRECT_URI");
  const environment =
    Deno.env.get("SQUARE_ENVIRONMENT") === "production" ? "production" : "sandbox";
  if (!applicationId || !applicationSecret || !redirectUri) return null;
  return { applicationId, applicationSecret, redirectUri, environment };
}

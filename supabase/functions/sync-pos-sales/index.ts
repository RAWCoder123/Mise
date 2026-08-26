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

    let locationIds: string[] = [];

    let authoritySyncToken: string | null = null;
    try {
      const { data: syncBoundary, error: syncBoundaryError } = await securitySupabase.rpc(
        "service_begin_square_authority_sync",
        {
          p_actor_user_id: user.id,
          p_restaurant_id: restaurantId,
          p_integration_id: credential.integrationId,
          p_snapshot_mode: "full",
          p_from: from,
          p_to: to,
        },
      );
      if (syncBoundaryError) throw syncBoundaryError;
      authoritySyncToken = requireUuid(syncBoundary?.syncToken, "syncToken");
      locationIds = Array.isArray(syncBoundary?.locationIds)
        ? syncBoundary.locationIds.filter(
          (value: unknown): value is string =>
            typeof value === "string" && value.length > 0 && value.length <= 128,
        )
        : [];
      if (locationIds.length === 0) {
        throw new HttpError(409, "Square has no active location for this synchronization.");
      }

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
        "service_apply_square_sync_result_scoped",
        {
          p_actor_user_id: user.id,
          p_restaurant_id: restaurantId,
          p_integration_id: credential.integrationId,
          p_sync_token: authoritySyncToken,
          p_snapshot_mode: "full",
          p_sales: sales,
          p_catalog_items: catalogItems,
          p_sync_cursor: null,
          p_from: from,
          p_to: to,
        },
      );
      if (applyError) throw applyError;
      const planningGeneration = authoritySyncToken;
      authoritySyncToken = null;

      let planningSyncStatus: "fresh" | "stale" = "stale";
      let planningSyncErrorCode: string | null = null;
      let planningSyncPersisted = false;

      const dirtyRecord = await recordPosPlanningSyncState(securitySupabase, {
        actorUserId: user.id,
        restaurantId,
        integrationId: credential.integrationId,
        status: "stale",
        errorCode: null,
        generation: planningGeneration,
        matchGeneration: false,
      });
      if (!dirtyRecord.persisted) {
        planningSyncErrorCode = "planning_state_persist_failed";
      } else {
        planningSyncPersisted = true;
      }

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
          const freshRecord = await recordPosPlanningSyncState(securitySupabase, {
            actorUserId: user.id,
            restaurantId,
            integrationId: credential.integrationId,
            status: "fresh",
            errorCode: null,
            generation: planningGeneration,
            matchGeneration: true,
          });
          if (freshRecord.persisted) {
            planningSyncStatus = "fresh";
            planningSyncErrorCode = null;
            planningSyncPersisted = true;
          } else if (freshRecord.skipped) {
            // A newer sales generation owns planning state; never claim fresh locally.
            planningSyncStatus = "stale";
            planningSyncErrorCode = dirtyRecord.persisted ? null : "planning_state_persist_failed";
            planningSyncPersisted = false;
          } else {
            planningSyncStatus = "stale";
            planningSyncErrorCode = "planning_state_persist_failed";
            planningSyncPersisted = false;
          }
        } else {
          const failedRecord = await recordPosPlanningSyncState(securitySupabase, {
            actorUserId: user.id,
            restaurantId,
            integrationId: credential.integrationId,
            status: "stale",
            errorCode: "signal_refresh_failed",
            generation: planningGeneration,
            matchGeneration: true,
          });
          planningSyncStatus = "stale";
          if (failedRecord.persisted) {
            planningSyncErrorCode = "signal_refresh_failed";
            planningSyncPersisted = true;
          } else if (failedRecord.skipped) {
            planningSyncErrorCode = "signal_refresh_failed";
            planningSyncPersisted = false;
          } else {
            planningSyncErrorCode = "planning_state_persist_failed";
            planningSyncPersisted = false;
          }
        }
      } catch {
        const failedRecord = await recordPosPlanningSyncState(securitySupabase, {
          actorUserId: user.id,
          restaurantId,
          integrationId: credential.integrationId,
          status: "stale",
          errorCode: "signal_refresh_failed",
          generation: planningGeneration,
          matchGeneration: true,
        });
        planningSyncStatus = "stale";
        if (failedRecord.persisted) {
          planningSyncErrorCode = "signal_refresh_failed";
          planningSyncPersisted = true;
        } else if (failedRecord.skipped) {
          planningSyncErrorCode = "signal_refresh_failed";
          planningSyncPersisted = false;
        } else {
          planningSyncErrorCode = "planning_state_persist_failed";
          planningSyncPersisted = false;
        }
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
          planningSyncPersisted,
          planningSyncGeneration: planningGeneration,
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
        planningSyncPersisted,
      });
    }    } catch (error) {
      const safeCode =
        error instanceof SquareProviderError ? error.safeCode : "square_sync_failed";
      if (authoritySyncToken) {
        await securitySupabase.rpc("service_fail_square_authority_sync", {
          p_actor_user_id: user.id,
          p_restaurant_id: restaurantId,
          p_integration_id: credential.integrationId,
          p_sync_token: authoritySyncToken,
          p_error_code: safeCode,
          p_from: from,
          p_to: to,
        });
        authoritySyncToken = null;
      }
      if (error instanceof SquareProviderError && error.disposition === "reauthorize") {
        await securitySupabase.rpc("service_mark_square_connection_state", {
          p_actor_user_id: user.id,
          p_restaurant_id: restaurantId,
          p_status: "error",
          p_error_code: safeCode,
        });
      }
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

type PlanningSyncRecordResult = {
  persisted: boolean;
  skipped: boolean;
  status: "fresh" | "stale";
  errorCode: string | null;
};

async function recordPosPlanningSyncState(
  securitySupabase: {
    rpc: (
      name: string,
      parameters: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  },
  args: {
    actorUserId: string;
    restaurantId: string;
    integrationId: string;
    status: "fresh" | "stale";
    errorCode: string | null;
    generation: string;
    matchGeneration: boolean;
  },
): Promise<PlanningSyncRecordResult> {
  try {
    const { data, error } = await securitySupabase.rpc("service_record_pos_planning_sync_state", {
      p_actor_user_id: args.actorUserId,
      p_restaurant_id: args.restaurantId,
      p_integration_id: args.integrationId,
      p_status: args.status,
      p_error_code: args.errorCode,
      p_generation: args.generation,
      p_match_generation: args.matchGeneration,
    });
    if (error) {
      return {
        persisted: false,
        skipped: false,
        status: "stale",
        errorCode: "planning_state_persist_failed",
      };
    }
    const payload =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
    const updatedCount = Number(payload.updatedCount ?? 0);
    const skipped =
      payload.skipped === true || (args.matchGeneration && (!Number.isFinite(updatedCount) || updatedCount <= 0));
    if (skipped) {
      return {
        persisted: false,
        skipped: true,
        status: "stale",
        errorCode: args.status === "stale" ? args.errorCode : null,
      };
    }
    return {
      persisted: true,
      skipped: false,
      status: args.status,
      errorCode: args.status === "fresh" ? null : args.errorCode,
    };
  } catch {
    return {
      persisted: false,
      skipped: false,
      status: "stale",
      errorCode: "planning_state_persist_failed",
    };
  }
}

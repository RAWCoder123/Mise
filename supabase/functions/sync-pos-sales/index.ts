import {
  firewallBlockedResponse,
  handleError,
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
  type PosProvider
} from "../_shared/mise.ts";

const providerSecretNames: Record<PosProvider, string | null> = {
  square: "SQUARE_ACCESS_TOKEN",
  toast: "TOAST_CLIENT_SECRET",
  clover: "CLOVER_ACCESS_TOKEN",
  lightspeed: "LIGHTSPEED_ACCESS_TOKEN",
  manual_csv: null
};

const validProviderList = Object.keys(providerSecretNames) as PosProvider[];

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

    const reservation = await reserveFunctionInvocation(securitySupabase, user.id, restaurantId, "sync-pos-sales", "pos_sync_requested", {
      provider,
      from,
      to
    });
    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      restaurantId,
      functionName: "sync-pos-sales"
    };

    await requireRestaurantRole(supabase, user.id, restaurantId, ["owner", "admin", "manager"]);
    await recordFunctionAuditLog(securitySupabase, user.id, restaurantId, "pos_sync_requested", "sales_imports", null, {
      provider,
      from,
      to
    });

    const requiredSecretName = providerSecretNames[provider];
    const providerConfigured = requiredSecretName === null || Boolean(Deno.env.get(requiredSecretName));
    // Secrets/config present means the provider can be selected, but live sync code is not
    // implemented yet. Missing secrets are a server-configuration problem, not an
    // unimplemented-capability signal.
    const blockedReason = providerConfigured ? "provider_not_implemented" : "server_configuration_required";

    await recordFunctionSecurityEvent(securitySupabase, user.id, reservation.reservation_id!, restaurantId, "sync-pos-sales", "blocked", "pos_sync_blocked", {
      provider,
      reason: blockedReason
    });
    terminalContext = null;
    return jsonResponse(
      {
        status: blockedReason,
        message: providerConfigured
          ? "Live POS synchronization is not implemented for this provider."
          : "The selected POS connection is not configured on the server.",
        retryable: false
      },
      providerConfigured ? 501 : 503
    );
  } catch (error) {
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

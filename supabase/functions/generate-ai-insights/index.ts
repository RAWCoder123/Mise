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
  requireRestaurantRole,
  requireUuid,
  type InvocationTerminalContext
} from "../_shared/mise.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let terminalContext: InvocationTerminalContext | null = null;
  try {
    const { supabase, securitySupabase, user } = await requireAuthenticatedContext(req);
    const body = await readJsonObject(req);
    const restaurantId = requireUuid(body.restaurantId, "restaurantId");
    const reservation = await reserveFunctionInvocation(
      securitySupabase,
      user.id,
      restaurantId,
      "generate-ai-insights",
      "ai_insight_generation_requested"
    );
    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      restaurantId,
      functionName: "generate-ai-insights"
    };

    await requireRestaurantRole(supabase, user.id, restaurantId, ["owner", "admin", "manager"]);
    await recordFunctionAuditLog(securitySupabase, user.id, restaurantId, "ai_insight_generation_requested", "ai_insights");

    const providerConfigured = Boolean(Deno.env.get("OPENAI_API_KEY"));
    const blockedReason = providerConfigured ? "provider_not_enabled" : "server_configuration_required";
    await recordFunctionSecurityEvent(
      securitySupabase,
      user.id,
      reservation.reservation_id!,
      restaurantId,
      "generate-ai-insights",
      "blocked",
      "ai_insight_generation_blocked",
      { reason: blockedReason }
    );
    terminalContext = null;

    return jsonResponse(
      {
        status: blockedReason,
        message: providerConfigured
          ? "Live AI insight generation is not enabled."
          : "AI insight generation is not configured on the server.",
        retryable: false
      },
      providerConfigured ? 501 : 503
    );
  } catch (error) {
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

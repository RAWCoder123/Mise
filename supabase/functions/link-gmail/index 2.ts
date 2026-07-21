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
    const reservation = await reserveFunctionInvocation(securitySupabase, user.id, restaurantId, "link-gmail", "gmail_link_started", {
      provider: "gmail"
    });
    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      restaurantId,
      functionName: "link-gmail"
    };

    await requireRestaurantRole(supabase, user.id, restaurantId, ["owner", "admin"]);

    const oauthConfigured = Boolean(
      Deno.env.get("GOOGLE_CLIENT_ID") &&
        Deno.env.get("GOOGLE_CLIENT_SECRET") &&
        Deno.env.get("GOOGLE_REDIRECT_URI")
    );

    const { data, error } = await supabase
      .from("restaurant_email_connections")
      .upsert(
        {
          restaurant_id: restaurantId,
          provider: "gmail",
          status: oauthConfigured ? "restricted" : "not_connected",
          sender_email: null,
          last_verified_at: null
        },
        { onConflict: "restaurant_id,provider" }
      )
      .select("id,restaurant_id,provider,status,sender_email,last_verified_at,updated_at")
      .single();

    if (error) throw error;
    await recordFunctionAuditLog(securitySupabase, user.id, restaurantId, "gmail_link_started", "restaurant_email_connections", data.id, {
      provider: "gmail",
      status: data.status
    });
    await recordFunctionSecurityEvent(securitySupabase, user.id, reservation.reservation_id!, restaurantId, "link-gmail", "completed", "gmail_link_scaffolded", {
      provider: "gmail",
      status: data.status
    });
    terminalContext = null;

    return jsonResponse(
      {
        status: oauthConfigured ? "oauth_not_implemented" : "server_configuration_missing",
        authorizationUrl: null,
        connection: data,
        message:
          "Gmail OAuth is intentionally backend-only and is not enabled in this beta scaffold. No Google tokens are stored in Expo."
      },
      501
    );
  } catch (error) {
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

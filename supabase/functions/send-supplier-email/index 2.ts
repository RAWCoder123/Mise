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
    const orderId = requireUuid(body.orderId, "orderId");
    const reservation = await reserveFunctionInvocation(
      securitySupabase,
      user.id,
      restaurantId,
      "send-supplier-email",
      "supplier_email_prepare_requested",
      { orderId }
    );
    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      restaurantId,
      functionName: "send-supplier-email"
    };

    await requireRestaurantRole(supabase, user.id, restaurantId, ["owner", "admin", "manager"]);
    await recordFunctionAuditLog(securitySupabase, user.id, restaurantId, "supplier_email_prepare_requested", "supplier_orders", orderId);

    const [restaurantResult, orderResult, connectionResult] = await Promise.all([
      supabase.from("restaurants").select("id,name").eq("id", restaurantId).single(),
      supabase
        .from("supplier_orders")
        .select("id,supplier_name,order_message,status")
        .eq("restaurant_id", restaurantId)
        .eq("id", orderId)
        .single(),
      supabase
        .from("restaurant_email_connections")
        .select("status,sender_email")
        .eq("restaurant_id", restaurantId)
        .eq("provider", "gmail")
        .maybeSingle()
    ]);

    if (restaurantResult.error) throw restaurantResult.error;
    if (orderResult.error) throw orderResult.error;
    if (connectionResult.error) throw connectionResult.error;

    const order = orderResult.data;
    const recipientResult = await supabase
      .from("supplier_recipients")
      .select("email")
      .eq("restaurant_id", restaurantId)
      .eq("supplier_name", order.supplier_name)
      .not("email", "is", null)
      .limit(1)
      .maybeSingle();

    if (recipientResult.error) throw recipientResult.error;

    const connection = connectionResult.data;
    if (connection?.status !== "connected" || !connection.sender_email) {
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "send-supplier-email",
        "blocked",
        "supplier_email_blocked",
        { orderId, reason: "gmail_not_connected" }
      );
      terminalContext = null;
      return jsonResponse(
        { error: "Connect the restaurant Gmail sender before Mise can send supplier email." },
        409
      );
    }

    if (!recipientResult.data?.email) {
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "send-supplier-email",
        "blocked",
        "supplier_email_blocked",
        { orderId, reason: "supplier_email_missing" }
      );
      terminalContext = null;
      return jsonResponse({ error: `Add a supplier email for ${order.supplier_name}.` }, 409);
    }

    if (!Deno.env.get("GMAIL_SEND_ENABLED")) {
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "send-supplier-email",
        "completed",
        "supplier_email_prepared",
        { orderId, supplierName: order.supplier_name, sent: false }
      );
      terminalContext = null;
      return jsonResponse(
        {
          status: "ready_not_sent",
          to: recipientResult.data.email,
          from: connection.sender_email,
          subject: `${restaurantResult.data.name} order for ${order.supplier_name}`,
          body: order.order_message,
          message:
            "Supplier email is prepared, but live Gmail sending is disabled until the backend OAuth integration is completed."
        },
        501
      );
    }

    await recordFunctionSecurityEvent(
      securitySupabase,
      user.id,
      reservation.reservation_id!,
      restaurantId,
      "send-supplier-email",
      "blocked",
      "supplier_email_blocked",
      { orderId, reason: "live_send_not_implemented" }
    );
    terminalContext = null;
    return jsonResponse(
      {
        status: "not_implemented",
        message: "Live Gmail sending must be implemented with backend-only Google tokens before enabling this branch."
      },
      501
    );
  } catch (error) {
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

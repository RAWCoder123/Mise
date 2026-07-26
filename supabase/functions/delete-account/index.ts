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
  type InvocationTerminalContext
} from "../_shared/mise.ts";

// Permanent account deletion (Apple App Store requirement). The caller must
// provide their active restaurant so the standard per-restaurant firewall,
// role check, and audit lifecycle can run. The reservation is finalized before
// service_delete_account because sole-owner restaurant deletes cascade the
// private security-event rows.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let terminalContext: InvocationTerminalContext | null = null;
  try {
    const { supabase, securitySupabase, user } = await requireAuthenticatedContext(req);
    const body = await readJsonObject(req);
    requireEnum(body.confirmation, "confirmation", ["delete_my_account"] as const);
    const restaurantId = requireUuid(body.restaurantId, "restaurantId");

    const reservation = await reserveFunctionInvocation(
      securitySupabase,
      user.id,
      restaurantId,
      "delete-account",
      "account_deletion_requested"
    );
    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      restaurantId,
      functionName: "delete-account"
    };

    // Any active member may delete their own account; restaurant ownership is
    // enforced separately inside service_delete_account for cascade scope.
    await requireRestaurantRole(supabase, user.id, restaurantId, ["owner", "admin", "manager", "staff"]);
    await recordFunctionAuditLog(
      securitySupabase,
      user.id,
      restaurantId,
      "account_deletion_requested",
      "users",
      user.id,
      { confirmation: "delete_my_account" }
    );

    // Close the firewall reservation while the restaurant still exists.
    await recordFunctionSecurityEvent(
      securitySupabase,
      user.id,
      reservation.reservation_id!,
      restaurantId,
      "delete-account",
      "completed",
      "account_deletion_authorized",
      { confirmation: "delete_my_account" }
    );
    terminalContext = null;

    const { data, error } = await securitySupabase.rpc("service_delete_account", {
      p_user_id: user.id
    });
    if (error) {
      throw new HttpError(500, "Account data could not be removed. No account changes were applied.");
    }

    const summary = (data ?? {}) as { restaurants_deleted?: number; memberships_removed?: number };

    const { error: adminError } = await securitySupabase.auth.admin.deleteUser(user.id);
    if (adminError) {
      throw new HttpError(
        500,
        "Restaurant data was removed but the sign-in account could not be deleted. Try again."
      );
    }

    return jsonResponse({
      status: "deleted",
      restaurantsDeleted: summary.restaurants_deleted ?? 0,
      membershipsRemoved: summary.memberships_removed ?? 0
    });
  } catch (error) {
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

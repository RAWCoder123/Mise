import {
  captureFunctionError,
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

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// Recoverable account deletion (Apple App Store requirement).
//
// Order (critical invariant):
//   1) Authorize against the caller's active restaurant membership.
//   2) Write a durable deletion *plan* without removing tenant data.
//   3) auth.admin.deleteUser
//   4) Finalize tenant cleanup by audit_id (works after auth user is gone).
//
// Failure boundaries:
//   - Auth deletion fails  -> memberships intact, client can retry.
//   - Tenant cleanup fails -> durable tenant_cleanup_failed audit, service-retryable.
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

    await requireRestaurantRole(supabase, user.id, restaurantId, ["owner", "admin", "manager", "staff"]);
    await recordFunctionAuditLog(
      securitySupabase,
      user.id,
      restaurantId,
      "account_deletion_requested",
      "users",
      user.id,
      { confirmation: "delete_my_account", phase: "authorization" }
    );

    // Close the firewall reservation as authorization only. Tenant data still exists.
    await recordFunctionSecurityEvent(
      securitySupabase,
      user.id,
      reservation.reservation_id!,
      restaurantId,
      "delete-account",
      "completed",
      "account_deletion_authorized",
      { confirmation: "delete_my_account", phase: "authorization" }
    );
    terminalContext = null;

    const { data: planData, error: planError } = await securitySupabase.rpc(
      "service_plan_account_deletion",
      {
        p_user_id: user.id,
        p_requesting_restaurant_id: restaurantId
      }
    );
    if (planError) {
      captureFunctionError(planError, {
        functionName: "delete-account",
        step: "deletion_plan",
        phase: "post_authorization",
        restaurantId
      });
      throw new HttpError(500, "Account deletion could not be planned. Try again.");
    }

    const plan = asObject(planData);
    const auditId = asString(plan.audit_id);
    if (!auditId || plan.phase !== "deletion_planned") {
      captureFunctionError(new Error("account_deletion_plan_invalid"), {
        functionName: "delete-account",
        step: "deletion_plan",
        phase: "post_authorization",
        restaurantId
      });
      throw new HttpError(500, "Account deletion could not be planned. Try again.");
    }

    const { error: adminError } = await securitySupabase.auth.admin.deleteUser(user.id);
    if (adminError) {
      captureFunctionError(adminError, {
        functionName: "delete-account",
        step: "auth_user_deletion",
        phase: "post_authorization",
        restaurantId,
        auditId
      });

      const { error: failFinalizeError } = await securitySupabase.rpc(
        "service_finalize_account_deletion",
        {
          p_audit_id: auditId,
          p_auth_outcome: "auth_deletion_failed"
        }
      );
      if (failFinalizeError) {
        captureFunctionError(failFinalizeError, {
          functionName: "delete-account",
          step: "audit_finalize",
          phase: "auth_deletion_failed",
          auditId
        });
      }

      // Memberships are still intact, so the client can retry delete-account.
      throw new HttpError(
        500,
        "Your sign-in account could not be deleted. Your restaurant access is unchanged — try again."
      );
    }

    // Auth user is gone. Tenant cleanup is keyed by audit_id / planned_user_id.
    const { data: finalizeData, error: finalizeError } = await securitySupabase.rpc(
      "service_finalize_account_deletion",
      {
        p_audit_id: auditId,
        p_auth_outcome: "auth_deletion_completed"
      }
    );
    if (finalizeError) {
      captureFunctionError(finalizeError, {
        functionName: "delete-account",
        step: "tenant_cleanup",
        phase: "post_auth_deletion",
        auditId
      });
      throw new HttpError(
        500,
        "Your sign-in was deleted but restaurant cleanup needs service recovery. Contact support with your deletion reference."
      );
    }

    const finalized = asObject(finalizeData);
    const phase = asString(finalized.phase);
    if (phase === "tenant_cleanup_failed") {
      captureFunctionError(new Error("account_deletion_tenant_cleanup_failed"), {
        functionName: "delete-account",
        step: "tenant_cleanup",
        phase: "tenant_cleanup_failed",
        auditId
      });
      throw new HttpError(
        500,
        "Your sign-in was deleted but restaurant cleanup needs service recovery. Contact support with your deletion reference."
      );
    }

    if (phase !== "tenant_cleanup_completed") {
      captureFunctionError(new Error("account_deletion_finalize_unexpected_phase"), {
        functionName: "delete-account",
        step: "tenant_cleanup",
        phase: phase || "unknown",
        auditId
      });
      throw new HttpError(
        500,
        "Your sign-in was deleted but restaurant cleanup needs service recovery. Contact support with your deletion reference."
      );
    }

    return jsonResponse({
      status: "deleted",
      auditId,
      restaurantsDeleted: asNumber(finalized.restaurants_deleted),
      membershipsRemoved: asNumber(finalized.memberships_removed)
    });
  } catch (error) {
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

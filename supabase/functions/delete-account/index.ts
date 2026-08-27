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
  type FunctionInvocationReservation,
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

function optionalRestaurantId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new HttpError(400, "restaurantId must be a UUID string when provided.");
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  return requireUuid(trimmed, "restaurantId");
}

// Recoverable account deletion (Apple App Store requirement).
//
// Order (critical invariant):
//   1) Authorize against the caller's active restaurant membership, OR prove
//      zero active memberships for the membershipless branch.
//   2) Write a durable deletion *plan* without removing tenant data.
//   3) auth.admin.deleteUser
//   4) Finalize tenant cleanup by audit_id (works after auth user is gone).
//
// Failure boundaries:
//   - Auth deletion fails  -> memberships intact, client can retry.
//   - Tenant cleanup fails -> durable tenant_cleanup_failed audit, service-retryable.
//
// Cross-system dependency (inventory-owned, not mutated here):
//   auth.admin.deleteUser must be able to anonymize inventory_events.actor_user_id
//   via FK ON DELETE SET NULL. This function never UPDATEs/DELETEs inventory_events.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let terminalContext: InvocationTerminalContext | null = null;
  try {
    const { supabase, securitySupabase, user } = await requireAuthenticatedContext(req);
    const body = await readJsonObject(req);
    requireEnum(body.confirmation, "confirmation", ["delete_my_account"] as const);
    const restaurantId = optionalRestaurantId(body.restaurantId);
    const membershipless = restaurantId === null;

    let reservation: FunctionInvocationReservation;
    if (membershipless) {
      const { data, error } = await securitySupabase.rpc(
        "service_reserve_membershipless_account_deletion",
        {
          p_actor_user_id: user.id,
          action_name: "account_deletion_requested",
          metadata: { confirmation: "delete_my_account", membershipless: true }
        }
      );
      if (error) {
        captureFunctionError(error, {
          functionName: "delete-account",
          actionName: "account_deletion_requested",
          restaurantId: null
        });
        throw new HttpError(500, "Unable to verify this function request.");
      }
      reservation = data as FunctionInvocationReservation;
      if (
        !reservation ||
        typeof reservation.allowed !== "boolean" ||
        (reservation.allowed && typeof reservation.reservation_id !== "string")
      ) {
        throw new HttpError(500, "Unable to verify this function request.");
      }
    } else {
      reservation = await reserveFunctionInvocation(
        securitySupabase,
        user.id,
        restaurantId,
        "delete-account",
        "account_deletion_requested"
      );
    }

    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      restaurantId,
      functionName: "delete-account",
      membershipless
    };

    if (membershipless) {
      const { count, error: membershipError } = await supabase
        .from("restaurant_memberships")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "active");
      if (membershipError) {
        throw new HttpError(500, "Unable to verify restaurant access.");
      }
      if ((count ?? 0) > 0) {
        throw new HttpError(
          403,
          "Delete your account from Settings while a restaurant workspace is still assigned."
        );
      }
    } else {
      await requireRestaurantRole(supabase, user.id, restaurantId, [
        "owner",
        "admin",
        "manager",
        "staff"
      ]);
      await recordFunctionAuditLog(
        securitySupabase,
        user.id,
        restaurantId,
        "account_deletion_requested",
        "users",
        user.id,
        { confirmation: "delete_my_account", phase: "authorization" }
      );
    }

    if (membershipless) {
      const { error: closeError } = await securitySupabase.rpc(
        "service_record_membershipless_account_deletion_event",
        {
          p_actor_user_id: user.id,
          p_reservation_id: reservation.reservation_id!,
          p_event_type: "completed",
          action_name: "account_deletion_authorized",
          metadata: {
            confirmation: "delete_my_account",
            phase: "authorization",
            membershipless: true
          }
        }
      );
      if (closeError) {
        captureFunctionError(closeError, {
          functionName: "delete-account",
          eventType: "completed",
          actionName: "account_deletion_authorized",
          restaurantId: null
        });
        throw new HttpError(500, "Unable to finalize this function request.");
      }
    } else {
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
    }
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

      // Memberships are still intact (or still absent), so the client can retry.
      throw new HttpError(
        500,
        membershipless
          ? "Your sign-in account could not be deleted. Try again."
          : "Your sign-in account could not be deleted. Your restaurant access is unchanged — try again."
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
      return jsonResponse(
        {
          error: "Your sign-in was deleted but restaurant cleanup needs service recovery. Contact support with your deletion reference.",
          deletionReference: auditId
        },
        500
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
      return jsonResponse(
        {
          error: "Your sign-in was deleted but restaurant cleanup needs service recovery. Contact support with your deletion reference.",
          deletionReference: auditId
        },
        500
      );
    }

    if (phase !== "tenant_cleanup_completed") {
      captureFunctionError(new Error("account_deletion_finalize_unexpected_phase"), {
        functionName: "delete-account",
        step: "tenant_cleanup",
        phase: phase || "unknown",
        auditId
      });
      return jsonResponse(
        {
          error: "Your sign-in was deleted but restaurant cleanup needs service recovery. Contact support with your deletion reference.",
          deletionReference: auditId
        },
        500
      );
    }

    return jsonResponse({
      status: "deleted",
      auditId,
      restaurantsDeleted: asNumber(finalized.restaurants_deleted),
      membershipsRemoved: asNumber(finalized.memberships_removed),
      membershipless
    });
  } catch (error) {
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

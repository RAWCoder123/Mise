import {
  firewallBlockedResponse,
  handleError,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJsonObject,
  recordUserScopedFunctionSecurityEvent,
  recordUserScopedFunctionTerminalError,
  requireAuthenticatedContext,
  requireString,
  reserveUserScopedFunctionInvocation,
  type UserScopedInvocationTerminalContext
} from "../_shared/mise.ts";

const ACTION = "request_account_deletion";
const FUNCTION_NAME = "request-account-deletion" as const;

async function updateDeletionRequestStatus(
  securitySupabase: Awaited<ReturnType<typeof requireAuthenticatedContext>>["securitySupabase"],
  requestId: string,
  subjectUserId: string,
  patch: Record<string, unknown>
) {
  const { data, error } = await securitySupabase
    .from("account_deletion_requests")
    .update(patch)
    .eq("id", requestId)
    .eq("subject_user_id", subjectUserId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    throw new HttpError(500, "Account deletion request status could not be updated.");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let terminalContext: UserScopedInvocationTerminalContext | null = null;
  let authUserDeleted = false;
  try {
    const { securitySupabase, user } = await requireAuthenticatedContext(req);
    const body = await readJsonObject(req);
    const confirmation = requireString(body.confirmation, "confirmation");
    if (confirmation.trim().toUpperCase() !== "DELETE") {
      throw new HttpError(400, "Type DELETE to confirm account deletion.");
    }

    const reservation = await reserveUserScopedFunctionInvocation(
      securitySupabase,
      user.id,
      FUNCTION_NAME,
      ACTION
    );
    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      functionName: FUNCTION_NAME
    };

    const { data: requestRow, error: requestError } = await securitySupabase.rpc(
      "service_request_my_account_deletion",
      {
        p_actor_user_id: user.id,
        p_confirmation: "DELETE"
      }
    );
    if (requestError) throw requestError;
    if (!requestRow || typeof requestRow !== "object") {
      throw new HttpError(500, "Account deletion request could not be recorded.");
    }

    const requestId = String((requestRow as { id?: unknown }).id ?? "");
    if (!requestId) {
      throw new HttpError(500, "Account deletion request is missing an identifier.");
    }

    const existingMetadata =
      requestRow && typeof requestRow === "object" && "metadata" in requestRow
        && requestRow.metadata
        && typeof requestRow.metadata === "object"
        && !Array.isArray(requestRow.metadata)
        ? (requestRow.metadata as Record<string, unknown>)
        : {};

    await updateDeletionRequestStatus(securitySupabase, requestId, user.id, {
      status: "processing",
      metadata: {
        ...existingMetadata,
        source: FUNCTION_NAME,
        processed_at: new Date().toISOString()
      }
    });

    const { error: deleteError } = await securitySupabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      const { error: rollbackError } = await securitySupabase.rpc(
        "service_rollback_failed_account_deletion",
        { p_request_id: requestId }
      );
      if (rollbackError) {
        throw new HttpError(
          500,
          "Account removal failed and automatic access restore needs support follow-up."
        );
      }
      throw new HttpError(
        500,
        "Account removal failed. Restaurant access was restored so you can retry or contact support."
      );
    }
    authUserDeleted = true;

    // After Auth hard-delete, prefer completing the audit trail over surfacing
    // secondary status/finalize failures as a false "deletion failed" to the client.
    try {
      await updateDeletionRequestStatus(securitySupabase, requestId, user.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: {
          ...existingMetadata,
          source: FUNCTION_NAME,
          completed_via: "auth_admin_delete_user"
        }
      });
    } catch {
      // Request row remains the durable subject_user_id audit key for support.
    }

    try {
      await recordUserScopedFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        FUNCTION_NAME,
        "completed",
        ACTION,
        {
          result_entity: "account_deletion_requests",
          request_id: requestId
        }
      );
    } catch {
      // SQL path allows null-actor finalization; if finalize still fails, Auth is already gone.
    }
    terminalContext = null;

    return jsonResponse({
      status: "completed",
      requestId,
      message: "Account deletion completed."
    });
  } catch (error) {
    if (!authUserDeleted) {
      await recordUserScopedFunctionTerminalError(terminalContext);
      return handleError(error);
    }

    // Auth user is already deleted; best-effort error audit then report completion.
    await recordUserScopedFunctionTerminalError(terminalContext);
    return jsonResponse({
      status: "completed",
      message: "Account deletion completed."
    });
  }
});

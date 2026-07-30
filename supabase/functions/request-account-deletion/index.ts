import {
  handleError,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJsonObject,
  requireAuthenticatedContext,
  requireString
} from "../_shared/mise.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const { supabase, securitySupabase, user } = await requireAuthenticatedContext(req);
    const body = await readJsonObject(req);
    const confirmation = requireString(body.confirmation, "confirmation");
    if (confirmation.trim().toUpperCase() !== "DELETE") {
      throw new HttpError(400, "Type DELETE to confirm account deletion.");
    }

    const { data: requestRow, error: requestError } = await supabase.rpc("request_my_account_deletion", {
      p_confirmation: "DELETE"
    });
    if (requestError) throw requestError;
    if (!requestRow || typeof requestRow !== "object") {
      throw new HttpError(500, "Account deletion request could not be recorded.");
    }

    const requestId = String((requestRow as { id?: unknown }).id ?? "");
    if (!requestId) {
      throw new HttpError(500, "Account deletion request is missing an identifier.");
    }

    await securitySupabase
      .from("account_deletion_requests")
      .update({
        status: "processing",
        metadata: {
          source: "request-account-deletion",
          processed_at: new Date().toISOString()
        }
      })
      .eq("id", requestId)
      .eq("subject_user_id", user.id);

    const { error: deleteError } = await securitySupabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      await securitySupabase
        .from("account_deletion_requests")
        .update({
          status: "requested",
          metadata: {
            source: "request-account-deletion",
            auth_delete_failed: true,
            failed_at: new Date().toISOString()
          }
        })
        .eq("id", requestId)
        .eq("subject_user_id", user.id);
      throw new HttpError(500, "Account access was revoked, but final account removal needs support follow-up.");
    }

    await securitySupabase
      .from("account_deletion_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: {
          source: "request-account-deletion",
          completed_via: "auth_admin_delete_user"
        }
      })
      .eq("id", requestId)
      .eq("subject_user_id", user.id);

    return jsonResponse({
      status: "completed",
      requestId,
      message: "Account deletion completed."
    });
  } catch (error) {
    return handleError(error);
  }
});

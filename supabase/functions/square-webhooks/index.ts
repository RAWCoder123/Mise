import { createClient } from "npm:@supabase/supabase-js@2";
import {
  listSquareCatalogItems,
  refreshSquareAccessToken,
  searchSquareOrders,
  type SquareOAuthConfig,
} from "../_shared/square.ts";
import { HttpError, jsonResponse, requireUuid } from "../_shared/mise.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type, x-square-hmacsha256-signature",
      },
    });
  }
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const signatureKey = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY");
    const notificationUrl = Deno.env.get("SQUARE_WEBHOOK_NOTIFICATION_URL");
    if (!signatureKey || !notificationUrl) {
      return jsonResponse(
        { status: "server_configuration_required", message: "Square webhooks are not configured." },
        503,
      );
    }

    const rawBody = await req.text();
    if (rawBody.length > 256_000) {
      return jsonResponse({ error: "Payload too large." }, 413);
    }
    const signature = req.headers.get("x-square-hmacsha256-signature") ?? "";
    const valid = await verifySquareSignature(signatureKey, notificationUrl, rawBody, signature);
    if (!valid) return jsonResponse({ error: "Invalid signature." }, 401);

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid JSON." }, 400);
    }

    const merchantId =
      (typeof payload.merchant_id === "string" && payload.merchant_id) ||
      (payload.merchant_id == null &&
      payload.data &&
      typeof payload.data === "object" &&
      typeof (payload.data as Record<string, unknown>).merchant_id === "string"
        ? String((payload.data as Record<string, unknown>).merchant_id)
        : "");
    if (!merchantId) return jsonResponse({ status: "ignored", reason: "merchant_missing" }, 200);

    const securitySupabase = serviceClient();
    const { data: target, error: targetError } = await securitySupabase.rpc(
      "service_resolve_square_webhook_merchant",
      { p_merchant_id: merchantId },
    );
    if (targetError) throw targetError;
    if (target?.outcome === "provider_not_enabled") {
      return jsonResponse({ status: "provider_not_enabled" }, 200);
    }
    if (target?.outcome !== "ready") {
      return jsonResponse({ status: "ignored", reason: target?.outcome ?? "unknown" }, 200);
    }

    const oauthConfig = squareOAuthConfig();
    if (!oauthConfig) {
      return jsonResponse({ status: "server_configuration_required" }, 503);
    }

    const { data: credential, error: credentialError } = await securitySupabase.rpc(
      "service_fetch_square_sync_credential",
      {
        p_actor_user_id: target.actorUserId,
        p_restaurant_id: target.restaurantId,
      },
    );
    if (credentialError) throw credentialError;
    if (credential?.outcome !== "ready") {
      return jsonResponse({ status: "ignored", reason: credential?.outcome ?? "not_ready" }, 200);
    }

    let locationIds: string[] = [];
    const to = new Date();
    const from = new Date(to.getTime() - 2 * 24 * 60 * 60 * 1000);
    const fromDate = from.toISOString().slice(0, 10);
    const toDate = to.toISOString().slice(0, 10);

    const { data: syncBoundary, error: syncBoundaryError } = await securitySupabase.rpc(
      "service_begin_square_authority_sync",
      {
        p_actor_user_id: target.actorUserId,
        p_restaurant_id: target.restaurantId,
        p_integration_id: credential.integrationId,
        p_snapshot_mode: "partial",
        p_from: fromDate,
        p_to: toDate,
      },
    );
    if (syncBoundaryError) throw syncBoundaryError;
    const authoritySyncToken = requireUuid(syncBoundary?.syncToken, "syncToken");

    try {
      locationIds = Array.isArray(syncBoundary?.locationIds)
        ? syncBoundary.locationIds.filter(
          (value: unknown): value is string =>
            typeof value === "string" && value.length > 0 && value.length <= 128,
        )
        : [];
      if (locationIds.length === 0) {
        throw new HttpError(409, "Square has no active webhook location.");
      }
      const tokens = await refreshSquareAccessToken(oauthConfig, String(credential.refreshToken));
      const [sales, catalogItems] = await Promise.all([
        searchSquareOrders(oauthConfig, tokens.accessToken, locationIds, fromDate, toDate),
        listSquareCatalogItems(oauthConfig, tokens.accessToken),
      ]);
      const { error: applyError } = await securitySupabase.rpc(
        "service_apply_square_sync_result_scoped",
        {
          p_actor_user_id: target.actorUserId,
          p_restaurant_id: target.restaurantId,
          p_integration_id: credential.integrationId,
          p_sync_token: authoritySyncToken,
          p_snapshot_mode: "partial",
          p_sales: sales,
          p_catalog_items: catalogItems,
          p_sync_cursor: null,
          p_from: fromDate,
          p_to: toDate,
        },
      );
      if (applyError) throw applyError;

      return jsonResponse({ status: "accepted", recordsProcessed: sales.length });
    } catch (error) {
      await securitySupabase.rpc("service_fail_square_authority_sync", {
        p_actor_user_id: target.actorUserId,
        p_restaurant_id: target.restaurantId,
        p_integration_id: credential.integrationId,
        p_sync_token: authoritySyncToken,
        p_error_code: "square_webhook_refresh_failed",
        p_from: fromDate,
        p_to: toDate,
      });
      throw error;
    }
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status);
    }
    return jsonResponse({ error: "Webhook processing failed." }, 500);
  }
});

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new HttpError(500, "Server configuration is unavailable.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function squareOAuthConfig(): SquareOAuthConfig | null {
  const applicationId = Deno.env.get("SQUARE_APPLICATION_ID");
  const applicationSecret = Deno.env.get("SQUARE_APPLICATION_SECRET");
  const redirectUri = Deno.env.get("SQUARE_REDIRECT_URI");
  const environment =
    Deno.env.get("SQUARE_ENVIRONMENT") === "production" ? "production" : "sandbox";
  if (!applicationId || !applicationSecret || !redirectUri) return null;
  return { applicationId, applicationSecret, redirectUri, environment };
}

async function verifySquareSignature(
  signatureKey: string,
  notificationUrl: string,
  body: string,
  signatureHeader: string,
) {
  if (!signatureHeader || signatureHeader.length > 512) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(notificationUrl + body),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
  if (expected.length !== signatureHeader.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signatureHeader.charCodeAt(index);
  }
  return mismatch === 0;
}

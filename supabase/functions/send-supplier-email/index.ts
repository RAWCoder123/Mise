import {
  buildGmailRawMessage,
  gmailMessageId,
  GoogleProviderError,
  refreshGoogleAccessToken,
  sendGmailMessage,
  type GoogleOAuthConfig,
} from "../_shared/gmail.ts";
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
  requireRestaurantRole,
  requireUuid,
  type InvocationTerminalContext,
} from "../_shared/mise.ts";

interface ClaimedSupplierEmail {
  outcome: "claimed";
  claimToken: string;
  credentialId: string;
  refreshToken: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  rfcMessageId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed." }, 405);

  let terminalContext: InvocationTerminalContext | null = null;
  try {
    const { supabase, securitySupabase, user } =
      await requireAuthenticatedContext(req);
    const body = await readJsonObject(req);
    const restaurantId = requireUuid(body.restaurantId, "restaurantId");
    const orderId = requireUuid(body.orderId, "orderId");
    const reservation = await reserveFunctionInvocation(
      securitySupabase,
      user.id,
      restaurantId,
      "send-supplier-email",
      "supplier_email_prepare_requested",
      { orderId },
    );
    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      restaurantId,
      functionName: "send-supplier-email",
    };

    await requireRestaurantRole(supabase, user.id, restaurantId, [
      "owner",
      "admin",
      "manager",
    ]);
    await recordFunctionAuditLog(
      securitySupabase,
      user.id,
      restaurantId,
      "supplier_email_prepare_requested",
      "supplier_orders",
      orderId,
      { provider: "gmail" },
    );

    if (Deno.env.get("GMAIL_SEND_ENABLED") !== "true") {
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "send-supplier-email",
        "blocked",
        "supplier_email_prepared",
        {
          orderId,
          provider: "gmail",
          sent: false,
          reason: "live_sending_disabled",
        },
      );
      terminalContext = null;
      return jsonResponse(
        {
          status: "live_sending_disabled",
          message: "Live Gmail sending is disabled for this environment.",
        },
        503,
      );
    }

    const oauthConfig = googleOAuthConfig();
    if (!oauthConfig) {
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "send-supplier-email",
        "blocked",
        "supplier_email_blocked",
        { orderId, provider: "gmail", reason: "server_configuration_missing" },
      );
      terminalContext = null;
      return jsonResponse(
        {
          status: "server_configuration_missing",
          message: "Gmail sending is not configured for this environment.",
        },
        503,
      );
    }

    const { data: claimData, error: claimError } = await securitySupabase.rpc(
      "service_claim_supplier_email_send",
      {
        p_actor_user_id: user.id,
        p_restaurant_id: restaurantId,
        p_order_id: orderId,
        p_idempotency_key: orderId,
        p_rfc_message_id: gmailMessageId(
          orderId,
          Deno.env.get("GMAIL_MESSAGE_ID_DOMAIN") ?? "mail.mise.app",
        ),
      },
    );
    if (claimError) throw claimError;

    if (!isClaimedSupplierEmail(claimData)) {
      const response = claimOutcomeResponse(claimData);
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "send-supplier-email",
        response.eventType,
        response.action,
        { orderId, provider: "gmail", outcome: response.outcome },
      );
      terminalContext = null;
      return jsonResponse(response.body, response.status);
    }
    const claim = claimData;

    let tokens;
    try {
      tokens = await refreshGoogleAccessToken(oauthConfig, claim.refreshToken);
      if (tokens.refreshToken) {
        const { error: rotationError } = await securitySupabase.rpc(
          "service_rotate_gmail_refresh_token",
          {
            p_actor_user_id: user.id,
            p_restaurant_id: restaurantId,
            p_credential_id: claim.credentialId,
            p_credential_material: tokens.refreshToken,
          },
        );
        if (rotationError) throw rotationError;
      }
    } catch (error) {
      const providerError = error instanceof GoogleProviderError ? error : null;
      await failDelivery(
        securitySupabase,
        user.id,
        restaurantId,
        orderId,
        claim.claimToken,
        "rejected",
        providerError?.safeCode ?? "gmail_refresh_failed",
      );
      if (providerError?.disposition === "reauthorize") {
        await markConnectionState(
          securitySupabase,
          user.id,
          restaurantId,
          "needs_reauth",
          providerError.safeCode,
        );
      }
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "send-supplier-email",
        providerError?.disposition === "reauthorize" ? "blocked" : "error",
        "supplier_email_refresh_failed",
        {
          orderId,
          provider: "gmail",
          reason: providerError?.safeCode ?? "gmail_refresh_failed",
        },
      );
      terminalContext = null;
      return jsonResponse(
        providerError?.disposition === "reauthorize"
          ? {
              status: "needs_reauth",
              message: "Reconnect Gmail before sending this order.",
            }
          : {
              status: "provider_unavailable",
              message: "Gmail is temporarily unavailable. No email was sent.",
            },
        providerError?.disposition === "reauthorize" ? 409 : 502,
      );
    }

    const rawMessage = buildGmailRawMessage({
      from: claim.from,
      to: claim.to,
      subject: claim.subject,
      textBody: claim.body,
      messageId: claim.rfcMessageId,
    });

    let providerMessage;
    try {
      providerMessage = await sendGmailMessage(tokens.accessToken, rawMessage);
    } catch (error) {
      const providerError = error instanceof GoogleProviderError ? error : null;
      const ambiguous =
        !providerError || providerError.disposition === "ambiguous";
      const safeCode = providerError?.safeCode ?? "gmail_send_network_unknown";
      await failDelivery(
        securitySupabase,
        user.id,
        restaurantId,
        orderId,
        claim.claimToken,
        ambiguous ? "unknown" : "rejected",
        safeCode,
      );
      if (providerError?.disposition === "reauthorize") {
        await markConnectionState(
          securitySupabase,
          user.id,
          restaurantId,
          "needs_reauth",
          safeCode,
        );
      } else if (providerError?.status === 403) {
        await markConnectionState(
          securitySupabase,
          user.id,
          restaurantId,
          "restricted",
          safeCode,
        );
      }
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "send-supplier-email",
        ambiguous ? "error" : "blocked",
        ambiguous
          ? "supplier_email_outcome_unknown"
          : "supplier_email_rejected",
        { orderId, provider: "gmail", reason: safeCode },
      );
      terminalContext = null;
      return jsonResponse(
        ambiguous
          ? {
              status: "delivery_requires_review",
              message:
                "Gmail did not return a definitive result. Mise will not retry automatically to avoid a duplicate email.",
            }
          : {
              status: "provider_rejected",
              message:
                "Gmail rejected the email. Review the connection and try again.",
            },
        ambiguous ? 409 : 502,
      );
    }

    const { data: completion, error: completionError } =
      await securitySupabase.rpc("service_complete_supplier_email_send", {
        p_actor_user_id: user.id,
        p_restaurant_id: restaurantId,
        p_order_id: orderId,
        p_claim_token: claim.claimToken,
        p_provider_message_id: providerMessage.id,
      });
    if (completionError) {
      try {
        await failDelivery(
          securitySupabase,
          user.id,
          restaurantId,
          orderId,
          claim.claimToken,
          "unknown",
          "database_finalize_failed",
        );
      } catch {
        // A stale sending claim becomes review-only; it is never auto-retried.
      }
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "send-supplier-email",
        "error",
        "supplier_email_finalize_failed",
        { orderId, provider: "gmail", reason: "database_finalize_failed" },
      );
      terminalContext = null;
      return jsonResponse(
        {
          status: "delivery_requires_review",
          message:
            "Gmail accepted the email, but Mise could not finalize the order. Do not resend; review the delivery.",
        },
        409,
      );
    }

    await recordFunctionSecurityEvent(
      securitySupabase,
      user.id,
      reservation.reservation_id!,
      restaurantId,
      "send-supplier-email",
      "completed",
      "supplier_email_sent",
      { orderId, provider: "gmail", providerMessageId: providerMessage.id },
    );
    terminalContext = null;
    return jsonResponse({
      status: "sent",
      outcome: completion?.outcome ?? "applied",
      providerMessageId: providerMessage.id,
      order: completion?.order ?? null,
      orderedRecommendations: completion?.ordered_recommendations ?? [],
    });
  } catch (error) {
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

function googleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

function isClaimedSupplierEmail(value: unknown): value is ClaimedSupplierEmail {
  if (!value || typeof value !== "object") return false;
  const claim = value as Record<string, unknown>;
  return (
    claim.outcome === "claimed" &&
    [
      "claimToken",
      "credentialId",
      "refreshToken",
      "from",
      "to",
      "subject",
      "body",
      "rfcMessageId",
    ].every(
      (key) =>
        typeof claim[key] === "string" && (claim[key] as string).length > 0,
    )
  );
}

function claimOutcomeResponse(value: unknown) {
  const outcome =
    value &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).outcome === "string"
      ? String((value as Record<string, unknown>).outcome)
      : "claim_failed";
  if (outcome === "already_sent") {
    return {
      outcome,
      eventType: "completed" as const,
      action: "supplier_email_already_sent",
      status: 200,
      body: {
        status: "sent",
        outcome: "already_sent",
        providerMessageId:
          (value as Record<string, unknown>).providerMessageId ?? null,
      },
    };
  }
  if (outcome === "in_progress") {
    return {
      outcome,
      eventType: "blocked" as const,
      action: "supplier_email_in_progress",
      status: 409,
      body: {
        status: "in_progress",
        message: "This supplier email is already being sent.",
      },
    };
  }
  if (outcome === "requires_review") {
    return {
      outcome,
      eventType: "blocked" as const,
      action: "supplier_email_review_required",
      status: 409,
      body: {
        status: "delivery_requires_review",
        message:
          "Review the prior delivery before sending again to avoid a duplicate email.",
      },
    };
  }
  if (outcome === "provider_not_enabled") {
    return {
      outcome,
      eventType: "blocked" as const,
      action: "supplier_email_provider_disabled",
      status: 503,
      body: {
        status: "provider_not_enabled",
        message:
          "Supplier email delivery is disabled for this restaurant. Copy or export the approved draft and send it outside Mise.",
      },
    };
  }
  if (
    outcome === "supplier_email_missing" ||
    outcome === "supplier_email_invalid"
  ) {
    return {
      outcome,
      eventType: "blocked" as const,
      action: "supplier_email_blocked",
      status: 409,
      body: {
        status: outcome,
        message: "Add a valid supplier email before sending this order.",
      },
    };
  }
  return {
    outcome,
    eventType: "blocked" as const,
    action: "supplier_email_blocked",
    status: 409,
    body: {
      status: "gmail_not_connected",
      message: "Connect or reconnect Gmail before sending this order.",
    },
  };
}

async function failDelivery(
  securitySupabase: {
    rpc: (
      name: string,
      params: Record<string, unknown>,
    ) => PromiseLike<{ error: unknown }>;
  },
  actorUserId: string,
  restaurantId: string,
  orderId: string,
  claimToken: string,
  outcome: "rejected" | "unknown",
  errorCode: string,
) {
  const { error } = await securitySupabase.rpc(
    "service_fail_supplier_email_send",
    {
      p_actor_user_id: actorUserId,
      p_restaurant_id: restaurantId,
      p_order_id: orderId,
      p_claim_token: claimToken,
      p_outcome: outcome,
      p_error_code: safeErrorCode(errorCode),
    },
  );
  if (error) throw error;
}

async function markConnectionState(
  securitySupabase: {
    rpc: (
      name: string,
      params: Record<string, unknown>,
    ) => PromiseLike<{ error: unknown }>;
  },
  actorUserId: string,
  restaurantId: string,
  status: "needs_reauth" | "restricted",
  errorCode: string,
) {
  const { error } = await securitySupabase.rpc(
    "service_mark_gmail_connection_state",
    {
      p_actor_user_id: actorUserId,
      p_restaurant_id: restaurantId,
      p_status: status,
      p_error_code: safeErrorCode(errorCode),
    },
  );
  if (error) throw error;
}

function safeErrorCode(value: string) {
  return /^[a-z0-9_]{1,80}$/u.test(value) ? value : "provider_request_failed";
}

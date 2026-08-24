import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  buildGmailRawMessage,
  gmailMessageId,
  type GoogleOAuthConfig,
  GoogleProviderError,
  refreshGoogleAccessToken,
  sendGmailMessage,
} from "../_shared/gmail.ts";
import {
  firewallBlockedResponse,
  handleError,
  type InvocationTerminalContext,
  jsonResponse,
  optionsResponse,
  readJsonObject,
  recordFunctionAuditLog,
  recordFunctionSecurityEvent,
  recordFunctionTerminalError,
  requireAuthenticatedContext,
  requireRestaurantRole,
  requireUuid,
  reserveFunctionInvocation,
} from "../_shared/mise.ts";

interface ClaimedSupplierEmailBase {
  outcome: "claimed";
  claimToken: string;
  credentialId: string;
  credentialGeneration: number;
  refreshToken: string;
  contentFingerprint: string;
  authorityVersion: "mise.purchase_authority.v1";
  authorityFingerprint: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  rfcMessageId: string;
}

interface LegacyClaimedSupplierEmail extends ClaimedSupplierEmailBase {
  contentVersion: "mise.supplier_send.v1";
  supplierId?: null;
}

interface ClaimedSupplierEmailV2 extends ClaimedSupplierEmailBase {
  contentVersion: "mise.supplier_send.v2";
  supplierId: string;
}

// New claims are v2 and bind a durable supplier UUID. The v1 branch exists
// only so an immutable claim created before MISE-003C can reach its original
// terminal outcome; it cannot be upgraded by fabricating a supplier identity.
type ClaimedSupplierEmail =
  | LegacyClaimedSupplierEmail
  | ClaimedSupplierEmailV2;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/u;
const EMAIL_PATTERN =
  /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
const SAFE_CODE_PATTERN = /^[a-z0-9_]{1,80}$/u;
const MAX_BLOCKER_CODES = 20;
const MAX_EMAIL_BODY_BYTES = 64 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let terminalContext: InvocationTerminalContext | null = null;
  let actionFailureContext: {
    securitySupabase: SupabaseClient;
    actorUserId: string;
    restaurantId: string;
    orderId: string;
  } | null = null;
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

    // Observe durable delivery state before deployment/configuration gates so
    // a replay can always return sent, in-progress, or review-required truth
    // without creating a second provider attempt.
    const { data: observationData, error: observationError } =
      await securitySupabase.rpc("service_observe_supplier_email_send", {
        p_actor_user_id: user.id,
        p_restaurant_id: restaurantId,
        p_order_id: orderId,
      });
    if (observationError) throw observationError;
    if (supplierSendOutcome(observationData) !== "claim_required") {
      const response = claimOutcomeResponse(observationData);
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

    actionFailureContext = {
      securitySupabase,
      actorUserId: user.id,
      restaurantId,
      orderId,
    };

    if (Deno.env.get("GMAIL_SEND_ENABLED") !== "true") {
      await recordMiseActionFailure(
        securitySupabase,
        user.id,
        restaurantId,
        orderId,
        "failed",
        "live_sending_disabled",
        "Supplier order sending is disabled for this environment.",
      );
      actionFailureContext = null;
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
          blockerCodes: ["live_sending_disabled"],
          message: "Live Gmail sending is disabled for this environment.",
        },
        503,
      );
    }

    const oauthConfig = googleOAuthConfig();
    if (!oauthConfig) {
      await recordMiseActionFailure(
        securitySupabase,
        user.id,
        restaurantId,
        orderId,
        "failed",
        "server_configuration_missing",
        "Supplier order sending is not configured for this environment.",
      );
      actionFailureContext = null;
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
          blockerCodes: ["server_configuration_missing"],
          message: "Gmail sending is not configured for this environment.",
        },
        503,
      );
    }

    const requestedMessageId = gmailMessageId(
      orderId,
      Deno.env.get("GMAIL_MESSAGE_ID_DOMAIN") ?? "mail.mise.app",
    );
    const { data: claimData, error: claimError } = await securitySupabase.rpc(
      "service_claim_supplier_email_send",
      {
        p_actor_user_id: user.id,
        p_restaurant_id: restaurantId,
        p_order_id: orderId,
        p_idempotency_key: orderId,
        p_rfc_message_id: requestedMessageId,
      },
    );
    if (claimError) throw claimError;

    if (supplierSendOutcome(claimData) !== "claimed") {
      const response = claimOutcomeResponse(claimData);
      if (shouldRecordPreClaimFailure(response.outcome)) {
        await recordMiseActionFailure(
          securitySupabase,
          user.id,
          restaurantId,
          orderId,
          response.outcome === "requires_review" ? "unverified" : "failed",
          safeErrorCode(response.outcome),
          "message" in response.body &&
            typeof response.body.message === "string"
            ? response.body.message
            : "Supplier order sending could not continue.",
        );
      }
      actionFailureContext = null;
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

    // From here onward the database owns an active claim. Its fail RPC also
    // updates the action atomically, so the generic pre-claim failure writer
    // must never race or overwrite that token-fenced result.
    actionFailureContext = null;
    if (!isClaimedSupplierEmail(claimData, requestedMessageId)) {
      const claimToken = claimedTokenForFailure(claimData);
      if (claimToken) {
        await failDelivery(
          securitySupabase,
          user.id,
          restaurantId,
          orderId,
          claimToken,
          "rejected",
          "claimed_snapshot_invalid",
        );
      }
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "send-supplier-email",
        claimToken ? "blocked" : "error",
        "supplier_email_claim_invalid",
        { orderId, provider: "gmail", reason: "claimed_snapshot_invalid" },
      );
      terminalContext = null;
      return jsonResponse(
        claimToken
          ? {
            status: "send_content_unapproved",
            blockerCodes: ["send_content_invalid"],
            message:
              "The claimed supplier email was invalid. Review the current email again before sending.",
          }
          : {
            status: "delivery_requires_review",
            blockerCodes: ["delivery_requires_review"],
            message:
              "Mise could not safely verify the delivery claim. Review it before trying again.",
          },
        409,
      );
    }
    const claim = claimData;

    let tokens;
    try {
      tokens = await refreshGoogleAccessToken(oauthConfig, claim.refreshToken);
      if (!isOpaqueCredential(tokens.accessToken)) {
        throw new GoogleProviderError(
          "provider_response_invalid",
          "rejected",
          502,
        );
      }
      if (tokens.refreshToken) {
        const { error: rotationError } = await securitySupabase.rpc(
          "service_rotate_gmail_refresh_token",
          {
            p_actor_user_id: user.id,
            p_restaurant_id: restaurantId,
            p_credential_id: claim.credentialId,
            p_expected_credential_generation: claim.credentialGeneration,
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
            blockerCodes: ["needs_reauth"],
            message: "Reconnect Gmail before sending this order.",
          }
          : {
            status: "provider_unavailable",
            blockerCodes: ["provider_unavailable"],
            message: "Gmail is temporarily unavailable. No email was sent.",
          },
        providerError?.disposition === "reauthorize" ? 409 : 502,
      );
    }

    let rawMessage: string;
    try {
      // The MIME payload is derived only from the immutable database claim.
      // No mutable order, recipient, or sender state is re-read here.
      rawMessage = buildGmailRawMessage({
        from: claim.from,
        to: claim.to,
        subject: claim.subject,
        textBody: claim.body,
        messageId: claim.rfcMessageId,
      });
    } catch {
      await failDelivery(
        securitySupabase,
        user.id,
        restaurantId,
        orderId,
        claim.claimToken,
        "rejected",
        "claimed_snapshot_invalid",
      );
      await recordFunctionSecurityEvent(
        securitySupabase,
        user.id,
        reservation.reservation_id!,
        restaurantId,
        "send-supplier-email",
        "blocked",
        "supplier_email_claim_invalid",
        { orderId, provider: "gmail", reason: "claimed_snapshot_invalid" },
      );
      terminalContext = null;
      return jsonResponse(
        {
          status: "send_content_unapproved",
          blockerCodes: ["send_content_invalid"],
          message:
            "The claimed supplier email could not be encoded safely. Review the current email again before sending.",
        },
        409,
      );
    }

    let providerMessage;
    try {
      providerMessage = await sendGmailMessage(tokens.accessToken, rawMessage);
    } catch (error) {
      const providerError = error instanceof GoogleProviderError ? error : null;
      const ambiguous = !providerError ||
        providerError.disposition === "ambiguous";
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
            blockerCodes: ["delivery_requires_review"],
            message:
              "Gmail did not return a definitive result. Mise will not retry automatically to avoid a duplicate email.",
          }
          : {
            status: "provider_rejected",
            blockerCodes: ["provider_rejected"],
            message:
              "Gmail rejected the email. Review the connection and try again.",
          },
        ambiguous ? 409 : 502,
      );
    }

    const { data: completion, error: completionError } = await securitySupabase
      .rpc("service_complete_supplier_email_send", {
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
          blockerCodes: ["delivery_requires_review"],
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
      sentToPreviouslyClaimedRecipient:
        completion?.externalIdentityChangedDuringClaim === true,
      order: completion?.order ?? null,
      orderedRecommendations: completion?.ordered_recommendations ?? [],
    });
  } catch (error) {
    if (isPostgresSerializationFailure(error)) {
      await recordFunctionTerminalError(terminalContext);
      return jsonResponse(
        {
          status: "request_blocked",
          blockerCodes: ["send_verification_race"],
          message:
            "Mise could not verify the current supplier email because its identity changed concurrently. Refresh and try again.",
        },
        409,
      );
    }
    if (actionFailureContext) {
      await recordMiseActionFailure(
        actionFailureContext.securitySupabase,
        actionFailureContext.actorUserId,
        actionFailureContext.restaurantId,
        actionFailureContext.orderId,
        "failed",
        "supplier_email_unexpected_failure",
        "The supplier order was not sent because the delivery workflow failed.",
      );
    }
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

async function recordMiseActionFailure(
  securitySupabase: SupabaseClient,
  actorUserId: string,
  restaurantId: string,
  orderId: string,
  failureStatus: "failed" | "unverified",
  errorCode: string,
  errorMessage: string,
) {
  try {
    await securitySupabase.rpc("service_record_mise_action_failure", {
      p_actor_user_id: actorUserId,
      p_restaurant_id: restaurantId,
      p_supplier_order_id: orderId,
      p_failure_status: failureStatus,
      p_error_code: safeErrorCode(errorCode),
      p_error_message: errorMessage.slice(0, 1000),
    });
  } catch {
    // The original provider result remains authoritative. Security telemetry
    // below still captures the terminal failure if public activity persistence
    // is temporarily unavailable.
  }
}

function googleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

function supplierSendOutcome(value: unknown) {
  const outcome = value &&
      typeof value === "object" &&
      typeof (value as Record<string, unknown>).outcome === "string"
    ? String((value as Record<string, unknown>).outcome)
    : "";
  return SAFE_CODE_PATTERN.test(outcome) ? outcome : "claim_failed";
}

function isClaimedSupplierEmail(
  value: unknown,
  expectedMessageId: string,
): value is ClaimedSupplierEmail {
  if (!value || typeof value !== "object") return false;
  const claim = value as Record<string, unknown>;
  return claim.outcome === "claimed" &&
    isCanonicalUuid(claim.claimToken) &&
    isCanonicalUuid(claim.credentialId) &&
    typeof claim.credentialGeneration === "number" &&
    Number.isSafeInteger(claim.credentialGeneration) &&
    claim.credentialGeneration > 0 &&
    isOpaqueCredential(claim.refreshToken) &&
    (
      (
        claim.contentVersion === "mise.supplier_send.v1" &&
        (claim.supplierId === undefined || claim.supplierId === null)
      ) ||
      (
        claim.contentVersion === "mise.supplier_send.v2" &&
        isCanonicalUuid(claim.supplierId)
      )
    ) &&
    typeof claim.contentFingerprint === "string" &&
    SHA256_HEX_PATTERN.test(claim.contentFingerprint) &&
    claim.authorityVersion === "mise.purchase_authority.v1" &&
    typeof claim.authorityFingerprint === "string" &&
    SHA256_HEX_PATTERN.test(claim.authorityFingerprint) &&
    isCanonicalEmail(claim.from) &&
    isCanonicalEmail(claim.to) &&
    isCanonicalSubject(claim.subject) &&
    isBoundedBody(claim.body) &&
    typeof claim.rfcMessageId === "string" &&
    claim.rfcMessageId === expectedMessageId &&
    claim.rfcMessageId.length <= 512 &&
    /^<[^<>\s@]+@[^<>\s@]+>$/u.test(claim.rfcMessageId);
}

function claimedTokenForFailure(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const token = (value as Record<string, unknown>).claimToken;
  return isCanonicalUuid(token) ? token : null;
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isCanonicalEmail(value: unknown): value is string {
  return typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 254 &&
    value === value.trim() &&
    value === value.toLowerCase() &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    EMAIL_PATTERN.test(value);
}

function isCanonicalSubject(value: unknown): value is string {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 500 &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

function isBoundedBody(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const byteLength = new TextEncoder().encode(value).byteLength;
  return byteLength >= 1 && byteLength <= MAX_EMAIL_BODY_BYTES;
}

function isOpaqueCredential(value: unknown): value is string {
  return typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 4096 &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

function claimOutcomeResponse(value: unknown) {
  const outcome = supplierSendOutcome(value);
  if (outcome === "already_sent") {
    return {
      outcome,
      eventType: "completed" as const,
      action: "supplier_email_already_sent",
      status: 200,
      body: {
        status: "sent",
        outcome: "already_sent",
        providerMessageId: boundedProviderMessageId(value),
        sentToPreviouslyClaimedRecipient:
          externalIdentityChangedDuringClaim(value),
      },
    };
  }
  if (outcome === "in_progress" || outcome === "send_in_progress") {
    return {
      outcome,
      eventType: "blocked" as const,
      action: "supplier_email_in_progress",
      status: 409,
      body: {
        status: "in_progress",
        blockerCodes: boundedBlockerCodes(value, ["send_in_progress"]),
        message: "This supplier email is already being sent.",
      },
    };
  }
  if (outcome === "requires_review" || outcome === "delivery_requires_review") {
    return {
      outcome,
      eventType: "blocked" as const,
      action: "supplier_email_review_required",
      status: 409,
      body: {
        status: "delivery_requires_review",
        blockerCodes: boundedBlockerCodes(value, [
          "delivery_requires_review",
        ]),
        message:
          "Review the prior delivery before sending again to avoid a duplicate email.",
      },
    };
  }
  if (outcome === "approval_required") {
    return {
      outcome,
      eventType: "blocked" as const,
      action: "supplier_email_approval_required",
      status: 409,
      body: {
        status: "approval_required",
        blockerCodes: boundedBlockerCodes(value, [
          "send_content_unapproved",
        ]),
        message:
          "Review the exact current supplier email, then approve it again before sending.",
      },
    };
  }
  if (
    outcome === "send_content_unapproved" ||
    outcome === "send_content_changed" ||
    outcome === "send_content_invalid" ||
    outcome === "send_content_too_large"
  ) {
    const changed = outcome === "send_content_changed";
    const tooLarge = outcome === "send_content_too_large";
    return {
      outcome,
      eventType: "blocked" as const,
      action: changed
        ? "supplier_email_content_changed"
        : "supplier_email_content_unapproved",
      status: 409,
      body: {
        status: changed ? "send_content_changed" : "send_content_unapproved",
        blockerCodes: boundedBlockerCodes(value, [outcome]),
        message: tooLarge
          ? "This supplier email is too large to send. Reduce the order content and review it again."
          : changed
          ? "This order changed after it was reviewed. Review the current email again."
          : "Review and approve the exact current supplier email before sending.",
      },
    };
  }
  if (
    outcome === "purchase_authority_stale" ||
    outcome === "draft_authority_incomplete"
  ) {
    return {
      outcome,
      eventType: "blocked" as const,
      action: "supplier_email_purchase_authority_blocked",
      status: 409,
      body: {
        status: outcome,
        blockerCodes: boundedBlockerCodes(value, [outcome]),
        message:
          "Inventory or sales evidence changed after this order was approved. Review the blocked purchasing items before sending.",
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
        blockerCodes: boundedBlockerCodes(value, ["provider_not_enabled"]),
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
        blockerCodes: boundedBlockerCodes(value, [outcome]),
        message: "Add a valid supplier email before sending this order.",
      },
    };
  }
  if (outcome === "gmail_not_connected") {
    return {
      outcome,
      eventType: "blocked" as const,
      action: "supplier_email_blocked",
      status: 409,
      body: {
        status: "gmail_not_connected",
        blockerCodes: boundedBlockerCodes(value, ["gmail_not_connected"]),
        message: "Connect or reconnect Gmail before sending this order.",
      },
    };
  }
  return {
    outcome,
    eventType: "error" as const,
    action: "supplier_email_claim_failed",
    status: 502,
    body: {
      status: "request_blocked",
      blockerCodes: ["request_blocked"],
      message: "Mise could not establish a safe supplier email claim.",
    },
  };
}

function shouldRecordPreClaimFailure(outcome: string) {
  return ![
    "already_sent",
    "in_progress",
    "send_in_progress",
    "requires_review",
    "delivery_requires_review",
    "approval_required",
    "send_content_unapproved",
    "send_content_changed",
    "send_content_invalid",
    "send_content_too_large",
    "purchase_authority_stale",
    "draft_authority_incomplete",
  ].includes(outcome);
}

function boundedBlockerCodes(value: unknown, requiredCodes: string[] = []) {
  const rawCodes = value && typeof value === "object" &&
      Array.isArray((value as Record<string, unknown>).blockerCodes)
    ? (value as Record<string, unknown>).blockerCodes as unknown[]
    : [];
  const bounded: string[] = [];
  for (const candidate of [...requiredCodes, ...rawCodes]) {
    if (
      typeof candidate === "string" &&
      SAFE_CODE_PATTERN.test(candidate) &&
      !bounded.includes(candidate)
    ) {
      bounded.push(candidate);
      if (bounded.length === MAX_BLOCKER_CODES) break;
    }
  }
  return bounded;
}

function boundedProviderMessageId(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const providerMessageId = (value as Record<string, unknown>)
    .providerMessageId;
  return typeof providerMessageId === "string" &&
      providerMessageId.length >= 1 &&
      providerMessageId.length <= 512 &&
      !/[\u0000-\u001f\u007f]/u.test(providerMessageId)
    ? providerMessageId
    : null;
}

function externalIdentityChangedDuringClaim(value: unknown) {
  return Boolean(
    value && typeof value === "object" &&
      (value as Record<string, unknown>).externalIdentityChangedDuringClaim === true,
  );
}

function isPostgresSerializationFailure(error: unknown) {
  return error && typeof error === "object" &&
      (error as Record<string, unknown>).code === "40001";
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
  return SAFE_CODE_PATTERN.test(value) ? value : "provider_request_failed";
}

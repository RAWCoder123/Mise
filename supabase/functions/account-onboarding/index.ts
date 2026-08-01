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
  requireEnum,
  requireString,
  reserveUserScopedFunctionInvocation,
  type UserScopedInvocationTerminalContext
} from "../_shared/mise.ts";

const actions = ["create_restaurant_with_owner", "claim_restaurant_member_invite"] as const;
type AccountOnboardingAction = (typeof actions)[number];

async function serviceRpc<T>(
  securitySupabase: Awaited<ReturnType<typeof requireAuthenticatedContext>>["securitySupabase"],
  functionName: string,
  args: Record<string, unknown>
): Promise<T> {
  const { data, error } = await securitySupabase.rpc(functionName, args);
  if (error) throw error;
  return data as T;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let terminalContext: UserScopedInvocationTerminalContext | null = null;
  try {
    const { securitySupabase, user } = await requireAuthenticatedContext(req);
    const body = await readJsonObject(req);
    const action = requireEnum(body.action, "action", actions);

    const reservation = await reserveUserScopedFunctionInvocation(
      securitySupabase,
      user.id,
      "account-onboarding",
      action
    );
    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      functionName: "account-onboarding"
    };

    let result: unknown;
    if (action === "create_restaurant_with_owner") {
      const name = requireString(body.name, "name");
      const cuisineType =
        typeof body.cuisineType === "string" ? body.cuisineType.trim() : null;
      result = await serviceRpc(securitySupabase, "service_create_restaurant_with_owner", {
        p_actor_user_id: user.id,
        restaurant_name: name,
        restaurant_cuisine_type: cuisineType || null
      });
    } else {
      const claimToken = requireString(body.claimToken, "claimToken").toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(claimToken)) {
        throw new HttpError(400, "Invite token is invalid.");
      }
      result = await serviceRpc(securitySupabase, "service_claim_restaurant_member_invite", {
        p_actor_user_id: user.id,
        p_claim_token: claimToken
      });
    }

    await recordUserScopedFunctionSecurityEvent(
      securitySupabase,
      user.id,
      reservation.reservation_id!,
      "account-onboarding",
      "completed",
      action,
      {
        result_entity:
          action === "create_restaurant_with_owner" ? "restaurants" : "restaurant_memberships"
      }
    );

    return jsonResponse({
      status: "completed",
      action,
      result
    });
  } catch (error) {
    await recordUserScopedFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

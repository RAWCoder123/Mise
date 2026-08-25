const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REASON_PATTERN = /^[a-z0-9_]{3,64}$/;

export const PILOT_CONTROL_ACTIONS = [
  "status",
  "enable-square-sync",
  "enable-square-webhooks",
  "enable-order-drafting",
  "enable-gmail-delivery",
  "disable-square",
  "disable-order-drafting",
  "disable-gmail-delivery",
  "disable-external",
  "pause-integrations",
  "resume-normal"
];

export function normalizePilotControlRequest(input) {
  const restaurantId = String(input.restaurantId ?? "").trim().toLowerCase();
  const action = String(input.action ?? "status").trim();
  if (!UUID_PATTERN.test(restaurantId)) {
    throw new Error("A valid restaurant UUID is required.");
  }
  if (!PILOT_CONTROL_ACTIONS.includes(action)) {
    throw new Error(`Unsupported pilot control action: ${action || "<empty>"}.`);
  }
  return { restaurantId, action };
}

export function normalizePilotControlMutationRequest(input) {
  const base = normalizePilotControlRequest(input);
  if (base.action === "status") {
    throw new Error("Status is read-only and does not accept mutation authority.");
  }
  const requestId = String(input.requestId ?? "").trim().toLowerCase();
  const actorUserId = String(input.actorUserId ?? "").trim().toLowerCase();
  const defaultReason = base.action.replaceAll("-", "_");
  const reasonCode = String(input.reasonCode ?? defaultReason).trim().toLowerCase();
  if (!UUID_PATTERN.test(requestId)) {
    throw new Error("A stable RFC 4122 request UUID is required for applied pilot controls.");
  }
  if (!UUID_PATTERN.test(actorUserId)) {
    throw new Error("A valid attributable actor user UUID is required for applied pilot controls.");
  }
  if (!REASON_PATTERN.test(reasonCode)) {
    throw new Error("Pilot control reason must be a 3-64 character lowercase code.");
  }
  return { ...base, requestId, actorUserId, reasonCode };
}

export function plannedPilotControlMutations(action) {
  switch (action) {
    case "status":
      return [];
    case "enable-square-sync":
      return ["atomic:system.square_sync=on+restaurant.square_sync=on"];
    case "enable-square-webhooks":
      return ["atomic:system.square=on+restaurant.square=on"];
    case "enable-order-drafting":
      return ["atomic:system.drafting=draft_only+restaurant.drafting=draft_only"];
    case "enable-gmail-delivery":
      return ["atomic:system.gmail_delivery=on+restaurant.gmail_delivery=on"];
    case "disable-square":
      return ["atomic:restaurant.square=off"];
    case "disable-order-drafting":
      return ["atomic:restaurant.drafting=off"];
    case "disable-gmail-delivery":
      return ["atomic:restaurant.gmail_delivery=off"];
    case "disable-external":
      return ["atomic:restaurant.external_controls=off"];
    case "pause-integrations":
      return ["atomic:system.operational_mode=integrations_paused"];
    case "resume-normal":
      return ["atomic:system.operational_mode=normal"];
    default:
      throw new Error(`Unsupported pilot control action: ${action}.`);
  }
}

/**
 * Read-only status may use ordinary service reads. Every mutation crosses one
 * database RPC that owns locking, provider preconditions, both control writes,
 * actor verification, replay handling, and immutable audit evidence.
 */
export async function executePilotControlAction(request, operations) {
  const normalized = normalizePilotControlRequest(request);
  if (normalized.action === "status") {
    const state = await operations.fetchState(normalized.restaurantId);
    assertState(normalized.restaurantId, state);
    return {
      restaurantId: normalized.restaurantId,
      action: normalized.action,
      mutations: [],
      state: summarizePilotControlState(state)
    };
  }

  const mutation = normalizePilotControlMutationRequest(request);
  const applied = await operations.applyControl(mutation);
  assertAppliedResult(mutation, applied);
  return {
    restaurantId: mutation.restaurantId,
    actorUserId: mutation.actorUserId,
    requestId: mutation.requestId,
    auditId: applied.auditId,
    outcome: applied.outcome,
    changed: applied.changed,
    action: mutation.action,
    reasonCode: mutation.reasonCode,
    mutations: plannedPilotControlMutations(mutation.action),
    state: summarizePilotControlState(applied.state)
  };
}

export function summarizePilotControlState(state) {
  return {
    operationalMode: state.system.operational_mode,
    square: {
      systemSync: state.system.square_sync_enabled,
      systemWebhooks: state.system.square_webhooks_enabled,
      restaurantSync: state.restaurant.square_sync_enabled,
      restaurantWebhooks: state.restaurant.square_webhooks_enabled,
      connected: state.square.connected,
      activeLocations: Number(state.square.activeLocations)
    },
    drafting: {
      systemEnabled: state.system.order_drafting_enabled,
      systemPolicy: state.system.ordering_policy,
      restaurantEnabled: state.restaurant.order_drafting_enabled,
      restaurantPolicy: state.restaurant.ordering_policy
    },
    gmail: {
      systemEnabled: state.system.gmail_delivery_enabled,
      restaurantEnabled: state.restaurant.gmail_delivery_enabled,
      connected: state.gmail.connected,
      senderVerified: state.gmail.senderVerified,
      configuredRecipients: Number(state.gmail.configuredRecipients)
    }
  };
}

function assertState(restaurantId, state) {
  if (!state?.system || state.system.singleton !== true) {
    throw new Error("System operational controls are unavailable.");
  }
  if (!state?.restaurant || state.restaurant.restaurant_id !== restaurantId) {
    throw new Error("Restaurant operational controls are unavailable or mismatched.");
  }
  if (!state.square || !state.gmail) {
    throw new Error("Provider readiness state is unavailable.");
  }
}

function assertAppliedResult(request, result) {
  if (!result || !["applied", "already_applied"].includes(result.outcome)) {
    throw new Error("Pilot control RPC returned an invalid outcome.");
  }
  if (!UUID_PATTERN.test(String(result.auditId ?? ""))) {
    throw new Error("Pilot control RPC returned no durable audit identity.");
  }
  if (result.requestId !== request.requestId || result.restaurantId !== request.restaurantId) {
    throw new Error("Pilot control RPC returned mismatched request authority.");
  }
  if (result.actorUserId !== request.actorUserId || result.action !== request.action) {
    throw new Error("Pilot control RPC returned mismatched actor or action authority.");
  }
  if (result.reasonCode !== request.reasonCode) {
    throw new Error("Pilot control RPC returned mismatched reason authority.");
  }
  assertState(request.restaurantId, result.state);
  assertApplied(request.action, result.state);
}

function assertApplied(action, state) {
  const system = state.system;
  const restaurant = state.restaurant;
  const applied = {
    "enable-square-sync": system.square_sync_enabled && restaurant.square_sync_enabled,
    "enable-square-webhooks": system.square_sync_enabled && system.square_webhooks_enabled &&
      restaurant.square_sync_enabled && restaurant.square_webhooks_enabled,
    "enable-order-drafting": system.order_drafting_enabled && system.ordering_policy === "draft_only" &&
      restaurant.order_drafting_enabled && restaurant.ordering_policy === "draft_only",
    "enable-gmail-delivery": system.gmail_delivery_enabled && restaurant.gmail_delivery_enabled,
    "disable-square": !restaurant.square_sync_enabled && !restaurant.square_webhooks_enabled,
    "disable-order-drafting": !restaurant.order_drafting_enabled && restaurant.ordering_policy === "off",
    "disable-gmail-delivery": !restaurant.gmail_delivery_enabled,
    "disable-external": !restaurant.square_sync_enabled && !restaurant.square_webhooks_enabled &&
      !restaurant.order_drafting_enabled && restaurant.ordering_policy === "off" &&
      !restaurant.gmail_delivery_enabled,
    "pause-integrations": system.operational_mode === "integrations_paused",
    "resume-normal": system.operational_mode === "normal"
  }[action];
  if (!applied) throw new Error(`Pilot control verification failed after ${action}.`);
}

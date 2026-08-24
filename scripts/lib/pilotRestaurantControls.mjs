const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function plannedPilotControlMutations(action) {
  switch (action) {
    case "status":
      return [];
    case "enable-square-sync":
      return ["system.square_sync=on", "restaurant.square_sync=on"];
    case "enable-square-webhooks":
      return [
        "system.square_sync=on",
        "system.square_webhooks=on",
        "restaurant.square_sync=on",
        "restaurant.square_webhooks=on"
      ];
    case "enable-order-drafting":
      return ["system.drafting=draft_only", "restaurant.drafting=draft_only"];
    case "enable-gmail-delivery":
      return ["system.gmail_delivery=on", "restaurant.gmail_delivery=on"];
    case "disable-square":
      return ["restaurant.square_sync=off", "restaurant.square_webhooks=off"];
    case "disable-order-drafting":
      return ["restaurant.drafting=off"];
    case "disable-gmail-delivery":
      return ["restaurant.gmail_delivery=off"];
    case "disable-external":
      return [
        "restaurant.square_sync=off",
        "restaurant.square_webhooks=off",
        "restaurant.drafting=off",
        "restaurant.gmail_delivery=off"
      ];
    case "pause-integrations":
      return ["system.operational_mode=integrations_paused"];
    case "resume-normal":
      return ["system.operational_mode=normal"];
    default:
      throw new Error(`Unsupported pilot control action: ${action}.`);
  }
}

/**
 * Executes founder-only pilot controls through injected service boundaries.
 * Enable actions open the system gate before the restaurant gate, so a failed
 * second write remains fail-closed. Restaurant disable actions close the
 * narrow tenant gate without changing any other restaurant.
 */
export async function executePilotControlAction(request, operations) {
  const normalized = normalizePilotControlRequest(request);
  const before = await operations.fetchState(normalized.restaurantId);
  assertState(normalized.restaurantId, before);
  assertEnablePreconditions(normalized.action, before);

  switch (normalized.action) {
    case "status":
      break;
    case "enable-square-sync":
      await operations.updateSystem({ square_sync_enabled: true });
      await operations.updateRestaurant(normalized.restaurantId, {
        square_sync_enabled: true
      });
      break;
    case "enable-square-webhooks":
      await operations.updateSystem({
        square_sync_enabled: true,
        square_webhooks_enabled: true
      });
      await operations.updateRestaurant(normalized.restaurantId, {
        square_sync_enabled: true,
        square_webhooks_enabled: true
      });
      break;
    case "enable-order-drafting":
      await operations.updateSystem({
        ordering_policy: "draft_only",
        order_drafting_enabled: true
      });
      await operations.updateRestaurant(normalized.restaurantId, {
        ordering_policy: "draft_only",
        order_drafting_enabled: true
      });
      break;
    case "enable-gmail-delivery":
      await operations.updateSystem({ gmail_delivery_enabled: true });
      await operations.updateRestaurant(normalized.restaurantId, {
        gmail_delivery_enabled: true
      });
      break;
    case "disable-square":
      await operations.updateRestaurant(normalized.restaurantId, {
        square_sync_enabled: false,
        square_webhooks_enabled: false
      });
      break;
    case "disable-order-drafting":
      await operations.updateRestaurant(normalized.restaurantId, {
        ordering_policy: "off",
        order_drafting_enabled: false
      });
      break;
    case "disable-gmail-delivery":
      await operations.updateRestaurant(normalized.restaurantId, {
        gmail_delivery_enabled: false
      });
      break;
    case "disable-external":
      await operations.updateRestaurant(normalized.restaurantId, {
        square_sync_enabled: false,
        square_webhooks_enabled: false,
        ordering_policy: "off",
        order_drafting_enabled: false,
        gmail_delivery_enabled: false
      });
      break;
    case "pause-integrations":
      await operations.setSystemMode("integrations_paused", "pilot_integrations_paused");
      break;
    case "resume-normal":
      await operations.setSystemMode("normal", "pilot_integrations_resumed");
      break;
  }

  const after = normalized.action === "status"
    ? before
    : await operations.fetchState(normalized.restaurantId);
  assertState(normalized.restaurantId, after);
  assertApplied(normalized.action, after);
  return {
    restaurantId: normalized.restaurantId,
    action: normalized.action,
    mutations: plannedPilotControlMutations(normalized.action),
    state: summarizePilotControlState(after)
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
      activeLocations: state.square.activeLocations
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
      configuredRecipients: state.gmail.configuredRecipients
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
}

function assertEnablePreconditions(action, state) {
  if (!action.startsWith("enable-")) return;
  if (state.system.operational_mode !== "normal") {
    throw new Error("System operational mode must be normal before enabling a pilot control.");
  }
  if (action === "enable-square-sync" || action === "enable-square-webhooks") {
    if (!state.square.connected || state.square.activeLocations < 1) {
      throw new Error("Square must be connected with at least one active location.");
    }
    if (!state.system.square_sync_enabled && state.otherEnabled.squareSync > 0) {
      throw new Error("Global Square enablement would activate another restaurant.");
    }
  }
  if (action === "enable-square-webhooks") {
    if (!state.system.square_webhooks_enabled && state.otherEnabled.squareWebhooks > 0) {
      throw new Error("Global Square webhook enablement would activate another restaurant.");
    }
  }
  if (action === "enable-order-drafting") {
    if (!state.system.order_drafting_enabled && state.otherEnabled.orderDrafting > 0) {
      throw new Error("Global drafting enablement would activate another restaurant.");
    }
  }
  if (action === "enable-gmail-delivery") {
    if (!state.gmail.connected || !state.gmail.senderVerified) {
      throw new Error("Gmail must be connected with a verified sender.");
    }
    if (state.gmail.configuredRecipients < 1) {
      throw new Error("At least one supplier recipient must be configured.");
    }
    if (!state.system.gmail_delivery_enabled && state.otherEnabled.gmailDelivery > 0) {
      throw new Error("Global Gmail enablement would activate another restaurant.");
    }
  }
}

function assertApplied(action, state) {
  const system = state.system;
  const restaurant = state.restaurant;
  const applied = {
    status: true,
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

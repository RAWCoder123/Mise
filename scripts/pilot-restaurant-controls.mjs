import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

import { assertProvisioningEnvironment } from "./lib/betaRestaurantProvisioning.mjs";
import {
  executePilotControlAction,
  normalizePilotControlRequest,
  PILOT_CONTROL_ACTIONS,
  plannedPilotControlMutations
} from "./lib/pilotRestaurantControls.mjs";
import { assertStagingPreflight } from "./staging-preflight.mjs";

const { values } = parseArgs({
  options: {
    action: { type: "string", default: "status" },
    "restaurant-id": { type: "string" },
    apply: { type: "boolean", default: false },
    "confirm-project-ref": { type: "string", default: "" },
    help: { type: "boolean", default: false }
  },
  strict: true,
  allowPositionals: false
});

if (values.help) {
  console.log(`Mise first-restaurant pilot controls

Dry-run a mutation (default):
  npm run pilot:controls -- --restaurant-id <uuid> --action enable-square-sync

Read current staging state:
  npm run pilot:controls -- --restaurant-id <uuid> --action status \\
    --confirm-project-ref <staging-project-ref>

Apply to hosted staging only:
  Add --apply --confirm-project-ref <staging-project-ref>

Actions:
  ${PILOT_CONTROL_ACTIONS.join("\n  ")}

Enable actions verify provider prerequisites and refuse to activate another
restaurant through a previously closed global gate. Disable actions close the
restaurant gate first. No credential value is printed.`);
  process.exit(0);
}

const request = normalizePilotControlRequest({
  restaurantId: values["restaurant-id"],
  action: values.action
});

if (!values.apply && request.action !== "status") {
  console.log(JSON.stringify({
    mode: "dry_run",
    target: "hosted_staging_only",
    restaurantId: request.restaurantId,
    action: request.action,
    mutations: plannedPilotControlMutations(request.action)
  }, null, 2));
  process.exit(0);
}

assertProvisioningEnvironment(
  { confirmProjectRef: values["confirm-project-ref"] },
  process.env
);
await assertStagingPreflight();

const admin = createClient(
  process.env.SUPABASE_STAGING_URL,
  process.env.SUPABASE_STAGING_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

try {
  const result = await executePilotControlAction(request, {
    fetchState,
    updateSystem,
    updateRestaurant,
    setSystemMode
  });
  console.log(JSON.stringify({ status: "verified", projectRef: process.env.SUPABASE_STAGING_PROJECT_REF, ...result }, null, 2));
} catch (error) {
  console.error(`Mise pilot control failed: ${safeErrorMessage(error)}`);
  process.exitCode = 1;
}

async function fetchState(restaurantId) {
  const [system, restaurant, integrations, locations, email, recipients, allRestaurants] = await Promise.all([
    admin.from("system_operational_controls").select("*").eq("singleton", true).single(),
    admin.from("restaurant_operational_controls").select("*").eq("restaurant_id", restaurantId).single(),
    admin.from("pos_integrations").select("id,status").eq("restaurant_id", restaurantId).eq("provider", "square"),
    admin.from("pos_locations").select("id,status").eq("restaurant_id", restaurantId).eq("status", "active"),
    admin.from("restaurant_email_connections").select("status,sender_email").eq("restaurant_id", restaurantId).eq("provider", "gmail").maybeSingle(),
    admin.from("supplier_recipients").select("id,email").eq("restaurant_id", restaurantId),
    admin.from("restaurant_operational_controls").select("restaurant_id,square_sync_enabled,square_webhooks_enabled,gmail_delivery_enabled,order_drafting_enabled")
  ]);
  for (const response of [system, restaurant, integrations, locations, email, recipients, allRestaurants]) {
    if (response.error) throw response.error;
  }
  const others = allRestaurants.data.filter((row) => row.restaurant_id !== restaurantId);
  return {
    system: system.data,
    restaurant: restaurant.data,
    square: {
      connected: integrations.data.some((row) => row.status === "connected"),
      activeLocations: locations.data.length
    },
    gmail: {
      connected: email.data?.status === "connected",
      senderVerified: Boolean(email.data?.sender_email?.trim()),
      configuredRecipients: recipients.data.filter((row) => Boolean(row.email?.trim())).length
    },
    otherEnabled: {
      squareSync: others.filter((row) => row.square_sync_enabled).length,
      squareWebhooks: others.filter((row) => row.square_webhooks_enabled).length,
      gmailDelivery: others.filter((row) => row.gmail_delivery_enabled).length,
      orderDrafting: others.filter((row) => row.order_drafting_enabled).length
    }
  };
}

async function updateSystem(patch) {
  const { error } = await admin.from("system_operational_controls")
    .update({ ...patch, updated_at: new Date().toISOString(), updated_by: null })
    .eq("singleton", true);
  if (error) throw error;
}

async function updateRestaurant(restaurantId, patch) {
  const { error } = await admin.from("restaurant_operational_controls")
    .update({ ...patch, updated_at: new Date().toISOString(), updated_by: null })
    .eq("restaurant_id", restaurantId);
  if (error) throw error;
}

async function setSystemMode(nextMode, reasonCode) {
  const { error } = await admin.rpc("service_set_system_operational_mode", {
    p_request_id: randomUUID(),
    p_next_mode: nextMode,
    p_reason_code: reasonCode,
    p_actor_user_id: null
  });
  if (error) throw error;
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : "Unknown pilot control failure.";
  return message
    .replace(/https?:\/\/\S+/gi, "<redacted-url>")
    .replace(/(?:access|refresh|service|secret)[_-]?(?:token|key)\s*[:=]\s*\S+/gi, "<redacted>")
    .slice(0, 500);
}

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
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
  requireRestaurantRole,
  requireUuid,
  type InvocationTerminalContext
} from "../_shared/mise.ts";

const PAGE_SIZE = 1_000;
const MAX_ROWS_PER_DATASET = 5_000;
const MAX_TOTAL_ROWS = 25_000;
const MAX_EXPORT_BYTES = 6 * 1024 * 1024;
const sensitiveKeyPattern =
  /(?:^|_)(?:access_token|refresh_token|oauth_token|client_secret|api_key|password|authorization|pkce_verifier|claim_token|credential_id|secret_id)(?:$|_)/i;

const exportDatasets = [
  { name: "pos_sales", order: "id" },
  { name: "inventory_items", order: "id" },
  { name: "inventory_events", order: "id" },
  { name: "menu_item_ingredients", order: "id" },
  { name: "purchase_recommendations", order: "id" },
  { name: "supplier_orders", order: "id" },
  { name: "pos_integrations", order: "id" },
  { name: "sales_imports", order: "id" },
  { name: "insights", order: "id" },
  { name: "supplier_items", order: "id" },
  { name: "purchase_orders", order: "id" },
  { name: "ai_insights", order: "id" },
  { name: "restaurant_email_connections", order: "id" },
  { name: "supplier_recipients", order: "id" },
  { name: "setup_attachments", order: "id" },
  { name: "restaurant_operational_controls", order: "restaurant_id" },
  { name: "pos_locations", order: "id" },
  { name: "pos_catalog_item_mappings", order: "id" },
  { name: "menu_items", order: "id" },
  { name: "recipe_versions", order: "id" },
  { name: "recipe_ingredients", order: "id" },
  { name: "modifier_recipe_adjustments", order: "id" },
  { name: "ingredient_substitutions", order: "id" },
  { name: "audit_logs", order: "id" }
] as const;

type ExportDatasetName = (typeof exportDatasets)[number]["name"];
type JsonRecord = Record<string, unknown>;

function assertSecretFree(value: unknown, path = "export"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSecretFree(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    if (sensitiveKeyPattern.test(key)) {
      throw new HttpError(500, `Restaurant export stopped because ${path} contains protected provider data.`);
    }
    assertSecretFree(nested, `${path}.${key}`);
  }
}

async function fetchDataset(
  supabase: SupabaseClient,
  table: ExportDatasetName,
  orderField: string,
  restaurantId: string
) {
  const first = await supabase
    .from(table)
    .select("*", { count: "exact" })
    .eq("restaurant_id", restaurantId)
    .order(orderField, { ascending: true })
    .range(0, PAGE_SIZE - 1);
  if (first.error) throw new HttpError(500, `Restaurant export could not read ${table}.`);

  const count = first.count ?? first.data.length;
  if (count > MAX_ROWS_PER_DATASET) {
    throw new HttpError(
      413,
      `Restaurant export is too large for in-app delivery (${table}). Contact Mise support for a secure export.`
    );
  }

  const rows = [...first.data];
  while (rows.length < count) {
    const next = await supabase
      .from(table)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order(orderField, { ascending: true })
      .range(rows.length, Math.min(rows.length + PAGE_SIZE - 1, count - 1));
    if (next.error) throw new HttpError(500, `Restaurant export could not finish ${table}.`);
    if (next.data.length === 0) {
      throw new HttpError(500, `Restaurant export returned an incomplete ${table} dataset.`);
    }
    rows.push(...next.data);
  }

  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let terminalContext: InvocationTerminalContext | null = null;
  try {
    const { supabase, securitySupabase, user } = await requireAuthenticatedContext(req);
    const body = await readJsonObject(req);
    const restaurantId = requireUuid(body.restaurantId, "restaurantId");

    const reservation = await reserveFunctionInvocation(
      securitySupabase,
      user.id,
      restaurantId,
      "export-restaurant-data",
      "restaurant_data_export_requested"
    );
    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      restaurantId,
      functionName: "export-restaurant-data"
    };

    await requireRestaurantRole(supabase, user.id, restaurantId, ["owner", "admin"]);

    const restaurantResult = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", restaurantId)
      .single();
    if (restaurantResult.error || !restaurantResult.data) {
      throw new HttpError(500, "Restaurant export could not read the restaurant profile.");
    }

    const teamResult = await supabase.rpc("list_restaurant_members", {
      p_restaurant_id: restaurantId
    });
    if (teamResult.error) {
      throw new HttpError(500, "Restaurant export could not read the team directory.");
    }

    const team = Array.isArray(teamResult.data) ? teamResult.data : [];
    const datasets: Partial<Record<ExportDatasetName, unknown[]>> = {};
    const counts: Partial<Record<ExportDatasetName | "team", number>> = {
      team: team.length
    };
    let totalRows = team.length;

    for (const dataset of exportDatasets) {
      const rows = await fetchDataset(supabase, dataset.name, dataset.order, restaurantId);
      totalRows += rows.length;
      if (totalRows > MAX_TOTAL_ROWS) {
        throw new HttpError(
          413,
          "Restaurant export is too large for in-app delivery. Contact Mise support for a secure export."
        );
      }
      datasets[dataset.name] = rows;
      counts[dataset.name] = rows.length;
    }

    const payload = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      restaurantId,
      restaurant: restaurantResult.data,
      team,
      datasets,
      counts,
      retention: {
        scope: "restaurant_operational_data",
        credentialsExcluded: true,
        privateSecurityLogsExcluded: true,
        backupDeletion: "Backups expire on the infrastructure provider schedule."
      }
    };
    assertSecretFree(payload);

    const bytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
    if (bytes > MAX_EXPORT_BYTES) {
      throw new HttpError(
        413,
        "Restaurant export is too large for in-app delivery. Contact Mise support for a secure export."
      );
    }

    await recordFunctionAuditLog(
      securitySupabase,
      user.id,
      restaurantId,
      "restaurant_data_export_completed",
      "restaurants",
      restaurantId,
      { schema_version: 1, total_rows: totalRows, bytes, counts }
    );
    await recordFunctionSecurityEvent(
      securitySupabase,
      user.id,
      reservation.reservation_id!,
      restaurantId,
      "export-restaurant-data",
      "completed",
      "restaurant_data_export_completed",
      { schema_version: 1, total_rows: totalRows, bytes }
    );
    terminalContext = null;

    return jsonResponse(payload);
  } catch (error) {
    captureFunctionError(error, {
      functionName: "export-restaurant-data",
      operation: "restaurant_data_export"
    });
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

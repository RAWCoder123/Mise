import {
  DEFAULT_POS_SALES_EXPORT_DAYS,
  buildRestaurantDataExport,
  posSalesExportCutoffDate
} from "../../../services/domain/restaurantDataExport.ts";
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
  requireAuthenticatedContext,
  requireRestaurantRole,
  requireUuid,
  reserveFunctionInvocation,
  type InvocationTerminalContext
} from "../_shared/mise.ts";

const FUNCTION_NAME = "export-restaurant-data" as const;
const ACTION = "export_restaurant_data";

async function loadRestaurantRows(
  securitySupabase: Awaited<ReturnType<typeof requireAuthenticatedContext>>["securitySupabase"],
  restaurantId: string
) {
  const cutoffDate = posSalesExportCutoffDate(new Date(), DEFAULT_POS_SALES_EXPORT_DAYS);

  const [
    restaurantResult,
    membershipsResult,
    invitesResult,
    inventoryItemsResult,
    inventoryMovementsResult,
    countSessionsResult,
    storageLocationsResult,
    locationBalancesResult,
    recipesResult,
    posSalesResult,
    posIntegrationsResult,
    salesImportsResult,
    recommendationsResult,
    supplierOrdersResult,
    purchaseOrdersResult,
    supplierItemsResult,
    supplierRecipientsResult,
    insightsResult,
    aiInsightsResult,
    setupAttachmentsResult,
    emailConnectionsResult,
    auditLogsResult
  ] = await Promise.all([
    securitySupabase.from("restaurants").select("*").eq("id", restaurantId),
    securitySupabase.from("restaurant_memberships").select("*").eq("restaurant_id", restaurantId),
    securitySupabase
      .from("restaurant_member_invites")
      .select(
        "id,restaurant_id,email,role,status,created_by,claimed_by,expires_at,created_at,claimed_at,revoked_at"
      )
      .eq("restaurant_id", restaurantId),
    securitySupabase.from("inventory_items").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("inventory_movements").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("inventory_count_sessions").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("storage_locations").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("inventory_location_balances").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("menu_item_ingredients").select("*").eq("restaurant_id", restaurantId),
    securitySupabase
      .from("pos_sales")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .gte("sale_date", cutoffDate),
    securitySupabase.from("pos_integrations").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("sales_imports").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("purchase_recommendations").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("supplier_orders").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("purchase_orders").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("supplier_items").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("supplier_recipients").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("insights").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("ai_insights").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("setup_attachments").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("restaurant_email_connections").select("*").eq("restaurant_id", restaurantId),
    securitySupabase.from("audit_logs").select("*").eq("restaurant_id", restaurantId)
  ]);

  const queryErrors = [
    restaurantResult.error,
    membershipsResult.error,
    invitesResult.error,
    inventoryItemsResult.error,
    inventoryMovementsResult.error,
    countSessionsResult.error,
    storageLocationsResult.error,
    locationBalancesResult.error,
    recipesResult.error,
    posSalesResult.error,
    posIntegrationsResult.error,
    salesImportsResult.error,
    recommendationsResult.error,
    supplierOrdersResult.error,
    purchaseOrdersResult.error,
    supplierItemsResult.error,
    supplierRecipientsResult.error,
    insightsResult.error,
    aiInsightsResult.error,
    setupAttachmentsResult.error,
    emailConnectionsResult.error,
    auditLogsResult.error
  ].filter(Boolean);
  if (queryErrors.length > 0) {
    throw queryErrors[0];
  }

  if (!restaurantResult.data?.length) {
    throw new HttpError(404, "Restaurant not found.");
  }

  const memberships = membershipsResult.data ?? [];
  const memberUserIds = [...new Set(memberships.map((row) => String(row.user_id)))].filter(Boolean);
  let users: Record<string, unknown>[] = [];
  if (memberUserIds.length > 0) {
    const usersResult = await securitySupabase
      .from("users")
      .select("id,name,email,restaurant_id,role,created_at")
      .in("id", memberUserIds);
    if (usersResult.error) throw usersResult.error;
    users = usersResult.data ?? [];
  }

  const sessionIds = (countSessionsResult.data ?? []).map((row) => String(row.id)).filter(Boolean);
  let countLines: Record<string, unknown>[] = [];
  if (sessionIds.length > 0) {
    const linesResult = await securitySupabase
      .from("inventory_count_lines")
      .select("*")
      .in("session_id", sessionIds);
    if (linesResult.error) throw linesResult.error;
    countLines = linesResult.data ?? [];
  }

  return {
    restaurants: restaurantResult.data ?? [],
    users,
    memberships,
    memberInvites: invitesResult.data ?? [],
    inventoryItems: inventoryItemsResult.data ?? [],
    inventoryMovements: inventoryMovementsResult.data ?? [],
    inventoryCountSessions: countSessionsResult.data ?? [],
    inventoryCountLines: countLines,
    storageLocations: storageLocationsResult.data ?? [],
    inventoryLocationBalances: locationBalancesResult.data ?? [],
    menuItemIngredients: recipesResult.data ?? [],
    posSales: posSalesResult.data ?? [],
    posIntegrations: posIntegrationsResult.data ?? [],
    salesImports: salesImportsResult.data ?? [],
    purchaseRecommendations: recommendationsResult.data ?? [],
    supplierOrders: supplierOrdersResult.data ?? [],
    purchaseOrders: purchaseOrdersResult.data ?? [],
    supplierItems: supplierItemsResult.data ?? [],
    supplierRecipients: supplierRecipientsResult.data ?? [],
    insights: insightsResult.data ?? [],
    aiInsights: aiInsightsResult.data ?? [],
    setupAttachments: setupAttachmentsResult.data ?? [],
    emailConnections: emailConnectionsResult.data ?? [],
    auditLogs: auditLogsResult.data ?? []
  };
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
      FUNCTION_NAME,
      ACTION
    );
    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      restaurantId,
      functionName: FUNCTION_NAME
    };

    await requireRestaurantRole(supabase, user.id, restaurantId, ["owner", "admin"]);
    await recordFunctionAuditLog(
      securitySupabase,
      user.id,
      restaurantId,
      ACTION,
      "restaurants",
      restaurantId,
      { source: FUNCTION_NAME }
    );

    const rows = await loadRestaurantRows(securitySupabase, restaurantId);
    const exportedAt = new Date().toISOString();
    const document = buildRestaurantDataExport({
      restaurantId,
      exportedAt,
      source: "edge_export_restaurant_data",
      ...rows
    });

    await recordFunctionSecurityEvent(
      securitySupabase,
      user.id,
      reservation.reservation_id!,
      restaurantId,
      FUNCTION_NAME,
      "completed",
      ACTION,
      {
        result_entity: "restaurant_data_export",
        pos_sales_exported: document.summary.pos_sales_exported,
        table_count: document.summary.table_count
      }
    );
    terminalContext = null;

    return jsonResponse({
      status: "completed",
      export: document
    });
  } catch (error) {
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

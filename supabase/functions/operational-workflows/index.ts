import { calculateOperationalSignals, type OperationalPlanningSnapshot } from "../../../services/domain/operationalSignals.ts";
import { inventoryUnitsAreCompatible } from "../../../services/domain/inventoryUnits.ts";
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
  requireEnum,
  requireRestaurantRole,
  requireString,
  requireUuid,
  type InvocationTerminalContext
} from "../_shared/mise.ts";

const actions = [
  "refresh_signals",
  "update_inventory",
  "create_inventory_item",
  "record_waste",
  "transfer_inventory",
  "receive_supplier_order",
  "upsert_recipe",
  "delete_recipe",
  "save_setup",
  "ingest_pos_csv",
  "begin_count_session",
  "save_count_lines",
  "submit_count_session",
  "cancel_count_session",
  "approve_count_session"
] as const;
type OperationalAction = (typeof actions)[number];
const countSessionDraftActions = new Set<OperationalAction>([
  "begin_count_session",
  "save_count_lines",
  "submit_count_session",
  "cancel_count_session"
]);
/**
 * Staff may draft/submit counts, record observed waste, and transfer stock
 * between storage locations. Approve/cancel counts and other mutations stay manager+.
 */
const staffOperationalActions = new Set<OperationalAction>([
  "begin_count_session",
  "save_count_lines",
  "submit_count_session",
  "record_waste",
  "transfer_inventory"
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let terminalContext: InvocationTerminalContext | null = null;
  try {
    const { supabase, securitySupabase, user } = await requireAuthenticatedContext(req);
    const body = await readJsonObject(req);
    const action = requireEnum(body.action, "action", actions);
    const restaurantId = requireUuid(body.restaurantId, "restaurantId");
    const reservation = await reserveFunctionInvocation(
      securitySupabase,
      user.id,
      restaurantId,
      "operational-workflows",
      action
    );
    if (!reservation.allowed) return firewallBlockedResponse(reservation);
    terminalContext = {
      securitySupabase,
      actorUserId: user.id,
      reservationId: reservation.reservation_id!,
      restaurantId,
      functionName: "operational-workflows"
    };

    if (staffOperationalActions.has(action)) {
      await requireRestaurantRole(supabase, user.id, restaurantId, [
        "owner",
        "admin",
        "manager",
        "staff"
      ]);
    } else {
      await requireRestaurantRole(supabase, user.id, restaurantId, ["owner", "admin", "manager"]);
    }

    let result: unknown;
    let setupSummary: unknown = null;
    let ingestSummary: unknown = null;
    if (action === "save_setup") {
      const setup = requireRecord(body.setup, "setup");
      await serviceRpc(securitySupabase, "service_mark_operational_signals_pending", {
        p_actor_user_id: user.id,
        p_restaurant_id: restaurantId
      });
      const { data, error } = await supabase.rpc("save_restaurant_setup", {
        p_restaurant_id: restaurantId,
        p_inventory_items: requireArray(setup.inventoryItems, "setup.inventoryItems", 250),
        p_suppliers: requireArray(setup.suppliers, "setup.suppliers", 100),
        p_recipe_mappings: requireArray(setup.recipeMappings, "setup.recipeMappings", 1000),
        p_pos_sales: requireArray(setup.posSales, "setup.posSales", 1000),
        p_attachments: requireArray(setup.attachments, "setup.attachments", 25),
        p_skipped_recipe_ingredients: requireBoundedInteger(
          setup.skippedRecipeIngredients,
          "setup.skippedRecipeIngredients",
          0,
          1000
        )
      });
      if (error) throw error;
      setupSummary = data;
      result = await refreshWithRetry(
        securitySupabase,
        user.id,
        restaurantId,
        action,
        body,
        true,
        requireRecord(data, "setup summary")
      );
    } else if (action === "ingest_pos_csv") {
      const sales = requireManualPosSales(body.sales);
      await serviceRpc(securitySupabase, "service_mark_operational_signals_pending", {
        p_actor_user_id: user.id,
        p_restaurant_id: restaurantId
      });
      ingestSummary = await serviceRpc(securitySupabase, "service_ingest_manual_pos_sales", {
        p_actor_user_id: user.id,
        p_restaurant_id: restaurantId,
        p_sales: sales,
        p_source_file_name: body.sourceFileName == null ? null : requireBoundedString(body.sourceFileName, "sourceFileName", 240)
      });
      result = await refreshWithRetry(
        securitySupabase,
        user.id,
        restaurantId,
        action,
        body,
        false,
        requireRecord(ingestSummary, "ingest summary")
      );
    } else if (action === "transfer_inventory") {
      result = await serviceRpc(securitySupabase, "service_transfer_inventory", {
        p_actor_user_id: user.id,
        p_restaurant_id: restaurantId,
        p_inventory_item_id: requireUuid(body.itemId, "itemId"),
        p_from_storage_location_id: requireUuid(body.fromStorageLocationId, "fromStorageLocationId"),
        p_to_storage_location_id: requireUuid(body.toStorageLocationId, "toStorageLocationId"),
        p_quantity: requireBoundedNumber(body.quantity, "quantity", Number.EPSILON, 1_000_000),
        p_note: body.note == null ? null : requireBoundedString(body.note, "note", 240)
      });
    } else if (countSessionDraftActions.has(action)) {
      result = await runCountSessionDraftAction(securitySupabase, user.id, restaurantId, action, body);
    } else {
      result = await refreshWithRetry(securitySupabase, user.id, restaurantId, action, body, false, {});
    }

    await recordFunctionAuditLog(
      securitySupabase,
      user.id,
      restaurantId,
      auditAction(action),
      auditEntityTable(action),
      auditEntityId(action, body, result),
      auditMetadata(action, body, result, ingestSummary)
    );
    await recordFunctionSecurityEvent(
      securitySupabase,
      user.id,
      reservation.reservation_id!,
      restaurantId,
      "operational-workflows",
      "completed",
      `${action}_completed`,
      { workflow: action }
    );
    terminalContext = null;
    return jsonResponse({ status: "completed", result, setupSummary, ingestSummary });
  } catch (error) {
    await recordFunctionTerminalError(terminalContext);
    return handleError(error);
  }
});

async function refreshWithRetry(
  securitySupabase: Parameters<typeof serviceRpc>[0],
  actorUserId: string,
  restaurantId: string,
  action: OperationalAction,
  body: Record<string, unknown>,
  completeSetup: boolean,
  setupMetadata: Record<string, unknown>
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const snapshot = await serviceRpc(
        securitySupabase,
        "service_fetch_operational_planning_snapshot",
        { p_actor_user_id: actorUserId, p_restaurant_id: restaurantId }
      ) as OperationalPlanningSnapshot & { revision: number };
      const revision = requireBoundedInteger(snapshot.revision, "planning revision", 0, Number.MAX_SAFE_INTEGER);
      let mutationBody = body;
      if (action === "approve_count_session") {
        const sessionId = requireUuid(body.sessionId, "sessionId");
        const detail = requireRecord(
          await serviceRpc(securitySupabase, "service_get_inventory_count_session", {
            p_actor_user_id: actorUserId,
            p_restaurant_id: restaurantId,
            p_session_id: sessionId
          }),
          "count session"
        );
        const session = requireRecord(detail.session, "count session.session");
        if (session.status !== "submitted") {
          throw new HttpError(400, "Submit the count session before approving adjustments.");
        }
        mutationBody = { ...body, approvedLines: requireArray(detail.lines, "count session.lines", 250) };
      }
      if (action === "create_inventory_item") {
        mutationBody = {
          ...body,
          itemId: crypto.randomUUID(),
          item: requireInventoryCreate(body.item)
        };
      }
      const planning = applyRequestedMutation(snapshot, action, mutationBody);
      const signals = calculateOperationalSignals(planning);
      const recommendations = signals.recommendations.map((recommendation) => ({
        inventory_item_id: recommendation.inventory_item_id,
        recommended_quantity: recommendation.recommended_quantity,
        reason: recommendation.reason,
        urgency: recommendation.urgency
      }));
      const insights = signals.insights.map((insight) => ({
        insight_type: insight.insight_type,
        title: insight.title,
        description: insight.description,
        why_it_matters: insight.why_it_matters,
        recommended_action: insight.recommended_action,
        severity: insight.severity
      }));

      if (action === "update_inventory") {
        const patch = requireInventoryPatch(body.patch);
        const note = body.note == null || body.note === ""
          ? null
          : requireBoundedString(body.note, "note", 240);
        return await serviceRpc(securitySupabase, "service_update_inventory_and_signals", {
          p_actor_user_id: actorUserId,
          p_restaurant_id: restaurantId,
          p_inventory_item_id: requireUuid(body.itemId, "itemId"),
          p_expected_revision: revision,
          p_patch: note ? { ...patch, note } : patch,
          p_recommendations: recommendations,
          p_insights: insights
        });
      }
      if (action === "create_inventory_item") {
        return await serviceRpc(securitySupabase, "service_create_inventory_item_and_signals", {
          p_actor_user_id: actorUserId,
          p_restaurant_id: restaurantId,
          p_inventory_item_id: requireUuid(mutationBody.itemId, "itemId"),
          p_expected_revision: revision,
          p_item: requireInventoryCreate(mutationBody.item),
          p_recommendations: recommendations,
          p_insights: insights
        });
      }
      if (action === "record_waste") {
        return await serviceRpc(securitySupabase, "service_record_inventory_waste_and_signals", {
          p_actor_user_id: actorUserId,
          p_restaurant_id: restaurantId,
          p_inventory_item_id: requireUuid(body.itemId, "itemId"),
          p_expected_revision: revision,
          p_quantity_removed: requireBoundedNumber(body.quantityRemoved, "quantityRemoved", Number.EPSILON, 1_000_000),
          p_note: body.note == null ? null : requireBoundedString(body.note, "note", 240),
          p_recommendations: recommendations,
          p_insights: insights
        });
      }
      if (action === "receive_supplier_order") {
        return await serviceRpc(securitySupabase, "service_receive_supplier_order_and_signals", {
          p_actor_user_id: actorUserId,
          p_restaurant_id: restaurantId,
          p_order_id: requireUuid(body.orderId, "orderId"),
          p_expected_revision: revision,
          p_receive_lines: requireReceiveLines(body.receiveLines),
          p_recommendations: recommendations,
          p_insights: insights
        });
      }
      if (action === "approve_count_session") {
        return await serviceRpc(securitySupabase, "service_approve_inventory_count_session", {
          p_actor_user_id: actorUserId,
          p_restaurant_id: restaurantId,
          p_session_id: requireUuid(body.sessionId, "sessionId"),
          p_expected_revision: revision,
          p_recommendations: recommendations,
          p_insights: insights
        });
      }
      if (action === "upsert_recipe") {
        return await serviceRpc(securitySupabase, "service_save_recipe_and_signals", {
          p_actor_user_id: actorUserId,
          p_restaurant_id: restaurantId,
          p_mapping_id: body.mappingId == null ? null : requireUuid(body.mappingId, "mappingId"),
          p_menu_item_name: requireBoundedString(body.menuItemName, "menuItemName", 200),
          p_inventory_item_id: requireUuid(body.inventoryItemId, "inventoryItemId"),
          p_quantity_used_per_sale: requireBoundedNumber(body.quantityUsedPerSale, "quantityUsedPerSale", Number.EPSILON, 10_000),
          p_unit: requireBoundedString(body.unit, "unit", 40),
          p_expected_revision: revision,
          p_recommendations: recommendations,
          p_insights: insights
        });
      }
      if (action === "delete_recipe") {
        return await serviceRpc(securitySupabase, "service_delete_recipe_and_signals", {
          p_actor_user_id: actorUserId,
          p_restaurant_id: restaurantId,
          p_mapping_id: requireUuid(body.mappingId, "mappingId"),
          p_expected_revision: revision,
          p_recommendations: recommendations,
          p_insights: insights
        });
      }
      return await serviceRpc(securitySupabase, "service_commit_operational_signals", {
        p_actor_user_id: actorUserId,
        p_restaurant_id: restaurantId,
        p_expected_revision: revision,
        p_recommendations: recommendations,
        p_insights: insights,
        p_complete_setup: completeSetup,
        p_setup_metadata: setupMetadata
      });
    } catch (error) {
      lastError = error;
      if (!isRevisionConflict(error) || attempt === 2) throw error;
    }
  }
  throw lastError;
}

async function runCountSessionDraftAction(
  securitySupabase: Parameters<typeof serviceRpc>[0],
  actorUserId: string,
  restaurantId: string,
  action: OperationalAction,
  body: Record<string, unknown>
) {
  if (action === "begin_count_session") {
    return await serviceRpc(securitySupabase, "service_begin_inventory_count_session", {
      p_actor_user_id: actorUserId,
      p_restaurant_id: restaurantId,
      p_note: body.note == null ? null : requireBoundedString(body.note, "note", 240)
    });
  }
  if (action === "save_count_lines") {
    return await serviceRpc(securitySupabase, "service_save_inventory_count_lines", {
      p_actor_user_id: actorUserId,
      p_restaurant_id: restaurantId,
      p_session_id: requireUuid(body.sessionId, "sessionId"),
      p_lines: requireCountLineUpdates(body.lines)
    });
  }
  if (action === "submit_count_session") {
    return await serviceRpc(securitySupabase, "service_submit_inventory_count_session", {
      p_actor_user_id: actorUserId,
      p_restaurant_id: restaurantId,
      p_session_id: requireUuid(body.sessionId, "sessionId")
    });
  }
  return await serviceRpc(securitySupabase, "service_cancel_inventory_count_session", {
    p_actor_user_id: actorUserId,
    p_restaurant_id: restaurantId,
    p_session_id: requireUuid(body.sessionId, "sessionId")
  });
}

function applyRequestedMutation(
  snapshot: OperationalPlanningSnapshot,
  action: OperationalAction,
  body: Record<string, unknown>
): OperationalPlanningSnapshot {
  if (action === "approve_count_session") {
    const lines = requireArray(body.approvedLines, "approvedLines", 250);
    if (lines.length < 1) throw new HttpError(400, "approvedLines must include at least one row.");
    const quantityByItemId = new Map<string, number>();
    for (const [index, entry] of lines.entries()) {
      const row = requireRecord(entry, `approvedLines[${index}]`);
      const itemId = requireUuid(row.inventory_item_id, `approvedLines[${index}].inventory_item_id`);
      const counted = requireBoundedNumber(
        row.counted_quantity,
        `approvedLines[${index}].counted_quantity`,
        0,
        1_000_000
      );
      quantityByItemId.set(itemId, counted);
    }
    return {
      ...snapshot,
      inventoryItems: snapshot.inventoryItems.map((item) =>
        quantityByItemId.has(item.id)
          ? {
              ...item,
              current_quantity: quantityByItemId.get(item.id) as number,
              last_updated: new Date().toISOString()
            }
          : item
      )
    };
  }
  if (action === "update_inventory") {
    const itemId = requireUuid(body.itemId, "itemId");
    const patch = requireInventoryPatch(body.patch);
    if (!snapshot.inventoryItems.some((item) => item.id === itemId)) throw new HttpError(404, "Inventory item not found.");
    return {
      ...snapshot,
      inventoryItems: snapshot.inventoryItems.map((item) => item.id === itemId
        ? { ...item, ...patch, last_updated: new Date().toISOString() }
        : item)
    };
  }
  if (action === "create_inventory_item") {
    if (snapshot.inventoryItems.length >= 250) {
      throw new HttpError(400, "This restaurant already has the maximum of 250 inventory items.");
    }
    const item = requireInventoryCreate(body.item);
    const itemId = requireUuid(body.itemId, "itemId");
    const duplicate = snapshot.inventoryItems.some(
      (existing) =>
        existing.item_name.trim().toLowerCase().replace(/\s+/g, " ") ===
        item.item_name.trim().toLowerCase().replace(/\s+/g, " ")
    );
    if (duplicate) {
      throw new HttpError(409, "An inventory item with this name already exists.");
    }
    if (snapshot.inventoryItems.some((existing) => existing.id === itemId)) {
      throw new HttpError(409, "Inventory item id already exists.");
    }
    return {
      ...snapshot,
      inventoryItems: [
        ...snapshot.inventoryItems,
        {
          id: itemId,
          restaurant_id: snapshot.restaurantId,
          item_name: item.item_name,
          category: item.category,
          unit: item.unit,
          current_quantity: item.current_quantity,
          par_level: item.par_level,
          reorder_threshold: item.reorder_threshold,
          estimated_unit_cost: item.estimated_unit_cost,
          supplier_name: item.supplier_name,
          last_updated: new Date().toISOString()
        }
      ]
    };
  }
  if (action === "record_waste") {
    const itemId = requireUuid(body.itemId, "itemId");
    const quantityRemoved = requireBoundedNumber(body.quantityRemoved, "quantityRemoved", Number.EPSILON, 1_000_000);
    if (body.note != null) requireBoundedString(body.note, "note", 240);
    const existing = snapshot.inventoryItems.find((item) => item.id === itemId);
    if (!existing) throw new HttpError(404, "Inventory item not found.");
    if (existing.current_quantity <= 0) {
      throw new HttpError(400, "Nothing on hand to record as waste. Update the count first.");
    }
    const quantityAfter = Math.max(0, existing.current_quantity - Math.min(quantityRemoved, existing.current_quantity));
    return {
      ...snapshot,
      inventoryItems: snapshot.inventoryItems.map((item) => item.id === itemId
        ? { ...item, current_quantity: quantityAfter, last_updated: new Date().toISOString() }
        : item)
    };
  }
  if (action === "receive_supplier_order") {
    const receiveLines = requireReceiveLines(body.receiveLines);
    const quantityByItemId = new Map(
      receiveLines.map((line) => [line.inventory_item_id as string, Number(line.quantity_received)] as const)
    );
    for (const itemId of quantityByItemId.keys()) {
      if (!snapshot.inventoryItems.some((item) => item.id === itemId)) {
        throw new HttpError(404, "Inventory item not found.");
      }
    }
    return {
      ...snapshot,
      inventoryItems: snapshot.inventoryItems.map((item) =>
        quantityByItemId.has(item.id)
          ? {
              ...item,
              current_quantity: item.current_quantity + (quantityByItemId.get(item.id) as number),
              last_updated: new Date().toISOString()
            }
          : item
      )
    };
  }
  if (action === "upsert_recipe") {
    const mappingId = body.mappingId == null ? null : requireUuid(body.mappingId, "mappingId");
    const inventoryItemId = requireUuid(body.inventoryItemId, "inventoryItemId");
    const mapping = {
      id: mappingId ?? `pending_${inventoryItemId}`,
      restaurant_id: snapshot.restaurantId,
      menu_item_name: requireBoundedString(body.menuItemName, "menuItemName", 200),
      inventory_item_id: inventoryItemId,
      quantity_used_per_sale: requireBoundedNumber(body.quantityUsedPerSale, "quantityUsedPerSale", Number.EPSILON, 10_000),
      unit: requireBoundedString(body.unit, "unit", 40)
    };
    const inventoryItem = snapshot.inventoryItems.find((item) => item.id === inventoryItemId);
    if (!inventoryItem) throw new HttpError(404, "Inventory item not found.");
    if (!inventoryUnitsAreCompatible(inventoryItem.unit, mapping.unit)) {
      throw new HttpError(400, `Recipe unit must match the inventory unit (${inventoryItem.unit}).`);
    }
    const existingMappingId = mappingId ?? (snapshot.menuItemIngredients.find((entry) =>
      entry.inventory_item_id === inventoryItemId &&
      entry.menu_item_name.trim().toLowerCase() === mapping.menu_item_name.toLowerCase()
    ) as { id?: string } | undefined)?.id;
    return {
      ...snapshot,
      menuItemIngredients: existingMappingId
        ? snapshot.menuItemIngredients.map((entry) => (entry as { id?: string }).id === existingMappingId ? { ...mapping, id: existingMappingId } : entry)
        : [...snapshot.menuItemIngredients, mapping]
    };
  }
  if (action === "delete_recipe") {
    const mappingId = requireUuid(body.mappingId, "mappingId");
    if (!snapshot.menuItemIngredients.some((entry) => (entry as { id?: string }).id === mappingId)) {
      throw new HttpError(404, "Recipe mapping not found.");
    }
    return {
      ...snapshot,
      menuItemIngredients: snapshot.menuItemIngredients.filter(
        (entry) => (entry as { id?: string }).id !== mappingId
      )
    };
  }
  return snapshot;
}

async function serviceRpc(client: { rpc: (name: string, parameters: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }, name: string, parameters: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, parameters);
  if (error) throw error;
  return data;
}

function requireRecord(value: unknown, fieldName: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, `${fieldName} must be an object.`);
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, fieldName: string, maximumLength: number) {
  if (!Array.isArray(value) || value.length > maximumLength) {
    throw new HttpError(400, `${fieldName} must be an array with at most ${maximumLength} entries.`);
  }
  return value;
}

function requireManualPosSales(value: unknown) {
  const sales = requireArray(value, "sales", 1000);
  if (sales.length < 1) throw new HttpError(400, "sales must include at least one row.");
  return sales.map((entry, index) => {
    const row = requireRecord(entry, `sales[${index}]`);
    const quantitySold = requireBoundedNumber(row.quantity_sold, `sales[${index}].quantity_sold`, Number.EPSILON, 100_000);
    const grossSales = requireBoundedNumber(row.gross_sales, `sales[${index}].gross_sales`, 0, 10_000_000);
    const netSales = requireBoundedNumber(row.net_sales, `sales[${index}].net_sales`, 0, 10_000_000);
    const sourcePos = requireBoundedString(row.source_pos, `sales[${index}].source_pos`, 80);
    if (sourcePos !== "Manual CSV Upload") {
      throw new HttpError(400, `sales[${index}].source_pos must be Manual CSV Upload.`);
    }
    return {
      source_record_id: requireBoundedString(row.source_record_id, `sales[${index}].source_record_id`, 200),
      sale_date: requireBoundedString(row.sale_date, `sales[${index}].sale_date`, 32),
      item_name: requireBoundedString(row.item_name, `sales[${index}].item_name`, 200),
      category: requireBoundedString(row.category, `sales[${index}].category`, 120),
      quantity_sold: quantitySold,
      gross_sales: grossSales,
      net_sales: netSales,
      source_pos: sourcePos
    };
  });
}

function requireBoundedString(value: unknown, fieldName: string, maximumLength: number) {
  const text = requireString(value, fieldName);
  if (text.length > maximumLength) throw new HttpError(400, `${fieldName} is too long.`);
  return text;
}

function requireBoundedNumber(value: unknown, fieldName: string, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new HttpError(400, `${fieldName} is outside supported limits.`);
  }
  return value;
}

function requireBoundedInteger(value: unknown, fieldName: string, minimum: number, maximum: number) {
  const number = requireBoundedNumber(value, fieldName, minimum, maximum);
  if (!Number.isSafeInteger(number)) throw new HttpError(400, `${fieldName} must be an integer.`);
  return number;
}

function requireInventoryPatch(value: unknown) {
  const patch = requireRecord(value, "patch");
  const allowed = new Set(["current_quantity", "par_level", "reorder_threshold", "supplier_name"]);
  if (Object.keys(patch).length === 0 || Object.keys(patch).some((key) => !allowed.has(key))) {
    throw new HttpError(400, "patch contains unsupported fields.");
  }
  const normalized: Record<string, string | number> = {};
  for (const field of ["current_quantity", "par_level", "reorder_threshold"] as const) {
    if (patch[field] !== undefined) normalized[field] = requireBoundedNumber(patch[field], field, 0, 1_000_000);
  }
  if (patch.supplier_name !== undefined) normalized.supplier_name = requireBoundedString(patch.supplier_name, "supplier_name", 160);
  return normalized;
}

function requireInventoryCreate(value: unknown) {
  const item = requireRecord(value, "item");
  const allowed = new Set([
    "item_name",
    "category",
    "unit",
    "current_quantity",
    "par_level",
    "reorder_threshold",
    "estimated_unit_cost",
    "supplier_name"
  ]);
  if (Object.keys(item).some((key) => !allowed.has(key))) {
    throw new HttpError(400, "item contains unsupported fields.");
  }
  const normalizeText = (raw: unknown, fieldName: string, maximumLength: number) => {
    const text = requireBoundedString(raw, fieldName, maximumLength).trim().replace(/\s+/g, " ");
    if (text.length < 1) throw new HttpError(400, `${fieldName} is required.`);
    if (text.length > maximumLength) throw new HttpError(400, `${fieldName} is too long.`);
    return text;
  };
  return {
    item_name: normalizeText(item.item_name, "item.item_name", 160),
    category: normalizeText(item.category, "item.category", 120),
    unit: normalizeText(item.unit, "item.unit", 40),
    current_quantity: requireBoundedNumber(item.current_quantity, "item.current_quantity", 0, 1_000_000),
    par_level: requireBoundedNumber(item.par_level, "item.par_level", 0, 1_000_000),
    reorder_threshold: requireBoundedNumber(item.reorder_threshold, "item.reorder_threshold", 0, 1_000_000),
    estimated_unit_cost: requireBoundedNumber(item.estimated_unit_cost, "item.estimated_unit_cost", 0, 1_000_000),
    supplier_name: normalizeText(item.supplier_name, "item.supplier_name", 160)
  };
}

function requireCountLineUpdates(value: unknown) {
  const lines = requireArray(value, "lines", 250);
  if (lines.length < 1) throw new HttpError(400, "lines must include at least one row.");
  const seen = new Set<string>();
  return lines.map((entry, index) => {
    const row = requireRecord(entry, `lines[${index}]`);
    const inventoryItemId = requireUuid(
      row.inventoryItemId ?? row.inventory_item_id,
      `lines[${index}].inventoryItemId`
    );
    if (seen.has(inventoryItemId)) {
      throw new HttpError(400, `lines[${index}] duplicates an inventory item.`);
    }
    seen.add(inventoryItemId);
    const noteValue = row.note;
    return {
      inventory_item_id: inventoryItemId,
      counted_quantity: requireBoundedNumber(
        row.countedQuantity ?? row.counted_quantity,
        `lines[${index}].countedQuantity`,
        0,
        1_000_000
      ),
      note: noteValue == null || noteValue === ""
        ? null
        : requireBoundedString(noteValue, `lines[${index}].note`, 240)
    };
  });
}

function requireReceiveLines(value: unknown) {
  const lines = requireArray(value, "receiveLines", 250);
  if (lines.length < 1) throw new HttpError(400, "receiveLines must include at least one row.");
  const seen = new Set<string>();
  return lines.map((entry, index) => {
    const row = requireRecord(entry, `receiveLines[${index}]`);
    const inventoryItemId = requireUuid(
      row.inventoryItemId ?? row.inventory_item_id,
      `receiveLines[${index}].inventoryItemId`
    );
    if (seen.has(inventoryItemId)) {
      throw new HttpError(400, `receiveLines[${index}] duplicates an inventory item.`);
    }
    seen.add(inventoryItemId);
    const noteValue = row.note;
    return {
      inventory_item_id: inventoryItemId,
      quantity_received: requireBoundedNumber(
        row.quantityReceived ?? row.quantity_received,
        `receiveLines[${index}].quantityReceived`,
        0,
        1_000_000
      ),
      note: noteValue == null ? null : requireBoundedString(noteValue, `receiveLines[${index}].note`, 240)
    };
  });
}

function isRevisionConflict(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate?.code === "40001" || String(candidate?.message ?? "").includes("Planning snapshot changed");
}

function auditAction(action: OperationalAction) {
  if (action === "update_inventory") return "inventory_updated";
  if (action === "create_inventory_item") return "inventory_item_created";
  if (action === "record_waste") return "inventory_waste_recorded";
  if (action === "transfer_inventory") return "inventory_transfer_recorded";
  if (action === "receive_supplier_order") return "supplier_order_received";
  if (action === "begin_count_session") return "inventory_count_session_started";
  if (action === "save_count_lines") return "inventory_count_lines_saved";
  if (action === "submit_count_session") return "inventory_count_session_submitted";
  if (action === "cancel_count_session") return "inventory_count_session_cancelled";
  if (action === "approve_count_session") return "inventory_count_session_approved";
  if (action === "upsert_recipe") return "recipe_baseline_updated";
  if (action === "delete_recipe") return "recipe_baseline_deleted";
  if (action === "save_setup") return "setup_signals_completed";
  if (action === "ingest_pos_csv") return "manual_pos_csv_signals_completed";
  return "operational_signals_refreshed";
}

function auditEntityTable(action: OperationalAction) {
  if (
    action === "update_inventory" ||
    action === "create_inventory_item" ||
    action === "record_waste" ||
    action === "transfer_inventory"
  ) {
    return "inventory_items";
  }
  if (action === "receive_supplier_order") return "supplier_orders";
  if (
    action === "begin_count_session" ||
    action === "save_count_lines" ||
    action === "submit_count_session" ||
    action === "cancel_count_session" ||
    action === "approve_count_session"
  ) {
    return "inventory_count_sessions";
  }
  if (action === "upsert_recipe" || action === "delete_recipe") return "menu_item_ingredients";
  if (action === "ingest_pos_csv") return "sales_imports";
  return "restaurants";
}

function auditEntityId(action: OperationalAction, body: Record<string, unknown>, result: unknown = null) {
  if (action === "update_inventory" || action === "record_waste" || action === "transfer_inventory") {
    return requireUuid(body.itemId, "itemId");
  }
  if (action === "create_inventory_item") {
    if (result && typeof result === "object" && typeof (result as { id?: unknown }).id === "string") {
      return requireUuid((result as { id: string }).id, "result.id");
    }
    if (body.itemId != null) return requireUuid(body.itemId, "itemId");
    return null;
  }
  if (action === "receive_supplier_order") return requireUuid(body.orderId, "orderId");
  if (
    action === "save_count_lines" ||
    action === "submit_count_session" ||
    action === "cancel_count_session" ||
    action === "approve_count_session"
  ) {
    return requireUuid(body.sessionId, "sessionId");
  }
  if (action === "begin_count_session" && body.sessionId != null) {
    return requireUuid(body.sessionId, "sessionId");
  }
  if ((action === "upsert_recipe" || action === "delete_recipe") && body.mappingId != null) {
    return requireUuid(body.mappingId, "mappingId");
  }
  return null;
}

function auditMetadata(
  action: OperationalAction,
  body: Record<string, unknown>,
  result: unknown,
  ingestSummary: unknown = null
) {
  const metadata: Record<string, unknown> = { workflow: action };
  if (action === "ingest_pos_csv" && ingestSummary && typeof ingestSummary === "object") {
    const summary = ingestSummary as Record<string, unknown>;
    if (typeof summary.pos_sales_rows_saved === "number") {
      metadata.pos_sales_rows_saved = summary.pos_sales_rows_saved;
    }
    if (typeof summary.sales_import_id === "string") metadata.sales_import_id = summary.sales_import_id;
    return metadata;
  }
  if (
    action === "begin_count_session" ||
    action === "save_count_lines" ||
    action === "submit_count_session" ||
    action === "cancel_count_session" ||
    action === "approve_count_session"
  ) {
    if (result && typeof result === "object") {
      const row = result as Record<string, unknown>;
      const session = row.session && typeof row.session === "object"
        ? row.session as Record<string, unknown>
        : null;
      if (session && typeof session.id === "string") metadata.session_id = session.id;
      if (session && typeof session.status === "string") metadata.session_status = session.status;
      if (Array.isArray(row.lines)) metadata.line_count = row.lines.length;
      if (typeof row.lines_changed === "number") metadata.lines_changed = row.lines_changed;
      if (typeof row.lines_total === "number") metadata.lines_total = row.lines_total;
    }
    return metadata;
  }
  if (
    (
      action !== "update_inventory" &&
      action !== "create_inventory_item" &&
      action !== "record_waste" &&
      action !== "transfer_inventory"
    ) ||
    !result ||
    typeof result !== "object"
  ) {
    return metadata;
  }
  const row = result as Record<string, unknown>;
  if (typeof row.quantity_before === "number") metadata.quantity_before = row.quantity_before;
  if (typeof row.current_quantity === "number") metadata.quantity_after = row.current_quantity;
  if (typeof row.quantity_changed === "boolean") metadata.quantity_changed = row.quantity_changed;
  if (typeof row.quantity_removed_requested === "number") {
    metadata.quantity_removed_requested = row.quantity_removed_requested;
  }
  if (typeof row.quantity_removed_applied === "number") {
    metadata.quantity_removed_applied = row.quantity_removed_applied;
  }
  if (typeof row.floored === "boolean") metadata.floored = row.floored;
  if (typeof row.created === "boolean") metadata.created = row.created;
  if (typeof row.item_name === "string") metadata.item_name = row.item_name;
  if (action === "update_inventory" && body.patch && typeof body.patch === "object") {
    metadata.patch_fields = Object.keys(body.patch as Record<string, unknown>);
  }
  if (action === "update_inventory" && typeof body.note === "string" && body.note.trim()) {
    metadata.note = body.note.trim().slice(0, 240);
  }
  if (action === "update_inventory" && typeof row.note === "string" && row.note.trim()) {
    metadata.note = row.note.trim().slice(0, 240);
  }
  if (action === "record_waste" && typeof body.quantityRemoved === "number") {
    metadata.quantity_removed = body.quantityRemoved;
  }
  if (action === "transfer_inventory") {
    if (typeof row.quantity_moved === "number") metadata.quantity_moved = row.quantity_moved;
    if (typeof row.from_storage_location_id === "string") {
      metadata.from_storage_location_id = row.from_storage_location_id;
    }
    if (typeof row.to_storage_location_id === "string") {
      metadata.to_storage_location_id = row.to_storage_location_id;
    }
    if (typeof body.note === "string" && body.note.trim()) {
      metadata.note = body.note.trim().slice(0, 240);
    }
  }
  return metadata;
}

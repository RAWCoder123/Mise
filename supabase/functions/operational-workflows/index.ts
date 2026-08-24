import { calculateOperationalSignals, type OperationalPlanningSnapshot } from "../../../services/domain/operationalSignals.ts";
import { withPendingCountEvidence } from "../../../services/domain/inventoryCountAuthority.ts";
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
  "upsert_recipe",
  "save_setup",
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
  "submit_count_session"
]);
const staffOperationalActions = new Set<OperationalAction>([
  "begin_count_session",
  "save_count_lines",
  "submit_count_session"
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
    } else if (countSessionDraftActions.has(action) || action === "cancel_count_session") {
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
      { workflow: action }
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
    return jsonResponse({ status: "completed", result, setupSummary });
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
        return await serviceRpc(securitySupabase, "service_update_inventory_and_signals", {
          p_actor_user_id: actorUserId,
          p_restaurant_id: restaurantId,
          p_inventory_item_id: requireUuid(body.itemId, "itemId"),
          p_expected_revision: revision,
          p_patch: requireInventoryPatch(body.patch),
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
    const countedAt = new Date().toISOString();
    return {
      ...snapshot,
      inventoryItems: snapshot.inventoryItems.map((item) =>
        quantityByItemId.has(item.id)
          ? {
              ...item,
              current_quantity: quantityByItemId.get(item.id) as number,
              last_updated: countedAt
            }
          : item
      ),
      // The count rows this approval is about to append are not on the ledger yet.
      // Anchor the recomputed signals to the count being approved so the freshly
      // counted quantity is not depleted again by sales the counter already observed.
      inventoryLedgerEvents: withPendingCountEvidence(snapshot.inventoryLedgerEvents ?? [], {
        restaurantId: snapshot.restaurantId,
        inventoryItemIds: [...quantityByItemId.keys()],
        countedAt
      })
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
  const allowed = new Set(["par_level", "reorder_threshold"]);
  if (Object.keys(patch).length === 0 || Object.keys(patch).some((key) => !allowed.has(key))) {
    throw new HttpError(400, "patch contains unsupported fields.");
  }
  const normalized: Record<string, string | number> = {};
  for (const field of ["par_level", "reorder_threshold"] as const) {
    if (patch[field] !== undefined) normalized[field] = requireBoundedNumber(patch[field], field, 0, 1_000_000);
  }
  return normalized;
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
    const countedQuantity = requireBoundedNumber(
      row.countedQuantity ?? row.counted_quantity,
      `lines[${index}].countedQuantity`,
      0,
      1_000_000
    );
    const normalized: Record<string, unknown> = {
      inventory_item_id: inventoryItemId,
      counted_quantity: countedQuantity
    };
    if (Object.prototype.hasOwnProperty.call(row, "note")) {
      const note = row.note;
      if (note !== null && note !== undefined) {
        normalized.note = requireBoundedString(note, `lines[${index}].note`, 240);
      } else {
        normalized.note = null;
      }
    }
    return normalized;
  });
}

function isRevisionConflict(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate?.code === "40001" || String(candidate?.message ?? "").includes("Planning snapshot changed");
}

function auditAction(action: OperationalAction) {
  if (action === "update_inventory") return "inventory_updated";
  if (action === "upsert_recipe") return "recipe_baseline_updated";
  if (action === "save_setup") return "setup_signals_completed";
  if (action === "begin_count_session") return "inventory_count_session_started";
  if (action === "save_count_lines") return "inventory_count_lines_saved";
  if (action === "submit_count_session") return "inventory_count_session_submitted";
  if (action === "cancel_count_session") return "inventory_count_session_cancelled";
  if (action === "approve_count_session") return "inventory_count_session_approved";
  return "operational_signals_refreshed";
}

function auditEntityTable(action: OperationalAction) {
  if (action === "update_inventory") return "inventory_items";
  if (action === "upsert_recipe") return "menu_item_ingredients";
  if (
    action === "begin_count_session" ||
    action === "save_count_lines" ||
    action === "submit_count_session" ||
    action === "cancel_count_session" ||
    action === "approve_count_session"
  ) {
    return "inventory_count_sessions";
  }
  return "restaurants";
}

function auditEntityId(action: OperationalAction, body: Record<string, unknown>, result: unknown) {
  if (action === "update_inventory") return requireUuid(body.itemId, "itemId");
  if (action === "upsert_recipe" && body.mappingId != null) return requireUuid(body.mappingId, "mappingId");
  if (
    action === "save_count_lines" ||
    action === "submit_count_session" ||
    action === "cancel_count_session" ||
    action === "approve_count_session"
  ) {
    return requireUuid(body.sessionId, "sessionId");
  }
  if (action === "begin_count_session" && result && typeof result === "object") {
    const session = (result as { session?: { id?: string } }).session;
    return session?.id ?? null;
  }
  return null;
}

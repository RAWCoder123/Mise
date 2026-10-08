import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import {
  RECALCULATION_MACHINE_RUNNER_MAX_TARGETS,
  runMachineRecalculationPass,
  type MachineRecalculationPorts,
  type RecalculationRunnerTarget
} from "../../../services/application/recalculationMachineRunner.ts";
import { calculateOperationalSignals, type OperationalPlanningSnapshot } from "../../../services/domain/operationalSignals.ts";
import {
  recalculationRunFromPersistedRow,
  recordRecalculationRunRpcArguments,
  type PersistedRecalculationRunRow
} from "../../../services/domain/recalculationRunTransport.ts";
import type { RecalculationRunInput } from "../../../services/repositories/repositoryContracts.ts";
import { HttpError, jsonResponse, readJsonObject } from "../_shared/http.ts";

/**
 * Secret-authenticated machine runner for Section 26 recalculation cycles.
 *
 * Cron / operators invoke this with `x-mise-recalculation-secret`. There is no
 * end-user JWT. Signal refresh still uses an active manager-class member through
 * the existing actor-bound planning RPCs; ledger rows are machine-sourced.
 */

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    await requireRunnerSecret(req);
    const body = await readJsonObject(req);
    const action = requireString(body.action, "action", 40);
    if (action !== "run") throw new HttpError(400, "Unsupported recalculation runner action.");

    const supabase = createServiceClient();
    const ports = createMachinePorts(supabase);
    const report = await runMachineRecalculationPass({
      ports,
      restaurantId: optionalString(body.restaurantId, "restaurantId", 64),
      limit: optionalInteger(body.maxRestaurants, "maxRestaurants", 1, RECALCULATION_MACHINE_RUNNER_MAX_TARGETS),
      now: new Date()
    });

    return jsonResponse({
      status: "completed",
      evaluatedAt: report.evaluatedAt,
      targetCount: report.targetCount,
      results: report.results.map((result) => ({
        restaurantId: result.restaurantId,
        status: result.status,
        reason: result.reason,
        operatingDate: result.report?.operatingDate ?? null,
        executionCount: result.report?.executions.length ?? 0,
        needsOperatorAttention: result.report?.needsOperatorAttention.length ?? 0
      }))
    });
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status);
    console.error("Recalculation runner request failed", safeError(error));
    return jsonResponse({ error: "Unexpected recalculation runner error." }, 500);
  }
});

function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new HttpError(500, "Supabase function environment is not configured.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function requireRunnerSecret(req: Request) {
  const expected = Deno.env.get("MISE_RECALCULATION_RUNNER_SECRET");
  const provided = req.headers.get("x-mise-recalculation-secret");
  if (!expected) throw new HttpError(503, "The recalculation runner is not configured.");
  if (!provided || !(await constantTimeEqual(provided, expected))) {
    throw new HttpError(401, "Invalid recalculation runner secret.");
  }
}

async function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right))
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index]! ^ b[index]!;
  return difference === 0;
}

function createMachinePorts(supabase: SupabaseClient): MachineRecalculationPorts {
  return {
    async listTargets(limit) {
      const { data, error } = await supabase.rpc("service_list_recalculation_runner_targets", {
        p_limit: limit
      });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      const targets: RecalculationRunnerTarget[] = [];
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const restaurantId = typeof (row as { restaurant_id?: unknown }).restaurant_id === "string"
          ? (row as { restaurant_id: string }).restaurant_id.trim()
          : "";
        const timeZone = typeof (row as { timezone?: unknown }).timezone === "string"
          ? (row as { timezone: string }).timezone.trim()
          : "";
        if (restaurantId && timeZone) targets.push({ restaurantId, timeZone });
      }
      return targets;
    },

    async resolveSignalActor(restaurantId) {
      const { data, error } = await supabase.rpc("service_resolve_recalculation_signal_actor", {
        p_restaurant_id: restaurantId
      });
      if (error) throw error;
      return typeof data === "string" && data.trim() ? data.trim() : null;
    },

    async listRuns(restaurantId, options = {}) {
      let query = supabase
        .from("recalculation_runs")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("operating_date", { ascending: false })
        .order("attempt", { ascending: true })
        .limit(options.limit ?? 64);
      if (options.sinceOperatingDate) {
        query = query.gte("operating_date", options.sinceOperatingDate);
      }
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as PersistedRecalculationRunRow[]).map(recalculationRunFromPersistedRow);
    },

    async recordMachineRun(input: RecalculationRunInput) {
      const { error } = await supabase.rpc(
        "service_record_machine_recalculation_run",
        recordRecalculationRunRpcArguments(input)
      );
      if (error) throw error;
    },

    async refreshSignals(restaurantId, signalActorUserId) {
      await refreshOperationalSignals(supabase, restaurantId, signalActorUserId);
    }
  };
}

async function refreshOperationalSignals(
  supabase: SupabaseClient,
  restaurantId: string,
  actorUserId: string
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const snapshot = await serviceRpc(supabase, "service_fetch_operational_planning_snapshot", {
        p_actor_user_id: actorUserId,
        p_restaurant_id: restaurantId
      }) as OperationalPlanningSnapshot & { revision: number };
      const revision = requireBoundedInteger(snapshot.revision, "planning revision", 0, Number.MAX_SAFE_INTEGER);
      const signals = calculateOperationalSignals(snapshot);
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
      await serviceRpc(supabase, "service_commit_operational_signals", {
        p_actor_user_id: actorUserId,
        p_restaurant_id: restaurantId,
        p_expected_revision: revision,
        p_recommendations: recommendations,
        p_insights: insights,
        p_complete_setup: false,
        p_setup_metadata: {}
      });
      return;
    } catch (error) {
      lastError = error;
      if (!isRevisionConflict(error) || attempt === 2) throw error;
    }
  }
  throw lastError;
}

async function serviceRpc(
  client: SupabaseClient,
  name: string,
  parameters: Record<string, unknown>
) {
  const { data, error } = await client.rpc(name, parameters);
  if (error) throw error;
  return data;
}

function isRevisionConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === "40001") return true;
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  return message.includes("planning snapshot changed");
}

function requireString(value: unknown, fieldName: string, maximumLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${fieldName} is required.`);
  }
  const text = value.trim();
  if (text.length > maximumLength) throw new HttpError(400, `${fieldName} is too long.`);
  return text;
}

function optionalString(value: unknown, fieldName: string, maximumLength: number) {
  if (value == null) return null;
  return requireString(value, fieldName, maximumLength);
}

function optionalInteger(value: unknown, fieldName: string, minimum: number, maximum: number) {
  if (value == null) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new HttpError(400, `${fieldName} is outside supported limits.`);
  }
  return value;
}

function requireBoundedInteger(value: unknown, fieldName: string, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new HttpError(400, `${fieldName} is outside supported limits.`);
  }
  return value;
}

function safeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message.slice(0, 200) };
  return { message: "unknown" };
}

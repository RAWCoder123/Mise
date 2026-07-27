import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import {
  TELEMETRY_MAX_PAYLOAD_BYTES,
  buildTelemetryCorrelation,
  safeExternalError,
  sanitizeTelemetryRecord,
  telemetryPayloadFits
} from "../../../services/domain/telemetrySecurity.ts";
import { HttpError, jsonResponse, readJsonObject } from "./http.ts";

export { HttpError, jsonHeaders, jsonResponse, MAX_JSON_BODY_BYTES, readJsonObject } from "./http.ts";

export type RestaurantRole = "owner" | "admin" | "manager" | "staff";
export type PosProvider = "square" | "toast" | "clover" | "lightspeed" | "manual_csv";
export type EdgeFunctionName =
  | "sync-pos-sales"
  | "generate-ai-insights"
  | "link-gmail"
  | "gmail-oauth-callback"
  | "send-supplier-email"
  | "operational-workflows"
  | "delete-account"
  | "export-restaurant-data";
export type EdgeFunctionSecurityEventType = "blocked" | "completed" | "error";

export interface FunctionInvocationReservation {
  allowed: boolean;
  reservation_id?: string;
  reason?: "forbidden" | "rate_limited";
  retry_after_seconds?: number;
  remaining?: number;
  window_seconds?: number;
}

export interface AuthenticatedContext {
  supabase: SupabaseClient;
  securitySupabase: SupabaseClient;
  user: User;
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, apikey, content-type"
    }
  });
}

export async function requireAuthenticatedContext(req: Request): Promise<AuthenticatedContext> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("authorization");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new HttpError(500, "Supabase function environment is not configured.");
  }

  if (!authorization) {
    throw new HttpError(401, "Missing Authorization header.");
  }
  const authorizationMatch = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!authorizationMatch) {
    throw new HttpError(401, "Invalid Authorization header.");
  }
  const accessToken = authorizationMatch[1];

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const securitySupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await securitySupabase.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new HttpError(401, "Invalid or expired user session.");
  }

  return { supabase, securitySupabase, user: data.user };
}

export async function requireRestaurantRole(
  supabase: SupabaseClient,
  userId: string,
  restaurantId: string,
  allowedRoles: RestaurantRole[]
) {
  const { data, error } = await supabase
    .from("restaurant_memberships")
    .select("role,status")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Unable to verify restaurant access.");
  }

  if (!data) {
    throw new HttpError(403, "You do not have access to this restaurant.");
  }

  const role = data.role as RestaurantRole;
  if (!allowedRoles.includes(role)) {
    throw new HttpError(403, "Your restaurant role cannot perform this action.");
  }

  return role;
}

export function requireString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${fieldName} is required.`);
  }
  return value.trim();
}

export function requireUuid(value: unknown, fieldName: string) {
  const text = requireString(value, fieldName).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(text)) {
    throw new HttpError(400, `${fieldName} must be a valid UUID.`);
  }
  return text;
}

export function requireIsoDateString(value: unknown, fieldName: string) {
  const text = requireString(value, fieldName);
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) {
    throw new HttpError(400, `${fieldName} must be a valid ISO date string.`);
  }
  return text;
}

export function requireEnum<TValue extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly TValue[]
): TValue {
  const text = requireString(value, fieldName);
  if (!allowedValues.includes(text as TValue)) {
    throw new HttpError(400, `${fieldName} is not supported.`);
  }
  return text as TValue;
}

export function safeFunctionMetadata(input: Record<string, unknown>) {
  return sanitizeMetadataValue(input) as Record<string, unknown>;
}

export async function reserveFunctionInvocation(
  securitySupabase: SupabaseClient,
  actorUserId: string,
  restaurantId: string,
  functionName: EdgeFunctionName,
  actionName: string,
  metadata: Record<string, unknown> = {}
): Promise<FunctionInvocationReservation> {
  const { data, error } = await securitySupabase.rpc("reserve_edge_function_invocation", {
    target_restaurant_id: restaurantId,
    p_actor_user_id: actorUserId,
    p_function_name: functionName,
    action_name: actionName,
    metadata: safeFunctionMetadata(metadata)
  });

  if (error) {
    captureFunctionError(error, { functionName, actionName, restaurantId });
    throw new HttpError(500, "Unable to verify this function request.");
  }

  const reservation = data as FunctionInvocationReservation | null;
  if (
    !reservation ||
    typeof reservation.allowed !== "boolean" ||
    (reservation.allowed && typeof reservation.reservation_id !== "string")
  ) {
    throw new HttpError(500, "Unable to verify this function request.");
  }

  return reservation;
}

export function firewallBlockedResponse(reservation: FunctionInvocationReservation) {
  captureFunctionError(new Error("edge_firewall_blocked"), {
    operation: "edge_firewall_blocked",
    operationId: reservation.reservation_id,
    reservationId: reservation.reservation_id,
    reason: reservation.reason ?? "forbidden"
  });
  if (reservation.reason === "rate_limited") {
    return jsonResponse(
      {
        status: "rate_limited",
        message: "Too many requests. Try again shortly.",
        retryAfterSeconds: reservation.retry_after_seconds ?? reservation.window_seconds ?? 60
      },
      429
    );
  }

  return jsonResponse(
    {
      status: "blocked",
      message: "This request is not allowed for the current restaurant session."
    },
    403
  );
}

export async function recordFunctionSecurityEvent(
  securitySupabase: SupabaseClient,
  actorUserId: string,
  reservationId: string,
  restaurantId: string,
  functionName: EdgeFunctionName,
  eventType: EdgeFunctionSecurityEventType,
  actionName: string,
  metadata: Record<string, unknown> = {}
) {
  const { error } = await securitySupabase.rpc("record_edge_function_security_event", {
    target_restaurant_id: restaurantId,
    p_actor_user_id: actorUserId,
    p_reservation_id: reservationId,
    p_function_name: functionName,
    p_event_type: eventType,
    action_name: actionName,
    metadata: safeFunctionMetadata(metadata)
  });

  if (error) {
    captureFunctionError(error, { functionName, eventType, actionName, restaurantId });
    throw new HttpError(500, "Unable to finalize this function request.");
  }
}

export interface InvocationTerminalContext {
  securitySupabase: SupabaseClient;
  actorUserId: string;
  reservationId: string;
  restaurantId: string;
  functionName: EdgeFunctionName;
}

export async function recordFunctionTerminalError(context: InvocationTerminalContext | null) {
  if (!context) return;
  const { error } = await context.securitySupabase.rpc("record_edge_function_security_event", {
    target_restaurant_id: context.restaurantId,
    p_actor_user_id: context.actorUserId,
    p_reservation_id: context.reservationId,
    p_function_name: context.functionName,
    p_event_type: "error",
    action_name: "function_error",
    metadata: { reason: "unexpected_function_error" }
  });
  if (error) {
    captureFunctionError(error, {
      functionName: context.functionName,
      eventType: "error",
      actionName: "function_error",
      restaurantId: context.restaurantId
    });
  }
}

export async function recordFunctionAuditLog(
  securitySupabase: SupabaseClient,
  actorUserId: string,
  restaurantId: string,
  action: string,
  entityTable: string,
  entityId: string | null = null,
  metadata: Record<string, unknown> = {}
) {
  const { error } = await securitySupabase.rpc("service_record_edge_audit_log", {
    p_actor_user_id: actorUserId,
    p_restaurant_id: restaurantId,
    p_action: action,
    p_entity_table: entityTable,
    p_entity_id: entityId,
    p_metadata: safeFunctionMetadata(metadata)
  });
  if (error) throw error;
}

export function handleError(error: unknown) {
  if (error instanceof HttpError) {
    if (error.status === 401 || error.status === 403) {
      captureFunctionError(new Error("edge_authorization_denied"), {
        operation: "edge_authorization_denied",
        status: error.status
      });
    }
    return jsonResponse({ error: error.message }, error.status);
  }
  captureFunctionError(error);
  console.error("Mise Edge Function failed", safeExternalError(error));
  return jsonResponse({ error: "Unexpected function error." }, 500);
}

export function captureFunctionError(error: unknown, context: Record<string, unknown> = {}) {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;

  const endpoint = sentryEnvelopeEndpoint(dsn);
  if (!endpoint) return;

  const externalError = safeExternalError(error);
  const requestId = safeContextString(context.requestId) ?? crypto.randomUUID();
  const operationId =
    safeContextString(context.operationId) ??
    safeContextString(context.reservationId) ??
    requestId;
  const operation =
    safeContextString(context.operation) ??
    safeContextString(context.actionName) ??
    safeContextString(context.functionName) ??
    "edge_function_error";
  const correlation = buildTelemetryCorrelation({
    environment: Deno.env.get("MISE_APP_ENV") ?? "staging",
    release: Deno.env.get("MISE_RELEASE") ?? Deno.env.get("DENO_DEPLOYMENT_ID") ?? "unversioned",
    operation,
    requestId,
    operationId,
    restaurantId: context.restaurantId,
    authoritativeEventId: context.authoritativeEventId ?? context.eventId
  });
  const event = {
    event_id: crypto.randomUUID().replaceAll("-", ""),
    timestamp: new Date().toISOString(),
    platform: "deno",
    level: "error",
    exception: {
      values: [
        {
          type: externalError.type,
          value: externalError.value
        }
      ]
    },
    environment: correlation.app_env,
    release: correlation.release,
    tags: { runtime: "supabase_edge_function", ...correlation },
    extra: sanitizeTelemetryRecord({
      ...context,
      ...correlation,
      ...(externalError.code ? { error_code: externalError.code } : {})
    })
  };

  let envelope = [
    JSON.stringify({ sent_at: new Date().toISOString(), dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event)
  ].join("\n");
  if (!telemetryPayloadFits(envelope)) {
    envelope = [
      JSON.stringify({ sent_at: new Date().toISOString(), dsn }),
      JSON.stringify({ type: "event" }),
      JSON.stringify({ ...event, extra: { telemetry_truncated: true } })
    ].join("\n");
  }
  if (!telemetryPayloadFits(envelope)) return;

  const captureRequest = fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-sentry-envelope" },
    body: envelope
  }).catch(() => undefined);
  const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (edgeRuntime) {
    edgeRuntime.waitUntil(captureRequest);
  }
}

function sentryEnvelopeEndpoint(dsn: string) {
  if (dsn.length > TELEMETRY_MAX_PAYLOAD_BYTES / 2) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace("/", "");
    if (!projectId) return null;
    return `${url.protocol}//${url.host}/api/${projectId}/envelope/`;
  } catch {
    return null;
  }
}

function sanitizeMetadataValue(value: unknown, key = ""): unknown {
  const forbidden = /(token|secret|password|authorization|cookie|credential|private|service_role|api[_-]?key)/i;
  if (forbidden.test(key)) return "[redacted]";
  if (typeof value === "string") return forbidden.test(value) ? "[redacted]" : value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => sanitizeMetadataValue(entry));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeMetadataValue(entryValue, entryKey)
      ])
    );
  }
  return null;
}

function safeContextString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const structuredInsightContract = {
  name: "mise_ai_insight",
  schema_version: "mise.ai_insight.v1",
  required: ["title", "summary", "recommended_action", "risk_level", "confidence", "affected_workflow", "evidence"],
  risk_levels: ["low", "medium", "high"],
  workflows: ["inventory", "ordering", "prep", "sales", "waste", "cost"]
} as const;

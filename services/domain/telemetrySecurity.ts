import { utf8ByteLength } from "./securityLimits.ts";

export type SafeTelemetryValue =
  | string
  | number
  | boolean
  | null
  | SafeTelemetryValue[]
  | { [key: string]: SafeTelemetryValue };

export const TELEMETRY_MAX_STRING_CHARACTERS = 256;
export const TELEMETRY_MAX_ARRAY_ITEMS = 20;
export const TELEMETRY_MAX_DEPTH = 3;
export const TELEMETRY_MAX_OBJECT_KEYS = 40;
export const TELEMETRY_MAX_PAYLOAD_BYTES = 8 * 1024;
export const EXTERNAL_ERROR_MESSAGE = "Mise operation failed.";
export const TELEMETRY_NOT_APPLICABLE = "not_applicable";

const forbiddenTelemetryMarker =
  /(token|secret|password|authorization|cookie|credential|private|service[_-]?role|api[_-]?key)/i;
const forbiddenTelemetryKeyMarker =
  /(email|phone|name|address|contact|recipient|sender|note|message|body|payload)/i;
const emailLikeValuePattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const bearerLikeValuePattern = /\bbearer\s+[A-Za-z0-9._~+/-]+=*/i;
const safeErrorTypePattern = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const safeErrorCodePattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const safeCorrelationValuePattern = /^[A-Za-z0-9][A-Za-z0-9_.:/@+-]{0,127}$/;

export interface TelemetryCorrelationInput {
  environment: unknown;
  release: unknown;
  operation: unknown;
  requestId: unknown;
  operationId: unknown;
  restaurantId?: unknown;
  authoritativeEventId?: unknown;
}

export interface TelemetryCorrelation extends Record<string, string> {
  app_env: string;
  release: string;
  operation: string;
  request_id: string;
  operation_id: string;
  restaurant_id: string;
  authoritative_event_id: string;
}

interface SanitizeState {
  objectKeys: number;
}

export function sanitizeTelemetryRecord(input: unknown): Record<string, SafeTelemetryValue> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const sanitized = sanitizeTelemetryValue(input, "", 0, { objectKeys: 0 });
  const record = isSafeRecord(sanitized) ? sanitized : {};
  if (utf8ByteLength(JSON.stringify(record)) <= TELEMETRY_MAX_PAYLOAD_BYTES) return record;
  return { telemetry_truncated: true };
}

export function safeExternalError(error: unknown) {
  const candidateType = error instanceof Error ? error.name : "Error";
  const candidateCode =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  const type =
    safeErrorTypePattern.test(candidateType) && !forbiddenTelemetryMarker.test(candidateType)
      ? candidateType
      : "Error";
  const code =
    typeof candidateCode === "string" &&
    safeErrorCodePattern.test(candidateCode) &&
    !forbiddenTelemetryMarker.test(candidateCode)
      ? candidateCode
      : undefined;

  return {
    type,
    value: EXTERNAL_ERROR_MESSAGE,
    ...(code ? { code } : {})
  };
}

export function telemetryPayloadFits(value: string | unknown) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return utf8ByteLength(serialized) <= TELEMETRY_MAX_PAYLOAD_BYTES;
}

export function buildTelemetryCorrelation(input: TelemetryCorrelationInput): TelemetryCorrelation {
  return {
    app_env: safeCorrelationValue(input.environment, "unknown"),
    release: safeCorrelationValue(input.release, "unversioned"),
    operation: safeCorrelationValue(input.operation, "unknown_operation"),
    request_id: safeCorrelationValue(input.requestId, "missing_request_id"),
    operation_id: safeCorrelationValue(input.operationId, "missing_operation_id"),
    restaurant_id: safeCorrelationValue(input.restaurantId, TELEMETRY_NOT_APPLICABLE),
    authoritative_event_id: safeCorrelationValue(
      input.authoritativeEventId,
      TELEMETRY_NOT_APPLICABLE
    )
  };
}

function sanitizeTelemetryValue(
  value: unknown,
  key: string,
  depth: number,
  state: SanitizeState
): SafeTelemetryValue {
  if (forbiddenTelemetryMarker.test(key) || forbiddenTelemetryKeyMarker.test(key)) {
    return "[redacted]";
  }
  if (typeof value === "string") {
    if (
      forbiddenTelemetryMarker.test(value) ||
      emailLikeValuePattern.test(value) ||
      bearerLikeValuePattern.test(value)
    ) {
      return "[redacted]";
    }
    return value.slice(0, TELEMETRY_MAX_STRING_CHARACTERS);
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  if (value === undefined || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    return null;
  }
  if (depth >= TELEMETRY_MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) {
    return value
      .slice(0, TELEMETRY_MAX_ARRAY_ITEMS)
      .map((entry) => sanitizeTelemetryValue(entry, "", depth + 1, state));
  }
  if (typeof value === "object") {
    const output: Record<string, SafeTelemetryValue> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      if (state.objectKeys >= TELEMETRY_MAX_OBJECT_KEYS) break;
      state.objectKeys += 1;
      output[entryKey.slice(0, TELEMETRY_MAX_STRING_CHARACTERS)] = sanitizeTelemetryValue(
        entryValue,
        entryKey,
        depth + 1,
        state
      );
    }
    return output;
  }
  return null;
}

function isSafeRecord(value: SafeTelemetryValue): value is Record<string, SafeTelemetryValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeCorrelationValue(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (
    !safeCorrelationValuePattern.test(normalized) ||
    forbiddenTelemetryMarker.test(normalized)
  ) {
    return fallback;
  }
  return normalized;
}

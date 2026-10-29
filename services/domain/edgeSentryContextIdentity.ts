/**
 * Edge Sentry capture-context identity helpers (MISE-005TS).
 *
 * Pins `supabase/functions/_shared/mise.ts` `safeContextString` prep outside
 * the Expo UI graph so Node tests can exercise inventing proofs without
 * loading React Native. The prior path Unicode-trimmed Sentry capture context
 * tokens (`requestId`, `operationId`, `reservationId`, `operation`,
 * `actionName`, `functionName`) before they fed `buildTelemetryCorrelation`
 * and Sentry tags (`'\u2003req_abc123\u2003'.trim() === 'req_abc123'`). Soft
 * empty / Unicode-only space also collapsed through `.trim()` into the
 * intentional empty → per-field fallback path (`crypto.randomUUID()`,
 * `"edge_function_error"`, …).
 *
 * These are Edge **Sentry capture-context tokens** only — not
 * `buildTelemetryCorrelation` / `safeCorrelationValue` prep (open #917 /
 * MISE-005SE), not activity-event idempotency keys (open #868 / MISE-005QH),
 * not restaurant-tasks correlationId (open #809 / MISE-005OA), and not Square
 * OAuth / catalog / order-sale `stringField` siblings. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so padded capture context
 * cannot invent durable Sentry / correlation identity upstream of #917.
 * Ordinary ASCII whitespace still trims clean. Case and accents are left
 * unchanged.
 *
 * Complements open telemetry correlation tip #917 / MISE-005SE without sharing
 * that module or rewriting `sanitizeTelemetryRecord` / `safeExternalError`.
 * Leave `buildTelemetryCorrelation` and sibling Sentry redaction alone for
 * their separate tips.
 */

const MAX_EDGE_SENTRY_CONTEXT_STRING = 256;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized capture-context token before it is stored
 * on durable Sentry tags / telemetry correlation inputs.
 */
export function asciiTrimEdgeSentryContextString(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Edge Sentry capture-context token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeEdgeSentryContextString(
  value: string
): string | null {
  const trimmed = asciiTrimEdgeSentryContextString(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_EDGE_SENTRY_CONTEXT_STRING) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Edge `safeContextString` capture-context tokens.
 * Preserves soft empty → undefined/fallback (prior `.trim()` emptiness →
 * `crypto.randomUUID()` / `"edge_function_error"`) while refusing to invent a
 * clean durable context token via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `??` fallback chain owns the fail-closed path without inventing a clean
 * durable Sentry / correlation identity from padding.
 */
export function normalizeEdgeSentryContextString(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional empty → fallback path. Do not
  // invent a capture-context token from padding.
  if (!value.trim()) return null;
  return canonicalizeEdgeSentryContextString(value);
}

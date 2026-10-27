/**
 * Telemetry correlation identity helpers (MISE-005SE).
 *
 * Pins `services/domain/telemetrySecurity.ts` `safeCorrelationValue` prep
 * outside Expo/AsyncStorage so Node tests can exercise inventing proofs.
 * The prior path fed Unicode `.trim()` into durable telemetry correlation
 * fields (`app_env`, `release`, `operation`, `request_id`, `operation_id`,
 * `restaurant_id`, `authoritative_event_id`), so NBSP / em-space padding
 * invented a clean correlation identity
 * (`'\u2003req_abc123\u2003'.trim() === 'req_abc123'`). Soft empty /
 * Unicode-only space also invented the per-field fallback branch via
 * `'\u2003'.trim() === ''` failing the safe-correlation pattern.
 *
 * These are observability **correlation tokens** only — not activity-event
 * idempotency keys (open #868 / MISE-005QH), not restaurant-tasks
 * correlationId (open #809 / MISE-005OA), and not finding-decision /
 * inventory outbox object identities. Soft empty (missing, non-string, `""`,
 * ASCII whitespace, or Unicode-only space) keeps the prior per-field
 * fallback contracts. Ordinary ASCII whitespace still trims clean before
 * the allowlist pattern. Unicode-padded, control-bearing, over-long, or
 * secret-like tokens fall back so padded correlation values cannot invent
 * reviewed durable telemetry identity.
 *
 * Complements open activity idempotency tip #868 / MISE-005QH without
 * sharing that module. Leave `sanitizeTelemetryRecord` string slicing,
 * Sentry redaction, and unrelated UUID restaurant-scope trims alone.
 */

/** Matches `safeCorrelationValuePattern` first char + `{0,127}` bound. */
export const TELEMETRY_CORRELATION_VALUE_MAX_CHARACTERS = 128;

const safeCorrelationValuePattern = /^[A-Za-z0-9][A-Za-z0-9_.:/@+-]{0,127}$/;
const forbiddenTelemetryMarker =
  /(token|secret|password|authorization|cookie|credential|private|service[_-]?role|api[_-]?key)/i;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized telemetry correlation identity before
 * Sentry tags / structured log correlation.
 */
export function asciiTrimTelemetryCorrelationValue(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a telemetry correlation token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * control-bearing, pattern-invalid, or secret-like.
 */
export function canonicalizeTelemetryCorrelationValue(
  value: string
): string | null {
  const trimmed = asciiTrimTelemetryCorrelationValue(value);
  if (!trimmed) return null;
  if (trimmed.length > TELEMETRY_CORRELATION_VALUE_MAX_CHARACTERS) {
    return null;
  }
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  if (!safeCorrelationValuePattern.test(trimmed)) return null;
  if (forbiddenTelemetryMarker.test(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for `safeCorrelationValue` / `buildTelemetryCorrelation`.
 * Preserves soft empty → per-field fallback while refusing Unicode-padded
 * tokens that would invent a durable correlation identity. Non-string and
 * unsafe tokens soft to `null` so the caller can apply its field fallback.
 */
export function normalizeTelemetryCorrelationValue(
  value: unknown
): string | null {
  if (typeof value !== "string") return null;
  if (value === "") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those and failed the allowlist → field fallback.
  if (!value.trim()) return null;
  return canonicalizeTelemetryCorrelationValue(value);
}

/**
 * Resolve a telemetry correlation field: canonical ASCII-C value or the
 * prior per-field fallback when soft-empty / unsafe / inventing padding.
 */
export function resolveTelemetryCorrelationValue(
  value: unknown,
  fallback: string
): string {
  return normalizeTelemetryCorrelationValue(value) ?? fallback;
}

/**
 * Activity-event idempotency-key identity helpers (MISE-005QH).
 *
 * Pins domain-layer `activityIdempotencyKey` explicit metadata prep outside
 * the repository graph so Node tests can exercise inventing proofs without
 * loading Supabase or AsyncStorage. The prior path Unicode-trimmed
 * `event.metadata.idempotencyKey` before returning it as the durable
 * dedupe / persist identity
 * (`'\u2003recommendation_created:rec-1\u2003'.trim() === 'recommendation_created:rec-1'`).
 *
 * Activity idempotency keys are single-line object identities (often
 * composed tokens such as `recommendation_created:<id>`), not free-form
 * multiline prose. Only ASCII end trim is pinned; case and accents are left
 * unchanged so presentation stays operator-faithful. Empty, Unicode-padded,
 * control-bearing, and over-long tokens soft to `null` so
 * `activityIdempotencyKey` can fall through to its synthetic key rather than
 * inventing equality with an unpadded explicit key. This tip does not throw;
 * the prior helper never threw on a bad explicit key.
 *
 * Max length stays 240 to match `public.activity_events.idempotency_key`
 * (`length(trim(idempotency_key)) between 1 and 240`).
 *
 * Complements open finding-decision object identity tip #790 / MISE-005NH
 * (clientEventId / idempotencyKey on finding-decision normalize only) and
 * activity_events SQL cntrl CHECK tip #569 without sharing those modules or
 * rewriting `requireRestaurantId` Unicode trim, mise-actions domain
 * idempotency (#772), or inventory-ledger / outbox emptiness-only checks.
 */

/** Matches `public.activity_events.idempotency_key` CHECK bound. */
export const ACTIVITY_EVENT_IDEMPOTENCY_KEY_MAX_CHARACTERS = 240;

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized activity-event idempotency identity
 * before dedupe or row persist.
 */
export function asciiTrimActivityEventIdempotencyKey(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an activity-event explicit idempotency key under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long
 * for the activity_events bound, or containing ASCII controls.
 */
export function canonicalizeActivityEventIdempotencyKey(
  value: string
): string | null {
  const trimmed = asciiTrimActivityEventIdempotencyKey(value);
  if (!trimmed) return null;
  if (trimmed.length > ACTIVITY_EVENT_IDEMPOTENCY_KEY_MAX_CHARACTERS) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for `activityIdempotencyKey` explicit metadata selection.
 * Preserves soft empty → fallthrough (prior `.trim()` emptiness check) while
 * refusing to invent a clean key via Unicode em-space / NBSP trim. Non-string
 * and unsafe tokens soft to `null` so the synthetic key path remains available.
 */
export function normalizeActivityEventIdempotencyKey(
  value: unknown
): string | null {
  if (typeof value !== "string") return null;
  if (value === "") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those and fell through to the synthetic key.
  if (!value.trim()) return null;
  return canonicalizeActivityEventIdempotencyKey(value);
}

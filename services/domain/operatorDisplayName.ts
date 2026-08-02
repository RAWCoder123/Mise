/** Matches `service_update_my_profile` length bounds in Postgres. */
export const OPERATOR_DISPLAY_NAME_MAX_LENGTH = 120;

const FALLBACK_OPERATOR_NAME = "Restaurant Operator";

/**
 * Normalize an operator display name for profile writes.
 * Trims whitespace only; restaurant/menu names are never rewritten here.
 */
export function normalizeOperatorDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Profile name must be between 1 and 120 characters.");
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > OPERATOR_DISPLAY_NAME_MAX_LENGTH) {
    throw new Error("Profile name must be between 1 and 120 characters.");
  }
  return normalized;
}

/**
 * Resolve the operator-facing display name for session hydration.
 * Prefer the stored profile name; fall back to the email local-part.
 */
export function resolveOperatorDisplayName(
  storedName: string | null | undefined,
  email: string | null | undefined
): string {
  if (typeof storedName === "string") {
    const trimmed = storedName.trim();
    if (trimmed.length > 0) return trimmed;
  }

  const localPart =
    typeof email === "string" && email.includes("@")
      ? email.split("@")[0]?.trim()
      : typeof email === "string"
        ? email.trim()
        : "";

  if (localPart) return localPart;
  return FALLBACK_OPERATOR_NAME;
}

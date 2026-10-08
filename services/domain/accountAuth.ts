// Pure sign-up decision logic for the Mise account flows. Keeping the
// Supabase response interpretation here lets the session context stay thin
// and makes the confirmation/already-registered branches unit-testable.

/** Supabase's default minimum password length. */
export const MIN_ACCOUNT_PASSWORD_LENGTH = 6;
export const MAX_ACCOUNT_EMAIL_LENGTH = 254;
export const MIN_INVITE_PASSWORD_LENGTH = 12;
export const MAX_INVITE_PASSWORD_LENGTH = 128;
const MAX_INVITE_CALLBACK_LENGTH = 20_000;
const MAX_INVITE_TOKEN_LENGTH = 12_000;

export type SignUpValidationError =
  | "email_required"
  | "email_invalid"
  | "password_too_short"
  | "password_mismatch";

export type SignUpOutcome = "session_ready" | "confirmation_required" | "already_registered";

export type InviteCallbackError =
  | "invite_callback_required"
  | "invite_callback_invalid"
  | "invite_callback_wrong_destination"
  | "invite_callback_wrong_type"
  | "invite_callback_incomplete"
  | "invite_callback_mixed_credentials"
  | "invite_callback_rejected";

export type InvitePasswordValidationError =
  | "password_too_short"
  | "password_too_long"
  | "password_mismatch";

export interface InviteCallbackTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005KS). Only ASCII A-Z is folded; Unicode-aware `toLowerCase`
 * would map Kelvin sign `K` → `k` and invent an ordinary ASCII mailbox
 * (`Khef@…` → `chef@…`) Auth admission would treat as a different
 * identity under COLLATE C.
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * Trim only ASCII whitespace so account mailboxes stay aligned with
 * C-locale `btrim` / `[[:space:]]` gates rather than Unicode `trim()`.
 */
function asciiCTrim(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/** ASCII controls under C locale `[[:cntrl:]]` (0x00–0x1F and DEL). */
const asciiCControl = /[\u0000-\u001f\u007f]/;

/**
 * ASCII C mailbox shape — mirrors SQL
 * `^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$` under COLLATE "C".
 * Uses an explicit ASCII whitespace class instead of Unicode `\s`.
 */
const asciiCMailboxShape = /^[^ \t\n\r\f\v@]+@[^ \t\n\r\f\v@]+\.[^ \t\n\r\f\v@]+$/;

/**
 * Normalize an account email under ASCII C identity (MISE-005KS).
 * Returns null when the input is not a usable mailbox.
 */
export function normalizeAccountEmail(value: string): string | null {
  const normalized = asciiCTrim(asciiCLower(value));
  if (normalized.length < 3 || normalized.length > MAX_ACCOUNT_EMAIL_LENGTH) return null;
  if (asciiCControl.test(normalized)) return null;
  if (!asciiCMailboxShape.test(normalized)) return null;
  return normalized;
}

/** True when the input is a usable account mailbox under ASCII C identity. */
export function isValidAccountEmail(value: string) {
  return normalizeAccountEmail(value) !== null;
}

/**
 * Parse the exact custom-scheme callback issued for an owner invitation.
 *
 * Supabase returns the invite session in the URL fragment. Query credentials
 * are accepted only as a complete alternate representation for SDK/runtime
 * compatibility; credentials from the two locations are never combined.
 */
export function parseInviteCallbackUrl(value: string): InviteCallbackTokens | InviteCallbackError {
  if (!value) return "invite_callback_required";
  if (value.length > MAX_INVITE_CALLBACK_LENGTH) return "invite_callback_invalid";

  let callback: URL;
  try {
    callback = new URL(value);
  } catch {
    return "invite_callback_invalid";
  }

  const destination = `${callback.hostname}${callback.pathname}`.replace(/^\/+|\/+$/g, "");
  if (callback.protocol !== "mise:" || destination !== "accept-invite") {
    return "invite_callback_wrong_destination";
  }

  const fragment = new URLSearchParams(callback.hash.replace(/^#/, ""));
  const query = callback.searchParams;
  const credentialKeys = ["access_token", "refresh_token", "type", "error", "error_code"];
  const fragmentHasCredentials = credentialKeys.some((key) => fragment.has(key));
  const queryHasCredentials = credentialKeys.some((key) => query.has(key));
  if (fragmentHasCredentials && queryHasCredentials) return "invite_callback_mixed_credentials";

  const source = fragmentHasCredentials ? fragment : query;
  if (source.has("error") || source.has("error_code")) return "invite_callback_rejected";
  if (source.get("type") !== "invite") return "invite_callback_wrong_type";

  const accessToken = source.get("access_token") ?? "";
  const refreshToken = source.get("refresh_token") ?? "";
  if (
    !accessToken ||
    !refreshToken ||
    accessToken.length > MAX_INVITE_TOKEN_LENGTH ||
    refreshToken.length > MAX_INVITE_TOKEN_LENGTH
  ) {
    return "invite_callback_incomplete";
  }

  return { accessToken, refreshToken };
}

export function validateInvitePassword(
  password: string,
  confirmPassword: string
): InvitePasswordValidationError | null {
  if (password.length < MIN_INVITE_PASSWORD_LENGTH) return "password_too_short";
  if (password.length > MAX_INVITE_PASSWORD_LENGTH) return "password_too_long";
  if (password !== confirmPassword) return "password_mismatch";
  return null;
}

export function validateSignUpInput(
  email: string,
  password: string,
  confirmPassword: string
): SignUpValidationError | null {
  // MISE-005KS: ASCII C trim for emptiness — do not Unicode-trim NBSP into
  // a missing mailbox, and do not invent a clean address before shape checks.
  const normalizedEmail = asciiCTrim(email);
  if (!normalizedEmail) return "email_required";
  if (!isValidAccountEmail(normalizedEmail)) return "email_invalid";
  if (password.length < MIN_ACCOUNT_PASSWORD_LENGTH) return "password_too_short";
  if (password !== confirmPassword) return "password_mismatch";
  return null;
}

interface SignUpResultShape {
  user: { identities?: unknown[] | null } | null;
  session: unknown | null;
}

/**
 * Interpret a successful `supabase.auth.signUp` response.
 *
 * - A session means email confirmation is disabled and the user is signed in.
 * - A user without a session means Supabase sent a confirmation email.
 * - A user with an empty `identities` array is Supabase's anti-enumeration
 *   response for an email that is already registered.
 */
export function interpretSignUpResult(result: SignUpResultShape): SignUpOutcome {
  if (result.user && Array.isArray(result.user.identities) && result.user.identities.length === 0) {
    return "already_registered";
  }
  if (result.session) return "session_ready";
  return "confirmation_required";
}

/** Matches Supabase auth errors raised when the email already has an account. */
export function isUserAlreadyRegisteredError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code === "user_already_exists" || code === "email_exists") return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && /already (been )?registered|already exists/i.test(message);
}

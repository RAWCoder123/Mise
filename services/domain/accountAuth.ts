// Pure sign-up decision logic for the Mise account flows. Keeping the
// Supabase response interpretation here lets the session context stay thin
// and makes the confirmation/already-registered branches unit-testable.

/** Supabase's default minimum password length. */
export const MIN_ACCOUNT_PASSWORD_LENGTH = 6;
export const MAX_ACCOUNT_EMAIL_LENGTH = 254;

export type SignUpValidationError =
  | "email_required"
  | "email_invalid"
  | "password_too_short"
  | "password_mismatch";

export type SignUpOutcome = "session_ready" | "confirmation_required" | "already_registered";

export function isValidAccountEmail(value: string) {
  const normalized = value.trim();
  return (
    normalized.length >= 3 &&
    normalized.length <= MAX_ACCOUNT_EMAIL_LENGTH &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  );
}

export function validateSignUpInput(
  email: string,
  password: string,
  confirmPassword: string
): SignUpValidationError | null {
  const normalizedEmail = email.trim();
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

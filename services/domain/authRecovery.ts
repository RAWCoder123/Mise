import { isValidAccountEmail, MAX_ACCOUNT_EMAIL_LENGTH } from "./accountAuth";

export const MIN_RECOVERY_PASSWORD_LENGTH = 8;
export const MAX_RECOVERY_PASSWORD_LENGTH = 72;
export const PASSWORD_RESET_PATH = "/reset-password";

export function normalizeRecoveryEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidRecoveryEmail(email: string): boolean {
  const normalized = normalizeRecoveryEmail(email);
  if (normalized.length > MAX_ACCOUNT_EMAIL_LENGTH) return false;
  return isValidAccountEmail(normalized);
}

export function validateNewPassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < MIN_RECOVERY_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_RECOVERY_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_RECOVERY_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_RECOVERY_PASSWORD_LENGTH} characters.`;
  }
  if (/\s/.test(password)) {
    return "Password cannot contain spaces.";
  }
  return null;
}

export function isPasswordRecoveryAuthEvent(event: string | null | undefined): boolean {
  return event === "PASSWORD_RECOVERY";
}

export type AuthCallbackParams = {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
};

export function extractAuthCallbackParams(url: string): AuthCallbackParams {
  const empty: AuthCallbackParams = {
    code: null,
    accessToken: null,
    refreshToken: null,
    type: null
  };
  if (!url || typeof url !== "string") return empty;

  try {
    const parsed = new URL(url);
    const hashParams = new URLSearchParams(parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash);
    const query = parsed.searchParams;

    const code = firstParam(query.get("code"), hashParams.get("code"));
    const accessToken = firstParam(query.get("access_token"), hashParams.get("access_token"));
    const refreshToken = firstParam(query.get("refresh_token"), hashParams.get("refresh_token"));
    const type = firstParam(query.get("type"), hashParams.get("type"));

    return {
      code,
      accessToken,
      refreshToken,
      type: type ? type.toLowerCase() : null
    };
  } catch {
    return empty;
  }
}

export function isAuthSessionCallback(params: AuthCallbackParams): boolean {
  return Boolean(params.code) || Boolean(params.accessToken && params.refreshToken);
}

export function isPasswordResetCallbackUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    const host = (parsed.hostname || "").toLowerCase();
    const path = (parsed.pathname || "").toLowerCase();
    if (host === "reset-password") return true;
    return path === PASSWORD_RESET_PATH || path.endsWith(PASSWORD_RESET_PATH);
  } catch {
    return false;
  }
}

/**
 * Recovery is scoped tightly so signup confirm and invite PKCE codes still
 * exchange a session without forcing the reset-password UX.
 */
export function isRecoveryCallback(params: AuthCallbackParams, url?: string): boolean {
  if (params.type === "recovery") return true;
  if (url && isPasswordResetCallbackUrl(url) && isAuthSessionCallback(params)) return true;
  return false;
}

function firstParam(...values: Array<string | null>): string | null {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return null;
}

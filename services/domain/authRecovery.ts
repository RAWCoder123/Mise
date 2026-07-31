import { isValidMemberEmail, normalizeMemberEmail } from "./teamMembership";

export const MIN_RECOVERY_PASSWORD_LENGTH = 8;
export const MAX_RECOVERY_PASSWORD_LENGTH = 72;
export const PASSWORD_RESET_PATH = "/reset-password";

export function normalizeRecoveryEmail(email: string): string {
  return normalizeMemberEmail(email);
}

export function isValidRecoveryEmail(email: string): boolean {
  return isValidMemberEmail(email);
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

export function isRecoveryCallback(params: AuthCallbackParams): boolean {
  return params.type === "recovery" || Boolean(params.code) || Boolean(params.accessToken && params.refreshToken);
}

function firstParam(...values: Array<string | null>): string | null {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return null;
}

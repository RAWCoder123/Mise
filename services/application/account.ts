import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import {
  parseInviteCallbackUrl,
  validateInvitePassword,
  type InviteCallbackError,
  type InvitePasswordValidationError
} from "../domain/accountAuth";

export type InviteAcceptanceErrorCode =
  | InviteCallbackError
  | InvitePasswordValidationError
  | "invite_service_unavailable"
  | "invite_session_failed"
  | "invite_password_update_failed";

export class InviteAcceptanceError extends Error {
  readonly code: InviteAcceptanceErrorCode;

  constructor(code: InviteAcceptanceErrorCode) {
    super(code);
    this.name = "InviteAcceptanceError";
    this.code = code;
  }
}

export interface AcceptedOwnerInvitation {
  userId: string;
  email: string;
}

/**
 * Complete an administrator-issued owner invitation without exposing provider
 * credentials to the screen. A failed password update signs out the partial
 * invite session so the app cannot continue in a half-accepted state.
 */
export async function acceptOwnerInvitation(
  callbackUrl: string,
  password: string,
  confirmPassword: string
): Promise<AcceptedOwnerInvitation> {
  const passwordError = validateInvitePassword(password, confirmPassword);
  if (passwordError) throw new InviteAcceptanceError(passwordError);

  const callback = parseInviteCallbackUrl(callbackUrl);
  if (typeof callback === "string") throw new InviteAcceptanceError(callback);
  if (!isSupabaseConfigured || !supabase) {
    throw new InviteAcceptanceError("invite_service_unavailable");
  }

  const session = await supabase.auth.setSession({
    access_token: callback.accessToken,
    refresh_token: callback.refreshToken
  });
  if (session.error || !session.data.user) {
    await supabase.auth.signOut({ scope: "local" });
    throw new InviteAcceptanceError("invite_session_failed");
  }

  const updated = await supabase.auth.updateUser({ password });
  if (updated.error || !updated.data.user || updated.data.user.id !== session.data.user.id) {
    await supabase.auth.signOut({ scope: "local" });
    throw new InviteAcceptanceError("invite_password_update_failed");
  }

  return {
    userId: updated.data.user.id,
    email: updated.data.user.email ?? ""
  };
}

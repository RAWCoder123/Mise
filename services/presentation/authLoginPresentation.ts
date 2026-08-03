export type LoginNoticeReason =
  | "emailRequired"
  | "passwordRequired"
  | "signInFailed"
  | "demoFailed"
  | "resetRequestFailed"
  | "resetSent";

export function presentLoginFormEditable(cloudConfigured: boolean, loading: boolean): boolean {
  return cloudConfigured && !loading;
}

export function resolveLoginSignInFailureReason(input: {
  email: string;
  password: string;
}): Extract<LoginNoticeReason, "emailRequired" | "passwordRequired"> | null {
  if (!input.email.trim()) return "emailRequired";
  if (!input.password) return "passwordRequired";
  return null;
}

export function resolveLoginResetRequestFailureReason(input: {
  email: string;
}): Extract<LoginNoticeReason, "emailRequired"> | null {
  if (!input.email.trim()) return "emailRequired";
  return null;
}

export function presentLoginNoticeCopy(
  reason: LoginNoticeReason,
  copy: Record<LoginNoticeReason, { title: string; message: string }>
): { tone: "danger" | "success"; title: string; message: string } {
  const selected = copy[reason] ?? copy.signInFailed;
  return {
    tone: reason === "resetSent" ? "success" : "danger",
    title: selected.title,
    message: selected.message
  };
}

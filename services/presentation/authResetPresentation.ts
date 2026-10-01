export type ResetFailureReason =
  | "tooShort"
  | "invalidPassword"
  | "mismatch"
  | "updateFailed";

export function presentResetFormEditable(
  cloudConfigured: boolean,
  loading: boolean,
  recoveryPending: boolean
): boolean {
  return cloudConfigured && !loading && recoveryPending;
}

export function resolveResetFormFailureReason(input: {
  password: string;
  confirmPassword: string;
  validatePassword: (password: string) => string | null;
}): Exclude<ResetFailureReason, "updateFailed"> | null {
  const passwordError = input.validatePassword(input.password);
  if (passwordError) {
    return input.password.length < 8 ? "tooShort" : "invalidPassword";
  }
  if (input.password !== input.confirmPassword) return "mismatch";
  return null;
}

export function presentResetFailureCopy(
  reason: ResetFailureReason,
  copy: Record<ResetFailureReason, { title: string; message: string }>
): { tone: "danger"; title: string; message: string } {
  const selected = copy[reason] ?? copy.updateFailed;
  return {
    tone: "danger",
    title: selected.title,
    message: selected.message
  };
}

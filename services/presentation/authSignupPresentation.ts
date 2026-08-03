export type SignupFailureReason =
  | "emailRequired"
  | "emailInvalid"
  | "tooShort"
  | "invalidPassword"
  | "mismatch"
  | "alreadyExists"
  | "createFailed";

export function presentSignupFormEditable(
  cloudConfigured: boolean,
  loading: boolean
): boolean {
  return cloudConfigured && !loading;
}

export function resolveSignupFormFailureReason(input: {
  email: string;
  password: string;
  confirmPassword: string;
  isValidEmail: (email: string) => boolean;
  normalizeEmail: (email: string) => string;
  validatePassword: (password: string) => string | null;
}): SignupFailureReason | null {
  const normalizedEmail = input.normalizeEmail(input.email);
  if (!normalizedEmail) return "emailRequired";
  if (!input.isValidEmail(normalizedEmail)) return "emailInvalid";

  const passwordError = input.validatePassword(input.password);
  if (passwordError) {
    return input.password.length < 8 ? "tooShort" : "invalidPassword";
  }

  if (input.password !== input.confirmPassword) return "mismatch";
  return null;
}

export function resolveSignupCreateFailureReason(error: unknown): SignupFailureReason {
  const message = error instanceof Error ? error.message : "";
  if (/already exists|already registered|User already registered/i.test(message)) {
    return "alreadyExists";
  }
  return "createFailed";
}

export function presentSignupFailureCopy(
  reason: SignupFailureReason,
  copy: Record<SignupFailureReason, { title: string; message: string }>
): { tone: "danger"; title: string; message: string } {
  const selected = copy[reason] ?? copy.createFailed;
  return {
    tone: "danger",
    title: selected.title,
    message: selected.message
  };
}

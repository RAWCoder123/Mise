export type SetupCreateNoticeReason =
  | "profileContinue"
  | "profileNavigate"
  | "validation"
  | "createFailed";

export function presentSetupFormBusy(loading: boolean, submissionLocked: boolean): boolean {
  return loading || submissionLocked;
}

export function presentSetupFormEditable(canConfigure: boolean, busy: boolean): boolean {
  return canConfigure && !busy;
}

export function presentSetupCreateNoticeCopy(
  reason: SetupCreateNoticeReason,
  copy: Record<SetupCreateNoticeReason, { title: string; message: string }>
): { tone: "danger"; title: string; message: string } {
  const selected = copy[reason] ?? copy.createFailed;
  return {
    tone: "danger",
    title: selected.title,
    message: selected.message
  };
}

export function resolveSetupCreateFailureReason(_error: unknown): SetupCreateNoticeReason {
  return "createFailed";
}

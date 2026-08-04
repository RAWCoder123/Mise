export type SetupCreateNoticeReason =
  | "profileContinue"
  | "profileNavigate"
  | "validation"
  | "createFailed"
  | "workspaceUnverified";

export type SetupWorkspaceAccessConfirmOutcome = "restored" | "empty";

export function presentSetupFormBusy(loading: boolean, submissionLocked: boolean): boolean {
  return loading || submissionLocked;
}

export function presentSetupFormEditable(canConfigure: boolean, busy: boolean): boolean {
  return canConfigure && !busy;
}

/** Fail-closed membership clear must not mint a new restaurant until access is rechecked. */
export function presentSetupCreateBlockedByUnverifiedAccess(workspaceAccessUnverified: boolean): boolean {
  return workspaceAccessUnverified;
}

export function presentSetupCreateNoticeCopy(
  reason: SetupCreateNoticeReason,
  copy: Record<SetupCreateNoticeReason, { title: string; message: string }>
): { tone: "danger" | "caution"; title: string; message: string } {
  const selected = copy[reason] ?? copy.createFailed;
  return {
    tone: reason === "workspaceUnverified" ? "caution" : "danger",
    title: selected.title,
    message: selected.message
  };
}

export function resolveSetupCreateFailureReason(_error: unknown): SetupCreateNoticeReason {
  return "createFailed";
}

export function resolveSetupWorkspaceAccessConfirmOutcome(activeRestaurantId: string | null): SetupWorkspaceAccessConfirmOutcome {
  return activeRestaurantId ? "restored" : "empty";
}

export type ProfileIdentityNoticeReason =
  | "invalidName"
  | "missingRestaurant"
  | "unknown"
  | "saved";

export type ProfileIdentityFailureReason = Exclude<ProfileIdentityNoticeReason, "saved">;

export function presentProfileIdentityFormEditable(
  interactive: boolean,
  saving: boolean
): boolean {
  return interactive && !saving;
}

export function resolveProfileIdentitySaveFailureReason(
  error: unknown
): ProfileIdentityFailureReason {
  const message = error instanceof Error ? error.message : "";
  if (!message.trim()) return "unknown";
  if (/display name|1 [Aa]nd 120|between 1 and 120/i.test(message)) return "invalidName";
  if (/restaurant/i.test(message)) return "missingRestaurant";
  return "unknown";
}

export function presentProfileIdentityNoticeCopy(
  reason: ProfileIdentityNoticeReason,
  copy: Record<ProfileIdentityNoticeReason, { title: string; message: string }>
): { tone: "danger" | "success"; title: string; message: string } {
  const selected = copy[reason] ?? copy.unknown;
  return {
    tone: reason === "saved" ? "success" : "danger",
    title: selected.title,
    message: selected.message
  };
}

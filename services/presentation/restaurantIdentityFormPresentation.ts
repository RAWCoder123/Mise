export type RestaurantIdentityNoticeReason =
  | "invalidName"
  | "invalidAddress"
  | "invalidCuisine"
  | "invalidTimezone"
  | "invalidCurrency"
  | "invalidServiceStyle"
  | "invalidBrandColor"
  | "invalidAccentColor"
  | "invalidLogoUrl"
  | "unknown"
  | "saved";

export type RestaurantIdentityFailureReason = Exclude<RestaurantIdentityNoticeReason, "saved">;

export function presentRestaurantIdentityFormEditable(
  canEdit: boolean,
  interactive: boolean,
  saving: boolean
): boolean {
  return canEdit && interactive && !saving;
}

export function resolveRestaurantIdentitySaveFailureReason(
  error: unknown
): RestaurantIdentityFailureReason {
  const message = error instanceof Error ? error.message : "";
  if (!message.trim()) return "unknown";
  if (/name must be between|Restaurant name/i.test(message)) return "invalidName";
  if (/address/i.test(message)) return "invalidAddress";
  if (/Cuisine/i.test(message)) return "invalidCuisine";
  if (/timezone|IANA/i.test(message)) return "invalidTimezone";
  if (/Currency/i.test(message)) return "invalidCurrency";
  if (/Service style/i.test(message)) return "invalidServiceStyle";
  if (/Brand color/i.test(message)) return "invalidBrandColor";
  if (/Accent color/i.test(message)) return "invalidAccentColor";
  if (/Logo URL/i.test(message)) return "invalidLogoUrl";
  return "unknown";
}

export function presentRestaurantIdentityNoticeCopy(
  reason: RestaurantIdentityNoticeReason,
  copy: Record<RestaurantIdentityNoticeReason, { title: string; message: string }>
): { tone: "danger" | "success"; title: string; message: string } {
  const selected = copy[reason] ?? copy.unknown;
  return {
    tone: reason === "saved" ? "success" : "danger",
    title: selected.title,
    message: selected.message
  };
}

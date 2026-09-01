/**
 * Classify restaurant-export share-sheet outcomes without inventing delivery.
 * expo-sharing resolves on any sheet dismissal, so callers must use platform
 * share actions (or explicit cancel errors) before claiming success.
 */

export type ExportShareOutcome = "shared" | "dismissed" | "unconfirmed";

export function classifyNativeShareAction(action: string | null | undefined): ExportShareOutcome {
  if (action === "dismissedAction") return "dismissed";
  if (action === "sharedAction") return "shared";
  return "unconfirmed";
}

export function isExportShareDismissalError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message.trim()) return false;
  return /cancel(?:led|ed)?|dismiss(?:ed)?|did not share|user.?did.?not.?share|sharing was aborted|share.?aborted/i.test(
    message
  );
}

/**
 * Android choosers and expo-sharing often cannot prove delivery. Fail closed to
 * unconfirmed instead of celebrating a dismissed sheet as a successful save.
 */
export function classifyExpoSharingSettlement(input: {
  platform: string;
  error?: unknown;
}): ExportShareOutcome {
  if (input.error != null && isExportShareDismissalError(input.error)) {
    return "dismissed";
  }
  if (input.error != null) {
    return "unconfirmed";
  }
  if (input.platform === "ios") {
    // expo-sharing iOS resolves on every dismissal permutation; do not claim shared.
    return "unconfirmed";
  }
  if (input.platform === "android") {
    return "unconfirmed";
  }
  return "unconfirmed";
}

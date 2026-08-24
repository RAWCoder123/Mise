export function isSupplierSendVerificationRace(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown };
  return candidate.code === "40001";
}

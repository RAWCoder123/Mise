type TenantAuthorizationListener = (restaurantId: string | null) => void;

const listeners = new Set<TenantAuthorizationListener>();

function statusFromError(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const candidate = error as {
    status?: unknown;
    code?: unknown;
    context?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.context?.status;
  return typeof status === "number" ? status : null;
}

export function isTenantAuthorizationError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const status = statusFromError(error);

  return (
    status === 401 ||
    status === 403 ||
    code === "42501" ||
    code === "PGRST301" ||
    /permission denied|access denied|not authenticated|invalid or expired user session/i.test(message)
  );
}

export function notifyTenantAuthorizationDenied(restaurantId: string | null = null) {
  for (const listener of listeners) listener(restaurantId);
}

export function subscribeToTenantAuthorizationDenials(listener: TenantAuthorizationListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function throwRepositoryError(error: unknown, restaurantId: string | null = null): never {
  if (isTenantAuthorizationError(error)) notifyTenantAuthorizationDenied(restaurantId);
  throw error;
}

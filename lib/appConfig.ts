import { DEMO_DATASET } from "../services/demoData";

export type PublicAppEnv = "development" | "staging" | "production";

export interface PublicAppConfig {
  appEnv: PublicAppEnv;
  enableDemoMode: boolean;
  /** HTTPS-only Terms of Service URL. Null when unset or non-HTTPS. */
  termsUrl: string | null;
}

function normalizeAppEnv(value: string | undefined): PublicAppEnv {
  if (value === "production" || value === "staging" || value === "development") {
    return value;
  }
  return "development";
}

function parseBoolean(value: string | undefined) {
  return value === "true";
}

/**
 * Accept only absolute https:// URLs. Reject http, other schemes, and junk.
 * App Store legal links must never open an insecure or malformed destination.
 */
export function normalizeOptionalHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function readPublicAppConfig(): PublicAppConfig {
  const appEnv = normalizeAppEnv(process.env.EXPO_PUBLIC_APP_ENV);
  const demoModeValue = process.env.EXPO_PUBLIC_ENABLE_DEMO_MODE;

  return {
    appEnv,
    enableDemoMode: demoModeValue === undefined ? appEnv !== "production" : parseBoolean(demoModeValue),
    termsUrl: normalizeOptionalHttpsUrl(process.env.EXPO_PUBLIC_TERMS_URL)
  };
}

export function isProductionApp(config: PublicAppConfig = readPublicAppConfig()) {
  return config.appEnv === "production";
}

export function canUseDemoMode(config: PublicAppConfig = readPublicAppConfig()) {
  return config.enableDemoMode && !isProductionApp(config);
}

export function getInitialLoginCredentials(config: PublicAppConfig = readPublicAppConfig()) {
  if (!canUseDemoMode(config)) {
    return { email: "", password: "" };
  }
  return { email: DEMO_DATASET.user.email, password: "" };
}

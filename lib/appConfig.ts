import { DEMO_DATASET } from "../services/demoData";

export type PublicAppEnv = "development" | "staging" | "production";

export interface PublicAppConfig {
  appEnv: PublicAppEnv;
  enableDemoMode: boolean;
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

export function readPublicAppConfig(): PublicAppConfig {
  const appEnv = normalizeAppEnv(process.env.EXPO_PUBLIC_APP_ENV);
  const demoModeValue = process.env.EXPO_PUBLIC_ENABLE_DEMO_MODE;

  return {
    appEnv,
    enableDemoMode: demoModeValue === undefined ? appEnv !== "production" : parseBoolean(demoModeValue)
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

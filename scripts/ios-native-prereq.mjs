import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { publicQaEnv } from "./safe-env.mjs";

const root = process.cwd();
const failures = [];
const warnings = [];
const notes = [];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: publicQaEnv({ CI: "1", EXPO_NO_TELEMETRY: "1" })
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(root, path), "utf8"));
  } catch (error) {
    failures.push(`${path} could not be read as JSON: ${error.message}`);
    return null;
  }
}

function assertAsset(path, label, minBytes = 1024) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    failures.push(`${label} is missing at ${path}`);
    return;
  }

  const stats = statSync(absolute);
  if (stats.size < minBytes) {
    failures.push(`${label} at ${path} is unexpectedly small (${stats.size} bytes)`);
    return;
  }

  notes.push(`${label}: ${path}`);
}

function pluginConfig(expo, pluginName) {
  const registration = (expo.plugins ?? []).find(
    (plugin) => plugin === pluginName || (Array.isArray(plugin) && plugin[0] === pluginName)
  );
  return Array.isArray(registration) ? registration[1] : undefined;
}

function checkExpoConfig() {
  const appConfig = readJson("app.json");
  const expo = appConfig?.expo;
  if (!expo) return;

  const splash = pluginConfig(expo, "expo-splash-screen");

  if (expo.orientation !== "portrait") failures.push("app.json must keep iOS demo orientation locked to portrait");
  if (!expo.icon) failures.push("app.json is missing expo.icon");
  if (Object.hasOwn(expo, "splash")) failures.push("app.json must not use the legacy expo.splash field");
  if (Object.hasOwn(expo, "newArchEnabled")) failures.push("app.json must not use the obsolete expo.newArchEnabled field");
  if (!splash || typeof splash !== "object") {
    failures.push("app.json is missing the configured expo-splash-screen plugin");
  } else {
    if (!splash.image) failures.push("expo-splash-screen is missing its image");
    if (splash.imageWidth !== 200) failures.push("expo-splash-screen.imageWidth must be 200");
    if (splash.resizeMode !== "contain") failures.push("expo-splash-screen.resizeMode must be contain");
    if (splash.backgroundColor !== "#F7F3ED") {
      failures.push("expo-splash-screen.backgroundColor must be #F7F3ED");
    }
  }
  if (!expo.ios?.bundleIdentifier) failures.push("app.json is missing expo.ios.bundleIdentifier");
  if (!expo.ios?.buildNumber) failures.push("app.json is missing expo.ios.buildNumber");
  if (expo.ios?.supportsTablet !== false) warnings.push("expo.ios.supportsTablet should stay false for the focused phone demo");
  if (expo.ios?.infoPlist?.ITSAppUsesNonExemptEncryption !== false) {
    failures.push("expo.ios.infoPlist.ITSAppUsesNonExemptEncryption must be false for this beta demo");
  }

  const privacyManifests = expo.ios?.privacyManifests;
  const accessedApiTypes = privacyManifests?.NSPrivacyAccessedAPITypes;
  if (!Array.isArray(accessedApiTypes) || accessedApiTypes.length === 0) {
    failures.push("app.json must declare expo.ios.privacyManifests.NSPrivacyAccessedAPITypes for App Store privacy manifests");
  } else {
    const expectedApiTypes = {
      NSPrivacyAccessedAPICategoryUserDefaults: ["CA92.1"],
      NSPrivacyAccessedAPICategoryFileTimestamp: ["0A2A.1", "3B52.1", "C617.1"],
      NSPrivacyAccessedAPICategoryDiskSpace: ["85F4.1", "E174.1"]
    };

    for (const [apiType, reasons] of Object.entries(expectedApiTypes)) {
      const entry = accessedApiTypes.find((item) => item?.NSPrivacyAccessedAPIType === apiType);
      if (!entry) {
        failures.push(`privacyManifests is missing required API category ${apiType}`);
        continue;
      }
      const declaredReasons = [...(entry.NSPrivacyAccessedAPITypeReasons ?? [])].sort();
      if (JSON.stringify(declaredReasons) !== JSON.stringify(reasons)) {
        failures.push(
          `privacyManifests.${apiType} must declare reasons ${reasons.join(", ")} (aggregated from AsyncStorage/Expo/RN PrivacyInfo)`
        );
      }
    }

    notes.push(`Privacy manifests: ${accessedApiTypes.length} required-reason API categories`);
  }

  if (expo.icon) assertAsset(expo.icon, "App icon");
  if (splash?.image) assertAsset(splash.image, "Splash image");
  if (expo.web?.favicon) assertAsset(expo.web.favicon, "Web favicon", 128);

  notes.push(`Bundle identifier: ${expo.ios?.bundleIdentifier ?? "missing"}`);
  notes.push(`Build number: ${expo.ios?.buildNumber ?? "missing"}`);
}

function checkSimulatorTooling() {
  const developerDir = run("xcode-select", ["-p"]);
  if (developerDir.status !== 0) {
    failures.push(`xcode-select is not configured: ${developerDir.stderr || developerDir.stdout}`);
    return;
  }

  notes.push(`Developer directory: ${developerDir.stdout}`);
  if (developerDir.stdout.includes("CommandLineTools")) {
    failures.push(
      "Full Xcode is not selected. Install Xcode and run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
    );
  }

  const simctl = run("xcrun", ["--find", "simctl"]);
  if (simctl.status !== 0) {
    failures.push(`simctl is unavailable: ${simctl.stderr || simctl.stdout}`);
    return;
  }

  notes.push(`simctl: ${simctl.stdout}`);

  const devices = run("xcrun", ["simctl", "list", "devices", "available", "--json"]);
  if (devices.status !== 0) {
    failures.push(`Could not list available iOS simulators: ${devices.stderr || devices.stdout}`);
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(devices.stdout);
  } catch (error) {
    failures.push(`simctl device output was not JSON: ${error.message}`);
    return;
  }

  const availablePhones = Object.entries(parsed.devices ?? {}).flatMap(([runtime, runtimeDevices]) =>
    runtimeDevices
      .filter((device) => device.isAvailable && /iPhone/i.test(device.name))
      .map((device) => `${device.name} (${runtime.replace(/^com\.apple\.CoreSimulator\.SimRuntime\./, "")})`)
  );

  if (availablePhones.length === 0) {
    failures.push("No available iPhone simulator runtime was found.");
    return;
  }

  notes.push(`Available iPhone simulator: ${availablePhones[0]}`);
}

checkExpoConfig();
checkSimulatorTooling();

if (warnings.length > 0) {
  console.warn("Mise iOS native readiness warnings:");
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (failures.length > 0) {
  console.error("Mise iOS native readiness failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  if (notes.length > 0) {
    console.error("\nValidated before failure:");
    notes.forEach((note) => console.error(`- ${note}`));
  }
  process.exit(1);
}

console.log("Mise iOS native readiness passed.");
notes.forEach((note) => console.log(`- ${note}`));

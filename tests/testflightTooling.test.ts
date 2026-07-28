import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("TestFlight commands use one pinned EAS CLI and fail closed on account prerequisites", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  const scripts = packageJson.scripts;
  const accountCheck = readFileSync("scripts/eas-account-prereq.mjs", "utf8");
  const script = (name: string) => {
    const value = scripts[name];
    if (typeof value !== "string") throw new Error(`missing package script ${name}`);
    return value;
  };

  assert.equal(script("qa:eas-account"), "node scripts/eas-account-prereq.mjs");
  assert.match(script("ios:testflight:check"), /qa:ios-prereq/);
  assert.match(script("ios:testflight:check"), /qa:eas-account/);
  assert.equal(
    script("ios:testflight:build"),
    "npx --yes eas-cli@21.4.0 build --platform ios --profile preview"
  );
  assert.equal(
    script("ios:testflight:submit"),
    "npx --yes eas-cli@21.4.0 submit --platform ios --profile production --latest"
  );
  assert.match(accountCheck, /expo\?\.extra\?\.eas\?\.projectId/);
  assert.match(accountCheck, /\["--yes", `eas-cli@\$\{EAS_CLI_VERSION\}`, "whoami"\]/);
  assert.match(accountCheck, /publicQaEnv/);
  assert.doesNotMatch(accountCheck, /EXPO_TOKEN|password|access[_-]?token/i);
});

test("restaurant export is covered by shell, mobile, and localized route harnesses", () => {
  const routeSmoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  const mobileSmoke = readFileSync("scripts/mobile-layout-smoke.mjs", "utf8");

  assert.match(routeSmoke, /"\/settings\/export"/);
  assert.equal((mobileSmoke.match(/"\/settings\/export"/g) ?? []).length, 2);
  assert.match(mobileSmoke, /const localizedLayoutRoutes = \[/);
});

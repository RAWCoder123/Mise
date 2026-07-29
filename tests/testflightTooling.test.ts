import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("TestFlight commands use one pinned EAS CLI and fail closed on account prerequisites", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  const scripts = packageJson.scripts;
  const accountCheck = readFileSync("scripts/eas-account-prereq.mjs", "utf8");
  const archiveCheck = readFileSync("scripts/eas-archive-prereq.mjs", "utf8");
  const easIgnore = readFileSync(".easignore", "utf8");
  const easConfig = JSON.parse(readFileSync("eas.json", "utf8")) as {
    build: Record<string, {
      distribution?: string;
      environment?: string;
      env?: Record<string, string>;
      ios?: Record<string, unknown>;
    }>;
    submit: Record<string, { ios?: Record<string, unknown> }>;
  };
  const script = (name: string) => {
    const value = scripts[name];
    if (typeof value !== "string") throw new Error(`missing package script ${name}`);
    return value;
  };

  assert.equal(script("qa:eas-account"), "node scripts/eas-account-prereq.mjs");
  assert.equal(script("qa:eas-archive"), "node scripts/eas-archive-prereq.mjs");
  assert.match(script("ios:testflight:check"), /qa:ios-prereq/);
  assert.match(script("ios:testflight:check"), /qa:eas-account/);
  assert.match(script("ios:testflight:check"), /qa:eas-archive/);
  assert.equal(
    script("ios:testflight:build"),
    "npx --yes eas-cli@21.4.0 build --platform ios --profile testflight"
  );
  assert.equal(
    script("ios:testflight:submit"),
    "npx --yes eas-cli@21.4.0 submit --platform ios --profile testflight --latest"
  );
  assert.equal(easConfig.build.testflight?.distribution, "store");
  assert.equal(easConfig.build.testflight?.environment, "preview");
  assert.equal(easConfig.build.testflight?.env?.EXPO_PUBLIC_APP_ENV, "staging");
  assert.equal(easConfig.build.testflight?.env?.EXPO_PUBLIC_ENABLE_DEMO_MODE, "true");
  assert.equal(easConfig.build.testflight?.env?.EXPO_PUBLIC_RELEASE, "mise-mobile@0.1.0+2");
  assert.deepEqual(easConfig.submit.testflight?.ios, {});
  assert.match(accountCheck, /expo\?\.extra\?\.eas\?\.projectId/);
  assert.match(accountCheck, /\["--yes", `eas-cli@\$\{EAS_CLI_VERSION\}`, "whoami"\]/);
  assert.match(accountCheck, /publicQaEnv/);
  assert.doesNotMatch(accountCheck, /EXPO_TOKEN|password|access[_-]?token/i);
  for (const excludedPath of [
    ".mise-staging.env",
    ".cursor/",
    "site/",
    "docs/",
    "scripts/",
    "supabase/",
    "tests/"
  ]) {
    assert.match(easIgnore, new RegExp(`^${excludedPath.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}$`, "m"));
    assert.match(archiveCheck, new RegExp(excludedPath.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")));
  }
});

test("restaurant export is covered by shell, mobile, and localized route harnesses", () => {
  const routeSmoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  const mobileSmoke = readFileSync("scripts/mobile-layout-smoke.mjs", "utf8");

  assert.match(routeSmoke, /"\/settings\/export"/);
  assert.equal((mobileSmoke.match(/"\/settings\/export"/g) ?? []).length, 2);
  assert.match(mobileSmoke, /const localizedLayoutRoutes = \[/);
});

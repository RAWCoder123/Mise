import assert from "node:assert/strict";
import test from "node:test";

import {
  TESTFLIGHT_EAS_PROJECT_ID,
  TESTFLIGHT_SUPABASE_URL,
  evaluateTestflightEasParity,
  parseEasEnvironmentVariable,
  parseEasProjectInfo
} from "../scripts/lib/eas-testflight-env-parity.mjs";

const expectedAnonKey = "intended-public-anon-key";

function remoteVariable(name: string, value: string, visibility = "SENSITIVE") {
  return {
    name,
    value,
    visibility,
    scope: "PROJECT",
    environments: ["preview"],
    readable: visibility !== "SECRET"
  };
}

function validInput() {
  return {
    localProjectId: TESTFLIGHT_EAS_PROJECT_ID,
    remoteProjectId: TESTFLIGHT_EAS_PROJECT_ID,
    testflightProfile: {
      environment: "preview",
      env: {
        EXPO_PUBLIC_APP_ENV: "staging",
        EXPO_PUBLIC_ENABLE_DEMO_MODE: "false"
      }
    },
    remoteUrl: remoteVariable("EXPO_PUBLIC_SUPABASE_URL", TESTFLIGHT_SUPABASE_URL),
    remoteAnonKey: remoteVariable("EXPO_PUBLIC_SUPABASE_ANON_KEY", expectedAnonKey),
    expectedAnonKey
  };
}

test("EAS long output parsers extract only the bounded project and variable fields", () => {
  assert.equal(parseEasProjectInfo(`fullName  @mise/app\nID        ${TESTFLIGHT_EAS_PROJECT_ID}\n`), TESTFLIGHT_EAS_PROJECT_ID);
  assert.deepEqual(
    parseEasEnvironmentVariable(
      `Name          EXPO_PUBLIC_SUPABASE_URL\nValue         ${TESTFLIGHT_SUPABASE_URL}\nScope         PROJECT\nVisibility    SENSITIVE\nEnvironments  preview\n`,
      "EXPO_PUBLIC_SUPABASE_URL"
    ),
    remoteVariable("EXPO_PUBLIC_SUPABASE_URL", TESTFLIGHT_SUPABASE_URL)
  );
});

test("matching remote URL and anon key pass TestFlight EAS parity", () => {
  assert.equal(evaluateTestflightEasParity(validInput()).ok, true);
});

test("wrong or missing remote Supabase URL fails closed", () => {
  const wrong = validInput();
  wrong.remoteUrl = remoteVariable("EXPO_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
  assert.equal(evaluateTestflightEasParity(wrong).summary.urlParity, "MISMATCH");
  assert.equal(evaluateTestflightEasParity({ ...validInput(), remoteUrl: null }).summary.urlParity, "MISSING");
});

test("missing, wrong, or unreadable remote anon key fails closed", () => {
  assert.equal(evaluateTestflightEasParity({ ...validInput(), remoteAnonKey: null }).summary.anonKeyParity, "MISSING");
  const wrong = validInput();
  wrong.remoteAnonKey = remoteVariable("EXPO_PUBLIC_SUPABASE_ANON_KEY", "wrong-public-anon-key");
  assert.equal(evaluateTestflightEasParity(wrong).summary.anonKeyParity, "MISMATCH");
  const unreadable = validInput();
  unreadable.remoteAnonKey = remoteVariable("EXPO_PUBLIC_SUPABASE_ANON_KEY", "*****", "SECRET");
  assert.equal(evaluateTestflightEasParity(unreadable).summary.anonKeyParity, "UNREADABLE");
});

test("wrong or missing local and remote EAS project identities fail", () => {
  assert.equal(evaluateTestflightEasParity({ ...validInput(), localProjectId: null }).ok, false);
  assert.equal(evaluateTestflightEasParity({ ...validInput(), remoteProjectId: "00000000-0000-4000-8000-000000000000" }).ok, false);
});

test("demo mode true and wrong TestFlight environment fail", () => {
  const demo = validInput();
  demo.testflightProfile.env.EXPO_PUBLIC_ENABLE_DEMO_MODE = "true";
  assert.equal(evaluateTestflightEasParity(demo).ok, false);
  const environment = validInput();
  environment.testflightProfile.environment = "production";
  assert.equal(evaluateTestflightEasParity(environment).ok, false);
});

test("success and failure results never contain anon key values", () => {
  const successText = JSON.stringify(evaluateTestflightEasParity(validInput()));
  const mismatch = validInput();
  mismatch.remoteAnonKey = remoteVariable("EXPO_PUBLIC_SUPABASE_ANON_KEY", "remote-public-anon-key");
  const failureText = JSON.stringify(evaluateTestflightEasParity(mismatch));
  for (const key of [expectedAnonKey, "remote-public-anon-key"]) {
    assert.doesNotMatch(successText, new RegExp(key));
    assert.doesNotMatch(failureText, new RegExp(key));
  }
});

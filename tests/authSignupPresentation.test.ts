import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import {
  isValidSignupEmail,
  normalizeSignupEmail,
  validateSignupPassword
} from "../services/domain/authSignup.ts";
import {
  presentSignupFailureCopy,
  presentSignupFormEditable,
  resolveSignupCreateFailureReason,
  resolveSignupFormFailureReason
} from "../services/presentation/authSignupPresentation.ts";

const signupScreen = readFileSync("app/(auth)/signup.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("signup form editable only when cloud is configured and idle", () => {
  assert.equal(presentSignupFormEditable(true, false), true);
  assert.equal(presentSignupFormEditable(true, true), false);
  assert.equal(presentSignupFormEditable(false, false), false);
});

test("signup form failure reasons cover email password and mismatch checks", () => {
  const helpers = {
    isValidEmail: isValidSignupEmail,
    normalizeEmail: normalizeSignupEmail,
    validatePassword: validateSignupPassword
  };

  assert.equal(
    resolveSignupFormFailureReason({
      email: "  ",
      password: "securePass1",
      confirmPassword: "securePass1",
      ...helpers
    }),
    "emailRequired"
  );
  assert.equal(
    resolveSignupFormFailureReason({
      email: "bad",
      password: "securePass1",
      confirmPassword: "securePass1",
      ...helpers
    }),
    "emailInvalid"
  );
  assert.equal(
    resolveSignupFormFailureReason({
      email: "owner@demo.mise",
      password: "short",
      confirmPassword: "short",
      ...helpers
    }),
    "tooShort"
  );
  assert.equal(
    resolveSignupFormFailureReason({
      email: "owner@demo.mise",
      password: "has space1",
      confirmPassword: "has space1",
      ...helpers
    }),
    "invalidPassword"
  );
  assert.equal(
    resolveSignupFormFailureReason({
      email: "owner@demo.mise",
      password: "securePass1",
      confirmPassword: "securePass2",
      ...helpers
    }),
    "mismatch"
  );
  assert.equal(
    resolveSignupFormFailureReason({
      email: "owner@demo.mise",
      password: "securePass1",
      confirmPassword: "securePass1",
      ...helpers
    }),
    null
  );
});

test("signup create failure reasons map backend English errors without leaking raw messages", () => {
  assert.equal(
    resolveSignupCreateFailureReason(new Error("User already registered")),
    "alreadyExists"
  );
  assert.equal(
    resolveSignupCreateFailureReason(new Error("An account with this email already exists. Sign in instead.")),
    "alreadyExists"
  );
  assert.equal(
    resolveSignupCreateFailureReason(new Error("Could not create account.")),
    "createFailed"
  );
  assert.equal(resolveSignupCreateFailureReason(new Error("")), "createFailed");
  assert.equal(resolveSignupCreateFailureReason("not-an-error"), "createFailed");
});

test("signup failure copy never invents success tone", () => {
  const notice = presentSignupFailureCopy("alreadyExists", {
    emailRequired: { title: "Email", message: "Enter email" },
    emailInvalid: { title: "Invalid", message: "Bad email" },
    tooShort: { title: "Short", message: "Too short" },
    invalidPassword: { title: "Password", message: "Bad password" },
    mismatch: { title: "Mismatch", message: "No match" },
    alreadyExists: { title: "Exists", message: "Sign in instead" },
    createFailed: { title: "Failed", message: "Try again" }
  });
  assert.equal(notice.tone, "danger");
  assert.equal(notice.title, "Exists");
  assert.equal(notice.message, "Sign in instead");
});

test("signup screen uses localized StatusNotice and never renders raw error.message", () => {
  assert.match(signupScreen, /resolveSignupFormFailureReason/);
  assert.match(signupScreen, /resolveSignupCreateFailureReason/);
  assert.match(signupScreen, /presentSignupFailureCopy/);
  assert.match(signupScreen, /presentSignupFormEditable/);
  assert.match(signupScreen, /StatusNotice/);
  assert.match(signupScreen, /captureMiseError/);
  assert.doesNotMatch(
    signupScreen,
    /setErrorKey|styles\.error|signUpError\.message|error\.message/
  );
  assert.match(catalog, /signup\.notice\.alreadyExistsTitle/);
  assert.match(catalog, /signup\.notice\.createFailedTitle/);
  assert.match(catalog, /"signup\.notice\.createFailedTitle":\s*"No se pudo crear la cuenta"/);
  assert.match(catalog, /"signup\.notice\.createFailedTitle":\s*"无法创建账户"/);
});

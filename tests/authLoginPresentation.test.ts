import assert from "node:assert/strict";
import { test } from "node:test";

import {
  presentLoginFormEditable,
  presentLoginNoticeCopy,
  resolveLoginResetRequestFailureReason,
  resolveLoginSignInFailureReason
} from "../services/presentation/authLoginPresentation.ts";
import {
  presentResetFailureCopy,
  presentResetFormEditable,
  resolveResetFormFailureReason
} from "../services/presentation/authResetPresentation.ts";

test("login form is editable only when cloud auth is ready and idle", () => {
  assert.equal(presentLoginFormEditable(true, false), true);
  assert.equal(presentLoginFormEditable(true, true), false);
  assert.equal(presentLoginFormEditable(false, false), false);
});

test("login sign-in and reset request validate required email/password", () => {
  assert.equal(resolveLoginSignInFailureReason({ email: "", password: "x" }), "emailRequired");
  assert.equal(resolveLoginSignInFailureReason({ email: "a@b.co", password: "" }), "passwordRequired");
  assert.equal(resolveLoginSignInFailureReason({ email: "a@b.co", password: "x" }), null);
  assert.equal(resolveLoginResetRequestFailureReason({ email: "  " }), "emailRequired");
  assert.equal(resolveLoginResetRequestFailureReason({ email: "a@b.co" }), null);
});

test("login notice copy marks reset-sent as success", () => {
  const copy = {
    emailRequired: { title: "e", message: "em" },
    passwordRequired: { title: "p", message: "pm" },
    signInFailed: { title: "s", message: "sm" },
    demoFailed: { title: "d", message: "dm" },
    resetRequestFailed: { title: "r", message: "rm" },
    resetLinkInvalid: { title: "l", message: "lm" },
    resetSent: { title: "ok", message: "sent" }
  };
  assert.equal(presentLoginNoticeCopy("resetSent", copy).tone, "success");
  assert.equal(presentLoginNoticeCopy("signInFailed", copy).tone, "danger");
});

test("reset form is editable only while recovery is pending", () => {
  assert.equal(presentResetFormEditable(true, false, true), true);
  assert.equal(presentResetFormEditable(true, false, false), false);
  assert.equal(presentResetFormEditable(true, true, true), false);
  assert.equal(presentResetFormEditable(false, false, true), false);
});

test("reset form failure reasons map validation outcomes", () => {
  assert.equal(
    resolveResetFormFailureReason({
      password: "short",
      confirmPassword: "short",
      validatePassword: () => "Password must be at least 8 characters."
    }),
    "tooShort"
  );
  assert.equal(
    resolveResetFormFailureReason({
      password: "bad pass1",
      confirmPassword: "bad pass1",
      validatePassword: () => "Password cannot contain spaces."
    }),
    "invalidPassword"
  );
  assert.equal(
    resolveResetFormFailureReason({
      password: "securePass1",
      confirmPassword: "otherPass1",
      validatePassword: () => null
    }),
    "mismatch"
  );
  assert.equal(
    resolveResetFormFailureReason({
      password: "securePass1",
      confirmPassword: "securePass1",
      validatePassword: () => null
    }),
    null
  );
  assert.equal(
    presentResetFailureCopy("mismatch", {
      tooShort: { title: "t", message: "tm" },
      invalidPassword: { title: "i", message: "im" },
      mismatch: { title: "m", message: "mm" },
      updateFailed: { title: "u", message: "um" }
    }).title,
    "m"
  );
});

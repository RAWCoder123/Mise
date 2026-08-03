import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import { validateNewPassword } from "../services/domain/authRecovery.ts";
import {
  presentResetFailureCopy,
  presentResetFormEditable,
  resolveResetFormFailureReason
} from "../services/presentation/authResetPresentation.ts";

const resetScreen = readFileSync("app/(auth)/reset-password.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("reset form editable only when cloud recovery is idle and pending", () => {
  assert.equal(presentResetFormEditable(true, false, true), true);
  assert.equal(presentResetFormEditable(true, true, true), false);
  assert.equal(presentResetFormEditable(true, false, false), false);
  assert.equal(presentResetFormEditable(false, false, true), false);
});

test("reset form failure reasons cover password strength and mismatch", () => {
  assert.equal(
    resolveResetFormFailureReason({
      password: "short",
      confirmPassword: "short",
      validatePassword: validateNewPassword
    }),
    "tooShort"
  );
  assert.equal(
    resolveResetFormFailureReason({
      password: "has space1",
      confirmPassword: "has space1",
      validatePassword: validateNewPassword
    }),
    "invalidPassword"
  );
  assert.equal(
    resolveResetFormFailureReason({
      password: "securePass1",
      confirmPassword: "securePass2",
      validatePassword: validateNewPassword
    }),
    "mismatch"
  );
  assert.equal(
    resolveResetFormFailureReason({
      password: "securePass1",
      confirmPassword: "securePass1",
      validatePassword: validateNewPassword
    }),
    null
  );
});

test("reset failure copy never invents success tone", () => {
  const notice = presentResetFailureCopy("updateFailed", {
    tooShort: { title: "Short", message: "Too short" },
    invalidPassword: { title: "Password", message: "Bad password" },
    mismatch: { title: "Mismatch", message: "No match" },
    updateFailed: { title: "Failed", message: "Try again" }
  });
  assert.equal(notice.tone, "danger");
  assert.equal(notice.title, "Failed");
  assert.equal(notice.message, "Try again");
});

test("reset screen uses localized StatusNotice and never renders raw error.message", () => {
  assert.match(resetScreen, /resolveResetFormFailureReason/);
  assert.match(resetScreen, /presentResetFailureCopy/);
  assert.match(resetScreen, /presentResetFormEditable/);
  assert.match(resetScreen, /StatusNotice/);
  assert.match(resetScreen, /captureMiseError/);
  assert.doesNotMatch(
    resetScreen,
    /setErrorKey|styles\.error|resetError\.message|error\.message/
  );
  assert.match(catalog, /login\.reset\.notice\.updateFailedTitle/);
  assert.match(catalog, /"login\.reset\.notice\.updateFailedTitle":\s*"No se pudo actualizar"/);
  assert.match(catalog, /"login\.reset\.notice\.updateFailedTitle":\s*"无法更新密码"/);
});

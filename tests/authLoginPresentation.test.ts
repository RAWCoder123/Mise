import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import {
  presentLoginFormEditable,
  presentLoginNoticeCopy,
  resolveLoginResetRequestFailureReason,
  resolveLoginSignInFailureReason
} from "../services/presentation/authLoginPresentation.ts";

const loginScreen = readFileSync("app/(auth)/login.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("login form editable only when cloud is configured and idle", () => {
  assert.equal(presentLoginFormEditable(true, false), true);
  assert.equal(presentLoginFormEditable(true, true), false);
  assert.equal(presentLoginFormEditable(false, false), false);
});

test("login sign-in failure reasons cover email and password checks", () => {
  assert.equal(resolveLoginSignInFailureReason({ email: "  ", password: "secret" }), "emailRequired");
  assert.equal(resolveLoginSignInFailureReason({ email: "owner@demo.mise", password: "" }), "passwordRequired");
  assert.equal(resolveLoginSignInFailureReason({ email: "owner@demo.mise", password: "secret" }), null);
});

test("login reset request requires an email", () => {
  assert.equal(resolveLoginResetRequestFailureReason({ email: "" }), "emailRequired");
  assert.equal(resolveLoginResetRequestFailureReason({ email: "  owner@demo.mise " }), null);
});

test("login notice copy uses success only for reset sent", () => {
  const copy = {
    emailRequired: { title: "Email", message: "Enter email" },
    passwordRequired: { title: "Password", message: "Enter password" },
    signInFailed: { title: "Sign in", message: "Try again" },
    demoFailed: { title: "Demo", message: "Demo failed" },
    resetRequestFailed: { title: "Reset", message: "Reset failed" },
    resetLinkInvalid: { title: "Link", message: "Open a fresh link" },
    resetSent: { title: "Sent", message: "Check inbox" }
  };

  const failure = presentLoginNoticeCopy("signInFailed", copy);
  assert.equal(failure.tone, "danger");
  assert.equal(failure.title, "Sign in");

  const linkFailure = presentLoginNoticeCopy("resetLinkInvalid", copy);
  assert.equal(linkFailure.tone, "danger");
  assert.equal(linkFailure.title, "Link");
  assert.equal(linkFailure.message, "Open a fresh link");

  const success = presentLoginNoticeCopy("resetSent", copy);
  assert.equal(success.tone, "success");
  assert.equal(success.title, "Sent");
  assert.equal(success.message, "Check inbox");
});

test("login screen uses localized StatusNotice and never renders raw error.message", () => {
  assert.match(loginScreen, /resolveLoginSignInFailureReason/);
  assert.match(loginScreen, /resolveLoginResetRequestFailureReason/);
  assert.match(loginScreen, /presentLoginNoticeCopy/);
  assert.match(loginScreen, /presentLoginFormEditable/);
  assert.match(loginScreen, /StatusNotice/);
  assert.match(loginScreen, /captureMiseError/);
  assert.match(loginScreen, /passwordRecoveryLinkError/);
  assert.match(loginScreen, /clearPasswordRecoveryLinkError/);
  assert.match(loginScreen, /resetLinkInvalid/);
  assert.doesNotMatch(
    loginScreen,
    /setErrorKey|setNoticeKey|styles\.error|styles\.notice|signInError\.message|error\.message/
  );
  assert.match(catalog, /login\.notice\.signInFailedTitle/);
  assert.match(catalog, /login\.notice\.resetSentTitle/);
  assert.match(catalog, /login\.notice\.resetLinkInvalidTitle/);
  assert.match(catalog, /login\.reset\.error\.linkInvalid/);
  assert.match(catalog, /"login\.notice\.signInFailedTitle":\s*"No se pudo iniciar sesión"/);
  assert.match(catalog, /"login\.notice\.signInFailedTitle":\s*"无法登录"/);
  assert.match(catalog, /"login\.notice\.resetSentTitle":\s*"Revisa tu correo"/);
  assert.match(catalog, /"login\.notice\.resetSentTitle":\s*"请查看邮箱"/);
  assert.match(catalog, /"login\.notice\.resetLinkInvalidTitle":\s*"Enlace de restablecimiento inválido"/);
  assert.match(catalog, /"login\.notice\.resetLinkInvalidTitle":\s*"重置链接无效"/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentSetupCreateNoticeCopy,
  presentSetupFormBusy,
  presentSetupFormEditable,
  resolveSetupCreateFailureReason
} from "../services/presentation/setupCreatePresentation.ts";

const setupScreen = readFileSync("app/(auth)/setup.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("setup form editable only when configurable and idle", () => {
  assert.equal(presentSetupFormBusy(false, false), false);
  assert.equal(presentSetupFormBusy(true, false), true);
  assert.equal(presentSetupFormBusy(false, true), true);
  assert.equal(presentSetupFormEditable(true, false), true);
  assert.equal(presentSetupFormEditable(true, true), false);
  assert.equal(presentSetupFormEditable(false, false), false);
});

test("setup create failures stay on createFailed without leaking raw English mapping", () => {
  assert.equal(resolveSetupCreateFailureReason(new Error("network down")), "createFailed");
  assert.equal(
    resolveSetupCreateFailureReason(new Error("Restaurant profile is required.")),
    "createFailed"
  );
});

test("setup create notice copy is always danger and uses reason-specific titles", () => {
  const copy = {
    profileContinue: { title: "Profile incomplete", message: "Add name" },
    profileNavigate: { title: "Finish profile", message: "Stay on profile" },
    validation: { title: "Check step", message: "Fix inventory" },
    createFailed: { title: "Could not finish", message: "Try again" }
  };

  const validation = presentSetupCreateNoticeCopy("validation", copy);
  assert.equal(validation.tone, "danger");
  assert.equal(validation.title, "Check step");
  assert.equal(validation.message, "Fix inventory");

  const createFailed = presentSetupCreateNoticeCopy("createFailed", copy);
  assert.equal(createFailed.tone, "danger");
  assert.equal(createFailed.title, "Could not finish");
});

test("setup screen uses localized StatusNotice helpers and captureMiseError", () => {
  assert.match(setupScreen, /presentSetupCreateNoticeCopy/);
  assert.match(setupScreen, /presentSetupFormEditable/);
  assert.match(setupScreen, /resolveSetupCreateFailureReason/);
  assert.match(setupScreen, /StatusNotice/);
  assert.match(setupScreen, /captureMiseError/);
  assert.doesNotMatch(setupScreen, /setError\(|error\.message/);
  assert.match(catalog, /setup\.error\.notice\.createFailedTitle/);
  assert.match(catalog, /setup\.error\.notice\.validationTitle/);
  assert.match(catalog, /"setup\.error\.notice\.createFailedTitle":\s*"No se pudo terminar la configuración"/);
  assert.match(catalog, /"setup\.error\.notice\.createFailedTitle":\s*"无法完成设置"/);
  assert.match(catalog, /"setup\.error\.notice\.validationTitle":\s*"Revisa este paso"/);
  assert.match(catalog, /"setup\.error\.notice\.validationTitle":\s*"请检查此设置步骤"/);
});

test("setup surfaces a localized StatusNotice after fail-closed workspace access clear", () => {
  assert.match(setupScreen, /workspaceAccessUnverified/);
  assert.match(setupScreen, /clearWorkspaceAccessUnverified/);
  assert.match(setupScreen, /workspaceAccessNotice/);
  assert.match(setupScreen, /setup\.access\.unverifiedTitle/);
  assert.match(setupScreen, /setup\.access\.unverifiedBody/);
  assert.match(setupScreen, /tone="caution"/);
  assert.match(catalog, /"setup\.access\.unverifiedTitle":\s*"Workspace access could not be verified"/);
  assert.match(catalog, /"setup\.access\.unverifiedTitle":\s*"No se pudo verificar el acceso al espacio"/);
  assert.match(catalog, /"setup\.access\.unverifiedTitle":\s*"无法验证工作区访问权限"/);
  assert.match(catalog, /"setup\.access\.unverifiedBody":\s*"Mise cleared the active restaurant/);
  assert.match(catalog, /"setup\.access\.unverifiedBody":\s*"Mise quitó el restaurante activo/);
  assert.match(catalog, /"setup\.access\.unverifiedBody":\s*"由于无法重新确认访问权限/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentProfileIdentityFormEditable,
  presentProfileIdentityNoticeCopy,
  resolveProfileIdentitySaveFailureReason
} from "../services/presentation/profileIdentityFormPresentation.ts";

const profileScreen = readFileSync("app/settings/profile.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("profile identity form editable only when interactive and idle", () => {
  assert.equal(presentProfileIdentityFormEditable(true, false), true);
  assert.equal(presentProfileIdentityFormEditable(true, true), false);
  assert.equal(presentProfileIdentityFormEditable(false, false), false);
});

test("profile identity save failures map backend English errors to localized notice reasons", () => {
  assert.equal(
    resolveProfileIdentitySaveFailureReason(
      new Error("Display name must be between 1 and 120 characters.")
    ),
    "invalidName"
  );
  assert.equal(
    resolveProfileIdentitySaveFailureReason(new Error("Restaurant workspace is required.")),
    "missingRestaurant"
  );
  assert.equal(resolveProfileIdentitySaveFailureReason(new Error("network down")), "unknown");
  assert.equal(resolveProfileIdentitySaveFailureReason("not-an-error"), "unknown");
});

test("profile identity notice copy uses success only for saved", () => {
  const copy = {
    invalidName: { title: "Name", message: "Fix name" },
    missingRestaurant: { title: "Restaurant", message: "Choose restaurant" },
    unknown: { title: "Failed", message: "Try again" },
    saved: { title: "Saved", message: "Updated Maya" }
  };

  const failure = presentProfileIdentityNoticeCopy("missingRestaurant", copy);
  assert.equal(failure.tone, "danger");
  assert.equal(failure.title, "Restaurant");

  const success = presentProfileIdentityNoticeCopy("saved", copy);
  assert.equal(success.tone, "success");
  assert.equal(success.title, "Saved");
  assert.equal(success.message, "Updated Maya");
});

test("profile identity screen uses localized StatusNotice and never renders raw error.message", () => {
  assert.match(profileScreen, /resolveProfileIdentitySaveFailureReason/);
  assert.match(profileScreen, /presentProfileIdentityNoticeCopy/);
  assert.match(profileScreen, /presentProfileIdentityFormEditable/);
  assert.match(profileScreen, /StatusNotice/);
  assert.match(profileScreen, /captureMiseError/);
  assert.doesNotMatch(
    profileScreen,
    /setValidationKey|setStatus\(|styles\.error|styles\.statusError|error\.message/
  );
  assert.match(catalog, /settings\.profile\.notice\.saveFailedTitle/);
  assert.match(catalog, /settings\.profile\.notice\.savedTitle/);
  assert.match(catalog, /"settings\.profile\.notice\.saveFailedTitle":\s*"No se pudo guardar el nombre"/);
  assert.match(catalog, /"settings\.profile\.notice\.saveFailedTitle":\s*"无法保存显示名称"/);
  assert.match(catalog, /"settings\.profile\.notice\.savedTitle":\s*"Nombre guardado"/);
  assert.match(catalog, /"settings\.profile\.notice\.savedTitle":\s*"显示名称已保存"/);
});

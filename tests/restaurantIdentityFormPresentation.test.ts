import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentRestaurantIdentityFormEditable,
  presentRestaurantIdentityNoticeCopy,
  resolveRestaurantIdentitySaveFailureReason
} from "../services/presentation/restaurantIdentityFormPresentation.ts";

const restaurantScreen = readFileSync("app/settings/restaurant.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("restaurant identity form editable only when editable, interactive, and idle", () => {
  assert.equal(presentRestaurantIdentityFormEditable(true, true, false), true);
  assert.equal(presentRestaurantIdentityFormEditable(true, true, true), false);
  assert.equal(presentRestaurantIdentityFormEditable(true, false, false), false);
  assert.equal(presentRestaurantIdentityFormEditable(false, true, false), false);
});

test("restaurant identity save failures map backend English errors to localized notice reasons", () => {
  assert.equal(
    resolveRestaurantIdentitySaveFailureReason(
      new Error("Restaurant name must be between 1 and 120 characters.")
    ),
    "invalidName"
  );
  assert.equal(
    resolveRestaurantIdentitySaveFailureReason(new Error("Address must be 500 characters or fewer.")),
    "invalidAddress"
  );
  assert.equal(
    resolveRestaurantIdentitySaveFailureReason(new Error("Cuisine must be 120 characters or fewer.")),
    "invalidCuisine"
  );
  assert.equal(
    resolveRestaurantIdentitySaveFailureReason(new Error("Choose a supported IANA timezone.")),
    "invalidTimezone"
  );
  assert.equal(
    resolveRestaurantIdentitySaveFailureReason(
      new Error("Currency must be a three-letter uppercase code.")
    ),
    "invalidCurrency"
  );
  assert.equal(
    resolveRestaurantIdentitySaveFailureReason(new Error("Service style is not supported.")),
    "invalidServiceStyle"
  );
  assert.equal(
    resolveRestaurantIdentitySaveFailureReason(
      new Error("Brand color must be a six-digit hex value like #EF3F27.")
    ),
    "invalidBrandColor"
  );
  assert.equal(
    resolveRestaurantIdentitySaveFailureReason(
      new Error("Accent color must be a six-digit hex value like #1F7A4D.")
    ),
    "invalidAccentColor"
  );
  assert.equal(
    resolveRestaurantIdentitySaveFailureReason(
      new Error("Logo URL must be a valid HTTPS link up to 2048 characters.")
    ),
    "invalidLogoUrl"
  );
  assert.equal(resolveRestaurantIdentitySaveFailureReason(new Error("network down")), "unknown");
  assert.equal(resolveRestaurantIdentitySaveFailureReason("not-an-error"), "unknown");
});

test("restaurant identity notice copy uses success only for saved", () => {
  const copy = {
    invalidName: { title: "Name", message: "Fix name" },
    invalidAddress: { title: "Address", message: "Fix address" },
    invalidCuisine: { title: "Cuisine", message: "Fix cuisine" },
    invalidTimezone: { title: "Timezone", message: "Fix timezone" },
    invalidCurrency: { title: "Currency", message: "Fix currency" },
    invalidServiceStyle: { title: "Service", message: "Fix service" },
    invalidBrandColor: { title: "Brand", message: "Fix brand" },
    invalidAccentColor: { title: "Accent", message: "Fix accent" },
    invalidLogoUrl: { title: "Logo", message: "Fix logo" },
    unknown: { title: "Failed", message: "Try again" },
    saved: { title: "Saved", message: "Updated Harbor Table" }
  };

  const failure = presentRestaurantIdentityNoticeCopy("invalidBrandColor", copy);
  assert.equal(failure.tone, "danger");
  assert.equal(failure.title, "Brand");

  const success = presentRestaurantIdentityNoticeCopy("saved", copy);
  assert.equal(success.tone, "success");
  assert.equal(success.title, "Saved");
  assert.equal(success.message, "Updated Harbor Table");
});

test("restaurant identity screen uses localized StatusNotice and never renders raw error.message", () => {
  assert.match(restaurantScreen, /resolveRestaurantIdentitySaveFailureReason/);
  assert.match(restaurantScreen, /presentRestaurantIdentityNoticeCopy/);
  assert.match(restaurantScreen, /presentRestaurantIdentityFormEditable/);
  assert.match(restaurantScreen, /StatusNotice/);
  assert.match(restaurantScreen, /captureMiseError/);
  assert.doesNotMatch(
    restaurantScreen,
    /setValidationKey|setStatus\(|styles\.error|styles\.statusError|error\.message/
  );
  assert.match(catalog, /settings\.restaurant\.notice\.saveFailedTitle/);
  assert.match(catalog, /settings\.restaurant\.notice\.savedTitle/);
  assert.match(catalog, /"settings\.restaurant\.notice\.saveFailedTitle":\s*"No se pudo guardar la identidad"/);
  assert.match(catalog, /"settings\.restaurant\.notice\.saveFailedTitle":\s*"无法保存餐厅身份"/);
  assert.match(catalog, /"settings\.restaurant\.notice\.savedTitle":\s*"Identidad del restaurante guardada"/);
  assert.match(catalog, /"settings\.restaurant\.notice\.savedTitle":\s*"餐厅身份已保存"/);
});

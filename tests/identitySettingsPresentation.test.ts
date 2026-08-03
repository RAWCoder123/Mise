import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentIdentitySettingsInteractive,
  presentIdentitySettingsNote,
  presentIdentitySettingsValuesVisible,
  resolveProfileIdentityLoadState,
  resolveRestaurantIdentityLoadState
} from "../services/presentation/identitySettingsPresentation";

const profileScreen = readFileSync("app/settings/profile.tsx", "utf8");
const restaurantScreen = readFileSync("app/settings/restaurant.tsx", "utf8");

test("profile identity load state waits for session readiness and surfaces load errors", () => {
  assert.equal(
    resolveProfileIdentityLoadState({
      sessionReady: false,
      loaded: false,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveProfileIdentityLoadState({
      sessionReady: true,
      loaded: false,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveProfileIdentityLoadState({
      sessionReady: true,
      loaded: false,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveProfileIdentityLoadState({
      sessionReady: true,
      loaded: true,
      loadError: false
    }),
    "ready"
  );
});

test("restaurant identity load state never claims missing before the session is ready", () => {
  assert.equal(
    resolveRestaurantIdentityLoadState({
      sessionReady: false,
      restaurantId: null,
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveRestaurantIdentityLoadState({
      sessionReady: true,
      restaurantId: null,
      loadedRestaurantId: null,
      loadError: false
    }),
    "missing"
  );
  assert.equal(
    resolveRestaurantIdentityLoadState({
      sessionReady: true,
      restaurantId: "rest_1",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveRestaurantIdentityLoadState({
      sessionReady: true,
      restaurantId: "rest_1",
      loadedRestaurantId: "rest_1",
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveRestaurantIdentityLoadState({
      sessionReady: true,
      restaurantId: "rest_1",
      loadedRestaurantId: "rest_1",
      loadError: false
    }),
    "ready"
  );
});

test("identity settings notes never claim persistence while loading or failed", () => {
  assert.equal(
    presentIdentitySettingsNote("loading", {
      loading: "Loading profile…",
      unavailable: "Profile unavailable",
      missing: "No restaurant",
      ready: "Saved securely"
    }),
    "Loading profile…"
  );
  assert.equal(
    presentIdentitySettingsNote("error", {
      loading: "Loading profile…",
      unavailable: "Profile unavailable",
      missing: "No restaurant",
      ready: "Saved securely"
    }),
    "Profile unavailable"
  );
  assert.doesNotMatch(
    presentIdentitySettingsNote("loading", {
      loading: "Loading restaurant…",
      unavailable: "Restaurant unavailable",
      missing: "No restaurant",
      ready: "Saved securely"
    }),
    /saved/i
  );
  assert.equal(presentIdentitySettingsValuesVisible("error"), true);
  assert.equal(presentIdentitySettingsValuesVisible("loading"), false);
  assert.equal(presentIdentitySettingsInteractive("error"), false);
  assert.equal(presentIdentitySettingsInteractive("ready"), true);
});

test("profile and restaurant identity screens wire soft-refresh and RetryNotice", () => {
  assert.match(profileScreen, /resolveProfileIdentityLoadState/);
  assert.match(profileScreen, /presentIdentitySettingsInteractive/);
  assert.match(profileScreen, /RetryNotice/);
  assert.match(profileScreen, /StatusNotice/);
  assert.match(profileScreen, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(profileScreen, /settings\.profile\.retry\.accessibility/);
  assert.match(profileScreen, /loading=\{hubLoadState === "loading" && !valuesVisible\}/);
  assert.match(profileScreen, /fetchMyDisplayName/);

  assert.match(restaurantScreen, /resolveRestaurantIdentityLoadState/);
  assert.match(restaurantScreen, /presentIdentitySettingsInteractive/);
  assert.match(restaurantScreen, /RetryNotice/);
  assert.match(restaurantScreen, /StatusNotice/);
  assert.match(restaurantScreen, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(restaurantScreen, /settings\.restaurant\.retry\.accessibility/);
  assert.match(restaurantScreen, /loading=\{hubLoadState === "loading" && !valuesVisible\}/);
  assert.match(restaurantScreen, /fetchRestaurant/);
  assert.doesNotMatch(
    restaurantScreen,
    /if \(!restaurant \|\| !draft\) \{\s*return \(\s*<Screen[\s\S]*settings\.profile\.noRestaurant/
  );
});


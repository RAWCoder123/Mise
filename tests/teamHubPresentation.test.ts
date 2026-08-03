import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentTeamHubEmptyCopy,
  presentTeamHubPendingInvitesCopy,
  presentTeamHubRosterCopy,
  resolveTeamHubLoadState
} from "../services/presentation/teamHubPresentation";

const teamHub = readFileSync("app/settings/team.tsx", "utf8");

test("team hub load state stays loading until the active restaurant finishes loading", () => {
  assert.equal(
    resolveTeamHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveTeamHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveTeamHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveTeamHubLoadState({
      restaurantId: null,
      loadedRestaurantId: null,
      loadError: false
    }),
    "ready"
  );
});

test("team roster and empty copy never claim an empty team while loading or failed", () => {
  assert.equal(
    presentTeamHubRosterCopy(
      "loading",
      0,
      {
        loading: "Refreshing roster…",
        unavailable: "Roster unavailable",
        rosterBody: (count) => `${count} people`
      },
      String
    ),
    "Refreshing roster…"
  );
  assert.equal(
    presentTeamHubRosterCopy(
      "error",
      0,
      {
        loading: "Refreshing roster…",
        unavailable: "Roster unavailable",
        rosterBody: (count) => `${count} people`
      },
      String
    ),
    "Roster unavailable"
  );
  assert.equal(
    presentTeamHubRosterCopy(
      "ready",
      3,
      {
        loading: "Refreshing roster…",
        unavailable: "Roster unavailable",
        rosterBody: (count) => `${count} people`
      },
      String
    ),
    "3 people"
  );

  const loadingEmpty = presentTeamHubEmptyCopy("loading", {
    loadingTitle: "Loading team…",
    loadingBody: "Refreshing access",
    unavailableTitle: "Team directory unavailable",
    unavailableBody: "Retry to refresh",
    emptyTitle: "No teammates yet",
    emptyBody: "Share an invite"
  });
  assert.equal(loadingEmpty.title, "Loading team…");
  assert.doesNotMatch(loadingEmpty.title, /no teammates/i);

  const errorEmpty = presentTeamHubEmptyCopy("error", {
    loadingTitle: "Loading team…",
    loadingBody: "Refreshing access",
    unavailableTitle: "Team directory unavailable",
    unavailableBody: "Retry to refresh",
    emptyTitle: "No teammates yet",
    emptyBody: "Share an invite"
  });
  assert.equal(errorEmpty.title, "Team directory unavailable");

  const pendingLoading = presentTeamHubPendingInvitesCopy(
    "loading",
    { pendingCount: 0, canManage: true },
    {
      loading: "Checking invites…",
      unavailable: "Invites unavailable",
      empty: "No pending invites",
      body: (count) => `${count} waiting`,
      readOnlyBody: (count) => `${count} waiting read-only`
    },
    String
  );
  assert.equal(pendingLoading.sectionBody, "Checking invites…");
  assert.equal(pendingLoading.emptyHelper, null);

  const pendingReadyEmpty = presentTeamHubPendingInvitesCopy(
    "ready",
    { pendingCount: 0, canManage: false },
    {
      loading: "Checking invites…",
      unavailable: "Invites unavailable",
      empty: "No pending invites",
      body: (count) => `${count} waiting`,
      readOnlyBody: (count) => `${count} waiting read-only`
    },
    String
  );
  assert.equal(pendingReadyEmpty.sectionBody, "0 waiting read-only");
  assert.equal(pendingReadyEmpty.emptyHelper, "No pending invites");
});

test("team hub wires soft-refresh and RetryNotice instead of false empty roster", () => {
  assert.match(teamHub, /resolveTeamHubLoadState/);
  assert.match(teamHub, /presentTeamHubEmptyCopy/);
  assert.match(teamHub, /presentTeamHubRosterCopy/);
  assert.match(teamHub, /RetryNotice/);
  assert.match(teamHub, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(teamHub, /loadedRestaurantRef/);
  assert.match(teamHub, /if \(showLoading \|\| loadedRestaurantRef\.current !== restaurantId\)/);
  assert.match(teamHub, /hubReady\s*\?\s*members\s*:\s*\[\]/);
  assert.match(teamHub, /settings\.team\.empty\.unavailableTitle/);
  assert.match(teamHub, /settings\.team\.retry\.accessibility/);
});

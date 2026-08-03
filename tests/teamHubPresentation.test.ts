import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentTeamHubEmptyCopy,
  presentTeamHubPendingInvitesCopy,
  presentTeamHubRosterCopy,
  presentTeamMutationActionsEditable,
  presentTeamMutationBusy,
  presentTeamMutationNoticeCopy,
  resolveTeamHubLoadState
} from "../services/presentation/teamHubPresentation";

const teamHub = readFileSync("app/settings/team.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

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

test("team mutation busy and editable helpers gate invite actions while busy", () => {
  assert.equal(presentTeamMutationBusy(null), false);
  assert.equal(presentTeamMutationBusy("add"), true);
  assert.equal(presentTeamMutationBusy("create-invite"), true);
  assert.equal(presentTeamMutationActionsEditable(true, false, true), true);
  assert.equal(presentTeamMutationActionsEditable(true, true, true), false);
  assert.equal(presentTeamMutationActionsEditable(false, false, true), false);
  assert.equal(presentTeamMutationActionsEditable(true, false, false), false);
});

test("team mutation notice copy uses caution for invalid email, success for outcomes, danger for failures", () => {
  const copy = {
    invalidEmail: { title: "Check the email", message: "Enter a valid email" },
    added: { title: "Teammate added", message: "Role assigned" },
    addError: { title: "Could not add", message: "Try invite link" },
    inviteCreated: { title: "Invite ready", message: "Share securely" },
    inviteCreateError: { title: "Could not create invite", message: "Retry" },
    inviteCopied: { title: "Copied", message: "Paste securely" },
    inviteRevoked: { title: "Invite revoked", message: "Link disabled" },
    inviteRevokeError: { title: "Could not revoke", message: "Retry" },
    updated: { title: "Role updated", message: "Now active" },
    disabled: { title: "Access disabled", message: "Cannot open" },
    enabled: { title: "Access restored", message: "Can open again" },
    updateError: { title: "Could not update", message: "Retry" },
    removed: { title: "Removed", message: "No access" },
    removeError: { title: "Could not remove", message: "Retry" }
  };
  assert.equal(presentTeamMutationNoticeCopy("invalidEmail", copy).tone, "caution");
  assert.equal(presentTeamMutationNoticeCopy("added", copy).tone, "success");
  assert.equal(presentTeamMutationNoticeCopy("inviteCreated", copy).tone, "success");
  assert.equal(presentTeamMutationNoticeCopy("inviteCopied", copy).tone, "success");
  assert.equal(presentTeamMutationNoticeCopy("disabled", copy).tone, "success");
  assert.equal(presentTeamMutationNoticeCopy("enabled", copy).tone, "success");
  assert.equal(presentTeamMutationNoticeCopy("addError", copy).tone, "danger");
  assert.equal(presentTeamMutationNoticeCopy("inviteCreateError", copy).tone, "danger");
  assert.equal(presentTeamMutationNoticeCopy("removeError", copy).tone, "danger");
  assert.equal(presentTeamMutationNoticeCopy("updated", copy).title, "Role updated");
  assert.equal(presentTeamMutationNoticeCopy("addError", copy).message, "Try invite link");
});

test("team hub uses localized StatusNotice for mutation outcomes and captureMiseError", () => {
  assert.match(teamHub, /presentTeamMutationNoticeCopy/);
  assert.match(teamHub, /presentTeamMutationBusy/);
  assert.match(teamHub, /presentTeamMutationActionsEditable/);
  assert.match(teamHub, /StatusNotice/);
  assert.match(teamHub, /title=\{notice\.title\}/);
  assert.match(teamHub, /message=\{notice\.message\}/);
  assert.match(teamHub, /tone=\{notice\.tone\}/);
  assert.match(teamHub, /captureMiseError/);
  assert.match(teamHub, /flow:\s*"settings_team"/);
  assert.doesNotMatch(teamHub, /title=\{t\(notice\.key\)\}/);
  assert.match(catalog, /settings\.team\.notice\.addedTitle/);
  assert.match(catalog, /settings\.team\.notice\.inviteCreatedTitle/);
  assert.match(catalog, /settings\.team\.notice\.removeErrorTitle/);
  assert.match(catalog, /"settings\.team\.notice\.addedTitle":\s*"Compañero añadido"/);
  assert.match(catalog, /"settings\.team\.notice\.inviteCreatedTitle":\s*"邀请链接已就绪"/);
});

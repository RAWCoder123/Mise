import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAccountDeletionRequestMetadata,
  isCompletedAccountDeletionStatus,
  isConfirmedAccountDeletion,
  selectMembershipIdsDisabledByAccountDeletion,
  selectSoleOwnedRestaurantIds
} from "../services/domain/accountDeletion.ts";

const memberships = [
  {
    id: "m-owner-a",
    restaurant_id: "rest-a",
    user_id: "user-1",
    role: "owner",
    status: "active"
  },
  {
    id: "m-staff-a",
    restaurant_id: "rest-a",
    user_id: "user-2",
    role: "staff",
    status: "active"
  },
  {
    id: "m-owner-b-1",
    restaurant_id: "rest-b",
    user_id: "user-1",
    role: "owner",
    status: "active"
  },
  {
    id: "m-owner-b-2",
    restaurant_id: "rest-b",
    user_id: "user-3",
    role: "owner",
    status: "active"
  },
  {
    id: "m-disabled",
    restaurant_id: "rest-c",
    user_id: "user-1",
    role: "owner",
    status: "disabled"
  }
];

test("account deletion confirmation requires exact DELETE token", () => {
  assert.equal(isConfirmedAccountDeletion("DELETE"), true);
  assert.equal(isConfirmedAccountDeletion(" delete "), true);
  assert.equal(isConfirmedAccountDeletion("delete account"), false);
  assert.equal(isConfirmedAccountDeletion(""), false);
  assert.equal(isConfirmedAccountDeletion(null), false);
});

test("account deletion completion status is exact completed only", () => {
  assert.equal(isCompletedAccountDeletionStatus("completed"), true);
  assert.equal(isCompletedAccountDeletionStatus("processing"), false);
  assert.equal(isCompletedAccountDeletionStatus("failed"), false);
  assert.equal(isCompletedAccountDeletionStatus("requested"), false);
  assert.equal(isCompletedAccountDeletionStatus(""), false);
  assert.equal(isCompletedAccountDeletionStatus(null), false);
  assert.equal(isCompletedAccountDeletionStatus(undefined), false);
});

test("sole-owned restaurants exclude co-owned and inactive memberships", () => {
  assert.deepEqual(selectSoleOwnedRestaurantIds("user-1", memberships), ["rest-a"]);
});

test("account deletion disables actor memberships and all members on sole-owned restaurants", () => {
  const soleOwned = selectSoleOwnedRestaurantIds("user-1", memberships);
  assert.deepEqual(
    selectMembershipIdsDisabledByAccountDeletion("user-1", memberships, soleOwned),
    ["m-owner-a", "m-owner-b-1", "m-staff-a"]
  );
});

test("account deletion metadata records archive and membership rollback ids", () => {
  const soleOwned = selectSoleOwnedRestaurantIds("user-1", memberships);
  const disabled = selectMembershipIdsDisabledByAccountDeletion("user-1", memberships, soleOwned);
  assert.deepEqual(buildAccountDeletionRequestMetadata({
    soleOwnedRestaurantIds: soleOwned,
    disabledMembershipIds: disabled
  }), {
    source: "service_request_my_account_deletion",
    archived_restaurant_ids: ["rest-a"],
    archived_restaurant_count: 1,
    disabled_membership_ids: ["m-owner-a", "m-owner-b-1", "m-staff-a"],
    disabled_membership_count: 3
  });
});

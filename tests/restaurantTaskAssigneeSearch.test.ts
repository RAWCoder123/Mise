import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  filterRestaurantTaskAssigneesBySearch,
  RESTAURANT_TASK_ASSIGNEE_SEARCH_THRESHOLD
} from "../services/domain/restaurantTaskAssigneeSearch";

const members = [
  {
    user_id: "user-alex",
    name: "Alex Rivera",
    email: "alex@example.com",
    role: "manager"
  },
  {
    user_id: "user-bailey",
    name: "Bailey Chen",
    email: "bailey@kitchen.test",
    role: "staff"
  },
  {
    user_id: "user-casey",
    name: "Casey Ortiz",
    email: "casey@example.com",
    role: "admin"
  },
  {
    user_id: "user-dana",
    name: "Dana Kim",
    email: "dana@produce.test",
    role: "staff"
  },
  {
    user_id: "user-eden",
    name: "Eden Blake",
    email: "eden@example.com",
    role: "owner"
  },
  {
    user_id: "user-fran",
    name: "Fran Nguyen",
    email: "fran@example.com",
    role: "manager"
  },
  {
    user_id: "user-gray",
    name: "Gray Patel",
    email: "gray@example.com",
    role: "staff"
  },
  {
    user_id: "user-harper",
    name: "Harper Singh",
    email: "harper@example.com",
    role: "staff"
  },
  {
    user_id: "user-blank",
    name: "   ",
    email: null,
    role: "staff"
  },
  {
    user_id: "user-email-only",
    name: null,
    email: "prep.lead@example.com",
    role: "staff"
  }
] as const;

test("RESTAURANT_TASK_ASSIGNEE_SEARCH_THRESHOLD stays at eight assignable members", () => {
  assert.equal(RESTAURANT_TASK_ASSIGNEE_SEARCH_THRESHOLD, 8);
});

test("filterRestaurantTaskAssigneesBySearch returns the full deduped list for an empty query", () => {
  const withDup = [
    ...members.slice(0, 3),
    {
      user_id: "user-alex",
      name: "Alex Rivera Dup",
      email: "alex-dup@example.com",
      role: "manager"
    }
  ];
  assert.deepEqual(
    filterRestaurantTaskAssigneesBySearch(withDup, " ").map((member) => member.user_id),
    ["user-alex", "user-bailey", "user-casey"]
  );
  assert.equal(filterRestaurantTaskAssigneesBySearch(members, "").length, 10);
});

test("filterRestaurantTaskAssigneesBySearch ranks name and email matches", () => {
  assert.deepEqual(
    filterRestaurantTaskAssigneesBySearch(members, "alex").map((member) => member.user_id),
    ["user-alex"]
  );
  assert.equal(
    filterRestaurantTaskAssigneesBySearch(members, "kitchen.test")[0]?.user_id,
    "user-bailey"
  );
  assert.equal(
    filterRestaurantTaskAssigneesBySearch(members, "prep.lead")[0]?.user_id,
    "user-email-only"
  );
  assert.deepEqual(filterRestaurantTaskAssigneesBySearch(members, "missing-member"), []);
});

test("filterRestaurantTaskAssigneesBySearch matches role and multi-token names", () => {
  assert.ok(
    filterRestaurantTaskAssigneesBySearch(members, "manager")
      .map((member) => member.user_id)
      .includes("user-alex")
  );
  assert.equal(
    filterRestaurantTaskAssigneesBySearch(members, "dana kim")[0]?.user_id,
    "user-dana"
  );
  assert.equal(
    filterRestaurantTaskAssigneesBySearch(members, "owner")[0]?.user_id,
    "user-eden"
  );
});

test("filterRestaurantTaskAssigneesBySearch skips blank labels and prefers exact/prefix hits", () => {
  assert.ok(
    !filterRestaurantTaskAssigneesBySearch(members, "staff").some(
      (member) => member.user_id === "user-blank"
    )
  );
  assert.equal(
    filterRestaurantTaskAssigneesBySearch(members, "alex rivera")[0]?.user_id,
    "user-alex"
  );
  assert.equal(
    filterRestaurantTaskAssigneesBySearch(members, "bailey")[0]?.user_id,
    "user-bailey"
  );
});

test("Create Task assignee picker uses ranked assignee search when the team is large", () => {
  const screen = readFileSync("app/more/create-task.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(screen, /filterRestaurantTaskAssigneesBySearch/);
  assert.match(screen, /RESTAURANT_TASK_ASSIGNEE_SEARCH_THRESHOLD/);
  assert.match(screen, /filteredAssignableTeam\.map/);
  assert.match(screen, /operatorTasks\.assignee\.search\.placeholder/);
  assert.match(catalog, /"operatorTasks\.assignee\.search\.accessibility"/);
  assert.match(catalog, /"operatorTasks\.assignee\.search\.empty"/);
});

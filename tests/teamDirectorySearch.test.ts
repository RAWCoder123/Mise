import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  filterTeamDirectoryBySearch,
  TEAM_DIRECTORY_SEARCH_THRESHOLD
} from "../services/domain/teamDirectorySearch";

const members = [
  {
    user_id: "user-alex",
    name: "Alex Rivera",
    email: "alex@example.com",
    role: "manager",
    status: "active"
  },
  {
    user_id: "user-bailey",
    name: "Bailey Chen",
    email: "bailey@kitchen.test",
    role: "staff",
    status: "active"
  },
  {
    user_id: "user-casey",
    name: "Casey Ortiz",
    email: "casey@example.com",
    role: "admin",
    status: "active"
  },
  {
    user_id: "user-dana",
    name: "Dana Kim",
    email: "dana@produce.test",
    role: "staff",
    status: "invited"
  },
  {
    user_id: "user-eden",
    name: "Eden Blake",
    email: "eden@example.com",
    role: "owner",
    status: "active"
  },
  {
    user_id: "user-fran",
    name: "Fran Nguyen",
    email: "fran@example.com",
    role: "manager",
    status: "disabled"
  },
  {
    user_id: "user-blank",
    name: "   ",
    email: null,
    role: "staff",
    status: "active"
  },
  {
    user_id: "user-email-only",
    name: null,
    email: "prep.lead@example.com",
    role: "staff",
    status: "active"
  }
] as const;

test("TEAM_DIRECTORY_SEARCH_THRESHOLD stays at six members", () => {
  assert.equal(TEAM_DIRECTORY_SEARCH_THRESHOLD, 6);
});

test("filterTeamDirectoryBySearch returns the full deduped list for an empty query", () => {
  const withDup = [
    ...members.slice(0, 3),
    {
      user_id: "user-alex",
      name: "Alex Rivera Dup",
      email: "alex-dup@example.com",
      role: "manager",
      status: "active"
    }
  ];
  assert.deepEqual(
    filterTeamDirectoryBySearch(withDup, " ").map((member) => member.user_id),
    ["user-alex", "user-bailey", "user-casey"]
  );
  assert.equal(filterTeamDirectoryBySearch(members, "").length, 8);
});

test("filterTeamDirectoryBySearch ranks name and email matches", () => {
  assert.deepEqual(
    filterTeamDirectoryBySearch(members, "alex").map((member) => member.user_id),
    ["user-alex"]
  );
  assert.equal(
    filterTeamDirectoryBySearch(members, "kitchen.test")[0]?.user_id,
    "user-bailey"
  );
  assert.equal(
    filterTeamDirectoryBySearch(members, "prep.lead")[0]?.user_id,
    "user-email-only"
  );
  assert.deepEqual(filterTeamDirectoryBySearch(members, "missing-member"), []);
});

test("filterTeamDirectoryBySearch matches role, status, and multi-token names", () => {
  assert.ok(
    filterTeamDirectoryBySearch(members, "manager")
      .map((member) => member.user_id)
      .includes("user-alex")
  );
  assert.equal(
    filterTeamDirectoryBySearch(members, "dana kim")[0]?.user_id,
    "user-dana"
  );
  assert.equal(
    filterTeamDirectoryBySearch(members, "owner")[0]?.user_id,
    "user-eden"
  );
  assert.equal(
    filterTeamDirectoryBySearch(members, "invited")[0]?.user_id,
    "user-dana"
  );
  assert.equal(
    filterTeamDirectoryBySearch(members, "disabled")[0]?.user_id,
    "user-fran"
  );
});

test("filterTeamDirectoryBySearch skips blank labels and prefers exact/prefix hits", () => {
  assert.ok(
    !filterTeamDirectoryBySearch(members, "staff").some(
      (member) => member.user_id === "user-blank"
    )
  );
  assert.equal(
    filterTeamDirectoryBySearch(members, "alex rivera")[0]?.user_id,
    "user-alex"
  );
  assert.equal(
    filterTeamDirectoryBySearch(members, "bailey")[0]?.user_id,
    "user-bailey"
  );
});

test("Team Settings directory uses ranked member search when the team is large", () => {
  const screen = readFileSync("app/settings/team.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(screen, /filterTeamDirectoryBySearch/);
  assert.match(screen, /TEAM_DIRECTORY_SEARCH_THRESHOLD/);
  assert.match(screen, /filteredMembers\.map/);
  assert.match(screen, /team\.members\.search\.placeholder/);
  assert.match(catalog, /"team\.members\.search\.accessibility"/);
  assert.match(catalog, /"team\.members\.search\.emptyTitle"/);
});

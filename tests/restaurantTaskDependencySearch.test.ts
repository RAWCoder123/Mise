import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  filterRestaurantTaskDependenciesBySearch,
  RESTAURANT_TASK_DEPENDENCY_SEARCH_THRESHOLD
} from "../services/domain/restaurantTaskDependencySearch";

const tasks = [
  {
    id: "task-count",
    title: "Count high-risk produce",
    status: "waiting",
    operationalCategory: "inventory",
    relatedSupplierName: null,
    detail: "Walk-in cooler"
  },
  {
    id: "task-receive",
    title: "Receive Sysco delivery",
    status: "ready",
    operationalCategory: "receiving",
    relatedSupplierName: "Sysco",
    detail: "Check invoice"
  },
  {
    id: "task-approve",
    title: "Approve produce order",
    status: "blocked",
    operationalCategory: "purchasing",
    relatedSupplierName: "Local Farms",
    detail: null
  },
  {
    id: "task-waste",
    title: "Log prep waste",
    status: "waiting",
    operationalCategory: "inventory",
    relatedSupplierName: null,
    detail: "End of lunch"
  },
  {
    id: "task-close",
    title: "Close walk-in checklist",
    status: "ready",
    operationalCategory: "closing",
    relatedSupplierName: null,
    detail: null
  },
  {
    id: "task-pos",
    title: "Reconnect Square POS",
    status: "waiting",
    operationalCategory: "integrations",
    relatedSupplierName: null,
    detail: "Token expired"
  },
  {
    id: "task-order-send",
    title: "Send dairy order",
    status: "ready",
    operationalCategory: "purchasing",
    relatedSupplierName: "Dairy Co",
    detail: null
  },
  {
    id: "task-verify",
    title: "Verify count variance",
    status: "blocked",
    operationalCategory: "inventory",
    relatedSupplierName: null,
    detail: "Tomatoes"
  },
  {
    id: "task-blank",
    title: "   ",
    status: "waiting",
    operationalCategory: "other",
    relatedSupplierName: null,
    detail: null
  }
] as const;

test("RESTAURANT_TASK_DEPENDENCY_SEARCH_THRESHOLD stays at eight open tasks", () => {
  assert.equal(RESTAURANT_TASK_DEPENDENCY_SEARCH_THRESHOLD, 8);
});

test("filterRestaurantTaskDependenciesBySearch returns the full deduped list for an empty query", () => {
  const withDup = [
    ...tasks.slice(0, 3),
    {
      id: "task-count",
      title: "Count high-risk produce Dup",
      status: "waiting",
      operationalCategory: "inventory",
      relatedSupplierName: null,
      detail: null
    }
  ];
  assert.deepEqual(
    filterRestaurantTaskDependenciesBySearch(withDup, " ").map((task) => task.id),
    ["task-count", "task-receive", "task-approve"]
  );
  assert.equal(filterRestaurantTaskDependenciesBySearch(tasks, "").length, 9);
});

test("filterRestaurantTaskDependenciesBySearch ranks task title matches", () => {
  assert.deepEqual(
    filterRestaurantTaskDependenciesBySearch(tasks, "count").map((task) => task.id),
    ["task-count", "task-verify"]
  );
  assert.equal(filterRestaurantTaskDependenciesBySearch(tasks, "sysco")[0]?.id, "task-receive");
  assert.deepEqual(filterRestaurantTaskDependenciesBySearch(tasks, "missing-task"), []);
});

test("filterRestaurantTaskDependenciesBySearch matches status, category, supplier, and detail", () => {
  assert.deepEqual(
    filterRestaurantTaskDependenciesBySearch(tasks, "blocked").map((task) => task.id),
    ["task-approve", "task-verify"]
  );
  assert.ok(
    filterRestaurantTaskDependenciesBySearch(tasks, "purchasing")
      .map((task) => task.id)
      .includes("task-approve")
  );
  assert.equal(filterRestaurantTaskDependenciesBySearch(tasks, "dairy co")[0]?.id, "task-order-send");
  assert.equal(filterRestaurantTaskDependenciesBySearch(tasks, "walk-in cooler")[0]?.id, "task-count");
});

test("filterRestaurantTaskDependenciesBySearch skips blank titles and prefers exact/prefix hits", () => {
  assert.ok(
    !filterRestaurantTaskDependenciesBySearch(tasks, "other").some((task) => task.id === "task-blank")
  );
  assert.equal(
    filterRestaurantTaskDependenciesBySearch(tasks, "count high-risk produce")[0]?.id,
    "task-count"
  );
  assert.equal(
    filterRestaurantTaskDependenciesBySearch(tasks, "receive")[0]?.id,
    "task-receive"
  );
});

test("Create Task prerequisite picker uses ranked dependency search without a hard slice cap", () => {
  const screen = readFileSync("app/more/create-task.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(screen, /filterRestaurantTaskDependenciesBySearch/);
  assert.match(screen, /RESTAURANT_TASK_DEPENDENCY_SEARCH_THRESHOLD/);
  assert.match(screen, /filteredDependencyTasks\.map/);
  assert.match(screen, /operatorTasks\.dependency\.search\.placeholder/);
  assert.doesNotMatch(screen, /visibleOpenSharedTasks\.slice\(0,\s*12\)/);
  assert.match(catalog, /"operatorTasks\.dependency\.search\.accessibility"/);
  assert.match(catalog, /"operatorTasks\.dependency\.search\.empty"/);
});

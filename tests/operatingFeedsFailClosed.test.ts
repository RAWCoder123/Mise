import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as ts from "typescript";

import { fetchOperatingBrief } from "../services/application/operatingBrief";
import { fetchDailyOperatingPlan } from "../services/application/operatingPlan";
import { setMiseRepositoryForTesting } from "../services/application/repository";
import { fetchTodaySummary } from "../services/application/today";
import type { MiseRepository } from "../services/repositories/repositoryContracts";
import type { Restaurant } from "../types/mise";

const restaurantId = "restaurant-fail-closed";
const restaurant: Restaurant = {
  id: restaurantId,
  name: "Fail Closed Kitchen",
  address: null,
  cuisine_type: "Test",
  brand_color: "#B42318",
  accent_color: "#B42318",
  logo_url: null,
  service_style: "full_service",
  timezone: "America/New_York",
  currency: "USD",
  operational_profile: {
    serviceStyle: "full_service",
    orderCadence: [],
    prepWindows: [],
    primarySuppliers: [],
    inventoryReviewDays: [],
    notes: null
  },
  created_at: "2026-01-01T00:00:00.000Z"
};

type FailingRead =
  | "listActivityEvents"
  | "listMiseActions"
  | "fetchOperationalFindingDecisions"
  | "fetchOpenInventoryCountSession";

function baseRepository(): MiseRepository {
  const stub: Partial<MiseRepository> = {
    async fetchRestaurantData() {
      return {
        restaurant,
        sales: [],
        inventoryItems: [],
        purchaseRecommendations: [],
        insights: [],
        menuItemIngredients: [],
        providerMappings: []
      };
    },
    async fetchSupplierOrders() {
      return [];
    },
    async fetchEmailConnectionState() {
      return null;
    },
    async fetchPosIntegrations() {
      return [];
    },
    async listActivityEvents() {
      return [];
    },
    async listMiseActions() {
      return [];
    },
    async fetchOperationalFindingDecisions() {
      return [];
    },
    async listRestaurantTasks() {
      return [];
    },
    async fetchOpenInventoryCountSession() {
      return null;
    },
    async listInventoryEvents() {
      return [];
    }
  };
  return stub as MiseRepository;
}

function repositoryFailing(read: FailingRead, failure: Error): MiseRepository {
  const stub = baseRepository();
  stub[read] = async () => {
    throw failure;
  };
  return stub;
}

async function expectReadFailure(
  read: FailingRead,
  load: () => Promise<unknown>
): Promise<void> {
  const failure = new Error(`${read} unavailable`);
  const restore = setMiseRepositoryForTesting(repositoryFailing(read, failure));
  try {
    await assert.rejects(load(), (error) => error === failure);
  } finally {
    restore();
  }
}

test("operating brief propagates failures from every approval and activity feed", async () => {
  for (const read of [
    "listActivityEvents",
    "listMiseActions",
    "fetchOperationalFindingDecisions"
  ] as const) {
    await expectReadFailure(read, () => fetchOperatingBrief(restaurantId));
  }
});

test("operating plan propagates activity feed failures", async () => {
  await expectReadFailure("listActivityEvents", () => fetchDailyOperatingPlan(restaurantId));
});

test("Today summary propagates open count session failures", async () => {
  await expectReadFailure("fetchOpenInventoryCountSession", () => fetchTodaySummary(restaurantId));
});

function namedCalls(sourceFile: ts.SourceFile, name: string): ts.CallExpression[] {
  const matches: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === name
    ) {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return matches;
}

function hasSwallowingAncestor(call: ts.CallExpression): boolean {
  let node: ts.Node = call;
  while (node.parent) {
    const parent = node.parent;
    if (
      ts.isPropertyAccessExpression(parent) &&
      parent.expression === node &&
      parent.name.text === "catch"
    ) {
      return true;
    }
    if (
      ts.isTryStatement(parent) &&
      parent.catchClause &&
      call.pos >= parent.tryBlock.pos &&
      call.end <= parent.tryBlock.end
    ) {
      return true;
    }
    node = parent;
  }
  return false;
}

function assertRequiredCallFailsClosed(sourceFile: ts.SourceFile, name: string): void {
  const calls = namedCalls(sourceFile, name);
  assert.ok(calls.length > 0, `${name} must remain part of the daily closeout`);
  for (const call of calls) {
    assert.equal(hasSwallowingAncestor(call), false, `${name} must propagate failures`);
  }
}

function assertFunctionContainsNoFallback(sourceFile: ts.SourceFile, name: string): void {
  let declaration: ts.FunctionDeclaration | undefined;
  const findDeclaration = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    ts.forEachChild(node, findDeclaration);
  };
  findDeclaration(sourceFile);
  assert.ok(declaration?.body, `${name} must remain defined`);

  let fallback: ts.Node | undefined;
  const findFallback = (node: ts.Node) => {
    if (ts.isTryStatement(node) && node.catchClause) fallback = node;
    if (ts.isPropertyAccessExpression(node) && node.name.text === "catch") fallback = node;
    ts.forEachChild(node, findFallback);
  };
  findFallback(declaration.body);
  assert.equal(fallback, undefined, `${name} must not replace delivery failures`);
}

test("screen and closeout reads do not attach empty fallbacks to required feeds", () => {
  const todayScreen = readFileSync("app/(tabs)/today.tsx", "utf8");
  const inventoryScreen = readFileSync("app/(tabs)/inventory.tsx", "utf8");
  const dailyReport = readFileSync("services/application/dailyReport.ts", "utf8");
  const dailyReportAst = ts.createSourceFile(
    "services/application/dailyReport.ts",
    dailyReport,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  assert.match(todayScreen, /listOpenOperatorTasks\(restaurantId\)/);
  assert.doesNotMatch(todayScreen, /listOpenOperatorTasks\([^)]*\)\.catch\(\s*\(\)\s*=>\s*\[\s*\]/);

  assert.match(inventoryScreen, /fetchOpenInventoryCountSession\(restaurantId\)/);
  assert.doesNotMatch(
    inventoryScreen,
    /fetchOpenInventoryCountSession\([^)]*\)\.catch\(\s*\(\)\s*=>\s*null\s*\)/
  );

  for (const name of [
    "fetchInventoryOutlookItems",
    "listOpenOperatorTasks",
    "fetchSupplierReliabilitySummary",
    "loadDeliveriesToday",
    "fetchWasteAnalysis"
  ]) {
    assertRequiredCallFailsClosed(dailyReportAst, name);
  }
  assertFunctionContainsNoFallback(dailyReportAst, "loadDeliveriesToday");
});

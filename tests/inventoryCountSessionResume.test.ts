import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("count Start resumes an already-open session instead of surfacing a raw begin error", () => {
  const screen = readFileSync("app/inventory/count.tsx", "utf8");
  const application = readFileSync("services/application/inventory.ts", "utf8");
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const demo = readFileSync("services/repositories/demoRepository.ts", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(application, /beginOrResumeInventoryCountSession/);
  assert.match(application, /fetchOpenInventoryCountSession\(restaurantId\)/);
  assert.match(application, /resumed:\s*true/);
  assert.match(screen, /beginOrResumeInventoryCountSession/);
  assert.match(screen, /inventory\.count\.resumed/);
  assert.match(screen, /syncDraftsFromDetail\(next\)/);
  assert.match(screen, /inventory\.count\.startErrorGeneric/);
  const startSessionBlock =
    screen.match(/async function startSession\(\) \{[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.match(startSessionBlock, /beginOrResumeInventoryCountSession/);
  assert.doesNotMatch(
    startSessionBlock,
    /setError\(caught instanceof Error \? caught\.message/,
    "Start must not surface raw begin errors to operators"
  );
  assert.match(edge, /HttpError\(409,\s*"A count session is already open for this restaurant"\)/);
  assert.match(edge, /isCountSessionAlreadyOpenRpcError/);
  assert.match(demo, /Idempotent begin: resume the open session/);
  assert.match(catalog, /"inventory\.count\.resumed"/);
  assert.match(catalog, /"inventory\.count\.startErrorGeneric"/);
});

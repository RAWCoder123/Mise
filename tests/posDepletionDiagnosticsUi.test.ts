import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("POS depletion diagnostics are wired through service and operator surfaces", () => {
  const domain = readFileSync("services/domain/posDepletionDiagnostics.ts", "utf8");
  const application = readFileSync("services/application/posDepletionDiagnostics.ts", "utf8");
  const service = readFileSync("services/miseService.ts", "utf8");
  const screen = readFileSync("app/more/pos-depletion.tsx", "utf8");
  const card = readFileSync("components/operations/PosDepletionDiagnosticsCard.tsx", "utf8");
  const pos = readFileSync("app/settings/pos.tsx", "utf8");
  const recipes = readFileSync("app/settings/recipes.tsx", "utf8");
  const more = readFileSync("app/(tabs)/more.tsx", "utf8");
  const layout = readFileSync("app/_layout.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(domain, /buildPosDepletionDiagnostics/);
  assert.match(domain, /unverified_provider_mapping/);
  assert.match(domain, /incompatible_recipe_units/);
  assert.match(application, /fetchPlanningData/);
  assert.match(application, /assertPosDepletionDiagnosticsTenantScoped/);
  assert.match(service, /application\/posDepletionDiagnostics/);
  assert.match(screen, /resolveRestaurantScopedHubLoadState/);
  assert.match(screen, /hubReady/);
  assert.match(card, /router\.push\("\/more\/pos-depletion"/);
  assert.match(pos, /PosDepletionDiagnosticsCard/);
  assert.match(recipes, /PosDepletionDiagnosticsCard/);
  assert.match(more, /\/more\/pos-depletion/);
  assert.match(layout, /more\/pos-depletion/);
  assert.match(catalog, /"posDepletion\.title"/);
  assert.match(catalog, /"more\.row\.posDepletion\.title"/);
});

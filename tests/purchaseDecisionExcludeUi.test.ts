import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen = readFileSync("app/(tabs)/orders.tsx", "utf8");
const row = readFileSync("components/RecommendationDecisionRow.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");
const telemetry = readFileSync("services/telemetry.ts", "utf8");

test("exclude-from-learning is manager-gated, confirms, and reloads advisory patterns", () => {
  assert.match(screen, /excludePurchaseDecisionEvent/);
  assert.match(screen, /Alert\.alert\(/);
  assert.match(screen, /orders\.memory\.excludeConfirmTitle/);
  assert.match(screen, /orders\.memory\.excludeConfirmAction/);
  assert.match(screen, /pattern\.evidenceEventIds\[0\]/);
  assert.match(screen, /patternExclusionLocksRef/);
  assert.match(screen, /await load\(false\)/);
  assert.match(screen, /purchase_decision_excluded/);
  assert.match(screen, /if \(!actionsEditable\)/);
  assert.match(screen, /onExcludePattern=\{\s*actionsEditable && purchaseDecisionPattern/);
  assert.match(row, /canExcludePattern/);
  assert.match(row, /excludingPattern/);
  assert.match(row, /!readOnly/);
  assert.match(row, /variant="ghost"/);
  assert.match(row, /size="compact"/);
});

test("exclude-from-learning clears pattern state on restaurant switch", () => {
  assert.match(screen, /setPurchaseDecisionPatterns\(\[\]\)/);
  assert.match(screen, /setExcludingPatternIds\(\{\}\)/);
  assert.match(screen, /patternExclusionLocksRef\.current\.clear\(\)/);
});

test("exclude-from-learning copy exists in EN, ES, and zh-Hans catalogs", () => {
  for (const key of [
    "orders.memory.exclude",
    "orders.memory.excluding",
    "orders.memory.excludeAccessibility",
    "orders.memory.excludeHint",
    "orders.memory.excludeConfirmTitle",
    "orders.memory.excludeConfirmBody",
    "orders.memory.excludeConfirmAction",
    "orders.memory.excludeCancel",
    "orders.notice.excluded",
    "orders.error.exclude"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}":`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} must exist once per locale`);
  }
});

test("exclude telemetry event is allowlisted without raw decision payloads", () => {
  assert.match(telemetry, /"purchase_decision_excluded"/);
  const trackCall = screen.match(
    /trackMiseEvent\("purchase_decision_excluded",\s*\{[\s\S]*?\}\)/
  )?.[0];
  assert.ok(trackCall);
  assert.doesNotMatch(trackCall, /evidence_event_id|eventId|event_id/);
  assert.match(trackCall, /evidence_strength: pattern\.evidenceStrength/);
  assert.match(trackCall, /sample_count: pattern\.sampleCount/);
});

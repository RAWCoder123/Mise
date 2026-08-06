import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const syncPos = readFileSync("supabase/functions/sync-pos-sales/index.ts", "utf8");
const generateAi = readFileSync("supabase/functions/generate-ai-insights/index.ts", "utf8");

function assertFailClosedOrder(source: string, functionName: string) {
  const auth = source.indexOf("requireAuthenticatedContext(req)");
  const body = source.indexOf("readJsonObject(req)");
  const reservation = source.indexOf("reserveFunctionInvocation(");
  const liveRole = source.indexOf("requireRestaurantRole(");
  const audit = source.indexOf("recordFunctionAuditLog(");
  const terminalEvent = source.indexOf("recordFunctionSecurityEvent(");
  const closeContext = source.indexOf("terminalContext = null", terminalEvent);
  const response = source.indexOf("return jsonResponse(", closeContext);

  assert.ok(auth >= 0 && auth < body, `${functionName} authenticates before reading the body`);
  assert.ok(body < reservation, `${functionName} validates its body before reserving work`);
  assert.ok(reservation < liveRole, `${functionName} rechecks the live restaurant role after reservation`);
  assert.ok(liveRole < audit, `${functionName} audits only a live authorized restaurant actor`);
  assert.ok(audit < terminalEvent, `${functionName} preserves the request audit before its terminal event`);
  assert.ok(terminalEvent < closeContext && closeContext < response, `${functionName} closes the reservation before responding`);
  assert.match(source, /"blocked"/);
  assert.match(source, /provider_not_enabled/);
  assert.match(source, /server_configuration_required/);
  assert.match(source, /retryable:\s*false/);
}

test("POS synchronization keeps non-Square providers and disabled Square fail-closed", () => {
  assertFailClosedOrder(syncPos, "sync-pos-sales");
  assert.match(syncPos, /"pos_sync_blocked"/);
  assert.match(syncPos, /provider !== "square"/);
  assert.match(syncPos, /service_fetch_square_sync_credential/);
  assert.match(syncPos, /service_apply_square_sync_result/);
  assert.match(syncPos, /"pos_sync_completed"/);
  assert.doesNotMatch(syncPos, /\.from\("sales_imports"\)\s*\.(?:insert|upsert)/);
  assert.doesNotMatch(syncPos, /status:\s*"queued"|pos_sync_queued|scaffold:\s*true/);
});

test("unimplemented model generation fails closed without persisting an insight", () => {
  const auth = generateAi.indexOf("requireAuthenticatedContext(req)");
  const body = generateAi.indexOf("readJsonObject(req)");
  const reservation = generateAi.indexOf("reserveFunctionInvocation(");
  const liveRole = generateAi.indexOf("requireRestaurantRole(");
  const audit = generateAi.indexOf("recordFunctionAuditLog(");
  const terminalEvent = generateAi.indexOf("recordFunctionSecurityEvent(");
  const closeContext = generateAi.indexOf("terminalContext = null", terminalEvent);
  const response = generateAi.indexOf("return jsonResponse(", closeContext);

  assert.ok(auth >= 0 && auth < body);
  assert.ok(body < reservation);
  assert.ok(reservation < liveRole);
  assert.ok(liveRole < audit);
  assert.ok(audit < terminalEvent);
  assert.ok(terminalEvent < closeContext && closeContext < response);
  assert.equal(generateAi.match(/recordFunctionSecurityEvent\s*\(/g)?.length ?? 0, 1);
  assert.match(generateAi, /"blocked"/);
  assert.match(generateAi, /provider_not_enabled/);
  assert.match(generateAi, /server_configuration_required/);
  assert.match(generateAi, /providerConfigured\s*\?\s*501\s*:\s*503/);
  assert.match(generateAi, /retryable:\s*false/);
  assert.doesNotMatch(generateAi, /"completed"/);
  assert.match(generateAi, /"ai_insight_generation_blocked"/);
  assert.doesNotMatch(generateAi, /service_create_rules_engine_ai_insight|\.from\("ai_insights"\)/);
  assert.doesNotMatch(generateAi, /generated_placeholder|ready_not_executed|ai_insight_generated/);
});

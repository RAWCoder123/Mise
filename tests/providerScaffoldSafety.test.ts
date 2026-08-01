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
  assert.equal(
    source.match(/recordFunctionSecurityEvent\s*\(/g)?.length ?? 0,
    1,
    `${functionName} has one explicit terminal security-event write`
  );
  assert.match(source, /"blocked"/);
  assert.match(source, /provider_not_enabled/);
  assert.match(source, /server_configuration_required/);
  assert.match(source, /providerConfigured\s*\?\s*501\s*:\s*503/);
  assert.match(source, /retryable:\s*false/);
  assert.doesNotMatch(source, /"completed"/);
}

test("unimplemented POS synchronization fails closed without creating import work", () => {
  assertFailClosedOrder(syncPos, "sync-pos-sales");
  assert.match(syncPos, /"pos_sync_blocked"/);
  assert.doesNotMatch(syncPos, /\.from\("sales_imports"\)/);
  assert.doesNotMatch(syncPos, /status:\s*"queued"|pos_sync_queued|scaffold:\s*true/);
});

test("unimplemented model generation fails closed without persisting an insight", () => {
  assertFailClosedOrder(generateAi, "generate-ai-insights");
  assert.match(generateAi, /"ai_insight_generation_blocked"/);
  assert.doesNotMatch(generateAi, /service_create_rules_engine_ai_insight|\.from\("ai_insights"\)/);
  assert.doesNotMatch(generateAi, /generated_placeholder|ready_not_executed|ai_insight_generated/);
});

test("hosted createAiInsight surfaces fail-closed Edge statuses instead of inventing an insight", () => {
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const hostedCreate =
    repository.match(
      /async createAiInsight\(input\) \{\s*const \{ data, error \} = await client\.functions\.invoke\("generate-ai-insights"[\s\S]*?async recordAuditLog\(/
    )?.[0] ?? "";
  assert.ok(hostedCreate.length > 0, "hosted createAiInsight Edge invoke path must exist");
  assert.match(hostedCreate, /provider_not_enabled/);
  assert.match(hostedCreate, /server_configuration_required/);
  assert.match(hostedCreate, /Live AI insight generation is unavailable/);
  assert.doesNotMatch(hostedCreate, /service_create_rules_engine_ai_insight/);
});

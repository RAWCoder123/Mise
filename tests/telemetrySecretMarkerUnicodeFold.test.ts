import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  hasForbiddenTelemetryMarker,
  sanitizeTelemetryRecord,
  unicodeFoldTelemetryText
} from "../services/domain/telemetrySecurity";

const KELVIN = "\u212A";

test("MISE-005KK pins telemetry secret markers to Unicode fold before match", () => {
  const telemetrySource = readFileSync("services/domain/telemetrySecurity.ts", "utf8");
  const edgeSource = readFileSync("supabase/functions/_shared/mise.ts", "utf8");
  const exportSource = readFileSync("services/repositories/repositoryContracts.ts", "utf8");
  const safeEnvSource = readFileSync("scripts/safe-env.mjs", "utf8");

  assert.match(telemetrySource, /export function unicodeFoldTelemetryText\(value: string\)/);
  assert.match(telemetrySource, /return value\.toLowerCase\(\);/);
  assert.match(telemetrySource, /hasForbiddenTelemetryMarker\(key\)/);
  assert.doesNotMatch(
    telemetrySource,
    /const forbiddenTelemetryMarker =\s*\/\(token[\s\S]*?\)\/i;/
  );

  assert.match(edgeSource, /hasForbiddenTelemetryMarker/);
  assert.match(edgeSource, /hasForbiddenTelemetryMarker\(key\)/);
  assert.match(edgeSource, /hasForbiddenTelemetryMarker\(value\)/);
  assert.doesNotMatch(
    edgeSource,
    /const forbidden = \/\(token\|secret\|password\|authorization\|cookie\|credential\|private\|service_role\|api\[_-\]\?key\)\/i;/
  );

  assert.match(
    exportSource,
    /restaurantExportProtectedKeyPattern\.test\(key\.toLowerCase\(\)\)/
  );
  assert.doesNotMatch(
    exportSource,
    /(?:access_token\|refresh_token[\s\S]*?)\/i;/
  );

  assert.match(safeEnvSource, /forbiddenChildName\.test\(name\.toLowerCase\(\)\)/);
  assert.doesNotMatch(
    safeEnvSource,
    /const forbiddenChildName = \/\(secret\|password[\s\S]*?\)\/i;/
  );
});

test("ASCII C identity fold would miss Kelvin secret markers that Unicode fold catches", () => {
  const asciiCLower = (value: string) =>
    value.replace(/[A-Z]/g, (character) => character.toLowerCase());
  const kelvinToken = `to${KELVIN}en`;
  const kelvinCookie = `coo${KELVIN}ie`;
  const kelvinApiKey = `api_${KELVIN}ey`;

  // Regression detector: bare /i without /u does not fold Kelvin.
  assert.equal(/(token)/i.test(kelvinToken), false);
  assert.equal(/(cookie)/i.test(kelvinCookie), false);
  assert.equal(/(api[_-]?key)/i.test(kelvinApiKey), false);

  // Unicode fold invents the ASCII secret marker (scrubbers want this).
  assert.equal(unicodeFoldTelemetryText(kelvinToken), "token");
  assert.equal(unicodeFoldTelemetryText(kelvinCookie), "cookie");
  assert.equal(unicodeFoldTelemetryText(kelvinApiKey), "api_key");
  assert.equal(hasForbiddenTelemetryMarker(kelvinToken), true);
  assert.equal(hasForbiddenTelemetryMarker(kelvinCookie), true);
  assert.equal(hasForbiddenTelemetryMarker(kelvinApiKey), true);

  // ASCII C would leave Kelvin intact and miss the marker — proving why
  // scrubbers must not reuse identity-tip ASCII C folds here.
  assert.equal(asciiCLower(kelvinToken), kelvinToken);
  assert.notEqual(asciiCLower(kelvinToken), "token");
});

test("sanitizeTelemetryRecord redacts Kelvin-lookalike secret keys and values", () => {
  const kelvinTokenKey = `refresh_to${KELVIN}en`;
  const kelvinTokenValue = `opaque-to${KELVIN}en-value`;
  const sanitized = sanitizeTelemetryRecord({
    restaurant_id: "restaurant_a",
    [kelvinTokenKey]: "should-not-leave",
    nested: {
      detail: kelvinTokenValue,
      count: 2
    },
    ordinary: "safe-context"
  });

  assert.equal(sanitized.restaurant_id, "restaurant_a");
  assert.equal(sanitized.ordinary, "safe-context");
  assert.equal(sanitized[kelvinTokenKey], "[redacted]");
  assert.deepEqual(sanitized.nested, {
    detail: "[redacted]",
    count: 2
  });

  // Ordinary ASCII uppercase markers still redact after Unicode fold.
  const ascii = sanitizeTelemetryRecord({
    AUTHORIZATION: "Bearer abc",
    API_KEY: "secret"
  });
  assert.equal(ascii.AUTHORIZATION, "[redacted]");
  assert.equal(ascii.API_KEY, "[redacted]");
});

test("safeFunctionMetadata wiring shares Unicode-fold secret markers", () => {
  const edgeSource = readFileSync("supabase/functions/_shared/mise.ts", "utf8");
  const sanitizeBody = edgeSource.slice(
    edgeSource.indexOf("function sanitizeMetadataValue("),
    edgeSource.indexOf("function safeContextString(")
  );
  assert.match(sanitizeBody, /hasForbiddenTelemetryMarker\(key\)/);
  assert.match(sanitizeBody, /hasForbiddenTelemetryMarker\(value\)/);
  assert.doesNotMatch(sanitizeBody, /\.test\(key\)/);
  assert.doesNotMatch(sanitizeBody, /\/i/);
});

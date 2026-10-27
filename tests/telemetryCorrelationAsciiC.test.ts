import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  TELEMETRY_CORRELATION_VALUE_MAX_CHARACTERS,
  asciiTrimTelemetryCorrelationValue,
  canonicalizeTelemetryCorrelationValue,
  normalizeTelemetryCorrelationValue,
  resolveTelemetryCorrelationValue
} from "../services/domain/telemetryCorrelationIdentity";
import {
  TELEMETRY_NOT_APPLICABLE,
  buildTelemetryCorrelation
} from "../services/domain/telemetrySecurity";

const identitySource = readFileSync(
  new URL("../services/domain/telemetryCorrelationIdentity.ts", import.meta.url),
  "utf8"
);
const telemetrySource = readFileSync(
  new URL("../services/domain/telemetrySecurity.ts", import.meta.url),
  "utf8"
);
const activityIdempotencySource = readFileSync(
  new URL("../services/domain/activityEvents.ts", import.meta.url),
  "utf8"
);

const cleanRequestId = "req_abc123";
const cleanRestaurantId = "00000000-0000-4000-8000-000000000001";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005SE pins telemetry correlation identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005SE/);
  assert.match(telemetrySource, /MISE-005SE/);

  assert.match(
    identitySource,
    /export function asciiTrimTelemetryCorrelationValue\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    telemetrySource,
    /from "\.\/telemetryCorrelationIdentity\.ts"/
  );
  assert.match(
    telemetrySource,
    /resolveTelemetryCorrelationValue\(input\.requestId, "missing_request_id"\)/
  );
  assert.match(
    telemetrySource,
    /resolveTelemetryCorrelationValue\(\s*input\.restaurantId,\s*TELEMETRY_NOT_APPLICABLE\s*\)/
  );
  assert.doesNotMatch(telemetrySource, /function safeCorrelationValue\(/);
  assert.doesNotMatch(telemetrySource, /value\.trim\(\)/);

  // Leave open #868 activity idempotency and #809 restaurant-tasks correlation alone.
  assert.doesNotMatch(identitySource, /activityEventIdempotencyIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasks/);
  assert.doesNotMatch(telemetrySource, /activityEventIdempotencyIdentity/);
  assert.doesNotMatch(activityIdempotencySource, /telemetryCorrelationIdentity/);

  assert.equal(TELEMETRY_CORRELATION_VALUE_MAX_CHARACTERS, 128);
});

test("ASCII whitespace still trims clean for telemetry correlation values", () => {
  assert.equal(asciiTrimTelemetryCorrelationValue(`  ${cleanRequestId}  `), cleanRequestId);
  assert.equal(asciiTrimTelemetryCorrelationValue(`\t${cleanRequestId}\n`), cleanRequestId);
  assert.equal(canonicalizeTelemetryCorrelationValue(`  ${cleanRequestId}  `), cleanRequestId);
  assert.equal(normalizeTelemetryCorrelationValue(`\t${cleanRequestId}\n`), cleanRequestId);
  assert.equal(
    resolveTelemetryCorrelationValue(`  ${cleanRequestId}  `, "missing_request_id"),
    cleanRequestId
  );

  const correlation = buildTelemetryCorrelation({
    environment: "  staging  ",
    release: "\tmise-mobile@0.1.0+42\n",
    operation: "  inventory_event_submit  ",
    requestId: `  ${cleanRequestId}  `,
    operationId: "  operation-123  ",
    restaurantId: `  ${cleanRestaurantId}  `,
    authoritativeEventId: "  event-123  "
  });
  assert.equal(correlation.app_env, "staging");
  assert.equal(correlation.release, "mise-mobile@0.1.0+42");
  assert.equal(correlation.operation, "inventory_event_submit");
  assert.equal(correlation.request_id, cleanRequestId);
  assert.equal(correlation.operation_id, "operation-123");
  assert.equal(correlation.restaurant_id, cleanRestaurantId);
  assert.equal(correlation.authoritative_event_id, "event-123");

  // Soft empty keeps prior per-field fallback contracts.
  assert.equal(canonicalizeTelemetryCorrelationValue(""), null);
  assert.equal(canonicalizeTelemetryCorrelationValue("   "), null);
  assert.equal(canonicalizeTelemetryCorrelationValue("\t\n"), null);
  assert.equal(canonicalizeTelemetryCorrelationValue(em), null);
  assert.equal(canonicalizeTelemetryCorrelationValue(nbsp), null);
  assert.equal(normalizeTelemetryCorrelationValue(""), null);
  assert.equal(normalizeTelemetryCorrelationValue(em), null);
  assert.equal(normalizeTelemetryCorrelationValue(42), null);
  assert.equal(
    resolveTelemetryCorrelationValue("", "missing_request_id"),
    "missing_request_id"
  );
  assert.equal(
    resolveTelemetryCorrelationValue(em, TELEMETRY_NOT_APPLICABLE),
    TELEMETRY_NOT_APPLICABLE
  );
});

test("Unicode-padded telemetry correlation values fail closed instead of inventing", () => {
  // Prior Unicode trim invented a clean durable correlation identity.
  assert.equal(`${em}${cleanRequestId}${em}`.trim(), cleanRequestId);
  assert.equal(canonicalizeTelemetryCorrelationValue(`${em}${cleanRequestId}${em}`), null);
  assert.equal(normalizeTelemetryCorrelationValue(`${em}${cleanRequestId}${em}`), null);
  assert.equal(
    resolveTelemetryCorrelationValue(`${em}${cleanRequestId}${em}`, "missing_request_id"),
    "missing_request_id"
  );

  assert.equal(`${nbsp}${cleanRestaurantId}${nbsp}`.trim(), cleanRestaurantId);
  assert.equal(
    canonicalizeTelemetryCorrelationValue(`${nbsp}${cleanRestaurantId}${nbsp}`),
    null
  );
  assert.equal(
    resolveTelemetryCorrelationValue(
      `${nbsp}${cleanRestaurantId}${nbsp}`,
      TELEMETRY_NOT_APPLICABLE
    ),
    TELEMETRY_NOT_APPLICABLE
  );

  assert.equal(
    canonicalizeTelemetryCorrelationValue(`${cleanRequestId}\u0000`),
    null
  );
  assert.equal(
    canonicalizeTelemetryCorrelationValue(`a${"b".repeat(128)}`),
    null
  );

  const invented = buildTelemetryCorrelation({
    environment: `${em}staging${em}`,
    release: `${nbsp}mise-mobile@0.1.0+42${nbsp}`,
    operation: `${em}inventory_event_submit${em}`,
    requestId: `${em}${cleanRequestId}${em}`,
    operationId: `${nbsp}operation-123${nbsp}`,
    restaurantId: `${em}${cleanRestaurantId}${em}`,
    authoritativeEventId: `${nbsp}event-123${nbsp}`
  });
  assert.equal(invented.app_env, "unknown");
  assert.equal(invented.release, "unversioned");
  assert.equal(invented.operation, "unknown_operation");
  assert.equal(invented.request_id, "missing_request_id");
  assert.equal(invented.operation_id, "missing_operation_id");
  assert.equal(invented.restaurant_id, TELEMETRY_NOT_APPLICABLE);
  assert.equal(invented.authoritative_event_id, TELEMETRY_NOT_APPLICABLE);

  // Secret-like and pattern-invalid values still fall back (prior contract).
  assert.equal(
    resolveTelemetryCorrelationValue("service_role_secret", "unversioned"),
    "unversioned"
  );
  assert.equal(
    resolveTelemetryCorrelationValue("token=raw", "missing_operation_id"),
    "missing_operation_id"
  );
  assert.equal(
    resolveTelemetryCorrelationValue("has space", "unknown_operation"),
    "unknown_operation"
  );
});

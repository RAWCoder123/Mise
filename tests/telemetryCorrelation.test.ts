import assert from "node:assert/strict";
import test from "node:test";

import {
  EXTERNAL_ERROR_MESSAGE,
  buildTelemetryCorrelation
} from "../services/domain/telemetrySecurity";
import { redactSentryEvent } from "../services/telemetry";

test("telemetry correlation is complete, bounded, and secret rejecting", () => {
  assert.deepEqual(
    buildTelemetryCorrelation({
      environment: "staging",
      release: "mise-mobile@0.1.0+42",
      operation: "inventory_event_submit",
      requestId: "request-123",
      operationId: "operation-123",
      restaurantId: "00000000-0000-4000-8000-000000000001",
      authoritativeEventId: "event-123"
    }),
    {
      app_env: "staging",
      release: "mise-mobile@0.1.0+42",
      operation: "inventory_event_submit",
      request_id: "request-123",
      operation_id: "operation-123",
      restaurant_id: "00000000-0000-4000-8000-000000000001",
      authoritative_event_id: "event-123"
    }
  );

  const rejected = buildTelemetryCorrelation({
    environment: "production",
    release: "service_role_secret",
    operation: "password_reset",
    requestId: "",
    operationId: "token=raw",
    restaurantId: undefined,
    authoritativeEventId: undefined
  });
  assert.equal(rejected.release, "unversioned");
  assert.equal(rejected.operation, "unknown_operation");
  assert.equal(rejected.request_id, "missing_request_id");
  assert.equal(rejected.operation_id, "missing_operation_id");
  assert.equal(rejected.restaurant_id, "not_applicable");
  assert.equal(rejected.authoritative_event_id, "not_applicable");
});

test("Sentry beforeSend emits only the bounded allowlist and removes raw SDK context", () => {
  const redacted = redactSentryEvent({
    level: "error",
    exception: {
      values: [{ type: "DatabaseError", value: "password=do-not-send" }]
    },
    tags: {
      app_env: "staging",
      authorization: "Bearer secret"
    },
    extra: {
      restaurant_id: "restaurant-1",
      api_key: "do-not-send",
      detail: "operator@example.com",
      restaurant_name: "Golden China"
    },
    contexts: {
      operation: {
        operation_id: "operation-1",
        cookie: "do-not-send"
      }
    },
    environment: "staging",
    release: "release-1",
    user: { email: "operator@example.com" },
    request: { url: "https://example.com?token=secret" },
    breadcrumbs: [{ message: "password=secret" }],
    message: "raw exception password=secret"
  });

  assert.deepEqual(redacted.exception?.values, [
    { type: "DatabaseError", value: EXTERNAL_ERROR_MESSAGE }
  ]);
  assert.equal(redacted.tags?.authorization, "[redacted]");
  assert.equal(redacted.extra?.api_key, "[redacted]");
  assert.equal(redacted.extra?.detail, "[redacted]");
  assert.equal(redacted.extra?.restaurant_name, "[redacted]");
  assert.equal(redacted.contexts, undefined);
  assert.equal("user" in redacted, false);
  assert.equal("request" in redacted, false);
  assert.equal("breadcrumbs" in redacted, false);
  assert.equal("message" in redacted, false);
});

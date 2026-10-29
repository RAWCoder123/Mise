import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimEdgeSentryContextString,
  canonicalizeEdgeSentryContextString,
  normalizeEdgeSentryContextString
} from "../services/domain/edgeSentryContextIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/edgeSentryContextIdentity.ts", import.meta.url),
  "utf8"
);
const miseSource = readFileSync(
  new URL("../supabase/functions/_shared/mise.ts", import.meta.url),
  "utf8"
);

const requestId = "req_abc123";
const operationId = "op_reservation_42";
const operation = "sync_pos_sales";
const accentedOperation = "sync_Café_sales";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005TS pins Edge Sentry safeContextString to ASCII C", () => {
  assert.match(identitySource, /MISE-005TS/);
  assert.match(miseSource, /MISE-005TS/);

  assert.match(
    identitySource,
    /export function asciiTrimEdgeSentryContextString\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    miseSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/edgeSentryContextIdentity\.ts"/
  );
  assert.match(miseSource, /normalizeEdgeSentryContextString\(/);

  const helperStart = miseSource.indexOf("function safeContextString(");
  const helperEnd = miseSource.indexOf("export const structuredInsightContract");
  assert.ok(helperStart > 0 && helperEnd > helperStart);
  const helperBody = miseSource.slice(helperStart, helperEnd);
  assert.match(helperBody, /normalizeEdgeSentryContextString\(/);
  assert.doesNotMatch(helperBody, /value\.trim\(\)/);

  // Leave sibling telemetry / Sentry contracts alone for separate tips.
  assert.match(miseSource, /buildTelemetryCorrelation\(/);
  assert.match(miseSource, /sanitizeTelemetryRecord\(/);
  assert.match(miseSource, /safeExternalError\(/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /telemetryCorrelationIdentity/);
  assert.doesNotMatch(identityCode, /activityEvents/);
  assert.doesNotMatch(identityCode, /squareOAuthAccessRefreshTokenIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /recalculationDescribeErrorIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Edge Sentry capture-context tokens stable", () => {
  assert.equal(asciiTrimEdgeSentryContextString(`  ${requestId}  `), requestId);
  assert.equal(asciiTrimEdgeSentryContextString(`\t${operationId}\n`), operationId);
  assert.equal(canonicalizeEdgeSentryContextString(`  ${operation}  `), operation);
  assert.equal(normalizeEdgeSentryContextString(`  ${requestId}  `), requestId);

  assert.equal(normalizeEdgeSentryContextString(accentedOperation), accentedOperation);
  assert.equal(canonicalizeEdgeSentryContextString(accentedOperation), accentedOperation);

  // Inventing proof baseline: Unicode trim would clean em-space padding.
  assert.equal(`${em}${requestId}${em}`.trim(), requestId);
  assert.equal(`${nbsp}${operation}${nbsp}`.trim(), operation);
});

test("Unicode em-space / NBSP padding cannot invent clean Edge Sentry context tokens", () => {
  const paddedRequest = `${em}${requestId}${em}`;
  const nbspRequest = `${nbsp}${requestId}${nbsp}`;
  const paddedOperation = `${em}${operation}${em}`;
  const nbspOperation = `${nbsp}${operation}${nbsp}`;

  assert.equal(paddedRequest.trim(), requestId);
  assert.equal(nbspRequest.trim(), requestId);
  assert.equal(paddedOperation.trim(), operation);
  assert.equal(nbspOperation.trim(), operation);

  assert.equal(asciiTrimEdgeSentryContextString(paddedRequest), paddedRequest);
  assert.equal(asciiTrimEdgeSentryContextString(nbspRequest), nbspRequest);
  assert.equal(canonicalizeEdgeSentryContextString(paddedRequest), null);
  assert.equal(canonicalizeEdgeSentryContextString(nbspRequest), null);
  assert.equal(normalizeEdgeSentryContextString(paddedRequest), null);
  assert.equal(normalizeEdgeSentryContextString(nbspRequest), null);
  assert.equal(normalizeEdgeSentryContextString(paddedOperation), null);
  assert.equal(normalizeEdgeSentryContextString(nbspOperation), null);
});

test("Soft empty / unsafe Edge Sentry capture-context tokens stay fail-closed", () => {
  assert.equal(normalizeEdgeSentryContextString(null), null);
  assert.equal(normalizeEdgeSentryContextString(undefined), null);
  assert.equal(normalizeEdgeSentryContextString(""), null);
  assert.equal(normalizeEdgeSentryContextString("   "), null);
  assert.equal(normalizeEdgeSentryContextString(em), null);
  assert.equal(normalizeEdgeSentryContextString(nbsp), null);
  assert.equal(normalizeEdgeSentryContextString(42), null);
  assert.equal(normalizeEdgeSentryContextString({ requestId }), null);

  assert.equal(normalizeEdgeSentryContextString(`\u0000${requestId}`), null);
  assert.equal(normalizeEdgeSentryContextString(`${requestId}\u007f`), null);
  assert.equal(
    normalizeEdgeSentryContextString(`x${"y".repeat(256)}`),
    null
  );

  // Capture helper preserves prior undefined soft-empty contract for ?? fallbacks.
  assert.match(
    miseSource,
    /normalizeEdgeSentryContextString\(value\) \?\? undefined/
  );
});

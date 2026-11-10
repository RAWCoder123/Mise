import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { catalogs } from "../i18n/catalog";
import {
  asciiTrimInventoryOutboxResolutionReason,
  canonicalizeInventoryOutboxResolutionReason,
  normalizeInventoryOutboxResolutionReason,
  resolveInventoryOutboxResolutionReasonMessageKey
} from "../services/domain/presentationInventoryOutboxResolutionReasonIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInventoryOutboxResolutionReasonIdentity.ts", import.meta.url),
  "utf8"
);
const inventoryDetailSource = readFileSync(
  new URL("../app/inventory/[id].tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const dailyBriefSource = readFileSync(
  new URL("../components/dailyBrief/DailyBriefBoard.tsx", import.meta.url),
  "utf8"
);

const em = "\u2003";
const nbsp = "\u00a0";
const knownReason = "network_retry";

test("MISE-005ABS pins inventory outbox resolutionReason presentation to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABS/);
  assert.match(inventoryDetailSource, /MISE-005ABS/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryOutboxResolutionReason\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    inventoryDetailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInventoryOutboxResolutionReasonIdentity"/
  );
  assert.match(inventoryDetailSource, /resolveInventoryOutboxResolutionReasonMessageKey\(/);
  assert.match(
    inventoryDetailSource,
    /t\("inventory\.ops\.queue\.reason", \{\s*reason: t\(resolutionReasonKey\)/
  );
  assert.doesNotMatch(
    inventoryDetailSource,
    /t\("inventory\.ops\.queue\.reason", \{\s*reason: entry\.resolutionReason/
  );

  // Leave Daily Brief finding-decision resolutionReason status gating alone.
  assert.match(
    dailyBriefSource,
    /entry\.status === "pending" && entry\.resolutionReason/
  );

  assert.match(catalogSource, /"inventory\.ops\.queue\.reasonCode\.network_retry"/);
  assert.match(catalogSource, /"inventory\.ops\.queue\.reasonCode\.unknown"/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationFindingDecision/);
  assert.match(identitySource, /^import type \{ MessageKey \} from "\.\.\/\.\.\/i18n\/catalog";$/m);
});

test("ASCII C prep keeps ordinary inventory outbox resolution reasons stable", () => {
  assert.equal(asciiTrimInventoryOutboxResolutionReason(`  ${knownReason}  `), knownReason);
  assert.equal(asciiTrimInventoryOutboxResolutionReason(`\t${knownReason}\n`), knownReason);
  assert.equal(canonicalizeInventoryOutboxResolutionReason(`  ${knownReason}  `), knownReason);
  assert.equal(normalizeInventoryOutboxResolutionReason(`  ${knownReason}  `), knownReason);
  assert.equal(
    resolveInventoryOutboxResolutionReasonMessageKey(knownReason),
    "inventory.ops.queue.reasonCode.network_retry"
  );
  assert.equal(
    resolveInventoryOutboxResolutionReasonMessageKey("server_deduplicated"),
    "inventory.ops.queue.reasonCode.server_deduplicated"
  );
  assert.equal(
    resolveInventoryOutboxResolutionReasonMessageKey("future_dated_count"),
    "inventory.ops.queue.reasonCode.future_dated_count"
  );
});

test("Unicode-only space cannot invent blank-looking inventory outbox reason chrome", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";

  // Prior always-pass path: truthy Unicode-only space still chose Reason: {reason}.
  assert.equal(Boolean(unicodeOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.notEqual(unicodeOnly, "");

  // Soft-null / unknown path: non-empty unsafe tokens localize to unknown,
  // empty/null keep attempts fallback (resolve → null).
  assert.equal(
    resolveInventoryOutboxResolutionReasonMessageKey(unicodeOnly),
    "inventory.ops.queue.reasonCode.unknown"
  );
  assert.equal(
    resolveInventoryOutboxResolutionReasonMessageKey(nbspOnly),
    "inventory.ops.queue.reasonCode.unknown"
  );
  assert.equal(resolveInventoryOutboxResolutionReasonMessageKey(empty), null);
  assert.equal(resolveInventoryOutboxResolutionReasonMessageKey(null), null);
  assert.equal(resolveInventoryOutboxResolutionReasonMessageKey(undefined), null);
  assert.equal(normalizeInventoryOutboxResolutionReason(unicodeOnly), null);
  assert.equal(normalizeInventoryOutboxResolutionReason("   "), null);
});

test("Unicode em-space / NBSP padding cannot invent clean inventory outbox reason tokens", () => {
  const padded = `${em}${knownReason}${em}`;
  const nbspReason = `${nbsp}${knownReason}${nbsp}`;

  assert.equal(padded.trim(), knownReason);
  assert.equal(nbspReason.trim(), knownReason);
  assert.equal(Boolean(padded), true);

  assert.equal(asciiTrimInventoryOutboxResolutionReason(padded), padded);
  assert.equal(canonicalizeInventoryOutboxResolutionReason(padded), null);
  assert.equal(normalizeInventoryOutboxResolutionReason(padded), null);
  assert.equal(
    resolveInventoryOutboxResolutionReasonMessageKey(padded),
    "inventory.ops.queue.reasonCode.unknown"
  );
  assert.equal(
    resolveInventoryOutboxResolutionReasonMessageKey(nbspReason),
    "inventory.ops.queue.reasonCode.unknown"
  );
});

test("unknown, control-bearing, and non-allowlisted reasons fail closed to localized unknown", () => {
  assert.equal(
    resolveInventoryOutboxResolutionReasonMessageKey("not_a_real_reason"),
    "inventory.ops.queue.reasonCode.unknown"
  );
  assert.equal(
    resolveInventoryOutboxResolutionReasonMessageKey(`\u0001${knownReason}`),
    "inventory.ops.queue.reasonCode.unknown"
  );
  assert.equal(
    resolveInventoryOutboxResolutionReasonMessageKey(`${knownReason}\u0007`),
    "inventory.ops.queue.reasonCode.unknown"
  );
  assert.equal(
    resolveInventoryOutboxResolutionReasonMessageKey(123 as unknown as string),
    "inventory.ops.queue.reasonCode.unknown"
  );
  // Trailing ASCII tab trims clean for allowlisted tokens.
  assert.equal(
    resolveInventoryOutboxResolutionReasonMessageKey(`${knownReason}\t`),
    "inventory.ops.queue.reasonCode.network_retry"
  );
  assert.equal(normalizeInventoryOutboxResolutionReason("Network_Retry"), null);
  assert.equal(normalizeInventoryOutboxResolutionReason("network-retry"), null);
});

test("EN / ES / zh-Hans catalogs carry localized inventory outbox reason codes", () => {
  const keys = [
    "inventory.ops.queue.reasonCode.network_retry",
    "inventory.ops.queue.reasonCode.server_deduplicated",
    "inventory.ops.queue.reasonCode.idempotency_payload_mismatch",
    "inventory.ops.queue.reasonCode.unknown"
  ] as const;

  for (const key of keys) {
    assert.equal(typeof catalogs.en[key], "string");
    assert.equal(typeof catalogs.es[key], "string");
    assert.equal(typeof catalogs["zh-Hans"][key], "string");
    assert.notEqual(catalogs.en[key].trim(), "");
    assert.notEqual(catalogs.es[key].trim(), "");
    assert.notEqual(catalogs["zh-Hans"][key].trim(), "");
    // Localized copy must not echo the machine token.
    assert.doesNotMatch(catalogs.en[key], /network_retry|idempotency_payload_mismatch/);
  }

  assert.match(catalogs.en["inventory.ops.queue.reasonCode.network_retry"], /Network retry/i);
  assert.match(catalogs.es["inventory.ops.queue.reasonCode.network_retry"], /Reintento/i);
  assert.match(catalogs["zh-Hans"]["inventory.ops.queue.reasonCode.network_retry"], /重试/);
});
